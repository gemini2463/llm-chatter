// This file contains the configuration for the app.

const openAIModels = [
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-5-chat-latest",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-image-1",
  "chatgpt-4o-latest",
  "o1",
  "o1-mini",
  //"o1-pro",
  "o3",
  "o3-mini",
  //"o3-pro",
  //"o3-deep-research",
  //"o4-mini-deep-research",
  "o4-mini",
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-3.5-turbo",
];

const anthropicModels = [
  "claude-opus-4-20250514",
  "claude-sonnet-4-20250514",
  "claude-3-7-sonnet-20250219",
  //"claude-3-5-sonnet-20241022",
  //"claude-3-5-haiku-20241022",
  //"claude-3-opus-20240229",
  //"claude-3-sonnet-20240229",
  //"claude-3-haiku-20240307",
];

const googleModels = [
  "gemini-2.5-pro-preview-06-05",
  "gemini-2.5-flash-preview-05-20",
  "gemini-2.0-flash",
  "gemini-2.0-flash-preview-image-generation",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

const grokModels = [
  "grok-4",
  "grok-3",
  "grok-3-fast",
  "grok-3-mini",
  "grok-3-mini-fast",
  "grok-2",
  "grok-2-vision",
];

const metaModels = [
  "Llama-4-Scout-17B-16E-Instruct-FP8",
  "Llama-4-Maverick-17B-128E-Instruct-FP8",
  "Llama-3.3-70B-Instruct",
  "Llama-3.3-8B-Instruct",
];

const deepseekModels = [
  "deepseek-chat", //DeepSeek-V3
  "deepseek-reasoner", //DeepSeek-R1
];

const alibabaModels = [
  "qwen-turbo",
  "qwen-max",
  "qwen-plus",
  //"qwen2-7b-instruct",
];

const mcpModels = ["Qwen/Qwen2.5-72B-Instruct"];

const Config = {
  //serverURL: "http://localhost:8080",
  //relayURL: "http://localhost:8081",
  //serverURL: "https://x.rossu.dev",
  //relayURL: "https://x.rossu.dev/relay",
  serverURL: "https://ai.rossu.dev",
  relayURL: "https://ai.rossu.dev/relay",
  //serverURL: "https://ai.activehost.pro",
  //relayURL: "https://ai.activehost.pro/relay",

  ollamaEnabled: true,

  temperature: "0.8",
  topp: "1",
  topk: "1",

  sysMsg:
    "Begin with a concise checklist (3-7 bullets) outlining the conceptual steps you will take before proceeding through the problem step by step to ensure an accurate and thorough solution.",

  defaultChatType: "OpenAI",
  defaultModel: { name: "gpt-5-chat-latest" },

  models: {
    openAI: openAIModels,
    anthropic: anthropicModels,
    google: googleModels,
    grok: grokModels,
    deepseek: deepseekModels,
    meta: metaModels,
    alibaba: alibabaModels,
  },

  reasoningModels: [
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "o1",
    "o1-mini",
    //"o1-pro",
    "o3",
    "o3-mini",
    "o4-mini",
    //"o3-pro",
    //"o3-deep-research",
    //"o4-mini-deep-research"
  ],

  visionModels: [
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-5-chat-latest",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "chatgpt-4o-latest",
    "o1",
    "o1-pro",
    "o3",
    "o3-pro",
    "o3-deep-research",
    "o4-mini-deep-research",
    "o4-mini",
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-image-1",
    "claude-opus-4-20250514",
    "claude-sonnet-4-20250514",
    "claude-3-7-sonnet-20250219",
    //"claude-3-5-sonnet-20241022",
    //"claude-3-5-haiku-20241022",
    //"claude-3-opus-20240229",
    //"claude-3-sonnet-20240229",
    //"claude-3-haiku-20240307",
    "gemini-2.5-pro-preview-06-05",
    "gemini-2.5-flash-preview-05-20",
    "gemini-2.0-flash",
    "gemini-2.0-flash-preview-image-generation",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "grok-4",
    "grok-2-vision",
    "Llama-4-Scout-17B-16E-Instruct-FP8",
    "Llama-4-Maverick-17B-128E-Instruct-FP8",
    "granite3.2-vision:latest",
    "llava-phi3:latest",
    "bakllava:latest",
    "moondream:latest",
    "llava-llama3:latest",
    "minicpm-v:latest",
    "llama3.2-vision:latest",
    "llama3.2-vision:11b",
    "llama3.2-vision:90b",
    "llava:latest",
    "llava:7b",
    "llava:13b",
    "llava:34b",
    "gemma3:latest",
    "gemma3:1b",
    "gemma3:4b",
    "gemma3:12b",
    "gemma3:27b",
  ],

  imgGenerationModels: [
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4o",
    "gpt-4o-mini",
    "o3",
  ],

  imgOutputModels: ["gpt-image-1", "gemini-2.0-flash-preview-image-generation"],
};

export default Config;
