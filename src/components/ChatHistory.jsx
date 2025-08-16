import { useCallback, useState, useMemo } from "react";
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
  clientJWT,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showAtAll, setShowAtAll] = useState(false);
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // --- Helpers ---
  const parseDate = useCallback((dateString) => {
    if (!dateString) return new Date(0);
    const [datePart, timePart] = dateString.split(" ");
    if (!datePart || !timePart) return new Date(0);
    const [day, month, year] = datePart.split("/");
    const [hours, minutes, seconds] = timePart.split(":");
    return new Date(year, month - 1, day, hours, minutes, seconds);
  }, []);

  const getUniqueChatIds = useCallback(
    (database) => {
      const uniqueChatIds = new Set();
      Object.entries(database || {}).forEach(([key, item]) => {
        if (key.startsWith("i_")) {
          uniqueChatIds.add(item.u);
        }
      });

      return Array.from(uniqueChatIds).sort((a, b) => {
        const firstChatA = Object.values(database).find((item) => item.u === a);
        const firstChatB = Object.values(database).find((item) => item.u === b);
        const dateA = parseDate(firstChatA?.d);
        const dateB = parseDate(firstChatB?.d);
        return dateB - dateA; // newest first
      });
    },
    [parseDate]
  );

  const getChatsByChatId = useCallback(
    (database, chatId) => {
      return Object.entries(database || {})
        .filter(([key, item]) => key.startsWith("i_") && item?.u === chatId)
        .map(([_, item]) => item)
        .sort((a, b) => parseDate(a.d) - parseDate(b.d));
    },
    [parseDate]
  );

  const getContextByChatId = useCallback((database, chatId) => {
    return (
      Object.entries(database || {})
        .filter(([key, item]) => key.startsWith("c_") && item.u === chatId)
        .map(([_, item]) => item)[0] || []
    );
  }, []);

  const getThreadByChatId = useCallback((database, chatId) => {
    return (
      Object.entries(database || {})
        .filter(([key, item]) => key.startsWith("t_") && item.u === chatId)
        .map(([_, item]) => item)[0] || []
    );
  }, []);

  // --- FIX: compute unique IDs FIRST ---
  const uniqueChatIds = useMemo(
    () => getUniqueChatIds(chatHistory),
    [chatHistory, getUniqueChatIds]
  );

  const paginatedChatIds = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return uniqueChatIds.slice(start, start + itemsPerPage);
  }, [uniqueChatIds, page, itemsPerPage]);

  const totalPages = Math.ceil(uniqueChatIds.length / itemsPerPage);
  const countEm = uniqueChatIds.length;

  const handleToggleHistory = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleShowAtAll = useCallback(() => {
    setShowAtAll((prev) => !prev);
  }, []);

  return (
    <>
      {countEm > 0 && (
        <div className="self-start place-self-center text-center items-center justify-center mb-4 pl-2 pr-2 rounded-lg border-solid border-2 border-aro-800 bg-aro-300 bg-gradient-to-tl from-nosferatu-600 min-w-[100%]">
          <table className="min-w-[100%] border-separate border-spacing-y-2 border-spacing-x-2">
            <tbody>
              <tr>
                <td className="p-2 tracking-wide text-2xl text-center font-bold text-black">
                  <div
                    className="hover:cursor-context-menu"
                    onClick={handleShowAtAll}
                  >
                    <i className="fa-solid fa-book-bookmark mr-6 text-nosferatu-800 hover:text-dracula-900" />
                    <span
                      className={showAtAll ? "underline" : "hover:underline"}
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
                        onClick={syncClient}
                      />
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
                        const chats = getChatsByChatId(chatHistory, chatId);
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
                            clientJWT={clientJWT}
                          />
                        );
                      }
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
      )}
    </>
  );
};

export default ChatHistory;
