const Config = {
  clientDomains: ["http://localhost:8181"],
  serverBehindCloudflare: false,
  ollamaEnabled: true,
  reasoningModels: ["o1", "o1-mini", "o3-mini", "o4-mini"],
  imgOutputModels: ["gpt-image-1", "gemini-2.0-flash-preview-image-generation"],
  timeFormat: "DD/MM/YYYY HH:mm:ss",
};

export default Config;
