import { Bot, InputFile, InputMediaBuilder } from "grammy";
import { existsSync, mkdirSync, unlinkSync, promises as fsPromises } from "node:fs";
import { join } from "node:path";
import crypto from "node:crypto";
import nodeFetch from "node-fetch";
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
export const agent = getProxyAgent("api.telegram.org");
// Use node-fetch in Bun environment because native fetch does not support proxy agents
const botConfig = agent ? { client: { baseFetchConfig: { agent, fetch: nodeFetch } } } : {};
export const bot = new Bot(TG_BOT_TOKEN, botConfig);

// Download VK file to disk (/tmp/vk-tg-forwarder) using Node fs
async function downloadVkFileToDisk(url, filename) {
  const hostname = new URL(url).hostname;
  const vkAgent = getProxyAgent(hostname);
  const res = vkAgent ? await nodeFetch(url, { agent: vkAgent }) : await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${url}`);
  
  const tempFileName = `vk_${crypto.randomUUID()}_${filename}`;
  const tempFilePath = join(TMP_DIR, tempFileName);
  
  const arrayBuffer = await res.arrayBuffer();
  await fsPromises.writeFile(tempFilePath, Buffer.from(arrayBuffer));
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
        // Disallow connecting personal user messages
        if (chatId > 0) {
          try {
            await ctx.reply("Этот бот предназначен для работы в группах и каналах. Добавьте его в вашу группу или канал и отправьте команду там.");
          } catch (err) {
            console.error("Failed to send context warning in TG:", err);
          }
          return;
        }

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

        const validation = await dbHelper.validateTempCode(code, "tg");
        if (validation) {
          const chatTitle = ctx.chat.title || ctx.from?.first_name || "Telegram Chat";
          await dbHelper.addConnectedChat(validation.userId, "tg", chatId, chatTitle);
          try {
            await ctx.reply(`Чат "${chatTitle}" успешно подключен к панели управления!`);
          } catch (err) {
            console.error("Failed to send connection success reply:", err);
          }
          console.log(`Telegram Chat connected: userId=${validation.userId} chatId=${chatId} title=${chatTitle}`);
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
      const activeBridges = await dbHelper.getBridgesBySource("tg", chatId);


      for (const bridge of activeBridges) {
        await forwardHandler(ctx, bridge);
      }
    } catch (err) {
      console.error("Error processing TG message:", err);
    }
  });

  bot.catch((err) => {
    console.error("Error in Telegram bot:", err);
  });

  // Start grammY runner
  console.log("Launching Telegram bot runner...");
  bot.start({
    onStart: (info) => {
      console.log(`Telegram Bot started as @${info.username}`);
    }
  });
}
