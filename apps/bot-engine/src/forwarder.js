import { vk } from "./vk.js";
import { bot, sendText, sendPhoto, sendMediaGroup, sendDocument, sendVoice, agent } from "./tg.js";
import { dbHelper, redis } from "./db.js";
import { mkdirSync, existsSync, unlinkSync, readFileSync, promises as fsPromises } from "fs";
import { join } from "path";
import crypto from "crypto";
import nodeFetch from "node-fetch";
import { getProxyAgent } from "./proxy.js";

// Temporary directory inside container for file transfers
const TMP_DIR = "/tmp/chat-forwarder";
if (!existsSync(TMP_DIR)) {
  mkdirSync(TMP_DIR, { recursive: true });
}

// Buffer to accumulate Telegram media groups (albums)
const mediaGroupBuffers = new Map();

// Helper to upload files to VK upload servers using Node File API
async function uploadToVkServer(uploadUrl, filePath, filename, fieldName = "file") {
  const buffer = readFileSync(filePath);
  // Create standard File object which is supported natively in Node.js 20+ and Bun
  const file = new File([buffer], filename);
  const formData = new FormData();
  formData.append(fieldName, file);

  const hostname = new URL(uploadUrl).hostname;
  const vkAgent = getProxyAgent(hostname);

  const fetchOptions = {
    method: "POST",
    body: formData
  };

  if (vkAgent) {
    fetchOptions.agent = vkAgent;
  }

  // Use nodeFetch because standard fetch does not support proxy agents easily
  const res = await nodeFetch(uploadUrl, fetchOptions);

  if (!res.ok) throw new Error(`VK upload HTTP error: ${res.status}`);
  return res.json();
}

// Download Telegram file to disk (/tmp/chat-forwarder) using Node fs
async function downloadTelegramFile(fileId) {
  const file = await bot.api.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${process.env.TG_BOT_TOKEN}/${file.file_path}`;
  
  const fetchOptions = agent ? { agent } : {};
  const res = await nodeFetch(url, fetchOptions);
  if (!res.ok) throw new Error(`Download TG file error: ${res.status}`);
  
  const tempFileName = `tg_${crypto.randomUUID()}_${file.file_path.split("/").pop()}`;
  const tempFilePath = join(TMP_DIR, tempFileName);
  
  const arrayBuffer = await res.arrayBuffer();
  await fsPromises.writeFile(tempFilePath, Buffer.from(arrayBuffer));
  return tempFilePath;
}

// Resolve VK user or community names with Redis caching (TTL 24 hours)
async function resolveVkName(senderId) {
  const cacheKey = `vk:name:${senderId}`;
  try {
    const cachedName = await redis.get(cacheKey);
    if (cachedName) return cachedName;
  } catch (err) {
    console.error("Redis read error in resolveVkName:", err);
  }

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

    try {
      // Cache name for 24 hours
      await redis.setex(cacheKey, 86400, name);
    } catch (err) {
      console.error("Redis write error in resolveVkName:", err);
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

// Universal Forwarding Entrypoint
export async function forwardMessage(ctx, bridge) {
  // If reversed, construct a virtual active bridge with swapped source and target fields
  const activeBridge = bridge.isReversed
    ? {
        ...bridge,
        sourcePlatform: bridge.targetPlatform,
        sourceChatId: bridge.targetChatId,
        targetPlatform: bridge.sourcePlatform,
        targetChatId: bridge.sourceChatId
      }
    : bridge;

  const { targetPlatform } = activeBridge;

  if (targetPlatform === "tg") {
    await forwardToTg(ctx, activeBridge);
  } else if (targetPlatform === "vk") {
    await forwardToVk(ctx, activeBridge);
  }
}

// --- TARGET: TELEGRAM ---
async function forwardToTg(ctx, bridge) {
  const tgChatId = bridge.targetChatId;
  const sourcePlatform = bridge.sourcePlatform;
  let logText = "";

  try {
    // A. SOURCE IS VK -> TARGET IS TG
    if (sourcePlatform === "vk") {
      const senderName = await resolveVkName(ctx.senderId);
      const prefix = bridge.showAuthor ? `${senderName}: ` : "";

      const msgData = await extractVkMessageData(ctx, true);
      const caption = msgData.text ? `${prefix}${msgData.text}` : (prefix ? prefix.slice(0, -2) : "");
      logText = msgData.text || "[Media attachment]";

      const photoUrls = msgData.attachments
        .filter((a) => a.type === "photo")
        .map(getVkPhotoUrl)
        .filter(Boolean);

      const docs = msgData.attachments
        .filter((a) => a.type === "doc")
        .map(getVkDocInfo)
        .filter(Boolean);

      const voiceUrls = msgData.attachments
        .filter((a) => a.type === "audio_message")
        .map(getVkVoiceUrl)
        .filter(Boolean);

      const hasMedia = photoUrls.length > 0 || docs.length > 0 || voiceUrls.length > 0;

      if (!hasMedia) {
        if (msgData.text) await sendText(tgChatId, caption);
        console.log(`[Forward Success] bridge=${bridge.id} direction=vk_to_tg message="${logText}"`);
        return;
      }

      let captionUsed = false;

      if (photoUrls.length === 1) {
        await sendPhoto(tgChatId, photoUrls[0], caption);
        captionUsed = true;
      } else if (photoUrls.length > 1) {
        for (let i = 0; i < photoUrls.length; i += 10) {
          const chunk = photoUrls.slice(i, i + 10);
          const chunkCaption = (i === 0) ? caption : undefined;
          if (chunk.length === 1) {
            await sendPhoto(tgChatId, chunk[0], chunkCaption);
          } else {
            await sendMediaGroup(tgChatId, chunk, chunkCaption);
          }
        }
        captionUsed = true;
      }

      for (const doc of docs) {
        const docCaption = captionUsed ? undefined : caption;
        await sendDocument(tgChatId, doc.url, doc.title, docCaption);
        captionUsed = true;
      }

      for (const url of voiceUrls) {
        await sendVoice(tgChatId, url);
      }

      console.log(`[Forward Success] bridge=${bridge.id} direction=vk_to_tg message="${logText}"`);
    }
    
    // B. SOURCE IS TG -> TARGET IS TG
    else if (sourcePlatform === "tg") {
      const message = ctx.message || ctx.channelPost;
      const authorSignature = message?.author_signature;
      const senderName = ctx.from
        ? (ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : ""))
        : (authorSignature ? `${ctx.chat.title} (${authorSignature})` : (ctx.chat.title || "Telegram Channel"));

      const prefix = bridge.showAuthor ? `${senderName}: ` : "";
      const messageText = message?.text || message?.caption || "";
      logText = messageText || "[TG-to-TG copy]";

      if (message?.text) {
        const fullText = `${prefix}${message.text}`;
        const shiftedEntities = message.entities?.map(entity => ({
          ...entity,
          offset: entity.offset + prefix.length
        }));

        await bot.api.sendMessage(tgChatId, fullText, {
          entities: shiftedEntities
        });
      } else {
        const caption = messageText ? `${prefix}${messageText}` : (prefix ? prefix.slice(0, -2) : "");
        await bot.api.copyMessage(tgChatId, ctx.chat.id, message.message_id, {
          caption: caption || undefined
        });
      }

      console.log(`[Forward Success] bridge=${bridge.id} direction=tg_to_tg message="${logText}"`);
    }
  } catch (err) {
    console.error(`[Forward Error] bridge=${bridge.id} direction=${sourcePlatform}_to_tg error="${err.message}"`);
  }
}

// --- TARGET: VK ---
async function forwardToVk(ctx, bridge) {
  const sourcePlatform = bridge.sourcePlatform;

  if (sourcePlatform === "tg") {
    const message = ctx.message || ctx.channelPost;
    // Buffer TG media groups to avoid multiple VK posts
    const mediaGroupId = message?.media_group_id;
    if (!mediaGroupId) {
      return processSingleTgToVk(ctx, bridge);
    }

    if (!mediaGroupBuffers.has(mediaGroupId)) {
      mediaGroupBuffers.set(mediaGroupId, {
        messages: [ctx],
        bridge,
        timer: setTimeout(() => {
          flushTgMediaGroupToVk(mediaGroupId);
        }, 800)
      });
    } else {
      const buffer = mediaGroupBuffers.get(mediaGroupId);
      buffer.messages.push(ctx);
    }
  } 
  
  else if (sourcePlatform === "vk") {
    // Direct VK-to-VK transfer using native attachment strings
    await processVkToVk(ctx, bridge);
  }
}

// A. SOURCE IS TG -> TARGET IS VK (Single message)
async function processSingleTgToVk(ctx, bridge) {
  const vkPeerId = bridge.targetChatId;
  let logText = "";
  const tempFiles = [];
  try {
    const message = ctx.message || ctx.channelPost;
    const hasSupportedMedia = message?.photo || message?.document || message?.voice;
    const messageText = message?.text || message?.caption || "";

    if (!messageText && !hasSupportedMedia) return;

    const authorSignature = message?.author_signature;
    const senderName = ctx.from
      ? (ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : ""))
      : (authorSignature ? `${ctx.chat.title} (${authorSignature})` : (ctx.chat.title || "Telegram Channel"));

    const prefix = bridge.showAuthor ? `${senderName}: ` : "";
    const fullText = messageText ? `${prefix}${messageText}` : (prefix ? prefix.slice(0, -2) : "");
    logText = messageText || "[Media attachment]";

    const attachments = [];

    if (message.photo) {
      const photo = message.photo.at(-1);
      const tempPath = await downloadTelegramFile(photo.file_id);
      tempFiles.push(tempPath);
      const server = await vk.api.photos.getMessagesUploadServer({ peer_id: vkPeerId });
      const uploadRes = await uploadToVkServer(server.upload_url, tempPath, "photo.jpg", "photo");
      const [saved] = await vk.api.photos.saveMessagesPhoto(uploadRes);
      attachments.push(`photo${saved.owner_id}_${saved.id}`);
    }

    if (message.document) {
      const doc = message.document;
      const tempPath = await downloadTelegramFile(doc.file_id);
      tempFiles.push(tempPath);
      const server = await vk.api.docs.getMessagesUploadServer({ peer_id: vkPeerId, type: "doc" });
      const uploadRes = await uploadToVkServer(server.upload_url, tempPath, doc.file_name);
      const saved = await vk.api.docs.save({ file: uploadRes.file, title: doc.file_name });
      attachments.push(`doc${saved.doc.owner_id}_${saved.doc.id}`);
    }

    if (message.voice) {
      const voice = message.voice;
      const tempPath = await downloadTelegramFile(voice.file_id);
      tempFiles.push(tempPath);
      const server = await vk.api.docs.getMessagesUploadServer({ peer_id: vkPeerId, type: "audio_message" });
      const uploadRes = await uploadToVkServer(server.upload_url, tempPath, "voice.ogg");
      const saved = await vk.api.docs.save({ file: uploadRes.file, title: "Voice Message" });
      attachments.push(`doc${saved.audio_message.owner_id}_${saved.audio_message.id}`);
    }

    await vk.api.messages.send({
      peer_id: vkPeerId,
      message: fullText,
      attachment: attachments.join(","),
      random_id: Math.floor(Math.random() * 1e15)
    });

    console.log(`[Forward Success] bridge=${bridge.id} direction=tg_to_vk message="${logText}"`);
  } catch (err) {
    console.error(`[Forward Error] bridge=${bridge.id} direction=tg_to_vk error="${err.message}"`);
  } finally {
    for (const path of tempFiles) {
      try {
        if (existsSync(path)) unlinkSync(path);
      } catch (e) {
        console.error(`Failed to delete temp file ${path}:`, e);
      }
    }
  }
}

// B. SOURCE IS TG -> TARGET IS VK (Grouped media album)
async function flushTgMediaGroupToVk(mediaGroupId) {
  const buffer = mediaGroupBuffers.get(mediaGroupId);
  if (!buffer) return;
  mediaGroupBuffers.delete(mediaGroupId);

  const { messages, bridge } = buffer;
  const vkPeerId = bridge.targetChatId;
  let logText = "";
  const tempFiles = [];

  try {
    messages.sort((a, b) => {
      const msgA = a.message || a.channelPost;
      const msgB = b.message || b.channelPost;
      return msgA.message_id - msgB.message_id;
    });

    const firstWithText = messages.find(m => {
      const msg = m.message || m.channelPost;
      return msg.text || msg.caption;
    }) || messages[0];

    const firstMsg = firstWithText.message || firstWithText.channelPost;

    const authorSignature = firstMsg?.author_signature;
    const senderName = firstWithText.from
      ? (firstWithText.from.first_name + (firstWithText.from.last_name ? ` ${firstWithText.from.last_name}` : ""))
      : (authorSignature ? `${firstWithText.chat.title} (${authorSignature})` : (firstWithText.chat.title || "Telegram Channel"));

    const prefix = bridge.showAuthor ? `${senderName}: ` : "";
    const messageText = firstMsg?.text || firstMsg?.caption || "";
    const fullText = messageText ? `${prefix}${messageText}` : (prefix ? prefix.slice(0, -2) : "");
    logText = messageText || "[Media Album]";

    const attachments = [];

    for (const ctx of messages) {
      const message = ctx.message || ctx.channelPost;
      if (message.photo) {
        const photo = message.photo.at(-1);
        const tempPath = await downloadTelegramFile(photo.file_id);
        tempFiles.push(tempPath);
        const server = await vk.api.photos.getMessagesUploadServer({ peer_id: vkPeerId });
        const uploadRes = await uploadToVkServer(server.upload_url, tempPath, "photo.jpg", "photo");
        const [saved] = await vk.api.photos.saveMessagesPhoto(uploadRes);
        attachments.push(`photo${saved.owner_id}_${saved.id}`);
      } else if (message.document) {
        const doc = message.document;
        const tempPath = await downloadTelegramFile(doc.file_id);
        tempFiles.push(tempPath);
        const server = await vk.api.docs.getMessagesUploadServer({ peer_id: vkPeerId, type: "doc" });
        const uploadRes = await uploadToVkServer(server.upload_url, tempPath, doc.file_name);
        const saved = await vk.api.docs.save({ file: uploadRes.file, title: doc.file_name });
        attachments.push(`doc${saved.doc.owner_id}_${saved.doc.id}`);
      }
    }

    await vk.api.messages.send({
      peer_id: vkPeerId,
      message: fullText,
      attachment: attachments.join(","),
      random_id: Math.floor(Math.random() * 1e15)
    });

    console.log(`[Forward Success] bridge=${bridge.id} direction=tg_to_vk message="${logText}"`);
  } catch (err) {
    console.error(`[Forward Error] bridge=${bridge.id} direction=tg_to_vk error="${err.message}"`);
  } finally {
    for (const path of tempFiles) {
      try {
        if (existsSync(path)) unlinkSync(path);
      } catch (e) {
        console.error(`Failed to delete temp file ${path}:`, e);
      }
    }
  }
}

// C. SOURCE IS VK -> TARGET IS VK
async function processVkToVk(ctx, bridge) {
  const vkPeerId = bridge.targetChatId;
  let logText = "";
  try {
    const senderName = await resolveVkName(ctx.senderId);
    const prefix = bridge.showAuthor ? `${senderName}: ` : "";

    const msgData = await extractVkMessageData(ctx, true);
    const fullText = msgData.text ? `${prefix}${msgData.text}` : (prefix ? prefix.slice(0, -2) : "");
    logText = msgData.text || "[VK-to-VK copy]";

    const attachments = [];

    // Transfer attachments directly using original VK platform IDs without re-uploading
    for (const attachment of msgData.attachments) {
      const type = attachment.type;
      const payload = attachment.payload || attachment[type];
      if (payload && payload.owner_id && payload.id) {
        // Form the standard vk attachment query string: type + owner_id + _ + id
        const accessKey = payload.access_key ? `_${payload.access_key}` : "";
        attachments.push(`${type}${payload.owner_id}_${payload.id}${accessKey}`);
      }
    }

    await vk.api.messages.send({
      peer_id: vkPeerId,
      message: fullText,
      attachment: attachments.join(","),
      random_id: Math.floor(Math.random() * 1e15)
    });

    console.log(`[Forward Success] bridge=${bridge.id} direction=vk_to_vk message="${logText}"`);
  } catch (err) {
    console.error(`[Forward Error] bridge=${bridge.id} direction=vk_to_vk error="${err.message}"`);
  }
}

// Bind listener-specific functions to the universal forwarder
export const forwardVkToTg = forwardMessage;
export const forwardTgToVk = forwardMessage;
