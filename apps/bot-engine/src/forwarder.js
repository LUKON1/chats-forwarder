import { vk } from "./vk.js";
import { bot, sendText, sendPhoto, sendMediaGroup, sendDocument, sendVoice } from "./tg.js";
import { dbHelper } from "./db.js";

// Buffer to accumulate Telegram media groups (albums)
const mediaGroupBuffers = new Map();

// Helper to upload buffers to VK upload servers
async function uploadToVkServer(uploadUrl, fileBuffer, filename, fieldName = "file") {
  const blob = new Blob([fileBuffer]);
  const formData = new FormData();
  formData.append(fieldName, blob, filename);

  const res = await fetch(uploadUrl, {
    method: "POST",
    body: formData
  });

  if (!res.ok) throw new Error(`VK upload HTTP error: ${res.status}`);
  return res.json();
}

// Download Telegram file into Buffer
async function downloadTelegramFile(fileId) {
  const file = await bot.api.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${process.env.TG_BOT_TOKEN}/${file.file_path}`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download TG file error: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Name cache for VK users
const vkNameCache = new Map();

async function resolveVkName(senderId) {
  if (vkNameCache.has(senderId)) return vkNameCache.get(senderId);
  try {
    if (senderId > 0) {
      const [user] = await vk.api.users.get({ user_ids: senderId });
      const name = `${user.first_name} ${user.last_name}`;
      vkNameCache.set(senderId, name);
      return name;
    }
    return "Group";
  } catch {
    return String(senderId);
  }
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
  const { target_platform } = bridge;

  if (target_platform === "tg") {
    await forwardToTg(ctx, bridge);
  } else if (target_platform === "vk") {
    await forwardToVk(ctx, bridge);
  }
}

// --- TARGET: TELEGRAM ---
async function forwardToTg(ctx, bridge) {
  const tgChatId = bridge.target_chat_id;
  const sourcePlatform = bridge.source_platform;
  let logText = "";

  try {
    // A. SOURCE IS VK -> TARGET IS TG
    if (sourcePlatform === "vk") {
      const senderName = await resolveVkName(ctx.senderId);
      const prefix = bridge.show_author ? `${senderName}: ` : "";

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
        dbHelper.addLog(bridge.id, "vk_to_tg", "success", logText);
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

      dbHelper.addLog(bridge.id, "vk_to_tg", "success", logText);
    }
    
    // B. SOURCE IS TG -> TARGET IS TG
    else if (sourcePlatform === "tg") {
      const senderName = ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : "");
      const prefix = bridge.show_author ? `${senderName}: ` : "";
      const messageText = ctx.message.text || ctx.message.caption || "";
      const caption = messageText ? `${prefix}${messageText}` : (prefix ? prefix.slice(0, -2) : "");
      logText = messageText || "[TG-to-TG copy]";

      // Fast-copy message on Telegram servers (no local download needed)
      await bot.api.copyMessage(tgChatId, ctx.chat.id, ctx.message.message_id, {
        caption: caption || undefined
      });

      dbHelper.addLog(bridge.id, "tg_to_tg", "success", logText);
    }
  } catch (err) {
    console.error(`Forwarding to Telegram failed (${sourcePlatform}->tg):`, err);
    dbHelper.addLog(bridge.id, `${sourcePlatform}_to_tg`, "error", logText, err.message);
  }
}

// --- TARGET: VK ---
async function forwardToVk(ctx, bridge) {
  const sourcePlatform = bridge.source_platform;

  if (sourcePlatform === "tg") {
    // Buffer TG media groups to avoid multiple VK posts
    const mediaGroupId = ctx.message.media_group_id;
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
  const vkPeerId = bridge.target_chat_id;
  let logText = "";
  try {
    const hasSupportedMedia = ctx.message.photo || ctx.message.document || ctx.message.voice;
    const messageText = ctx.message.text || ctx.message.caption || "";

    if (!messageText && !hasSupportedMedia) return;

    const senderName = ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : "");
    const prefix = bridge.show_author ? `${senderName}: ` : "";
    const fullText = messageText ? `${prefix}${messageText}` : (prefix ? prefix.slice(0, -2) : "");
    logText = messageText || "[Media attachment]";

    const attachments = [];

    if (ctx.message.photo) {
      const photo = ctx.message.photo.at(-1);
      const buffer = await downloadTelegramFile(photo.file_id);
      const server = await vk.api.photos.getMessagesUploadServer({ peer_id: vkPeerId });
      const uploadRes = await uploadToVkServer(server.upload_url, buffer, "photo.jpg", "photo");
      const [saved] = await vk.api.photos.saveMessagesPhoto(uploadRes);
      attachments.push(`photo${saved.owner_id}_${saved.id}`);
    }

    if (ctx.message.document) {
      const doc = ctx.message.document;
      const buffer = await downloadTelegramFile(doc.file_id);
      const server = await vk.api.docs.getMessagesUploadServer({ peer_id: vkPeerId, type: "doc" });
      const uploadRes = await uploadToVkServer(server.upload_url, buffer, doc.file_name);
      const saved = await vk.api.docs.save({ file: uploadRes.file, title: doc.file_name });
      attachments.push(`doc${saved.doc.owner_id}_${saved.doc.id}`);
    }

    if (ctx.message.voice) {
      const voice = ctx.message.voice;
      const buffer = await downloadTelegramFile(voice.file_id);
      const server = await vk.api.docs.getMessagesUploadServer({ peer_id: vkPeerId, type: "audio_message" });
      const uploadRes = await uploadToVkServer(server.upload_url, buffer, "voice.ogg");
      const saved = await vk.api.docs.save({ file: uploadRes.file, title: "Voice Message" });
      attachments.push(`doc${saved.audio_message.owner_id}_${saved.audio_message.id}`);
    }

    await vk.api.messages.send({
      peer_id: vkPeerId,
      message: fullText,
      attachment: attachments.join(","),
      random_id: Math.floor(Math.random() * 1e15)
    });

    dbHelper.addLog(bridge.id, "tg_to_vk", "success", logText);
  } catch (err) {
    console.error("TG -> VK forwarding failed:", err);
    dbHelper.addLog(bridge.id, "tg_to_vk", "error", logText, err.message);
  }
}

// B. SOURCE IS TG -> TARGET IS VK (Grouped media album)
async function flushTgMediaGroupToVk(mediaGroupId) {
  const buffer = mediaGroupBuffers.get(mediaGroupId);
  if (!buffer) return;
  mediaGroupBuffers.delete(mediaGroupId);

  const { messages, bridge } = buffer;
  const vkPeerId = bridge.target_chat_id;
  let logText = "";

  try {
    messages.sort((a, b) => a.message.message_id - b.message.message_id);

    const firstWithText = messages.find(m => m.message.text || m.message.caption) || messages[0];
    const senderName = firstWithText.from.first_name + (firstWithText.from.last_name ? ` ${firstWithText.from.last_name}` : "");
    const prefix = bridge.show_author ? `${senderName}: ` : "";
    const messageText = firstWithText.message.text || firstWithText.message.caption || "";
    const fullText = messageText ? `${prefix}${messageText}` : (prefix ? prefix.slice(0, -2) : "");
    logText = messageText || "[Media Album]";

    const attachments = [];

    for (const ctx of messages) {
      if (ctx.message.photo) {
        const photo = ctx.message.photo.at(-1);
        const fileBuffer = await downloadTelegramFile(photo.file_id);
        const server = await vk.api.photos.getMessagesUploadServer({ peer_id: vkPeerId });
        const uploadRes = await uploadToVkServer(server.upload_url, fileBuffer, "photo.jpg", "photo");
        const [saved] = await vk.api.photos.saveMessagesPhoto(uploadRes);
        attachments.push(`photo${saved.owner_id}_${saved.id}`);
      } else if (ctx.message.document) {
        const doc = ctx.message.document;
        const fileBuffer = await downloadTelegramFile(doc.file_id);
        const server = await vk.api.docs.getMessagesUploadServer({ peer_id: vkPeerId, type: "doc" });
        const uploadRes = await uploadToVkServer(server.upload_url, fileBuffer, doc.file_name);
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

    dbHelper.addLog(bridge.id, "tg_to_vk", "success", logText);
  } catch (err) {
    console.error("TG -> VK media album forwarding failed:", err);
    dbHelper.addLog(bridge.id, "tg_to_vk", "error", logText, err.message);
  }
}

// C. SOURCE IS VK -> TARGET IS VK
async function processVkToVk(ctx, bridge) {
  const vkPeerId = bridge.target_chat_id;
  let logText = "";
  try {
    const senderName = await resolveVkName(ctx.senderId);
    const prefix = bridge.show_author ? `${senderName}: ` : "";

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

    dbHelper.addLog(bridge.id, "vk_to_vk", "success", logText);
  } catch (err) {
    console.error("VK -> VK forwarding failed:", err);
    dbHelper.addLog(bridge.id, "vk_to_vk", "error", logText, err.message);
  }
}

// Bind listener-specific functions to the universal forwarder
export const forwardVkToTg = forwardMessage;
export const forwardTgToVk = forwardMessage;

