/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import {
  useEffect,
  useRef,
  useCallback,
  useState,
  useContext,
  React,
} from "react";
import Hyphenated from "react-hyphen";
import { RealtimeClient } from "@openai/realtime-api-beta";
import { WavRecorder, WavStreamPlayer } from "../wavtools/index.js";
import { WavRenderer } from "../utils/wav_renderer";
import { X, Zap } from "react-feather";
import copy from "copy-to-clipboard";
import { Button } from "./Button";
import { Toggle } from "./Toggle";
import "./ConsolePage.scss";
import { dataContext } from "../Chatter";
import XClose from "../components/XClose";

export const ConsolePage = ({ instructions, closeID, numba, relayWS }) => {
  const { clientJWT, checkedIn, componentList, setComponentList } =
    useContext(dataContext);

  const onClose = useCallback((id) => {
    setComponentList(componentList.filter((container) => container.id !== id));
  });

  const wavRecorderRef = useRef(new WavRecorder({ sampleRate: 24000 }));
  const wavStreamPlayerRef = useRef(new WavStreamPlayer({ sampleRate: 24000 }));
  const clientRef = useRef(new RealtimeClient({ url: relayWS }));

  const clientCanvasRef = useRef(null);
  const serverCanvasRef = useRef(null);
  const startTimeRef = useRef(new Date().toISOString());

  const [items, setItems] = useState([]);
  const [realtimeEvents, setRealtimeEvents] = useState([]);
  const [allConvo, setAllConvo] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [canPushToTalk, setCanPushToTalk] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [memoryKv, setMemoryKv] = useState({});
  const [coords, setCoords] = useState({
    lat: 37.775593,
    lng: -122.418137,
  });

  const connectConversation = useCallback(async () => {
    if (!checkedIn) {
      return;
    }

    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    // Set state variables
    startTimeRef.current = new Date().toISOString();
    setIsConnected(true);
    setRealtimeEvents([]);
    setItems(client.conversation.getItems());
    // Connect to microphone
    await wavRecorder.begin();
    // Connect to audio output
    await wavStreamPlayer.connect();
    // Connect to realtime API
    await client.connect();
    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: allConvo.length === 0 ? "Hello!" : JSON.stringify(allConvo),
      },
    ]);
    if (client.getTurnDetectionType() === "server_vad") {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  }, []);

  /* Disconnect and reset conversation state */
  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    //setItems([]);
    setMemoryKv({});
    setCoords({
      lat: 37.775593,
      lng: -122.418137,
    });
    const client = clientRef.current;
    client.disconnect();
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();
    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
  }, []);
  const deleteConversationItem = useCallback(async (id) => {
    const client = clientRef.current;
    client.deleteItem(id);
  }, []);

  /**
   * In push-to-talk mode, start recording
   * .appendInputAudio() for each sample
   */

  const startRecording = async () => {
    if (!checkedIn) {
      disconnectConversation;
      return;
    }
    setIsRecording(true);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await client.cancelResponse(trackId, offset);
    }
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  };

  /* In push-to-talk mode, stop recording */
  const stopRecording = async () => {
    if (!checkedIn) {
      disconnectConversation;
      return;
    }
    setIsRecording(false);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.pause();
    client.createResponse();
  };

  // Prevent any default touch behavior
  const handleStartRecording = (event) => {
    event.preventDefault();
    startRecording();
  };
  const handleStopRecording = (event) => {
    event.preventDefault();
    stopRecording();
  };

  /* Switch between Manual <> VAD mode for communication */
  const changeTurnEndType = async (value) => {
    if (!checkedIn) {
      disconnectConversation;
      return;
    }
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    if (value === "none" && wavRecorder.getStatus() === "recording") {
      await wavRecorder.pause();
    }
    client.updateSession({
      turn_detection: value === "none" ? null : { type: "server_vad" },
    });
    if (value === "server_vad" && client.isConnected()) {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
    setCanPushToTalk(value === "none");
  };

  /* Auto-scroll */
  useEffect(() => {
    // Automatically scroll to the bottom controls
    const eventsSection = document.querySelector(".content-actions.btns");
    if (eventsSection) {
      eventsSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [items]);

  useEffect(() => {
    if (!checkedIn) {
      disconnectConversation();
    }
  }, [checkedIn]);

  /* Set up render loops for the visualization canvas */
  useEffect(() => {
    let isLoaded = true;
    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx = null;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx = null;
    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext("2d");
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies("voice")
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              "#0099ff",
              10,
              0,
              8,
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width = serverCanvas.offsetWidth;
            serverCanvas.height = serverCanvas.offsetHeight;
          }
          serverCtx = serverCtx || serverCanvas.getContext("2d");
          if (serverCtx) {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies("voice")
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              serverCanvas,
              serverCtx,
              result.values,
              "#009900",
              10,
              0,
              8,
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();
    return () => {
      isLoaded = false;
    };
  }, []);

  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */

  useEffect(() => {
    // Get refs
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;

    // Set instructions
    client.updateSession({ instructions: instructions });

    // Set transcription, otherwise we don't get user transcriptions back
    client.updateSession({ input_audio_transcription: { model: "whisper-1" } });

    // Set voice randomly (missing: 'fable', 'onyx', 'nova')
    //exempt 'alloy', 'echo',  'shimmer'
    client.updateSession({
      voice: ["ash", "ballad", "coral", "sage", "verse"][
        Math.floor(Math.random() * 8)
      ],
    });

    // Add tools
    client.addTool(
      {
        name: "set_memory",
        description: "Saves important data about the user into memory.",
        parameters: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description:
                "The key of the memory value. Always use lowercase and underscores, no other characters.",
            },
            value: {
              type: "string",
              description: "Value can be anything represented as a string",
            },
          },
          required: ["key", "value"],
        },
      },
      async ({ key, value }) => {
        setMemoryKv((memoryKv) => {
          const newKv = { ...memoryKv };
          newKv[key] = value;
          return newKv;
        });
        return { ok: true };
      },
    );

    client.addTool(
      {
        name: "get_weather",
        description:
          "Retrieves the weather for a given lat, lng coordinate pair. Specify a label for the location.",
        parameters: {
          type: "object",
          properties: {
            lat: {
              type: "number",
              description: "Latitude",
            },
            lng: {
              type: "number",
              description: "Longitude",
            },
            location: {
              type: "string",
              description: "Name of the location",
            },
          },
          required: ["lat", "lng", "location"],
        },
      },
      async ({ lat, lng, location }) => {
        setCoords({ lat, lng, location });
        const result = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m`,
        );
        const json = await result.json();
        const temperature = {
          value: json.current.temperature_2m,
          units: json.current_units.temperature_2m,
        };
        const wind_speed = {
          value: json.current.wind_speed_10m,
          units: json.current_units.wind_speed_10m,
        };
        return json;
      },
    );

    // handle realtime events from client + server for event logging
    client.on("realtime.event", (realtimeEvent) => {
      setRealtimeEvents((realtimeEvents) => {
        const lastEvent = realtimeEvents[realtimeEvents.length - 1];
        if (lastEvent?.event.type === realtimeEvent.event.type) {
          // if we receive multiple events in a row, aggregate them for display purposes
          lastEvent.count = (lastEvent.count || 0) + 1;
          return realtimeEvents.slice(0, -1).concat(lastEvent);
        } else {
          return realtimeEvents.concat(realtimeEvent);
        }
      });
    });

    client.on("error", (event) => console.error(event));

    client.on("conversation.interrupted", async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });

    client.on("conversation.updated", async ({ item, delta }) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      if (item.status === "completed" && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000,
        );
        item.formatted.file = wavFile;
      }
      setItems(items);
      setAllConvo((prev) => [
        ...prev,
        { role: item.role, text: item.formatted.text },
      ]);
    });

    setItems(client.conversation.getItems());

    return () => {
      // cleanup; resets to defaults
      client.reset();
    };
  }, [instructions]);

  const copyClick = useCallback((value) => {
    if (typeof value === "string") {
      copy(value);
    }
  });

  const handleCopy = useCallback((e) => {
    e.preventDefault();
    const selectedText = document.getSelection().toString();

    //Remove soft hyphens
    const textContent = selectedText.replace(/\xAD/g, "");

    navigator.clipboard.writeText(textContent);
  });

  return (
    <div className="min-w-[99%] self-start mt-2 mb-2 mb-1 inline p-2 bg-nosferatu-200 rounded-3xl bg-gradient-to-tl from-nosferatu-500 shadow-sm">
      {/* Chat ID number, Type of Model, X-Close button */}
      <table className="min-w-[99%] border-separate border-spacing-y-2 border-spacing-x-2">
        <tbody>
          <tr>
            <td
              colSpan="2"
              className="pb-4 tracking-wide text-4xl text-center font-bold text-black"
            >
              <span className="mr-6">#{numba}</span>
              <i className="fa-regular fa-comments mr-6 text-black"></i>
              OpenAI Realtime
            </td>
            <td>
              <XClose onClose={onClose} closeID={closeID} />
            </td>
          </tr>
          <tr>
            <td
              onCopy={handleCopy}
              colSpan="3"
              className="py-3 p-3 bg-morbius-300 font-sans rounded-xl text-black-800 text-md whitespace-pre-wrap"
            >
              <div className="mb-3 grid grid-cols-3">
                <span className="font-bold text-xl text-aro-900">
                  Starting Prompt
                </span>
                <span></span>
                <span className="text-right cursor-copy">
                  <i
                    onClick={() => copyClick(instructions)}
                    className="text-aro-900 m-2 fa-solid fa-copy fa-2x cursor-copy shadow-xl hover:shadow-dracula-900"
                  ></i>
                </span>
              </div>
              <div>
                <Hyphenated>{instructions}</Hyphenated>
              </div>
            </td>
          </tr>
          <tr>
            <td colSpan="3">
              <div data-component="ConsolePage">
                <div className="content-main">
                  <div className="content-logs">
                    <div className="content-block conversation">
                      <div
                        className="content-block-body"
                        data-conversation-content
                      >
                        {!items.length && (
                          <div className="py-3 whitespace-pre-wrap p-3 bg-nosferatu-100 font-mono rounded-xl text-vanHelsing-200 text-sm">
                            <div>
                              <span className="font-bold text-xl text-aro-900">
                                OpenAI Realtime
                              </span>
                            </div>
                            <div className="mt-6 text-black">
                              <span>Awaiting Connection...</span>
                            </div>
                          </div>
                        )}
                        {items.map((conversationItem) => {
                          const role = conversationItem.role;
                          const transcript =
                            conversationItem.formatted.transcript;
                          const text = conversationItem.formatted.text;

                          return (
                            <div
                              className={
                                role === "user"
                                  ? "p-3 mt-2 bg-morbius-300 font-sans rounded-xl text-black text-md whitespace-pre-wrap"
                                  : "p-3 mt-2 whitespace-pre-wrap bg-nosferatu-100 font-mono rounded-xl text-black text-md"
                              }
                              key={conversationItem.id}
                            >
                              {conversationItem.type ===
                                "function_call_output" && (
                                <div>{conversationItem.formatted.output}</div>
                              )}
                              {conversationItem.formatted.tool && (
                                <div>
                                  {conversationItem.formatted.tool.name}(
                                  {conversationItem.formatted.tool.arguments})
                                </div>
                              )}
                              {!conversationItem.formatted.tool &&
                                (role === "user" ? (
                                  <>
                                    <div className="flex">
                                      <div className="flex-1">
                                        <span className="font-bold text-xl text-aro-900 mb-3">
                                          User
                                        </span>
                                      </div>
                                    </div>
                                    <div className="mt-3">
                                      {transcript || text || "(item sent)"}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex">
                                      <div className="flex-1">
                                        <span className="font-bold text-xl text-aro-900 mb-3">
                                          OpenAI Realtime
                                        </span>
                                      </div>
                                    </div>
                                    <div className="mt-3">
                                      {transcript ||
                                        text ||
                                        "(awaiting response or snipped)"}
                                    </div>
                                  </>
                                ))}
                              {conversationItem.formatted.file &&
                                role != "user" && (
                                  <audio
                                    className="mt-6"
                                    src={conversationItem.formatted.file.url}
                                    controls
                                  />
                                )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="content-block events">
                      <div className="visualization">
                        <div className="visualization-entry client">
                          <canvas ref={clientCanvasRef} />
                        </div>
                        <div className="visualization-entry server">
                          <canvas ref={serverCanvasRef} />
                        </div>
                      </div>
                    </div>

                    {checkedIn ? (
                      <>
                        {isConnected && canPushToTalk ? (
                          <div className="content-actions ptt mt-3">
                            <Button
                              label={
                                isRecording ? "release to send" : "push to talk"
                              }
                              buttonStyle={isRecording ? "alert" : "regular"}
                              disabled={!isConnected || !canPushToTalk}
                              onMouseDown={startRecording}
                              onMouseUp={stopRecording}
                              onTouchStart={handleStartRecording}
                              onTouchEnd={handleStopRecording}
                            />
                          </div>
                        ) : (
                          <></>
                        )}
                        {!isConnected ? (
                          <div className="content-actions ptt mt-3">
                            <i className="fa-solid fa-triangle-exclamation text-marcelin-900 text-4xl" />
                          </div>
                        ) : (
                          <></>
                        )}

                        <div className="content-actions btns mt-1">
                          <Toggle
                            defaultValue={false}
                            labels={["PTT", "VAD"]}
                            values={["none", "server_vad"]}
                            onChange={(_, value) => changeTurnEndType(value)}
                          />
                          <div className="spacer" />
                          <Button
                            label={isConnected ? "Disconnect" : "Connect"}
                            iconPosition={isConnected ? "end" : "start"}
                            icon={isConnected ? X : Zap}
                            buttonStyle={isConnected ? "regular" : "action"}
                            onClick={
                              isConnected
                                ? disconnectConversation
                                : connectConversation
                            }
                          />
                        </div>
                      </>
                    ) : (
                      <div className="content-actions ptt mt-3">
                        <i className="fa-solid fa-triangle-exclamation text-marcelin-900 text-4xl" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
