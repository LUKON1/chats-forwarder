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
      const text = ctx.message.text || "";

      // Skip updates from other bots
      if (ctx.from?.is_bot) return;

      // 1. Handle connect pin-code onboarding command
      if (text.startsWith("/connect")) {
        const parts = text.split(" ");
        const code = parts[1]?.trim();

        if (!code) {
          await ctx.reply("Пожалуйста, укажите пин-код подключения. Пример: /connect 123456");
          return;
        }

        const validation = dbHelper.validateTempCode(code, "tg");
        if (validation) {
          const chatTitle = ctx.chat.title || ctx.chat.first_name || "Telegram Chat";
          dbHelper.addConnectedChat(validation.user_id, "tg", chatId, chatTitle);
          await ctx.reply(`Чат "${chatTitle}" успешно подключен к панели управления!`);
          console.log(`Telegram Chat connected: userId=${validation.user_id} chatId=${chatId} title=${chatTitle}`);
        } else {
          await ctx.reply("Неверный или истекший пин-код подключения.");
        }
        return;
      }

      const bridge = dbHelper.getBridgeByTg(chatId);

      if (logCount < 5) {
        console.log(`[TG Message] chatId=${chatId} hasActiveBridge=${!!bridge}`);
        logCount++;
      }

      // 2. Dynamic routing to multiple targets (TG -> VK, TG -> TG, etc.)
      const activeBridges = dbHelper.getBridgesBySource("tg", chatId);
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
