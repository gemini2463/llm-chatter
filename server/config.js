const Config = {
  clientDomains: ["http://localhost:8181"],
  serverBehindCloudflare: false,
  ollamaEnabled: true,
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
  timeFormat: "DD/MM/YYYY HH:mm:ss",
};

export default Config;
