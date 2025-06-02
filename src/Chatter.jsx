import {
  useRef,
  useState,
  useCallback,
  createContext,
  useMemo,
  useEffect,
} from "react";
import { animated, Spring } from "react-spring";
import TextareaAutosize from "react-textarea-autosize";
import { randomBytes } from "crypto";
import axios from "axios";
import debounce from "lodash/debounce";
import { v4 as uuidv4 } from "uuid";
import Chat from "./components/Chat.jsx";
import ChatHistory from "./components/ChatHistory.jsx";
import { ConsolePage } from "./console/ConsolePage.jsx";
import Config from "./Config.jsx";
import Cookies from "js-cookie";

export const dataContext = createContext();

function Chatter() {
  const modelSets = {};
  Object.entries(Config.models).forEach(([provider, models]) => {
    modelSets[provider] = models.map((name) => ({ name }));
  });

  const {
    openAI: openAImodels,
    anthropic: anthropicAImodels,
    google: googleAImodels,
    grok: grokAImodels,
    deepseek: deepseekAImodels,
    meta: metaAImodels,
  } = modelSets;

  //Which model type is chosen by default

  const [chatType, setChatType] = useState(Config.defaultChatType);
  const [model, setModel] = useState(Config.defaultModel);
  const [listModels, setListModels] = useState(openAImodels);

  //Other defaults

  const [serverPassphrase, setServerPassphrase] = useState("");
  const [serverURL, setServerURL] = useState(Config.serverURL);
  const [relayWS, setRelayWS] = useState(Config.relayURL);
  const [temperature, setTemperature] = useState(Config.temperature);
  const [topp, setTopp] = useState(Config.topp);
  const [topk, setTopk] = useState(Config.topk);

  //Don't touch the rest of these.

  const [sysMsg, setSysMsg] = useState(() => {
    const cookieSysMsg = JSON.parse(localStorage.getItem("sysMsg"));
    return cookieSysMsg ? cookieSysMsg : Config.sysMsg;
  });

  const [serverUsername, setServerUsername] = useState(() => {
    const cookieUsername = Cookies.get("serverUsername");
    return cookieUsername ? JSON.parse(cookieUsername) : "";
  });

  const [clientJWT, setClientJWT] = useState(() => {
    const cookieJWT = Cookies.get("clientJWT");
    return cookieJWT ? JSON.parse(cookieJWT) : "";
  });

  const [checkedIn, setCheckedIn] = useState(() => {
    const cookieCheckedIn = Cookies.get("checkedIn");
    return cookieCheckedIn ? JSON.parse(cookieCheckedIn) : false;
  });

  const [localModels, setLocalModels] = useState(() => {
    const cookieModels = JSON.parse(localStorage.getItem("localModels"));
    return cookieModels ? cookieModels : [];
  });

  const [chosenOllama, setChosenOllama] = useState(() => {
    const cookieOllama = Cookies.get("chosenOllama");
    return cookieOllama ? JSON.parse(cookieOllama) : localModels[0];
  });

  const [chatHistory, setChatHistory] = useState(() => {
    const cookieHistory = JSON.parse(localStorage.getItem("chatHistory"));
    return cookieHistory ? cookieHistory : {};
  });

  const [sessionHash, setSessionHash] = useState("");
  const [componentList, setComponentList] = useState([]);
  const [advancedSetting, setAdvancedSetting] = useState(false);
  const [serverCheck, setServerCheck] = useState(false);
  const [signInAttempted, setSignInAttempted] = useState(false);
  const [chatCount, setChatCount] = useState(1);
  const [chosenAnthropic, setChosenAnthropic] = useState(anthropicAImodels[0]);
  const [chosenGoogle, setChosenGoogle] = useState(googleAImodels[0]);
  const [chosenGrokAI, setChosenGrokAI] = useState(grokAImodels[0]);
  const [chosenDeepseekAI, setChosenDeepseekAI] = useState(deepseekAImodels[0]);
  const [chosenMetaAI, setChosenMetaAI] = useState(metaAImodels[0]);
  const [chosenOpenAI, setChosenOpenAI] = useState(openAImodels[0]);
  const intervalIdRef = useRef(null);

  // Check if the arrays contains elements before adding related keys
  const modelOptions = {};

  if (anthropicAImodels.length > 0) {
    modelOptions["Anthropic"] = anthropicAImodels;
  }

  if (deepseekAImodels.length > 0) {
    modelOptions["Deepseek"] = deepseekAImodels;
  }

  if (googleAImodels.length > 0) {
    modelOptions["Google"] = googleAImodels;
  }

  if (grokAImodels.length > 0) {
    modelOptions["Grok"] = grokAImodels;
  }

  if (localModels.length > 0 && Config.ollamaEnabled) {
    modelOptions["Ollama"] = localModels;
  }

  if (metaAImodels.length > 0) {
    modelOptions["Meta"] = metaAImodels;
  }

  if (openAImodels.length > 0) {
    modelOptions["OpenAI"] = openAImodels;
  }

  const useDebouncedCallback = useCallback((callback, delay) => {
    const debouncedFn = useMemo(
      () => debounce(callback, delay),
      [callback, delay],
    );
    useEffect(() => {
      return () => debouncedFn.cancel();
    }, [debouncedFn]);
    return debouncedFn;
  });

  const makeNewChat = useCallback((theChatType) => {
    const uuid = uuidv4();

    const newChat = {
      id: uuid,
      numba: chatCount,
      systemMessage: sysMsg,
      chatType: theChatType,
      model: model.name,
      temperature: temperature,
      topp: topp,
      topk: topk,
      localModels: localModels,
      listModels: listModels,
      serverURL: serverURL,
      modelOptions: modelOptions,
      sessionHash: sessionHash,
      serverUsername: serverUsername,
      messages: {},
      context: [],
      thread: [],
      restoreID: "",
    };

    setComponentList([...componentList, newChat]);
    setChatCount(chatCount + 1);
  });

  const debouncedMakeNewChat = useDebouncedCallback(makeNewChat, 250);

  //Loop every 3 seconds to check if server is available
  const startInterval = useCallback(() => {
    // Ensure not to start multiple intervals
    if (intervalIdRef.current) {
      return;
    }

    setSessionHash(randomBytes(16).toString("hex"));
    checkBackServer();

    // Start the interval
    intervalIdRef.current = setInterval(() => {
      checkBackServer();
    }, 3000);
  });

  const clearStuff = useCallback((attempted) => {
    Cookies.set("clientJWT", JSON.stringify(""), { expires: 1 });
    setClientJWT("");
    //Cookies.set('serverUsername', JSON.stringify(""), { expires: 1 });
    //setServerUsername("");
    Cookies.set("checkedIn", JSON.stringify(false), { expires: 1 });
    setCheckedIn(false);
    setSignInAttempted(attempted);
    localStorage.setItem("localModels", JSON.stringify([]));
    localStorage.setItem("chatHistory", JSON.stringify({}));
    setLocalModels([]);
  });

  //Starts the interval on first load
  useEffect(() => {
    startInterval();
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, []);

  const checkBackServer = useCallback(
    debounce(async () => {
      try {
        const response = await axios.post(serverURL + "/check");
        const backServerCheck = response?.data || undefined;
        if (backServerCheck === "ok") {
          setServerCheck(true);
        } else {
          setServerCheck(false);
          clearStuff(false);
        }
      } catch (error) {
        setServerCheck(false);
        clearStuff(false);
      }
    }, 250),
    [serverURL, clearStuff], // Add serverURL as a dependency
  );

  //Ping the backend server to check in, validate passphrase and acquire the JWT for later API calls
  const clientCheckIn = useCallback(
    debounce(async () => {
      if (clientJWT != "") {
        return;
      }

      try {
        const checkinResp = await axios.post(
          serverURL + "/checkin",
          {
            serverUsername: serverUsername,
            serverPassphrase: serverPassphrase,
            sessionHash: sessionHash,
          },
          {
            headers: { "Content-Type": "application/json" },
          },
        );

        const clientCheck = checkinResp?.data || undefined;

        if (clientCheck) {
          const data = checkinResp.data;

          setChatHistory(data.userChatHistory);
          localStorage.setItem(
            "chatHistory",
            JSON.stringify(data.userChatHistory),
          );

          Cookies.set("clientJWT", JSON.stringify(data.token), { expires: 1 });
          setClientJWT(data.token);

          Cookies.set("serverUsername", JSON.stringify(serverUsername), {
            expires: 1,
          });
          setServerUsername(serverUsername);

          Cookies.set("checkedIn", JSON.stringify(true), { expires: 1 });
          setCheckedIn(true);

          if (Config.ollamaEnabled) {
            checkModels(data.token);
          }
        }
      } catch (error) {
        console.log(error);
        clearStuff(true);
      }
    }, 250),
    [clientJWT, serverUsername, serverPassphrase, sessionHash],
  );

  const getRandomModel = useCallback((modelsArray) => {
    if (!modelsArray || modelsArray.length === 0) {
      return null;
    }
    const randomIndex = Math.floor(Math.random() * modelsArray.length);
    return modelsArray[randomIndex];
  });

  const logoutUser = useCallback(
    debounce(async () => {
      setCheckedIn(false);
      setClientJWT("");
      setServerUsername("");
      setSignInAttempted(false);
      Cookies.remove("checkedIn");
      Cookies.remove("clientJWT");
      Cookies.remove("chosenOllama");
      Cookies.remove("serverUsername");
      localStorage.setItem("localModels", JSON.stringify([]));
      localStorage.setItem("chatHistory", JSON.stringify({}));
      setLocalModels([]);

      return;
    }, 250),
    [],
  );

  //Update the Chat History from the server, for a given username
  const syncClient = useCallback(
    debounce(async () => {
      try {
        const newChatData = await axios.post(
          serverURL + "/sync",
          { userName: serverUsername },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${clientJWT}`,
            },
          },
        );
        setChatHistory(newChatData.data);
        localStorage.setItem("chatHistory", JSON.stringify(newChatData.data));
      } catch (error) {
        console.log(error);
      }
    }, 250),
    [serverURL, clientJWT],
  );

  //Ping the backend server for a list of Ollama locally downloaded list of models
  const checkModels = useCallback(
    debounce(async (bearer) => {
      try {
        const theModels = await axios.post(
          serverURL + "/getmodels",
          {},
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${bearer}`,
            },
          },
        );

        const allModels = theModels.data;

        allModels.sort((a, b) => {
          const nameA = a.name.toLowerCase();
          const nameB = b.name.toLowerCase();

          return nameA.localeCompare(nameB);
        });

        setLocalModels(allModels);
        localStorage.setItem("localModels", JSON.stringify(allModels));

        const modelMapping = {
          Anthropic: anthropicAImodels,
          Google: googleAImodels,
          Grok: grokAImodels,
          Deepseek: deepseekAImodels,
          Meta: metaAImodels,
          OpenAI: openAImodels,
        };

        const randomOllama = getRandomModel(allModels);
        setModel(modelMapping[chatType]?.[0] || randomOllama);

        const randyOllama = { name: randomOllama.name };
        setChosenOllama(randyOllama);
        Cookies.set("chosenOllama", JSON.stringify(randyOllama), {
          expires: 1,
        });
      } catch (error) {
        console.log(error);
      }
    }, 250),
    [serverURL, localModels, chatType],
  );

  //Event Handlers

  const handleChatTypeChange = useCallback(
    (e) => {
      const selectedChatType = e.target.value;
      setChatType(selectedChatType);

      const modelMapping = {
        Anthropic: { modelState: chosenAnthropic, list: anthropicAImodels },
        Google: { modelState: chosenGoogle, list: googleAImodels },
        Grok: { modelState: chosenGrokAI, list: grokAImodels },
        Deepseek: { modelState: chosenDeepseekAI, list: deepseekAImodels },
        Meta: { modelState: chosenMetaAI, list: metaAImodels },
        OpenAI: { modelState: chosenOpenAI, list: openAImodels },
        default: { modelState: chosenOllama, list: localModels }, //Ollama
      };

      const selected =
        modelMapping[selectedChatType] || modelMapping["default"];

      // Attempt to restore previous model choice, fallback to the first model if undefined.
      const previousSelectedModel = selected.modelState || selected.list[0];

      setModel(previousSelectedModel);
      setListModels(selected.list);
    },
    [
      chosenOpenAI,
      chosenAnthropic,
      chosenGoogle,
      chosenGrokAI,
      chosenDeepseekAI,
      chosenMetaAI,
      chosenOllama,
      localModels,
    ],
  );

  const handleModelChange = useCallback(
    (e) => {
      const modelObj = { name: e.target.value };
      setModel(modelObj);

      const setChosenMapping = {
        Anthropic: setChosenAnthropic,
        Google: setChosenGoogle,
        Grok: setChosenGrokAI,
        Deepseek: setChosenDeepseekAI,
        Meta: setChosenMetaAI,
        Ollama: setChosenOllama,
        OpenAI: setChosenOpenAI,
      };

      (setChosenMapping[chatType] || setChosenOllama)(modelObj);
    },
    [chatType],
  );

  const handleChange = useCallback(
    (setter) => (e) => {
      setter(e.target.value);
    },
    [],
  );

  const handleSysMsgChange = handleChange(setSysMsg);
  const handleToppChange = handleChange(setTopp);
  const handleTopkChange = handleChange(setTopk);
  const handleTempChange = handleChange(setTemperature);
  const handleUsernameChange = handleChange(setServerUsername);
  const handlePassphraseChange = handleChange(setServerPassphrase);

  const handleCheckboxChange = useCallback((e) => {
    setAdvancedSetting(e.target.checked);
  }, []);

  // If input contains whitespace, return false.
  const isValidURL = useCallback((input) => {
    if (/\s/.test(input)) {
      return false;
    }

    const res = input.match(
      /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi,
    );
    return res !== null;
  });

  //Shorten excessively long model names for the Settings drop-down list
  const truncateString = useCallback((str, length) => {
    if (str.length > length) {
      return str.substring(0, length) + "...";
    }
    return str;
  });

  const handleEnterKey = useCallback(async (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      clientCheckIn();
    }
  });

  //If only 1, 2 or 3 chats, then allow them to fill the horizontal space
  const getGridClasses = useCallback((itemCount) => {
    let classes = "grid gap-2 mx-auto mt-1 ";
    if (itemCount === 1) {
      classes +=
        "w-[50%] smolscreen:w-full mx-auto mx-auto items-center justify-center gap-0 sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1 2xl:grid-cols-1";
    } else if (itemCount === 2) {
      classes +=
        "sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-2";
    } else if (itemCount === 3) {
      classes +=
        "sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3";
    } else {
      classes +=
        "sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3";
    }
    return classes;
  });

  const itemCount = componentList.length;

  return (
    <dataContext.Provider
      value={{
        componentList,
        setComponentList,
        chatCount,
        setChatCount,
        chosenAnthropic,
        chosenGoogle,
        chosenGrokAI,
        chosenDeepseekAI,
        chosenMetaAI,
        chosenOllama,
        chosenOpenAI,
        clientJWT,
        checkedIn,
        setClientJWT,
        setCheckedIn,
      }}
    >
      <div>
        <Spring from={{ opacity: 0 }} to={[{ opacity: 1 }]} delay={400}>
          {(styles) => (
            <animated.div
              style={styles}
              className="w-[50%] smolscreen:w-full text-aro-100 mx-auto cursor-default bg-vonCount-600 bg-gradient-to-tl from-vonCount-700 rounded-3xl font-bold p-2 flex items-center justify-center"
            >
              {/* Settings box */}
              <div className="w-full">
                {checkedIn && (
                  <ChatHistory
                    chatHistory={chatHistory}
                    componentList={componentList}
                    chatCount={chatCount}
                    localModels={localModels}
                    serverURL={serverURL}
                    modelOptions={modelOptions}
                    setComponentList={setComponentList}
                    setChatCount={setChatCount}
                    syncClient={syncClient}
                    serverUsername={serverUsername}
                  />
                )}
                <table className="min-w-full text-black">
                  <tbody>
                    {serverCheck && checkedIn ? (
                      <tr>
                        <td className="w-[10%] text-center">
                          <a
                            alt="GitHub"
                            target="_blank"
                            rel="noopener noreferrer"
                            href="https://github.com/gemini2463/llm-chatter"
                          >
                            <i className="fa-brands fa-github text-4xl text-aro-300 text-center mb-2"></i>
                          </a>
                        </td>
                        <td className="2xl:w-[90%] xl:w-[86%] lg:w-[82%] md:w-[78%] sm:w-[74%] text-3xl tracking-normal text-center items-center font-bold text-black">
                          <div className="border-solid border border-aro-800 self-start text-black mx-auto hover:bg-nosferatu-300 cursor-default bg-nosferatu-200 rounded-3xl text-2xl font-bold flex items-center justify-center mb-4 bg-gradient-to-tl from-nosferatu-500 hover:from-nosferatu-600 cursor-pointer">
                            <input
                              className="hidden"
                              type="checkbox"
                              name="advancedSetting"
                              id="advancedSettings"
                              checked={advancedSetting}
                              onChange={handleCheckboxChange}
                            />
                            <label
                              className="cursor-context-menu leading-6"
                              htmlFor="advancedSettings"
                            >
                              <span className="mr-2 flex items-center text-black">
                                <i
                                  className={`text-aro-200 text-4xl fa-solid fa-gear ml-2 p-4 hover:text-marcelin-900 ${
                                    advancedSetting
                                      ? "fa-gear text-blade-700 fa-rotate-270"
                                      : "hover:text-dracula-100 ml-2"
                                  }`}
                                ></i>
                                <span
                                  className={
                                    advancedSetting
                                      ? "underline hover:no-underline mr-4"
                                      : "hover:underline mr-4"
                                  }
                                >
                                  Advanced Settings
                                </span>
                              </span>
                            </label>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td className="w-[10%] text-5xl text-center items-center justify-center">
                          <a
                            alt="GitHub"
                            target="_blank"
                            rel="noopener noreferrer"
                            href="https://github.com/gemini2463/llm-chatter"
                          >
                            <i className="fa-brands fa-github text-5xl text-aro-300 text-center mb-2"></i>
                          </a>
                        </td>
                        <td className="text-black text-3xl pl-12 font-mono">
                          LLM Chatter <span className="font-sans">login</span>
                        </td>
                      </tr>
                    )}

                    {/* NodeJS server check display */}
                    <tr>
                      <td className="w-[10%] pb-4 pr-4 pt-6">Server:</td>
                      <td className="pl-10 pb-4 font-sans pt-6">
                        {serverCheck ? (
                          <>
                            <span className="rounded-2xl p-3 border border-solid border-aro-100 bg-aro-500 text-black italic">
                              Online
                            </span>
                            {checkedIn && (
                              <span
                                onClick={logoutUser}
                                className="border-solid border border-cullen-200 rounded-2xl p-3 bg-aro-600 ml-6 text-black cursor-pointer hover:font-extrabold hover:bg-aro-400 hover:border-aro-200 hover:border-2 hover:underline"
                              >
                                Log Out ({serverUsername})
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <p>
                              <span className="text-marcelin-900">Offline</span>{" "}
                              <i className="fa-solid fa-triangle-exclamation text-marcelin-900 text-2xl"></i>
                            </p>
                          </>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Login username */}

                {!checkedIn && (
                  <form onSubmit={clientCheckIn}>
                    <table className="min-w-full text-black">
                      <tbody>
                        <tr>
                          <td className="w-[10%] pb-2 pr-4">Username:</td>
                          <td className="pb-2 font-sans">
                            <input
                              autoComplete="username"
                              className="w-full font-bold hover:bg-vonCount-300 bg-vonCount-200 p-4 text-sm font-sans text-black rounded-xl"
                              placeholder="Username"
                              onChange={(e) => handleUsernameChange(e)}
                              onKeyDown={handleEnterKey}
                              value={serverUsername}
                            />
                          </td>
                        </tr>

                        {/* Login passphrase */}

                        <tr>
                          <td className="pb-4 pr-4">Passphrase:</td>
                          <td className="pb-4 font-sans">
                            <input
                              type="password"
                              autoComplete="current-password"
                              className="min-w-full font-bold hover:bg-vonCount-300 bg-vonCount-200 p-4 text-sm font-sans text-black rounded-xl"
                              placeholder="Passphrase"
                              onChange={(e) => handlePassphraseChange(e)}
                              onKeyDown={handleEnterKey}
                              value={serverPassphrase}
                            />
                          </td>
                        </tr>

                        {/* Sign In */}

                        <tr>
                          <td colSpan="2">
                            <Spring
                              from={{ opacity: 0 }}
                              to={[{ opacity: 1 }]}
                              delay={200}
                            >
                              {(styles) => (
                                <animated.div
                                  onClick={debounce(() => {
                                    clientCheckIn();
                                  }, 250)}
                                  style={styles}
                                  className="border-solid border border-aro-800 hover:bg-nosferatu-300 cursor-default bg-nosferatu-200 rounded-3xl text-2xl font-bold p-4 flex mb-2 bg-gradient-to-tl from-nosferatu-500 hover:from-nosferatu-600 shadow-xl hover:shadow-dracula-700 cursor-pointer"
                                >
                                  <i className="text-vonCount-900 fa-solid fa-plug-circle-bolt mr-4"></i>
                                  <h1 className="text-black">Sign In</h1>
                                  {!checkedIn && signInAttempted && (
                                    <p>
                                      :{" "}
                                      <span className="text-buffy-800">
                                        Login Error
                                      </span>
                                    </p>
                                  )}
                                </animated.div>
                              )}
                            </Spring>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </form>
                )}

                <table className="min-w-full text-black">
                  <tbody>
                    {/* System Message */}
                    {checkedIn &&
                      !Config.reasoningModels.includes(model.name) &&
                      !Config.imgOutputModels.includes(model.name) && (
                        <tr>
                          <td className="w-[10%] pb-4 pr-4">
                            Starting Prompt:
                          </td>
                          <td>
                            <TextareaAutosize
                              minRows="3"
                              maxRows="5"
                              className="min-w-full font-bold hover:bg-vonCount-300 bg-vonCount-200 p-4 text-sm font-sans text-black rounded-xl"
                              placeholder="'System' Message"
                              onChange={(e) => {
                                handleSysMsgChange(e);
                                localStorage.setItem(
                                  "sysMsg",
                                  JSON.stringify(""),
                                );
                              }}
                              value={sysMsg}
                            />
                          </td>
                        </tr>
                      )}

                    {/* Input Type */}
                    {checkedIn && (
                      <tr>
                        <td className="w-[10%] pb-2 pr-4">Input Type:</td>
                        <td className="pb-2 tracking-wide font-bold text-black">
                          <select
                            name="chatType"
                            id="chatType"
                            className="hover:bg-vonCount-300 bg-vonCount-200 cursor-pointer p-4 min-w-full font-sans rounded-xl text-black"
                            onChange={(e) => handleChatTypeChange(e)}
                            value={chatType}
                          >
                            {Object.keys(modelOptions).map((optionKey) => (
                              <option key={optionKey} value={optionKey}>
                                {optionKey}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    )}

                    {/* Model Selection */}
                    {advancedSetting && checkedIn && (
                      <>
                        <tr>
                          <td className="w-[10%] pb-2 pr-4 text-blade-700">
                            Model:
                          </td>
                          <td className="pb-2 tracking-wide font-bold text-black">
                            <select
                              name="model"
                              id="model"
                              className="hover:bg-vonCount-300 bg-vonCount-200 cursor-pointer p-4 min-w-full font-sans rounded-xl text-black"
                              onChange={(e) => handleModelChange(e)}
                              value={model.name}
                              disabled={
                                !modelOptions[chatType] ||
                                modelOptions[chatType].length === 0
                              }
                            >
                              {modelOptions[chatType] &&
                              modelOptions[chatType].length > 0 ? (
                                modelOptions[chatType].map((option) => {
                                  const displayName =
                                    truncateString(option.name, 40) +
                                    (Config.visionModels.includes(option.name)
                                      ? " *"
                                      : "");
                                  return (
                                    <option
                                      key={option.name}
                                      value={option.name}
                                    >
                                      {displayName}
                                    </option>
                                  );
                                })
                              ) : (
                                <option value="" disabled>
                                  No models available
                                </option>
                              )}
                            </select>
                          </td>
                        </tr>

                        {!Config.imgOutputModels.includes(model.name) && (
                          <>
                            {/* Temperature */}
                            <tr>
                              <td className="w-[10%] pb-4 pr-4 text-blade-700">
                                temp.:
                              </td>
                              <td className="tracking-wide font-bold text-black">
                                <select
                                  name="temperature"
                                  id="temperature"
                                  className="hover:bg-vonCount-300 bg-vonCount-200 cursor-pointer mb-2 p-4 min-w-24 font-sans rounded-xl text-black"
                                  onChange={(e) => handleTempChange(e)}
                                  value={temperature}
                                >
                                  <option value="0">0</option>
                                  <option value="0.01">0.01</option>
                                  <option value="0.02">0.02</option>
                                  <option value="0.03">0.03</option>
                                  <option value="0.04">0.04</option>
                                  <option value="0.05">0.05</option>
                                  <option value="0.06">0.06</option>
                                  <option value="0.07">0.07</option>
                                  <option value="0.08">0.08</option>
                                  <option value="0.09">0.09</option>
                                  <option value="0.1">0.1</option>
                                  <option value="0.2">0.2</option>
                                  <option value="0.3">0.3</option>
                                  <option value="0.4">0.4</option>
                                  <option value="0.5">0.5</option>
                                  <option value="0.6">0.6</option>
                                  <option value="0.7">0.7</option>
                                  <option value="0.8">0.8</option>
                                  <option value="0.9">0.9</option>
                                  <option value="1">1</option>
                                </select>
                              </td>
                            </tr>

                            {/* top-p */}
                            <tr>
                              <td className="w-[10%] pb-4 text-blade-700">
                                top-p:
                              </td>
                              <td className="tracking-wide font-bold text-black">
                                <select
                                  name="topp"
                                  id="topp"
                                  className="hover:bg-vonCount-300 bg-vonCount-200 cursor-pointer mb-2 p-4 min-w-24 font-sans rounded-xl text-black"
                                  onChange={(e) => handleToppChange(e)}
                                  value={topp}
                                >
                                  <option value="0">0</option>
                                  <option value="0.01">0.01</option>
                                  <option value="0.02">0.02</option>
                                  <option value="0.03">0.03</option>
                                  <option value="0.04">0.04</option>
                                  <option value="0.05">0.05</option>
                                  <option value="0.06">0.06</option>
                                  <option value="0.07">0.07</option>
                                  <option value="0.08">0.08</option>
                                  <option value="0.09">0.09</option>
                                  <option value="0.1">0.1</option>
                                  <option value="0.2">0.2</option>
                                  <option value="0.3">0.3</option>
                                  <option value="0.4">0.4</option>
                                  <option value="0.5">0.5</option>
                                  <option value="0.6">0.6</option>
                                  <option value="0.7">0.7</option>
                                  <option value="0.8">0.8</option>
                                  <option value="0.9">0.9</option>
                                  <option value="1">1</option>
                                </select>
                              </td>
                            </tr>

                            {/* top-k */}
                            {chatType.includes("OpenAI") ||
                            chatType.includes("Grok") ||
                            chatType.includes("Deepseek") ||
                            chatType.includes("Meta") ? (
                              <></>
                            ) : (
                              <tr>
                                <td className="w-[10%] pb-4 text-blade-700">
                                  top-k:
                                </td>
                                <td className="tracking-wide font-bold text-black">
                                  <select
                                    name="topk"
                                    id="topk"
                                    className="hover:bg-vonCount-300 bg-vonCount-200 cursor-pointer mb-1 p-4 min-w-24 font-sans rounded-xl text-black"
                                    onChange={(e) => handleTopkChange(e)}
                                    value={topk}
                                  >
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                    <option value="5">5</option>
                                    <option value="6">6</option>
                                    <option value="7">7</option>
                                    <option value="8">8</option>
                                    <option value="9">9</option>
                                    <option value="10">10</option>
                                    <option value="11">11</option>
                                    <option value="12">12</option>
                                    <option value="13">13</option>
                                    <option value="14">14</option>
                                    <option value="15">15</option>
                                    <option value="16">16</option>
                                    <option value="17">17</option>
                                    <option value="18">18</option>
                                    <option value="19">19</option>
                                    <option value="20">20</option>
                                  </select>
                                </td>
                              </tr>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </tbody>
                </table>

                {
                  //New Chat button displays only when conditions allow.
                  !serverCheck || !checkedIn ? (
                    <></>
                  ) : (
                    <>
                      <div className="grid gap-2 grid-cols-3 mt-6 mb-2">
                        <Spring
                          from={{ opacity: 0 }}
                          to={[{ opacity: 1 }]}
                          delay={200}
                        >
                          {(styles) => (
                            <animated.div
                              onClick={() => {
                                debouncedMakeNewChat(chatType);
                              }}
                              style={styles}
                              className="border-solid border border-aro-800 self-start text-black mx-auto hover:bg-nosferatu-300 cursor-default bg-nosferatu-200 rounded-3xl text-2xl font-bold p-4 flex items-center justify-center mb-2 bg-gradient-to-tl from-nosferatu-500 hover:from-aro-600 cursor-pointer hover:border-2"
                            >
                              <i className="fa-solid fa-keyboard mr-4"></i>
                              <h1 className="hover:underline">Text</h1>
                            </animated.div>
                          )}
                        </Spring>

                        {/* Info of selected model */}
                        <div className="col-span-2 rounded-lg border-solid border border-aro-800 bg-aro-300 text-black self-start mx-auto text-center items-center justify-center p-2 cursor-text">
                          <p className="underline text-2xl">Text Model</p>
                          <p className="text-xl">
                            {model.name +
                              (Config.visionModels.includes(model.name)
                                ? " *"
                                : "")}
                          </p>
                          {Config.visionModels.includes(model.name) ? (
                            <p className="text-xs mt-2">* Vision</p>
                          ) : (
                            <></>
                          )}
                        </div>

                        {/* New Voice button */}
                        {chatType.includes("OpenAI") &&
                        !componentList.some((container) =>
                          container.chatType.includes("(Voice)"),
                        ) ? (
                          <>
                            <Spring
                              from={{ opacity: 0 }}
                              to={[{ opacity: 1 }]}
                              delay={300}
                            >
                              {(styles) => (
                                <animated.div
                                  onClick={() => {
                                    debouncedMakeNewChat("(Voice)");
                                  }}
                                  style={styles}
                                  className="border-solid border border-aro-800 self-start text-black mx-auto hover:bg-nosferatu-300 cursor-default bg-nosferatu-200 rounded-3xl text-2xl font-bold p-4 flex items-center justify-center mb-1 bg-gradient-to-tl from-nosferatu-500 hover:from-aro-600 cursor-pointer hover:border-2"
                                >
                                  <i className="fa-solid fa-microphone-lines mr-4"></i>
                                  <h1 className="hover:underline">Voice</h1>
                                </animated.div>
                              )}
                            </Spring>
                            <div className="col-span-2 rounded-lg border-solid border border-aro-800 bg-aro-300 text-black self-start mx-auto text-center items-center justify-center p-2 cursor-text">
                              <p className="underline text-2xl">Voice Model</p>
                              <p className="text-xl">gpt-4o-realtime-preview</p>
                            </div>
                          </>
                        ) : (
                          <></>
                        )}
                      </div>
                    </>
                  )
                }
              </div>
            </animated.div>
          )}
        </Spring>
      </div>

      {/* <ChatStream
  key={container.id}
  serverURL={serverURL}
  closeID={container.id}
/> */}

      {/* All the Chats */}
      <div className={getGridClasses(itemCount)}>
        {componentList
          .slice()
          .reverse()
          .map((container) =>
            container.chatType.includes("(Voice)") ? (
              <ConsolePage
                key={container.id}
                instructions={container.systemMessage}
                closeID={container.id}
                numba={container.numba}
                relayWS={relayWS}
              />
            ) : (
              <Chat
                key={container.id}
                closeID={container.id}
                systemMessage={container.systemMessage}
                chatType={container.chatType}
                model={container.model}
                temperature={container.temperature}
                topp={container.topp}
                topk={container.topk}
                numba={container.numba}
                listModels={container.listModels}
                serverURL={container.serverURL}
                modelOptions={container.modelOptions}
                localModels={container.localModels}
                sessionHash={sessionHash}
                serverUsername={serverUsername}
                messages={container.messages}
                context={container.context}
                thread={container.thread}
                restoreID={container.restoreID}
              />
            ),
          )}
      </div>
    </dataContext.Provider>
  );
}

export default Chatter;
