import { VK } from "vk-io";
import { getProxyAgent } from "./proxy.js";
import { dbHelper } from "./db.js";

const { VK_COMMUNITY_TOKEN } = process.env;

if (!VK_COMMUNITY_TOKEN) {
  console.error("VK_COMMUNITY_TOKEN is not set in env");
  process.exit(1);
}

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

// Start Bots Long Poll and route messages dynamically based on DB routes
export async function startVkListener(forwardHandler) {
  let logCount = 0;

  vk.updates.on("message_new", async (ctx) => {
    try {
      // Find active bridge in DB for this VK peer ID
      const bridge = dbHelper.getBridgeByVk(ctx.peerId);
      
      if (logCount < 5) {
        console.log(`[VK Message] peerId=${ctx.peerId} hasActiveBridge=${!!bridge}`);
        logCount++;
      }

      if (!bridge) return;

      // Check if forwarding in this direction is enabled (vk_to_tg)
      if (bridge.direction === "vk_to_tg") {
        await forwardHandler(ctx, bridge, "vk_to_tg");
      }
    } catch (err) {
      console.error("Error processing VK message:", err);
    }
  });

  await vk.updates.start().then(() => {
    console.log("VK Bots Long Poll started");
  }).catch((err) => {
    console.error("VK Long Poll failed to start:", err);
    process.exit(1);
  });
}
