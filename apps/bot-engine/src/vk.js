import { VK } from "vk-io";
import { getProxyAgent } from "./proxy.js";

// Token for VK community instance
const VK_COMMUNITY_TOKEN = process.env.VK_COMMUNITY_TOKEN || "fake-token-for-testing-purposes";

// Generate proxy agents for API and Updates
const apiAgent = getProxyAgent("api.vk.com");
const updatesAgent = getProxyAgent("lp.vk.com");

// Shared VK instance using community token and proxy if configured
export const vk = new VK({
  token: VK_COMMUNITY_TOKEN,
  api: {
    agent: apiAgent
  },
  updates: {
    agent: updatesAgent
  }
});

// Start Bots Long Poll
export async function startVkListener() {
  if (!process.env.VK_COMMUNITY_TOKEN) {
    console.error("VK_COMMUNITY_TOKEN is not set in env");
    process.exit(1);
  }

  console.log("[VK] Launching Updates listener (Long Polling)...");
  await vk.updates.start().then(() => {
    console.log("[VK] Updates listener started successfully");
  }).catch((err) => {
    console.error("[VK] Long Poll failed to start:", err);
    process.exit(1);
  });
}
