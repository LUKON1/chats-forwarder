import { Bot, InputFile, InputMediaBuilder } from "grammy";
import { getProxyAgent } from "./proxy.js";
import { dbHelper } from "./db.js";

const { TG_BOT_TOKEN } = process.env;

if (!TG_BOT_TOKEN) {
  console.error("TG_BOT_TOKEN is not set in env");
  process.exit(1);
}

// Generate proxy agent for Telegram API
const agent = getProxyAgent("api.telegram.org");
const botConfig = agent ? { client: { baseFetchConfig: { agent } } } : {};
export const bot = new Bot(TG_BOT_TOKEN, botConfig);

// Helper to download remote files (VK links) into buffer for Telegram delivery
async function fetchBuffer(url) {
  // Bun's native fetch handles HTTP_PROXY/HTTPS_PROXY env variables automatically
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchBuffer failed: ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// Telegram sending helpers (VK -> TG)
export function sendText(chatId, text) {
  return bot.api.sendMessage(chatId, text, { parse_mode: "HTML" });
}

export function sendPhoto(chatId, url, caption) {
  return bot.api.sendPhoto(chatId, url, { caption, parse_mode: "HTML" });
}

export function sendMediaGroup(chatId, urls, caption) {
  const media = urls.map((url, i) =>
    InputMediaBuilder.photo(url, i === 0 ? { caption, parse_mode: "HTML" } : {})
  );
  return bot.api.sendMediaGroup(chatId, media);
}

export async function sendDocument(chatId, url, filename, caption) {
  const buffer = await fetchBuffer(url);
  const file = new InputFile(buffer, filename);
  return bot.api.sendDocument(chatId, file, caption ? { caption, parse_mode: "HTML" } : {});
}

export async function sendVoice(chatId, url) {
  const buffer = await fetchBuffer(url);
  return bot.api.sendVoice(chatId, new InputFile(buffer, "voice.ogg"));
}

// Start Telegram listener for forwarding TG -> VK
export async function startTgListener(forwardHandler) {
  let logCount = 0;

  // Listen to any message (text, photos, documents, etc.)
  bot.on("message", async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      // Skip updates from VK bot itself to avoid infinite loops if it posts to the same chat
      if (ctx.from?.is_bot) return;

      const bridge = dbHelper.getBridgeByTg(chatId);

      if (logCount < 5) {
        console.log(`[TG Message] chatId=${chatId} hasActiveBridge=${!!bridge}`);
        logCount++;
      }

      if (!bridge) return;

      // Check if forwarding in this direction is enabled (tg_to_vk)
      if (bridge.direction === "tg_to_vk") {
        await forwardHandler(ctx, bridge, "tg_to_vk");
      }
    } catch (err) {
      console.error("Error processing TG message:", err);
    }
  });

  // Start grammY runner
  bot.start({
    onStart: (info) => {
      console.log(`Telegram Bot started as @${info.username}`);
    }
  });
}
