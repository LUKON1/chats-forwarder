import { Bot, InputFile, InputMediaBuilder } from "grammy";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import crypto from "node:crypto";
import { getProxyAgent } from "./proxy.js";
import { dbHelper } from "./db.js";

const { TG_BOT_TOKEN } = process.env;

if (!TG_BOT_TOKEN) {
  console.error("TG_BOT_TOKEN is not set in env");
  process.exit(1);
}

// Temporary directory inside container for file transfers
const TMP_DIR = "/tmp/chat-forwarder";
if (!existsSync(TMP_DIR)) {
  mkdirSync(TMP_DIR, { recursive: true });
}

// Generate proxy agent for Telegram API
const agent = getProxyAgent("api.telegram.org");
const botConfig = agent ? { client: { baseFetchConfig: { agent } } } : {};
export const bot = new Bot(TG_BOT_TOKEN, botConfig);

// Download VK file to disk (/tmp/vk-tg-forwarder) using Bun.write
async function downloadVkFileToDisk(url, filename) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${url}`);
  
  const tempFileName = `vk_${crypto.randomUUID()}_${filename}`;
  const tempFilePath = join(TMP_DIR, tempFileName);
  
  await Bun.write(tempFilePath, res);
  return tempFilePath;
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
  const tempPath = await downloadVkFileToDisk(url, filename);
  try {
    const file = new InputFile(tempPath, filename);
    return await bot.api.sendDocument(chatId, file, caption ? { caption, parse_mode: "HTML" } : {});
  } finally {
    if (existsSync(tempPath)) unlinkSync(tempPath);
  }
}

export async function sendVoice(chatId, url) {
  const tempPath = await downloadVkFileToDisk(url, "voice.ogg");
  try {
    const file = new InputFile(tempPath, "voice.ogg");
    return await bot.api.sendVoice(chatId, file);
  } finally {
    if (existsSync(tempPath)) unlinkSync(tempPath);
  }
}

// Start Telegram listener for forwarding TG -> VK (both messages and channel posts)
export async function startTgListener(forwardHandler) {
  let logCount = 0;

  // Listen to any message (text, photos, documents, etc.) in chats, groups, and channels
  bot.on(["message", "channel_post"], async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const message = ctx.message || ctx.channelPost;
      if (!message) return;

      const text = message.text || message.caption || "";

      // Skip updates from other bots (only applies if we have sender info)
      if (ctx.from?.is_bot) return;

      // 1. Handle connect pin-code onboarding command
      if (text.startsWith("/connect")) {
        const parts = text.split(" ");
        const code = parts[1]?.trim();

        if (!code) {
          try {
            await ctx.reply("Пожалуйста, укажите пин-код подключения. Пример: /connect 123456");
          } catch (err) {
            console.error("Failed to send command instructions:", err);
          }
          return;
        }

        const validation = dbHelper.validateTempCode(code, "tg");
        if (validation) {
          const chatTitle = ctx.chat.title || ctx.from?.first_name || "Telegram Chat";
          dbHelper.addConnectedChat(validation.user_id, "tg", chatId, chatTitle);
          try {
            await ctx.reply(`Чат "${chatTitle}" успешно подключен к панели управления!`);
          } catch (err) {
            console.error("Failed to send connection success reply:", err);
          }
          console.log(`Telegram Chat connected: userId=${validation.user_id} chatId=${chatId} title=${chatTitle}`);
        } else {
          try {
            await ctx.reply("Неверный или истекший пин-код подключения.");
          } catch (err) {
            console.error("Failed to send connection fail reply:", err);
          }
        }
        return;
      }
      // Dynamic routing to multiple targets (TG -> VK, TG -> TG, etc.)
      const activeBridges = dbHelper.getBridgesBySource("tg", chatId);

      if (logCount < 5) {
        console.log(`[TG Message] chatId=${chatId} hasActiveBridge=${activeBridges.length > 0}`);
        logCount++;
      }

      for (const bridge of activeBridges) {
        await forwardHandler(ctx, bridge);
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
