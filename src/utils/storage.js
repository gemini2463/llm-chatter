import { openDB } from "idb";
import LZString from "lz-string";

const DB_NAME = "LLMChatterDB";
const DB_VERSION = 1;
const STORE_NAME = "chatHistory";

class StorageService {
  async initDB() {
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }

  async saveChatHistory(username, chatHistory) {
    if (!this.db) await this.initDB();

    // Compress the data
    const compressed = LZString.compressToUTF16(JSON.stringify(chatHistory));

    // Store in IndexedDB
    await this.db.put(STORE_NAME, compressed, username);

    // Keep a small reference in localStorage for quick access
    const summary = {
      lastUpdated: Date.now(),
      chatCount: Object.keys(chatHistory).length,
      size: compressed.length,
    };
    localStorage.setItem(`chatSummary_${username}`, JSON.stringify(summary));
  }

  async getChatHistory(username) {
    if (!this.db) await this.initDB();

    const compressed = await this.db.get(STORE_NAME, username);
    if (!compressed) return {};

    // Decompress the data
    const decompressed = LZString.decompressFromUTF16(compressed);
    return JSON.parse(decompressed);
  }

  async deleteChatHistory(username) {
    if (!this.db) await this.initDB();
    await this.db.delete(STORE_NAME, username);
    localStorage.removeItem(`chatSummary_${username}`);
  }

  // Get storage size estimate
  async getStorageInfo() {
    if ("storage" in navigator && "estimate" in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        percent: (estimate.usage / estimate.quota) * 100,
      };
    }
    return null;
  }
}
export default new StorageService();
