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

// VK -> TG Forwarding Logic
export async function forwardVkToTg(ctx, bridge) {
  const tgChatId = bridge.tg_chat_id;
  let logText = "";
  try {
    const senderName = await resolveVkName(ctx.senderId);
    
    // Clean styling: Use plain author name with colon
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

    // Send single or grouped photos
    if (photoUrls.length === 1) {
      await sendPhoto(tgChatId, photoUrls[0], caption);
      captionUsed = true;
    } else if (photoUrls.length > 1) {
      // Chunk photos by 10 to respect Telegram media group limits
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

    // Send documents
    for (const doc of docs) {
      const docCaption = captionUsed ? undefined : caption;
      await sendDocument(tgChatId, doc.url, doc.title, docCaption);
      captionUsed = true;
    }

    // Send voice recordings
    for (const url of voiceUrls) {
      await sendVoice(tgChatId, url);
    }

    dbHelper.addLog(bridge.id, "vk_to_tg", "success", logText);
  } catch (err) {
    console.error("VK -> TG Forwarding failed:", err);
    dbHelper.addLog(bridge.id, "vk_to_tg", "error", logText, err.message);
  }
}

// TG -> VK Forwarding Entrypoint (Handles media group buffering)
export async function forwardTgToVk(ctx, bridge) {
  const mediaGroupId = ctx.message.media_group_id;

  if (!mediaGroupId) {
    return processSingleTgMessage(ctx, bridge);
  }

  // Group media into local buffer and trigger flush after 800ms
  if (!mediaGroupBuffers.has(mediaGroupId)) {
    mediaGroupBuffers.set(mediaGroupId, {
      messages: [ctx],
      bridge,
      timer: setTimeout(() => {
        flushMediaGroup(mediaGroupId);
      }, 800)
    });
  } else {
    const buffer = mediaGroupBuffers.get(mediaGroupId);
    buffer.messages.push(ctx);
  }
}

// Process single TG message output to VK
async function processSingleTgMessage(ctx, bridge) {
  const vkPeerId = bridge.vk_peer_id;
  let logText = "";
  try {
    const hasSupportedMedia = ctx.message.photo || ctx.message.document || ctx.message.voice;
    const messageText = ctx.message.text || ctx.message.caption || "";

    // Ignore unsupported Telegram events like stickers, location pin updates, etc.
    if (!messageText && !hasSupportedMedia) return;

    const senderName = ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : "");
    const prefix = bridge.show_author ? `${senderName}: ` : "";
    const fullText = messageText ? `${prefix}${messageText}` : (prefix ? prefix.slice(0, -2) : "");
    logText = messageText || "[Media attachment]";

    const attachments = [];

    // Photo attachment
    if (ctx.message.photo) {
      const photo = ctx.message.photo.at(-1);
      const buffer = await downloadTelegramFile(photo.file_id);
      const server = await vk.api.photos.getMessagesUploadServer({ peer_id: vkPeerId });
      const uploadRes = await uploadToVkServer(server.upload_url, buffer, "photo.jpg", "photo");
      const [saved] = await vk.api.photos.saveMessagesPhoto(uploadRes);
      attachments.push(`photo${saved.owner_id}_${saved.id}`);
    }

    // Document attachment
    if (ctx.message.document) {
      const doc = ctx.message.document;
      const buffer = await downloadTelegramFile(doc.file_id);
      const server = await vk.api.docs.getMessagesUploadServer({ peer_id: vkPeerId, type: "doc" });
      const uploadRes = await uploadToVkServer(server.upload_url, buffer, doc.file_name);
      const saved = await vk.api.docs.save({ file: uploadRes.file, title: doc.file_name });
      attachments.push(`doc${saved.doc.owner_id}_${saved.doc.id}`);
    }

    // Voice message attachment
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
    console.error("TG -> VK Single message forwarding failed:", err);
    dbHelper.addLog(bridge.id, "tg_to_vk", "error", logText, err.message);
  }
}

// Flush and send grouped Telegram media messages as a single VK post
async function flushMediaGroup(mediaGroupId) {
  const buffer = mediaGroupBuffers.get(mediaGroupId);
  if (!buffer) return;
  mediaGroupBuffers.delete(mediaGroupId);

  const { messages, bridge } = buffer;
  const vkPeerId = bridge.vk_peer_id;
  let logText = "";

  try {
    // Sort messages by ID to keep the original visual layout sequence
    messages.sort((a, b) => a.message.message_id - b.message.message_id);

    // Pick the message containing the caption/text
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
    console.error("Failed to forward TG media group to VK:", err);
    dbHelper.addLog(bridge.id, "tg_to_vk", "error", logText, err.message);
  }
}
