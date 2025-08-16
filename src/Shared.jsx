import { useState, useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import debounce from "lodash/debounce";
import Config from "./Config.jsx";
import ContentText from "./components/ContentText";
import copy from "copy-to-clipboard";
import CopyButton from "./components/CopyButton";

function Shared() {
  const { shareToken } = useParams();
  const { serverURL } = Config;
  const [shareChat, setShareChat] = useState([]);
  const [showError, setShowError] = useState("");

  const sharedCheckIn = useCallback(
    debounce(async () => {
      if (!serverURL || !shareToken) {
        const errMsg = "Missing required parameters.";
        setShowError(errMsg);

        return;
      }

      try {
        const checkinResp = await axios.post(
          serverURL + "/chkshr",
          { shareToken },
          {
            headers: { "Content-Type": "application/json" },
          }
        );

        const clientCheck = checkinResp?.data || undefined;

        if (Array.isArray(checkinResp.data)) {
          setShareChat(checkinResp.data);
          setShowError("");
        } else {
          setShareChat([]);
          setShowError("No chat data found.");
        }
      } catch (error) {
        setShowError(JSON.stringify(error));
      }
    }, 250),
    [serverURL, shareToken]
  );

  //Starts the interval on first load
  useEffect(() => {
    sharedCheckIn();
    return () => {
      sharedCheckIn.cancel();
    };
  }, [sharedCheckIn]);

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
    }
  });

  let checkDuplicates = "";

  return (
    <div className="self-start mt-2 mb-2 inline p-0 bg-nosferatu-200 rounded-3xl bg-gradient-to-tl from-nosferatu-500 shadow-sm mx-auto items-center justify-center">
      <table className="w-[50%] smolscreen:w-full border-separate border-spacing-y-2 border-spacing-x-2 mx-auto items-center justify-center bg-nosferatu-200 rounded-3xl bg-gradient-to-tl from-nosferatu-500 shadow-sm">
        <tbody>
          <tr>
            <td>
              <div className="mx-auto items-center justify-center cursor-default font-bold p-4 flex mb-2">
                <i className="text-vonCount-900 fa-regular fa-comment mr-4 text-4xl"></i>
                <h1 className="text-black text-3xl">Shared Chat</h1>
              </div>
            </td>
          </tr>
          {showError && (
            <tr>
              <td>
                <div className="text-center text-red-500 font-bold p-2">
                  {showError}
                </div>
              </td>
            </tr>
          )}
          {shareChat.map((obj, index) => {
            if (!obj || typeof obj.z !== "string") return null;
            const contentText = obj.z;

            if (obj.r === "user") {
              if (contentText === checkDuplicates) {
                return null;
              }
              checkDuplicates = contentText;
            }

            if (!contentText || typeof contentText !== "string") {
              return null;
            }

            const roleShow =
              obj.r === "assistant"
                ? obj.m
                : obj.r === "system"
                  ? "Starting Prompt"
                  : obj.r === "user"
                    ? "Prompt"
                    : "Unknown Role";

            return (
              <tr key={index}>
                <td
                  onCopy={handleCopy}
                  className={
                    obj.r === "user" || obj.r === "system"
                      ? "py-3 p-3 bg-morbius-300 font-sans rounded-xl text-black-800 text-md whitespace-pre-wrap"
                      : "py-3 whitespace-pre-wrap p-3 bg-nosferatu-100 font-mono rounded-xl text-black text-sm"
                  }
                >
                  <div className="mb-3 grid grid-cols-3">
                    <span className="font-bold text-xl text-aro-900">
                      {roleShow}
                    </span>
                    <span className="text-center text-sm text-aro-900">
                      {obj.d}
                    </span>
                    <span className="text-right">
                      <CopyButton
                        contentText={contentText}
                        copyClick={copyClick}
                      />
                    </span>
                  </div>

                  <ContentText role={obj.r} txt={contentText} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mx-auto items-center justify-center text-center">
        <a
          alt="GitHub"
          target="_blank"
          rel="noopener noreferrer"
          href="https://github.com/gemini2463/llm-chatter"
        >
          <i className="fa-brands fa-github text-4xl mb-2 text-white mt-2"></i>
        </a>
      </div>
    </div>
  );
}

export default Shared;
