import { Bot } from "grammy";
import nodeFetch from "node-fetch";
import { getProxyAgent } from "./proxy.js";

// Token for Grammy instance
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || "123456:fake-token-for-testing-purposes";

// Generate proxy agent for Telegram API
export const agent = getProxyAgent("api.telegram.org");
// Use node-fetch in Bun environment because native fetch does not support proxy agents
const botConfig = agent ? { client: { baseFetchConfig: { agent, fetch: nodeFetch } } } : {};
export const bot = new Bot(TG_BOT_TOKEN, botConfig);

// Start Telegram listener (Long Polling)
export async function startTgListener() {
  if (!process.env.TG_BOT_TOKEN) {
    console.error("TG_BOT_TOKEN is not set in env");
    process.exit(1);
  }

  console.log("[Telegram] Launching bot runner (Long Polling)...");
  return bot.start({
    onStart: (info) => {
      console.log(`[Telegram] Bot started successfully as @${info.username}`);
    }
  });
}
