import { useState, useCallback } from "react";
import Config from "../Config";
import copy from "copy-to-clipboard";

export const HistoryItem = ({
  chats,
  uID,
  componentList,
  chatCount,
  localModels,
  serverURL,
  modelOptions,
  setComponentList,
  setChatCount,
  context,
  thread,
  serverUsername,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [theShareURL, setTheShareURL] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const firstChat = chats.find((chat) => chat.r === "user");
  const findSystem = chats.find((chat) => chat.r === "system") || "";
  const lastChat = chats[chats.length - 1];

  const lastChatMsg = lastChat.z;
  const shortLast =
    lastChatMsg.length > 250
      ? `${lastChatMsg.substring(0, 250)}...`
      : lastChatMsg;

  const handleCopy = useCallback((e) => {
    e.preventDefault();
    const selectedText = document.getSelection().toString();

    //Remove soft hyphens
    const textContent = selectedText.replace(/\xAD/g, "");

    navigator.clipboard.writeText(textContent);
  });

  const copyClick = useCallback((value) => {
    if (typeof value === "string") {
      copy(value);

      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 150);
    }
  });

  const makeNewChat = useCallback((isShare) => {
    let chatType = "";

    if (Config.models.openAI.includes(firstChat.m)) {
      chatType = "OpenAI";
    } else if (Config.models.anthropic.includes(firstChat.m)) {
      chatType = "Anthropic";
    } else if (Config.models.google.includes(firstChat.m)) {
      chatType = "Google";
    } else if (Config.models.grok.includes(firstChat.m)) {
      chatType = "Grok";
    } else if (Config.models.deepseek.includes(firstChat.m)) {
      chatType = "Deepseek";
    } else if (Config.models.meta.includes(firstChat.m)) {
      chatType = "Meta";
    } else {
      chatType = "Ollama";
    }

    const newChat = {
      id: Date.now(),
      numba: chatCount,
      systemMessage: findSystem.z,
      chatType: chatType,
      model: firstChat.m,
      temperature: firstChat.t,
      topp: firstChat.p,
      topk: firstChat.k,
      localModels: localModels,
      listModels: modelOptions[chatType],
      serverURL: serverURL,
      modelOptions: modelOptions,
      messages: chats,
      context: context,
      thread: [...thread, firstChat.u],
      restoreID: firstChat.u,
    };

    if (isShare) {
      const setURL =
        serverURL + "/shared/" + serverUsername + "/" + firstChat.u;
      setTheShareURL(setURL);
    } else {
      setComponentList([...componentList, newChat]);
      setChatCount(chatCount + 1);
    }
  });

  const handleToggle = useCallback(() => {
    setExpanded(!expanded);
  });

  const restoreButton = useCallback(() => {
    return (
      <div
        onClick={() => {
          makeNewChat(false);
        }}
        className="border-solid border border-aro-800 self-start place-self-center text-black hover:bg-nosferatu-300 cursor-default bg-nosferatu-100 rounded-3xl text-xl font-bold pt-2 pb-2 pl-4 pr-4 flex items-center mb-2 bg-gradient-to-tl from-nosferatu-300 hover:from-aro-300 cursor-pointer justify-center"
      >
        <i className="fa-solid fa-retweet mr-4 text-nosferatu-800"></i>
        <h1 className="hover:underline">Restore</h1>
      </div>
    );
  });

  const copyURLbutton = useCallback(() => {
    return (
      <div
        onClick={() => {
          copyClick(theShareURL);
        }}
        className={`border-solid border border-aro-800 self-start place-self-center text-black hover:bg-nosferatu-300 cursor-default bg-nosferatu-100 rounded-3xl text-md font-bold pt-2 pb-2 pl-4 pr-4 flex items-center mb-2 bg-gradient-to-tl from-nosferatu-300 hover:from-aro-300 cursor-pointer justify-center ${
          isCopied ? "text-blade-300" : ""
        }`}
      >
        <i
          className={`fa-solid fa-clone mr-4 text-nosferatu-800${
            isCopied ? "text-blade-300" : ""
          }`}
        ></i>
        <h1 className="hover:underline">Copy URL</h1>
      </div>
    );
  });

  const shareButton = useCallback(() => {
    return (
      //If serverURL begins with https://, then show the share button
      serverURL.startsWith("https://") && (
        <div
          onClick={() => {
            makeNewChat(true);
          }}
          className="border-solid border border-aro-800 self-start place-self-center text-black hover:bg-nosferatu-300 cursor-default bg-nosferatu-100 rounded-3xl text-xl font-bold pt-2 pb-2 pl-4 pr-4 flex items-center mb-2 bg-gradient-to-tl from-nosferatu-300 hover:from-aro-300 cursor-pointer justify-center"
        >
          <i className="fa-solid fa-share mr-4 text-nosferatu-800"></i>
          <h1 className="hover:underline">Share</h1>
        </div>
      )
    );
  });

  const toggleIcon = useCallback(() => {
    return (
      <div className="text-center cursor-pointer mt-1" onClick={handleToggle}>
        <i
          className={
            expanded
              ? "fa-solid fa-ellipsis text-3xl text-blade-800 hover:text-dracula-500"
              : "fa-solid fa-ellipsis text-3xl text-black hover:text-buffy-500"
          }
          title={expanded ? "Show less" : "Show more"}
        />
      </div>
    );
  });

  const topLines = useCallback(() => {
    return (
      <div className="text-black text-sm text-left">
        <span
          onClick={handleToggle}
          className="underline font-bold hover:no-underline hover:cursor-pointer text-base"
        >
          Chat #{uID}
        </span>
        <br />
        <br />
        {/* {restoreButton()} */}
        <span className="italic">
          {firstChat.z.length > 60
            ? `${firstChat.z.substring(0, 60)}...`
            : firstChat.z}
        </span>
        <br />
        <br />
        <span className="underline">Model:</span>
        <br />
        {firstChat.m}
        {toggleIcon()}
      </div>
    );
  });

  const allLines = useCallback(() => {
    return (
      <div className="text-black text-base text-left">
        <span
          onClick={handleToggle}
          className="underline text-xl font-extrabold hover:no-underline hover:cursor-pointer"
        >
          Chat #{uID}
        </span>
        {restoreButton()}

        {theShareURL ? (
          <div className="mb-2" onCopy={handleCopy}>
            {copyURLbutton()}
            <input
              type="text"
              value={theShareURL}
              readOnly
              className="w-full p-2 border border-gray-400 rounded bg-gray-100 text-black cursor-text text-sm p-3 mx-auto overflow-hidden text-ellipsis whitespace-nowrap hover:bg-gray-200 font-mono"
              onClick={(e) => e.target.select()}
            />
          </div>
        ) : (
          <>{shareButton()}</>
        )}
        <span className="underline">Prompt:</span>
        <br />
        <span className="italic">
          {firstChat.z.length > 250
            ? `${firstChat.z.substring(0, 250)}...`
            : firstChat.z}
        </span>
        <br />
        <br />
        <span className="underline">Model:</span>
        <br />
        {firstChat.m}
        <br />
        <br />
        <span className="underline">Latest Response:</span>
        <br />
        <span className="italic">{shortLast}</span>
        <br />
        {toggleIcon()}
      </div>
    );
  });

  const displayedLines = expanded ? allLines() : topLines();

  return (
    <div className="mb-2 p-1 rounded-lg border-solid border border-aro-800 bg-aro-200">
      <div className="text-black text-sm text-left">{displayedLines}</div>
    </div>
  );
};

export default HistoryItem;
