/* eslint-disable no-undef */
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { body, validationResult } from "express-validator";
import axios from "axios";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import fs from "fs";
import chalk from "chalk";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Anthropic from "@anthropic-ai/sdk";
import {
  GoogleGenAI,
  Modality,
  createPartFromUri,
  createUserContent,
} from "@google/genai";
import OpenAI, { toFile } from "openai";
import { RealtimeRelay } from "./relay.js";
import Config from "./config.js";
import dayjs from "dayjs";
import { extension } from "mime-types";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createClient } from "redis";
import { randomBytes } from "crypto";

// Create a Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

await redisClient.connect();

//Express server to handle client requests
const app = express();
const port = 8080;

// Trust the first proxy (Cloudflare)
app.set("trust proxy", Config.serverBehindCloudflare);

app.use(cors({ origin: Config.clientDomains }));
app.use(helmet());
app.use(bodyParser.json({ limit: "25mb" }));

// Apply the rate limiting middleware to all requests
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  keyGenerator: (req) => req.headers["cf-connecting-ip"] || req.ip,
});

const slowLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 50,
  keyGenerator: (req) => req.headers["cf-connecting-ip"] || req.ip,
});

app.use(limiter);
app.use("/chkshr", slowLimiter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Bad Request" });
});

//.env file containing the API keys
dotenv.config({ path: path.join(process.cwd(), ".env") });

//Realtime Relay
const relay = new RealtimeRelay(process.env["OPENAI_API_KEY"]);
relay.listen(8081);

const chatHistoryDir = path.join(process.cwd(), "chat-histories");
const imgOutputDir = path.join(process.cwd(), "img-output");

if (!fs.existsSync(chatHistoryDir)) {
  fs.mkdirSync(chatHistoryDir);
}

if (!fs.existsSync(imgOutputDir)) {
  fs.mkdirSync(imgOutputDir);
}

//Read the chat history for a specific user
async function readChatHistory(username) {
  const redisKey = `chat:${username}`;
  console.log("[readChatHistory] Looking up key:", redisKey);

  try {
    const data = await redisClient.get(redisKey);
    //console.log(
    //  "[readChatHistory] Raw data from Redis:",
    //  data ? "FOUND" : "NOT FOUND"
    //);

    if (!data) {
      console.log("[readChatHistory] No history found, returning {}");
      return {};
    }

    const parsed = JSON.parse(data);
    //console.log("[readChatHistory] Parsed keys:", Object.keys(parsed));

    // Refresh TTL (30 days)
    await redisClient.expire(redisKey, 60 * 60 * 24 * 30);

    return parsed;
  } catch (error) {
    console.error(`Error reading chat history for ${username}:`, error);
    return {};
  }
}

// Helper function to parse date strings
function parseDate(dateString) {
  // Split the date string into components
  const [datePart, timePart] = dateString.split(" ");
  const [day, month, year] = datePart.split("/");
  const [hours, minutes, seconds] = timePart.split(":");

  // Create a Date object (note: month is 0-indexed in JavaScript Date)
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

//Read chats for the given chatId
function getChatsByChatId(database, chatId) {
  try {
    return Object.entries(database)
      .filter(
        ([key, item]) =>
          key.startsWith("i_") &&
          item &&
          typeof item === "object" &&
          item.u === chatId
      )
      .map(([_, item]) => item)
      .sort((a, b) => {
        const dateA = parseDate(a.d);
        const dateB = parseDate(b.d);
        if (isNaN(dateA) && isNaN(dateB)) return 0;
        if (isNaN(dateA)) return 1;
        if (isNaN(dateB)) return -1;
        return dateA - dateB;
      });
  } catch (error) {
    console.error("Error parsing chat history:", error);
    return [];
  }
}

// Function to log chat events
async function logChatEvent(username, data, context = null, thread = null) {
  const redisKey = `chat:${username}`;
  try {
    // Read existing history
    let chatHistory = await readChatHistory(username);

    // Add the new chat record
    const key = `i_${Object.keys(chatHistory).length}`;
    chatHistory[key] = { ...data };

    // Add optional context
    if (context) {
      const contextKey = `c_${Object.keys(chatHistory).length}`;
      chatHistory[contextKey] = context;
    }

    // Add optional thread
    if (thread) {
      const threadKey = `t_${Object.keys(chatHistory).length}`;
      chatHistory[threadKey] = thread;
    }

    // Save back to Redis & reset TTL to 30 days
    await redisClient.set(redisKey, JSON.stringify(chatHistory), {
      EX: 60 * 60 * 24 * 30, // 30 days
    });
  } catch (error) {
    console.error(`Error logging chat event for ${username}:`, error);
  }
}

//Shareable links to historical chats
const validateShare = [
  body("shareToken").isString().isLength({ min: 32, max: 64 }),
];

app.post("/chkshr", validateShare, async (req, res) => {
  const { shareToken } = req.body;
  const redisKey = `share:${shareToken}`;
  const data = await redisClient.get(redisKey);

  if (!data)
    return res.status(404).json({ error: "Invalid or expired share token" });

  const { user, chatId } = JSON.parse(data);
  const userChatHistory = await readChatHistory(user);
  const chatHistory = getChatsByChatId(userChatHistory, chatId);

  res.send(chatHistory);
});

//Heartbeat: Clients ping this /check URL every few seconds seconds
app.post("/check", async (req, res) => {
  res.send("ok");
});

// Function to authenticate passphrase
const verifyPassphrase = async (plainPassphrase, hashedPassphrase) => {
  const match = await bcrypt.compare(plainPassphrase, hashedPassphrase);
  return match;
};

// Function to generate a token
const generateToken = (userId) => {
  const token = jwt.sign({ userId }, process.env["SECRET_RANDOM"], {
    expiresIn: "1d",
  });
  return token;
};

const validateCheckin = [
  body("serverUsername")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Username cannot be empty.")
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage(
      "Username can only contain letters, numbers, underscores, and hyphens."
    ),

  body("serverPassphrase")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Passphrase cannot be empty."),

  body("sessionHash").isString().trim(),
];

const activeSessions = new Map();

//Client check-in
app.post("/checkin", validateCheckin, async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(errors);
    return res.status(400).json({ error: "Bad Request" });
  }

  const clientIp =
    req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip;
  const agent = req.headers["user-agent"];
  const origin = req.headers.origin;
  const sessionHash = req.body.sessionHash;

  const sentPhrase = req.body.serverPassphrase;
  const serverUsername = req.body.serverUsername;

  let passphraseData;

  try {
    passphraseData = JSON.parse(process.env["LLM_CHATTER_PASSPHRASE"]);
  } catch (e) {
    return res.status(400).json({ error: "Bad Request" });
  }
  // Check if the username exists and passphrase matches
  let checkPass = false;
  let userName = "Unknown";

  // Find the user with the matching name
  const user = passphraseData.users.find((u) => u.name === serverUsername);

  if (user) {
    const isValid = await verifyPassphrase(sentPhrase, user.value);
    if (isValid) {
      checkPass = true;
      userName = user.name;
    }
  }
  if (!checkPass) {
    console.log(
      chalk.cyan(
        "\nAuthentication failed." +
          "\nUsername: " +
          serverUsername +
          "\nSource (Origin): " +
          origin +
          "\nConnector's Address (IP): " +
          clientIp +
          "\n"
      )
    );

    return res.status(400).json({ error: "Authentication Failure" });
  }

  const token = generateToken(sessionHash);

  // Store user session information
  activeSessions.set(token, {
    userName,
    clientIp,
    agent,
    origin,
    sessionHash,
    createdAt: new Date(),
  });

  console.log(
    chalk.cyan(
      "\nClient checked in." +
        "\nUser: " +
        userName +
        "\nSource: " +
        origin +
        "\nConnector IP: " +
        clientIp +
        "\nUser-Agent: " +
        agent +
        "\n"
    )
  );
  //console.log("[/checkin] Authenticated user:", userName);

  const userChatHistory = await readChatHistory(userName);
  //console.log(
  //  "[/checkin] Chat history keys sent to client:",
  //  Object.keys(userChatHistory)
  //);
  res.json({ token, userChatHistory });
});

const validateInput = [
  // Validation checks
  body("uniqueChatID").optional().isString().trim(),
  body("model").optional().isString().trim(),
  body("prompt").optional().isString().trim(),
  body("system").optional().isString().trim(),
  body("imgSize").optional().isString().trim(),
  body("imgQuality").optional().isString().trim(),
  body("thread").optional().isArray(),
  body("context").optional().isArray(),
  body("options.temperature").optional().isFloat({ min: 0, max: 1 }),
  body("options.top_p").optional().isFloat({ min: 0, max: 1 }),
  body("options.top_k").optional().isFloat({ min: 1, max: 20 }),
  body("temperature").optional().isFloat({ min: 0, max: 1 }),
  body("top_p").optional().isFloat({ min: 0, max: 1 }),
  body("top_k").optional().isFloat({ min: 1, max: 20 }),
  body("imgInput").optional().isBoolean(),
  body("imgOutput").optional().isBoolean(),
  body("sentOne").optional().isBoolean(),
  body("stream").optional().isBoolean(),
  body("keep_alive").optional().isInt({ min: 0 }),
  body("messages").optional().isArray(),
  body("images").optional().isArray(),
  body("chatId").optional().isString().trim(),

  // Middleware function to handle validation and token verification
  (req, res, next) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: "Bad Request" });
    }
    // Verify token
    let token;
    if (req.query.token) {
      token = req.query.token;
    } else {
      token = req.headers["authorization"]?.split(" ")[1]; // Bearer token scheme
    }

    if (!token || !activeSessions.has(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // If both validation and token verification succeed, proceed
    next();
  },
];

//Client requests to re-sync their data
app.post("/sync", validateInput, async (req, res) => {
  const username = req.body.userName;
  console.log("[/sync] Requested by:", username);

  try {
    const userChatHistory = await readChatHistory(username);
    console.log(
      "[/sync] Returning chat history keys:",
      Object.keys(userChatHistory)
    );

    res.send(userChatHistory);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Client Sync Error" });
  }
});

//Model Context Protocol (MCP)
const server = new McpServer({
  name: "llm-chatter-mcp",
  version: "1.0.0",
});

const transports = {};

const verifyToken = (req, res, next) => {
  let token;
  if (req.query.token) {
    token = req.query.token;
  } else {
    token = req.headers["authorization"]?.split(" ")[1];
  }
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  // Optionally attach session info to req
  req.session = activeSessions.get(token);
  next();
};

// Generate a Share Token
app.post("/mkshr", async (req, res) => {
  const { chatId, user } = req.body;
  if (!chatId) return res.status(400).json({ error: "Missing chatId" });

  const shareToken = randomBytes(16).toString("hex");
  const redisKey = `share:${shareToken}`;

  // Store mapping to chatId + user
  await redisClient.set(
    redisKey,
    JSON.stringify({
      user: user,
      chatId,
    }),
    { EX: 60 * 60 * 24 * 365 }
  ); // expire in 365 days

  res.json({ shareToken });
});

function extractPromptText(theData, messages) {
  let promptText = (theData.prompt && theData.prompt.trim()) || "";

  // If no prompt yet, scan the last user message for real text (excluding "Image.")
  if (!promptText && Array.isArray(messages) && messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && Array.isArray(lastMessage.content)) {
      const textPart = lastMessage.content.find(
        (part) =>
          part.type === "text" &&
          part.text &&
          part.text.trim() &&
          part.text.trim().toLowerCase() !== "image."
      );
      if (textPart) {
        promptText = textPart.text.trim();
      }
    }
  }

  // If still no prompt, scan earlier messages for any non-empty text (excluding "Image.")
  if (!promptText && Array.isArray(messages)) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m && Array.isArray(m.content)) {
        const part = m.content.find(
          (p) =>
            p.type === "text" &&
            p.text &&
            p.text.trim() &&
            p.text.trim().toLowerCase() !== "image."
        );
        if (part) {
          promptText = part.text.trim();
          break;
        }
      }
    }
  }

  // --- New: detect attachments ---
  let hasImage = false;
  let hasTextFile = false;

  if (Array.isArray(messages)) {
    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        for (const p of msg.content) {
          // Detect image content
          if (
            (p.type === "image" && p.data) ||
            p.type === "image_url" ||
            p.type === "inlineData" ||
            (p.source && p.source.type === "base64")
          ) {
            hasImage = true;
          }
          // Detect attached text/csv file
          if (
            p.type === "text_attachment" || // hypothetical custom type
            (p.mimeType &&
              (p.mimeType.includes("text/plain") ||
                p.mimeType.includes("text/csv")))
          ) {
            hasTextFile = true;
          }
        }
      }
    }
  }

  // If no prompt text but attachments exist
  if (!promptText) {
    if (hasImage && hasTextFile) {
      promptText = "Image + Text File Attached";
    } else if (hasImage) {
      promptText = "Image Attached";
    } else if (hasTextFile) {
      promptText = "Text File Attached";
    }
  } else {
    // If there is prompt text, append attachment info
    if (hasImage && hasTextFile) {
      promptText += " [Image + Text File Attached]";
    } else if (hasImage) {
      promptText += " [Image Attached]";
    } else if (hasTextFile) {
      promptText += " [Text File Attached]";
    }
  }

  return promptText || "N/A";
}

app.get("/sse", verifyToken, async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  await server.connect(transport);
});

app.post("/messages", verifyToken, async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No transport found for sessionId");
  }
});

app.post("/stream", verifyToken, async (req, res) => {
  const { prompt } = req.body;
  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let numba = 0;
  try {
    for (numba = 1; numba <= 20; numba++) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second
      res.write(`data: ${numba}\n\n`);
    }
    res.write("event: end\ndata: [DONE]\n\n");
    res.end();
  } catch (e) {
    res.write(`event: error\ndata: ${JSON.stringify(e.message)}\n\n`);
    res.end();
  }
});

//Client requests the list of local Ollama models
app.post("/getmodels", validateInput, async (req, res) => {
  const clientIp =
    req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip;
  const origin = req.headers["origin"];

  try {
    if (Config.ollamaEnabled) {
      const response = await axios.get("http://localhost:11434/api/tags");

      console.log(
        chalk.cyan("\nSent model list.") +
          "\nSource: " +
          origin +
          "\nConnector IP: " +
          clientIp +
          "\n"
      );

      res.send(response.data.models);
    } else {
      console.error("Ollama disabled on server. Models not sent.");
      res.status(500).json({ error: "Ollama GetModels Error" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Ollama GetModels Error" });
  }
});

//Local Ollama API
app.post("/ollama", validateInput, async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(errors);
    return res.status(400).json({ error: "Bad Request" });
  }

  try {
    const theData = { ...req.body };
    delete theData.uniqueChatID;
    delete theData.sentOne;
    delete theData.serverUsername;
    delete theData.thread;

    const timeNow = dayjs().format(Config.timeFormat);
    const chatId = req.body.uniqueChatID;
    const sent1 = req.body.sentOne;
    const username = req.body.serverUsername;
    const thread = req.body.thread;

    const logData = {
      u: chatId,
      m: theData.model,
      t: theData.options.temperature || 0.8,
      p: theData.options.top_p || 1,
      k: theData.options.top_k || 1,
    };

    if (!sent1 && theData.system && thread.length === 0) {
      logChatEvent(
        username,
        {
          ...logData,
          r: "system",
          d: timeNow,
          z: theData.system,
        },
        [],
        thread
      );
    }

    logChatEvent(
      username,
      {
        ...logData,
        r: "user",
        d: timeNow,
        z: theData.prompt,
      },
      [],
      thread
    );

    const response = await axios.post(
      "http://localhost:11434/api/generate",
      theData,
      { headers: { "Content-Type": "application/json" } }
    );

    res.send(response.data);

    const timestamp = dayjs().format(Config.timeFormat);

    logChatEvent(
      username,
      {
        ...logData,
        r: "assistant",
        d: timestamp,
        z: response.data.response,
      },
      response.data.context,
      thread
    );

    console.log(`
    ${chalk.bgGreen.bold("\n////////////////////////////////////////")}
    ${chalk.underline("Remote IP:")} ${chalk.white(
      req.headers["cf-connecting-ip"] ||
        req.headers["x-forwarded-for"] ||
        req.ip
    )}
    ${chalk.underline("User:")} ${chalk.white(username)}
    ${chalk.blue.bold.underline("Model")}: ${chalk.blue(theData.model)}
    ${chalk.bgGreen.bold("////////////////////////////////////////\n")}
    `);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Ollama Failure" });
  }
});

app.post("/anthropic", validateInput, async (req, res) => {
  //Handle validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors);
    return res.status(400).json({ error: "Bad Request" });
  }

  try {
    const theData = req.body;
    const theMsgs = theData.messages;

    if (!theData.model || !theMsgs) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const anthropic = new Anthropic({
      apiKey: process.env["ANTHROPIC_API_KEY"],
    });

    const timeNow = dayjs().format(Config.timeFormat);
    const chatId = req.body.uniqueChatID;
    const sent1 = req.body.sentOne;
    const username = req.body.serverUsername;

    const logData = {
      u: chatId,
      m: theData.model,
      t: theData.temperature || 0.8,
      p: theData.top_p || 1,
      k: theData.top_k || 1,
    };

    if (!sent1 && theData.system && theData.thread.length === 0) {
      logChatEvent(
        username,
        {
          ...logData,
          r: "system",
          d: timeNow,
          z: theData.system,
        },
        [],
        theData.thread
      );
    }

    const promptText = extractPromptText(theData, theMsgs);

    logChatEvent(
      username,
      {
        ...logData,
        r: "user",
        d: timeNow,
        z: promptText,
      },
      [],
      theData.thread
    );

    const msg = await anthropic.messages.create({
      model: theData.model,
      max_tokens: 10000,
      temperature: theData.temperature,
      top_p: theData.top_p,
      top_k: theData.top_k,
      system: theData.system,
      messages: theMsgs,
    });

    res.status(200).json(msg);

    const timestamp = dayjs().format(Config.timeFormat);

    logChatEvent(
      username,
      {
        ...logData,
        r: "assistant",
        d: timestamp,
        z: msg.content[0].text,
      },
      [], //Context, Ollama only
      theData.thread
    );

    console.log(`
    ${chalk.bgGreen.bold("\n////////////////////////////////////////")}
    ${chalk.underline("Remote IP:")} ${chalk.white(
      req.headers["cf-connecting-ip"] ||
        req.headers["x-forwarded-for"] ||
        req.ip
    )}
    ${chalk.underline("User:")} ${chalk.white(theData.serverUsername)}
    ${chalk.blue.bold.underline("Model")}: ${chalk.blue(theData.model)}
    ${chalk.bgGreen.bold("////////////////////////////////////////\n")}
    `);
  } catch (error) {
    console.error("Error:\n", error);
    res.status(500).json({ error: "Anthropic Failure" });
  }
});

function getExtFromMime(mimeType) {
  return extension(mimeType) || "png";
}

//OpenAI
//Grok
//DeepSeek
//Meta
//Alibaba

//Non-OpenAI need to have baseUrl set
async function makeAIRequest(req, res, apiKeyEnvVar, baseUrl = null) {
  // Handle validation errors
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(errors);
    return res.status(400).json({ error: "Bad Request" });
  }

  try {
    const theData = req.body;
    let { model, messages, temperature, top_p } = req.body;
    let system = messages[0] ? messages[0].content : "";

    // Validate required fields
    if (!model || !messages) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check the model and alter messages if necessary
    if (Config.reasoningModels.includes(model)) {
      // Reasoning models: force certain params
      temperature = 1;
      top_p = 1;
      system = "";

      // Keep all non-system messages, but still include any vision/image parts
      messages = messages.filter((message) => {
        if (message.role !== "system") return true;
        // If system message had any vision/image content, keep it
        if (Array.isArray(message.content)) {
          return message.content.some(
            (p) =>
              p.type === "image" ||
              p.type === "image_url" ||
              p.type === "inlineData" ||
              (p.source && p.source.type === "base64")
          );
        }
        return false;
      });
    }

    const promptText = extractPromptText(theData, messages);

    const timeNow = dayjs().format(Config.timeFormat);
    const chatId = theData.uniqueChatID;
    const sent1 = theData.sentOne;
    const username = theData.serverUsername;
    const streaming = theData.stream ?? false;

    const imgQuality = theData.imgQuality ?? "medium";
    const imgSize = theData.imgSize ?? "1024x1024";
    const imgInput = theData.imgInput ?? false;
    const imgOutput = theData.imgOutput ?? false;
    const isImgGenModel =
      Config.imgGenerationModels.includes(model) && imgOutput;

    if (streaming) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
    }

    let images;
    if (imgInput) {
      const sentImgs = theData.images;

      images = await Promise.all(
        sentImgs.map(async (img) => {
          const imgBuffer = Buffer.from(img.data, "base64");
          return await toFile(
            imgBuffer,
            "upload." + getExtFromMime(img.mimeType),
            {
              type: img.mimeType,
            }
          );
        })
      );
    }

    const logData = {
      u: chatId,
      m: model,
      t: temperature || 0.8,
      p: top_p || 1,
      k: theData.top_k || 1,
    };

    if (!sent1 && system && theData.thread.length === 0) {
      logChatEvent(
        username,
        {
          ...logData,
          r: "system",
          d: timeNow,
          z: system,
        },
        [],
        theData.thread
      );
    }

    logChatEvent(
      username,
      {
        ...logData,
        r: "user",
        d: timeNow,
        z: promptText,
      },
      [],
      theData.thread
    );

    // Set up client with the appropriate API key and optional base URL
    const client = new OpenAI({
      apiKey: process.env[apiKeyEnvVar],
      ...(baseUrl && { baseURL: baseUrl }),
    });

    let response;

    if (isImgGenModel) {
      response = await client.responses.create({
        model,
        input: promptText,
        tools: [
          {
            type: "image_generation",
            size: imgSize,
            quality: imgQuality,
          },
        ],
        //tool_choice: { type: "image_generation" }
      });

      const imageData = response.output
        .filter((output) => output.type === "image_generation_call")
        .map((output) => output.result);

      if (imageData.length > 0) {
        const timestamp = dayjs().format(Config.timeFormat);
        const savedImages = [];
        imageData.forEach((imgB64, idx) => {
          const imgSpecificPath = path.join(
            imgOutputDir,
            `${chatId}_${idx}.jpg`
          );
          fs.writeFileSync(imgSpecificPath, Buffer.from(imgB64, "base64"));
          savedImages.push(imgB64);
        });

        logChatEvent(
          username,
          {
            ...logData,
            r: "assistant",
            d: timestamp,
            z: `Image Output (${imageData.length} file${imageData.length > 1 ? "s" : ""}).`,
          },
          [],
          theData.thread
        );

        res.status(200).json({ base64: savedImages });
      } else {
        res.status(200).json(response);
      }
      return;
    }

    // Make the API call
    response =
      imgOutput && !imgInput
        ? await client.images.generate({
            prompt: promptText,
            model: "gpt-image-1",
            moderation: "low",
            n: 1,
            output_format: "jpeg",
            quality: imgQuality,
            size: imgSize,
          })
        : imgOutput && imgInput
          ? await client.images.edit({
              prompt: promptText,
              model: "gpt-image-1",
              n: 1,
              quality: imgQuality,
              size: imgSize,
              image: images,
            })
          : await client.chat.completions.create({
              model: model,
              temperature: temperature,
              top_p: top_p,
              messages: messages,
              stream: streaming,
            });
    if (imgOutput) {
      const images_base64 = response.data.map((d) => d.b64_json);
      images_base64.forEach((b64, idx) => {
        const image_bytes = Buffer.from(b64, "base64");
        const imgSpecificPath = path.join(imgOutputDir, `${chatId}_${idx}.jpg`);
        fs.writeFileSync(imgSpecificPath, image_bytes);
      });
      res.status(200).json({ base64: images_base64 });
    } else {
      if (streaming) {
        let fullAssistantText = "";
        for await (const chunk of response) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          // Accumulate text
          const content = chunk.choices?.[0]?.delta?.content;
          if (typeof content === "string") {
            fullAssistantText += content;
          }
        }
        res.write("event: end\ndata: [DONE]\n\n");
        res.end();
        const timestamp = dayjs().format(Config.timeFormat);
        logChatEvent(
          username,
          {
            ...logData,
            r: "assistant",
            d: timestamp,
            z: fullAssistantText || "No response content available",
          },
          [], //Context, Ollama only
          theData.thread
        );
      } else {
        res.status(200).json(response);
        const timestamp = dayjs().format(Config.timeFormat);
        if (!imgOutput) {
          logChatEvent(
            username,
            {
              ...logData,
              r: "assistant",
              d: timestamp,
              z:
                response.choices?.[0]?.message?.content ||
                "No response content available",
            },
            [], //Context, Ollama only
            theData.thread
          );
        }
      }
    }

    console.log(`
    ${chalk.bgGreen.bold("\n////////////////////////////////////////")}
    ${chalk.underline("Remote IP:")} ${chalk.white(
      req.headers["cf-connecting-ip"] ||
        req.headers["x-forwarded-for"] ||
        req.ip
    )}
    ${chalk.underline("User:")} ${chalk.white(theData.serverUsername)}
    ${chalk.blue.bold.underline("Model")}: ${chalk.blue(model)}
    ${chalk.bgGreen.bold("////////////////////////////////////////\n")}
    `);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: `API Failure` }); // Generic error message
  }
}
app.post("/openai", validateInput, (req, res) =>
  makeAIRequest(req, res, "OPENAI_API_KEY")
);
app.post("/grok", validateInput, (req, res) =>
  makeAIRequest(req, res, "GROK_API_KEY", "https://api.x.ai/v1")
);
app.post("/deepseek", validateInput, (req, res) =>
  makeAIRequest(req, res, "DEEPSEEK_API_KEY", "https://api.deepseek.com")
);
app.post("/meta", validateInput, (req, res) =>
  makeAIRequest(req, res, "META_API_KEY", "https://api.llama.com/compat/v1")
);
app.post("/alibaba", validateInput, (req, res) =>
  makeAIRequest(
    req,
    res,
    "ALIBABA_API_KEY",
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
  )
);

//Convert function needed here because the Google API handles messages differently than other models
const convertMessages = (messages) => {
  return messages.map((message) => {
    // Change 'assistant' role to 'model' if applicable
    const newRole = message.role === "assistant" ? "model" : message.role;

    return {
      role: newRole,
      parts: message.content.map((contentItem) => ({
        text: contentItem.text,
      })),
    };
  });
};

app.post("/google", validateInput, async (req, res) => {
  // Handle validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors);
    return res.status(400).json({ error: "Bad Request" });
  }

  try {
    const theData = req.body;
    const theMsgs = theData.messages;
    let convertedMsgs = convertMessages(theMsgs);

    if (!theData.model || !theMsgs) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const safetySettings = [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
    ];

    const ai = new GoogleGenAI({ apiKey: process.env["GOOGLE_API_KEY"] });

    const timeNow = dayjs().format(Config.timeFormat);
    const chatId = req.body.uniqueChatID;
    const sent1 = req.body.sentOne;
    const username = req.body.serverUsername;

    const logData = {
      u: chatId,
      m: theData.model,
      t: theData.temperature || 0.8,
      p: theData.top_p || 1,
      k: theData.top_k || 1,
    };

    if (!sent1 && theData.system && theData.thread.length === 0) {
      logChatEvent(
        username,
        {
          ...logData,
          r: "system",
          d: timeNow,
          z: theData.system,
        },
        [],
        theData.thread
      );
    }

    const promptText = extractPromptText(theData, theMsgs);

    logChatEvent(
      username,
      {
        ...logData,
        r: "user",
        d: timeNow,
        z: promptText,
      },
      [],
      theData.thread
    );

    const generationConfig = {
      temperature: theData.temperature,
      topP: theData.top_p,
      topK: theData.top_k,
      maxOutputTokens: 10000,
      safetySettings: safetySettings,
    };

    const imgOutput = theData.imgOutput ?? false;

    if (imgOutput) {
      generationConfig.responseModalities = [Modality.TEXT, Modality.IMAGE];
    }

    const googleImgInput = theData.images;

    if (googleImgInput && googleImgInput.length > 0) {
      try {
        convertedMsgs = [
          {
            inlineData: {
              mimeType: googleImgInput[0].mimeType,
              data: googleImgInput[0].data,
            },
          },
          { text: promptText },
        ];

        // Add the formatted image parts to the *last* message in convertedMsgs
        if (convertedMsgs.length === 0) {
          // Handle case where there are images but no messages
          console.error("Received images but message history is empty.");
          return res
            .status(400)
            .json({ error: "Cannot process images without a prompt message." });
        }
      } catch (imgError) {
        console.error("Error processing image data:", imgError);
        return res.status(400).json({
          error: `Bad Request: Invalid image data - ${imgError.message}`,
        });
      }
    }

    const response = await ai.models.generateContent({
      model: theData.model,
      contents: convertedMsgs,
      config: generationConfig,
    });

    if (imgOutput) {
      const parts = response.candidates[0].content.parts;
      const imagePart = parts.find((p) => p.inlineData);
      if (imagePart) {
        const image_base64 = imagePart.inlineData.data;
        const image_bytes = Buffer.from(image_base64, "base64");
        const imgSpecificPath = path.join(imgOutputDir, `${chatId}.jpg`);
        fs.writeFileSync(imgSpecificPath, image_bytes);

        res.status(200).json({ base64: image_base64 });
      }
    } else {
      const responseText = response.text;
      res.status(200).json(responseText);

      const timestamp = dayjs().format(Config.timeFormat);

      logChatEvent(
        username,
        {
          ...logData,
          r: "assistant",
          d: timestamp,
          z: responseText,
        },
        [], // Context, Ollama only
        theData.thread
      );
    }
    console.log(`
    ${chalk.bgGreen.bold("\n////////////////////////////////////////")}
    ${chalk.underline("Remote IP:")} ${chalk.white(
      req.headers["cf-connecting-ip"] ||
        req.headers["x-forwarded-for"] ||
        req.ip
    )}
    ${chalk.underline("User:")} ${chalk.white(theData.serverUsername)}
    ${chalk.blue.bold.underline("Model")}: ${chalk.blue(theData.model)}
    ${chalk.bgGreen.bold("////////////////////////////////////////\n")}
    `);
  } catch (error) {
    console.error("Error:", error);
    console.log(error);
    if (error.message.includes("overloaded")) {
      return res
        .status(503)
        .json("The model is overloaded. Please try again later.\n");
    } else {
      return res.status(500).json({ error: "An unexpected error occurred." }); // More generic error message
    }
  }
});

//Express server
app.listen(port, () => {
  console.log(
    `\n\nServer running at http://localhost:${port}\n` +
      chalk.bgCyan.bold("////////////////////////////////////////\n")
  );
});
