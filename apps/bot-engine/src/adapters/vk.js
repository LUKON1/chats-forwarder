import nodeFetch from "node-fetch";
import { BaseAdapter } from "./base.js";
import { vk } from "../vk.js";
import { getProxyAgent } from "../proxy.js";
import { dbHelper } from "../db.js";
import { forwardVkToTg } from "../forwarder.js";

// Resolves VK user or community names (using caching)
async function resolveVkName(senderId) {
  let name = String(senderId);
  try {
    if (senderId > 0) {
      const [user] = await vk.api.users.get({ user_ids: senderId });
      name = `${user.first_name} ${user.last_name}`;
    } else if (senderId < 0) {
      const [group] = await vk.api.groups.getById({ group_ids: Math.abs(senderId) });
      name = group?.name || `Group ${Math.abs(senderId)}`;
    } else {
      name = "VK User";
    }
  } catch (err) {
    console.error(`Failed to resolve VK name for senderId=${senderId}:`, err);
  }
  return name;
}

// Extract VK nested messages recursively
async function extractVkMessageData(ctx, isRoot = true) {
  let textPart = ctx.text || "";

  if (!isRoot && textPart) {
    const senderName = await resolveVkName(ctx.senderId);
    textPart = `[Forwarded from ${senderName}]:\n${textPart}`;
  }

  const allAttachments = [...(ctx.attachments || [])];
  const allTexts = textPart ? [textPart] : [];

  if (ctx.hasReplyMessage && ctx.replyMessage) {
    const replyData = await extractVkMessageData(ctx.replyMessage, false);
    if (replyData.text) {
      const formattedReply = replyData.text.replace(/^\[Forwarded from /, '[Reply from ');
      allTexts.push(`>> ${formattedReply}`);
    }
    allAttachments.push(...replyData.attachments);
  }

  if (ctx.hasForwards && ctx.forwards && ctx.forwards.length > 0) {
    for (const fwd of ctx.forwards) {
      const fwdData = await extractVkMessageData(fwd, false);
      if (fwdData.text) {
        allTexts.push(fwdData.text);
      }
      allAttachments.push(...fwdData.attachments);
    }
  }

  return {
    text: allTexts.join("\n\n").trim(),
    attachments: allAttachments
  };
}

// Extract the best resolution photo from VK attachment
function getVkPhotoUrl(attachment) {
  const sizes = attachment.payload?.sizes ?? attachment.photo?.sizes ?? [];
  return [...sizes].sort((a, b) => b.width - a.width)[0]?.url ?? null;
}

// Extract document info from VK attachment
function getVkDocInfo(attachment) {
  const doc = attachment.payload ?? attachment.doc ?? {};
  const url = doc.url ?? null;
  const title = doc.title ?? `file.${doc.ext ?? "bin"}`;
  return url ? { url, title } : null;
}

// Extract voice info from VK attachment
function getVkVoiceUrl(attachment) {
  const am = attachment.payload ?? attachment.audioMessage ?? attachment.audio_message ?? {};
  return am.link_ogg ?? am.link_mp3 ?? null;
}

// VK Platform Adapter
export class VkAdapter extends BaseAdapter {
  constructor() {
    super("vk");
    this.initListeners();
  }

  // Register VK updates events to process onboarding and message forwarding
  initListeners() {
    vk.updates.on("message_new", async (ctx) => {
      try {
        // Skip updates sent by this bot itself to prevent loops
        if (ctx.senderId === -vk.updates.groupId) return;

        const text = ctx.text || "";

        // 1. Handle connect pin-code onboarding command
        if (text.startsWith("/connect")) {
          // Disallow connecting personal user messages
          if (ctx.peerId < 2000000000) {
            await ctx.send("Бот работает только в групповых беседах. Добавьте бота в беседу и отправьте команду там.");
            return;
          }

          const parts = text.split(" ");
          const code = parts[1]?.trim();

          if (!code) {
            await ctx.send("Пожалуйста, укажите пин-код подключения. Пример: /connect 123456");
            return;
          }

          const validation = await dbHelper.validateTempCode(code, "vk");
          if (validation) {
            let chatTitle = "VK Chat";
            let accessWarning = false;
            try {
              const res = await vk.api.messages.getConversationsById({
                peer_ids: ctx.peerId
              });
              if (res.items && res.items.length > 0 && res.items[0].chat_settings) {
                chatTitle = res.items[0].chat_settings.title || `VK Chat ${ctx.peerId}`;
              } else {
                chatTitle = `VK Chat ${ctx.peerId}`;
                accessWarning = true;
              }
            } catch (err) {
              console.error("Failed to get VK conversation details:", err);
              chatTitle = `VK Chat ${ctx.peerId}`;
              accessWarning = true;
            }

            await dbHelper.addConnectedChat(validation.userId, "vk", ctx.peerId, chatTitle);
            if (accessWarning) {
              await ctx.send(`Чат "${chatTitle}" успешно подключен!\n\n⚠️ Обратите внимание: бот не смог прочитать название беседы. Пожалуйста, сделайте бота администратором беседы и разрешите ему доступ к переписке в настройках сообщества, чтобы пересылка работала корректно.`);
            } else {
              await ctx.send(`Чат "${chatTitle}" успешно подключен к панели управления!`);
            }
            console.log(`VK Chat connected: userId=${validation.userId} peerId=${ctx.peerId} title=${chatTitle} (accessWarning=${accessWarning})`);
          } else {
            await ctx.send("Неверный или истекший пин-код подключения.");
          }
          return;
        }

        // 2. Route messages based on DB bridges configurations
        const activeBridges = await dbHelper.getBridgesBySource("vk", ctx.peerId);
        for (const bridge of activeBridges) {
          await forwardVkToTg(ctx, bridge);
        }
      } catch (err) {
        console.error("Error processing VK message in adapter:", err);
      }
    });
  }

  // Normalizes incoming VK message event
  async parseMessage(ctx) {
    if (ctx.senderId === -vk.updates.groupId) return null;

    const msgData = await extractVkMessageData(ctx, true);
    const attachments = [];

    // Parse attachments into uniform structure
    for (const attachment of msgData.attachments) {
      if (attachment.type === "photo") {
        attachments.push({
          type: "photo",
          url: getVkPhotoUrl(attachment),
        });
      } else if (attachment.type === "doc") {
        const info = getVkDocInfo(attachment);
        if (info) {
          attachments.push({
            type: "doc",
            url: info.url,
            filename: info.title,
          });
        }
      } else if (attachment.type === "audio_message") {
        attachments.push({
          type: "voice",
          url: getVkVoiceUrl(attachment),
          filename: "voice.ogg",
        });
      }
    }

    return {
      text: msgData.text,
      senderName: await resolveVkName(ctx.senderId),
      chatId: ctx.peerId,
      attachments,
    };
  }

  // Sends plain text message
  async sendMessage(chatId, text) {
    return vk.api.messages.send({
      peer_id: chatId,
      message: text,
      random_id: Math.floor(Math.random() * 1e15),
    });
  }

  // Sends a single photo
  async sendPhoto(chatId, url, caption) {
    const buffer = await this.downloadUrlToBuffer(url);
    const attachment = await vk.upload.messagePhoto({
      source: {
        value: buffer,
        filename: "photo.jpg"
      },
      peer_id: chatId
    });

    return vk.api.messages.send({
      peer_id: chatId,
      message: caption,
      attachment: `photo${attachment.ownerId}_${attachment.id}`,
      random_id: Math.floor(Math.random() * 1e15)
    });
  }

  // Sends an array of photos as a single media group (album)
  async sendMediaGroup(chatId, urls, caption) {
    const attachments = [];
    for (const url of urls) {
      const buffer = await this.downloadUrlToBuffer(url);
      const photo = await vk.upload.messagePhoto({
        source: {
          value: buffer,
          filename: "photo.jpg"
        },
        peer_id: chatId
      });
      attachments.push(`photo${photo.ownerId}_${photo.id}`);
    }

    return vk.api.messages.send({
      peer_id: chatId,
      message: caption,
      attachment: attachments.join(","),
      random_id: Math.floor(Math.random() * 1e15)
    });
  }

  // Sends a document
  async sendDocument(chatId, url, filename, caption) {
    const buffer = await this.downloadUrlToBuffer(url);
    const doc = await vk.upload.messageDocument({
      source: {
        value: buffer,
        filename
      },
      peer_id: chatId,
      title: filename
    });

    return vk.api.messages.send({
      peer_id: chatId,
      message: caption,
      attachment: `doc${doc.ownerId}_${doc.id}`,
      random_id: Math.floor(Math.random() * 1e15)
    });
  }

  // Sends a voice message
  async sendVoice(chatId, url) {
    const buffer = await this.downloadUrlToBuffer(url);
    const voice = await vk.upload.messageDocument({
      source: {
        value: buffer,
        filename: "voice.ogg"
      },
      peer_id: chatId,
      type: "audio_message",
      title: "Voice Message"
    });

    return vk.api.messages.send({
      peer_id: chatId,
      attachment: `doc${voice.ownerId}_${voice.id}`,
      random_id: Math.floor(Math.random() * 1e15)
    });
  }

  // Helper to fetch URL to memory buffer
  async downloadUrlToBuffer(url) {
    const hostname = new URL(url).hostname;
    const proxyAgent = getProxyAgent(hostname);
    const fetchOptions = proxyAgent ? { agent: proxyAgent } : {};
    
    const res = await nodeFetch(url, fetchOptions);
    if (!res.ok) {
      throw new Error(`Failed to fetch file to buffer: ${res.status} for URL ${url}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Downloads file from VK and returns ReadableStream
  async downloadFileStream(url) {
    const hostname = new URL(url).hostname;
    const proxyAgent = getProxyAgent(hostname);
    const fetchOptions = proxyAgent ? { agent: proxyAgent } : {};
    
    const res = await nodeFetch(url, fetchOptions);
    if (!res.ok) {
      throw new Error(`Failed to fetch VK file stream: ${res.status} for URL ${url}`);
    }
    return res.body; // Readable stream
  }

  // Handles VK Callback API HTTP Webhooks
  async handleWebhook(req) {
    try {
      const body = await req.json();
      
      if (body.type === "confirmation") {
        const confirmationCode = process.env.VK_CONFIRMATION_CODE || "";
        return new Response(confirmationCode, { status: 200 });
      }

      if (body.type === "message_new") {
        await vk.updates.handleWebhookUpdate(body);
      }

      return new Response("ok", { status: 200 });
    } catch (err) {
      console.error("VK webhook handling error:", err);
      return new Response("ok", { status: 200 });
    }
  }
}
