import { InputFile, InputMediaBuilder } from "grammy";
import nodeFetch from "node-fetch";
import { BaseAdapter } from "./base.js";
import { bot, agent } from "../tg.js";
import { getProxyAgent } from "../proxy.js";
import { dbHelper } from "../db.js";
import { forwardTgToVk } from "../forwarder.js";

// Telegram Platform Adapter
export class TelegramAdapter extends BaseAdapter {
  constructor() {
    super("tg");
    this.initListeners();
  }

  // Register bot events to process onboarding and message forwarding
  initListeners() {
    bot.on(["message", "channel_post"], async (ctx) => {
      try {
        const chatId = ctx.chat.id;
        const message = ctx.message || ctx.channelPost;
        if (!message) return;

        const text = message.text || message.caption || "";

        // Skip updates from other bots
        if (ctx.from?.is_bot) return;

        // 1. Handle connect pin-code onboarding command
        if (text.startsWith("/connect")) {
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

        // 2. Route messages based on DB bridges configurations
        const activeBridges = await dbHelper.getBridgesBySource("tg", chatId);
        for (const bridge of activeBridges) {
          await forwardTgToVk(ctx, bridge);
        }
      } catch (err) {
        console.error("Error processing TG update in adapter:", err);
      }
    });

    bot.catch((err) => {
      console.error("Error in Telegram bot:", err);
    });
  }

  // Normalizes incoming telegram message or channel post
  async parseMessage(ctx) {
    const message = ctx.message || ctx.channelPost;
    if (!message) return null;

    const authorSignature = message.author_signature;
    const senderName = ctx.from
      ? (ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : ""))
      : (authorSignature ? `${ctx.chat.title} (${authorSignature})` : (ctx.chat.title || "Telegram Channel"));

    const text = message.text || message.caption || "";
    const attachments = [];

    // Parse photos
    if (message.photo) {
      const photo = message.photo.at(-1);
      attachments.push({
        type: "photo",
        fileId: photo.file_id,
      });
    }

    // Parse documents
    if (message.document) {
      attachments.push({
        type: "doc",
        fileId: message.document.file_id,
        filename: message.document.file_name || "file.bin",
      });
    }

    // Parse voice messages
    if (message.voice) {
      attachments.push({
        type: "voice",
        fileId: message.voice.file_id,
        filename: "voice.ogg",
      });
    }

    return {
      text,
      senderName,
      chatId: ctx.chat.id,
      mediaGroupId: message.media_group_id || null,
      attachments,
    };
  }

  // Sends plain text message
  async sendMessage(chatId, text, options = {}) {
    return bot.api.sendMessage(chatId, text, {
      parse_mode: "HTML",
      ...options,
    });
  }

  // Sends a single photo using direct URL
  async sendPhoto(chatId, url, caption) {
    return bot.api.sendPhoto(chatId, url, {
      caption,
      parse_mode: "HTML",
    });
  }

  // Sends an array of photos as a single media group (album)
  async sendMediaGroup(chatId, urls, caption) {
    const media = urls.map((url, i) =>
      InputMediaBuilder.photo(url, i === 0 ? { caption, parse_mode: "HTML" } : {})
    );
    return bot.api.sendMediaGroup(chatId, media);
  }

  // Sends document by streaming its content directly without local disk writes
  async sendDocument(chatId, url, filename, caption) {
    const stream = await this.downloadUrlStream(url);
    const file = new InputFile(stream, filename);
    return bot.api.sendDocument(chatId, file, {
      caption,
      parse_mode: "HTML",
    });
  }

  // Sends voice message by streaming its content directly without local disk writes
  async sendVoice(chatId, url) {
    const stream = await this.downloadUrlStream(url);
    const file = new InputFile(stream, "voice.ogg");
    return bot.api.sendVoice(chatId, file);
  }

  // Helper to fetch file stream from external platform (e.g. VK servers)
  async downloadUrlStream(url) {
    const hostname = new URL(url).hostname;
    const vkAgent = getProxyAgent(hostname);
    const fetchOptions = vkAgent ? { agent: vkAgent } : {};
    
    const res = await nodeFetch(url, fetchOptions);
    if (!res.ok) {
      throw new Error(`Failed to fetch file stream: ${res.status} for URL ${url}`);
    }
    return res.body; // Readable stream
  }

  // Downloads file from Telegram API and returns Readable stream
  async downloadFileStream(fileId) {
    const file = await bot.api.getFile(fileId);
    const url = `https://api.telegram.org/file/bot${process.env.TG_BOT_TOKEN}/${file.file_path}`;
    
    const fetchOptions = agent ? { agent } : {};
    const res = await nodeFetch(url, fetchOptions);
    if (!res.ok) {
      throw new Error(`Failed to download TG file: ${res.status} for fileId ${fileId}`);
    }
    return res.body; // Readable stream
  }

  // Resolves direct URL for a Telegram file
  async getFileUrl(fileId) {
    const file = await bot.api.getFile(fileId);
    return `https://api.telegram.org/file/bot${process.env.TG_BOT_TOKEN}/${file.file_path}`;
  }

  // Processes incoming Webhook requests
  async handleWebhook(req) {
    try {
      const body = await req.json();
      if (!bot.botInfo) {
        await bot.init();
      }
      await bot.handleUpdate(body);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Telegram webhook handling error:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
}
