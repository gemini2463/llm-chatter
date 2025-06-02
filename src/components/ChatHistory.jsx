/* Shorthand (file storage) for the following:
i = item_x
u = chatId
m = model
t = temp
p = topp
k = topk
r = role
d = time
z = message */

import { useCallback, useState } from "react";
import { HistoryItem } from "./HistoryItem";

const ChatHistory = ({
  chatHistory,
  chatCount,
  localModels,
  serverURL,
  modelOptions,
  setComponentList,
  setChatCount,
  componentList,
  syncClient,
  serverUsername,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showAtAll, setShowAtAll] = useState(false);

  const handleToggleHistory = useCallback(() => {
    setExpanded(!expanded);
  });

  const handleShowAtAll = useCallback(() => {
    setShowAtAll(!showAtAll);
  });

  // Function 1: Get all unique chat IDs
  const getUniqueChatIds = useCallback((database) => {
    const uniqueChatIds = new Set();

    // Use Object.values to get all items directly
    Object.entries(database).forEach(([key, item]) => {
      if (key.startsWith("i_")) {
        uniqueChatIds.add(item.u);
      }
    });

    return Array.from(uniqueChatIds).sort((a, b) => {
      const firstChatA = Object.values(database).find((item) => item.u === a);
      const firstChatB = Object.values(database).find((item) => item.u === b);

      const dateA = parseDate(firstChatA.d);
      const dateB = parseDate(firstChatB.d);

      return dateB - dateA; // Change to descending order
    });
  });

  const getChatsByChatId = useCallback((database, chatId) => {
    return Object.entries(database)
      .filter(
        ([key, item]) =>
          key.startsWith("i_") &&
          item &&
          typeof item === "object" &&
          item.u === chatId,
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
  });

  const getContextByChatId = useCallback((database, chatId) => {
    const contextItems = Object.entries(database)
      .filter(([key, item]) => key.startsWith("c_") && item.u === chatId)
      .map(([key, item]) => item);

    return contextItems.length > 0 ? contextItems[0] : [];
  });

  const getThreadByChatId = useCallback((database, chatId) => {
    const contextItems = Object.entries(database)
      .filter(([key, item]) => key.startsWith("t_") && item.u === chatId)
      .map(([key, item]) => item);

    return contextItems.length > 0 ? contextItems[0] : [];
  });

  // Helper function to parse date strings
  const parseDate = useCallback((dateString) => {
    // Split the date string into components
    const [datePart, timePart] = dateString.split(" ");
    const [day, month, year] = datePart.split("/");
    const [hours, minutes, seconds] = timePart.split(":");

    // Create a Date object (note: month is 0-indexed in JavaScript Date)
    return new Date(year, month - 1, day, hours, minutes, seconds);
  });

  const uniqueChatIds = getUniqueChatIds(chatHistory);
  const countEm = uniqueChatIds.length;

  return (
    <>
      {countEm > 0 ? (
        <div className="self-start place-self-center text-center items-center justify-center mb-4 pl-2 pr-2 rounded-lg border-solid border-2 border-aro-800 bg-aro-300 bg-gradient-to-tl from-nosferatu-600 min-w-[100%]">
          <table className="min-w-[100%] border-separate border-spacing-y-2 border-spacing-x-2">
            <tbody>
              <tr>
                <td className="p-2 tracking-wide text-2xl text-center font-bold text-black">
                  <div
                    className="hover:cursor-context-menu"
                    onClick={() => handleShowAtAll()}
                  >
                    <i className="fa-solid fa-book-bookmark mr-6 text-nosferatu-800 hover:text-dracula-900" />
                    <span
                      className={
                        showAtAll
                          ? "underline hover:no-underline"
                          : "hover:underline"
                      }
                    >
                      Chat History
                    </span>
                  </div>
                </td>
                {showAtAll && (
                  <td>
                    <div className="mb-6 flex font-bold text-3xl items-end justify-end">
                      <i
                        className="fa-solid fa-rotate text-ero-800 cursor-pointer hover:text-dracula-300 pt-2"
                        onClick={() => syncClient()}
                      ></i>
                    </div>
                  </td>
                )}
              </tr>
            </tbody>
          </table>
          {showAtAll && (
            <table className="min-w-[100%] border-separate border-spacing-y-2 border-spacing-x-2">
              <tbody>
                <tr>
                  <td colSpan="2" className="text-black">
                    {(expanded ? uniqueChatIds : uniqueChatIds.slice(0, 5)).map(
                      (chatId) => {
                        const thread = getThreadByChatId(chatHistory, chatId);
                        const chats = getChatsByChatId(
                          chatHistory,
                          chatId,
                          thread,
                        );
                        const context = getContextByChatId(chatHistory, chatId);

                        return (
                          <HistoryItem
                            key={chatId}
                            chats={chats}
                            uID={
                              uniqueChatIds.length -
                              uniqueChatIds.indexOf(chatId)
                            }
                            componentList={componentList}
                            chatCount={chatCount}
                            localModels={localModels}
                            serverURL={serverURL}
                            modelOptions={modelOptions}
                            setComponentList={setComponentList}
                            setChatCount={setChatCount}
                            context={context}
                            thread={thread}
                            serverUsername={serverUsername}
                          />
                        );
                      },
                    )}
                  </td>
                </tr>
                {uniqueChatIds.length > 5 && (
                  <tr>
                    <td colSpan="2">
                      <div
                        className="tracking-wide text-center cursor-pointer mt-1"
                        onClick={handleToggleHistory}
                      >
                        <i
                          className={
                            expanded
                              ? "fa-regular fa-square-caret-up text-5xl text-blade-800 hover:text-dracula-500"
                              : "fa-regular fa-square-caret-down text-5xl text-nosferatu-800 hover:text-buffy-500"
                          }
                          title={expanded ? "Show less" : "Show more"}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <></>
      )}
    </>
  );
};

export default ChatHistory;
