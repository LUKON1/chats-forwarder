import { TelegramAdapter } from "./tg.js";
import { VkAdapter } from "./vk.js";

// Registry to manage active platform adapters
class AdapterRegistry {
  constructor() {
    this.adapters = new Map();
  }

  // Register a new platform adapter
  register(platform, adapter) {
    this.adapters.set(platform.toLowerCase(), adapter);
    console.log(`Registered platform adapter: ${platform}`);
  }

  // Get adapter instance by platform name
  get(platform) {
    const adapter = this.adapters.get(platform.toLowerCase());
    if (!adapter) {
      throw new Error(`Platform adapter not found for platform: ${platform}`);
    }
    return adapter;
  }

  // List all registered platforms
  getRegisteredPlatforms() {
    return Array.from(this.adapters.keys());
  }
}

export const adapterRegistry = new AdapterRegistry();

// Initialize and register default adapters
adapterRegistry.register("tg", new TelegramAdapter());
adapterRegistry.register("vk", new VkAdapter());
