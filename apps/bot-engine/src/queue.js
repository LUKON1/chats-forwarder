import { Queue, Worker } from "bullmq";
import { adapterRegistry } from "./adapters/registry.js";
import { redis } from "./db.js";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// Redis configuration options for BullMQ
const redisOptions = (() => {
  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: Number(url.port) || 6379,
      username: url.username || undefined,
      password: url.password || undefined,
      db: Number(url.pathname.substring(1)) || 0,
      maxRetriesPerRequest: null,
    };
  } catch (err) {
    console.error("Failed to parse REDIS_URL, falling back to localhost", err);
    return {
      host: "localhost",
      port: 6379,
      maxRetriesPerRequest: null,
    };
  }
})();

// Create the task queue for forwarding jobs
export const forwardingQueue = new Queue("forwarding-queue", {
  connection: redisOptions,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

console.log("[Queue] Forwarding queue initialized");

// Start BullMQ workers to process message routing tasks
export function startQueueWorkers() {
  const worker = new Worker(
    "forwarding-queue",
    async (job) => {
      const { type, mediaGroupId, bridge, showAuthor } = job.data;

      // --- SCENARIO A: FLUSH TG MEDIA GROUP (ALBUM) ---
      if (type === "flush_mediagroup") {
        console.log(`[Queue] Flushing media group ${mediaGroupId}...`);
        const attachmentsKey = `tg:mediagroup:${mediaGroupId}:attachments`;
        const textKey = `tg:mediagroup:${mediaGroupId}:text`;
        const senderKey = `tg:mediagroup:${mediaGroupId}:sender`;
        const startedKey = `tg:mediagroup:${mediaGroupId}:started`;

        try {
          const rawAttachments = await redis.lrange(attachmentsKey, 0, -1);
          const text = await redis.get(textKey);
          const senderName = await redis.get(senderKey) || "Telegram User";

          const attachments = rawAttachments.map(JSON.parse).flat();

          // Prepare normal message data from accumulated parts
          const messageData = {
            text,
            senderName,
            attachments
          };

          // Re-route as a normal direct job to execute delivery
          await processDelivery({
            sourcePlatform: "tg",
            targetPlatform: bridge.targetPlatform,
            targetChatId: Number(bridge.targetChatId),
            messageData,
            showAuthor
          });
        } finally {
          // Clean up Redis keys
          await redis.del(attachmentsKey, textKey, senderKey, startedKey);
        }
        return { success: true, flushed: true };
      }

      // --- SCENARIO B: NORMAL MESSAGE DELIVERY ---
      await processDelivery(job.data);
      return { success: true };
    },
    { connection: redisOptions }
  );

  worker.on("failed", (job, err) => {
    console.error(`[Queue] Job ${job?.id} failed permanently:`, err.message);
  });

  console.log("[Queue] Worker listening for jobs...");
  return worker;
}

// Executes message delivery via target adapter
async function processDelivery(data) {
  const { sourcePlatform, targetPlatform, targetChatId, messageData, showAuthor } = data;
  const targetAdapter = adapterRegistry.get(targetPlatform);
  const sourceAdapter = adapterRegistry.get(sourcePlatform);

  const prefix = showAuthor ? `${messageData.senderName}: ` : "";
  const caption = messageData.text ? `${prefix}${messageData.text}` : (prefix ? prefix.slice(0, -2) : "");

  const attachments = messageData.attachments || [];

  // 1. Send text only if no attachments
  if (attachments.length === 0) {
    if (messageData.text) {
      await targetAdapter.sendMessage(targetChatId, caption);
    }
    return;
  }

  // 2. Resolve URLs for fileIds (if necessary)
  for (const attachment of attachments) {
    if (attachment.fileId && !attachment.url) {
      attachment.url = await sourceAdapter.getFileUrl(attachment.fileId);
    }
  }

  const photos = attachments.filter((a) => a.type === "photo").map((a) => a.url);
  const docs = attachments.filter((a) => a.type === "doc");
  const voices = attachments.filter((a) => a.type === "voice");

  let captionUsed = false;

  // 3. Send photo media group or single photo
  if (photos.length === 1) {
    await targetAdapter.sendPhoto(targetChatId, photos[0], caption);
    captionUsed = true;
  } else if (photos.length > 1) {
    for (let i = 0; i < photos.length; i += 10) {
      const chunk = photos.slice(i, i + 10);
      const chunkCaption = (i === 0) ? caption : undefined;
      if (chunk.length === 1) {
        await targetAdapter.sendPhoto(targetChatId, chunk[0], chunkCaption);
      } else {
        await targetAdapter.sendMediaGroup(targetChatId, chunk, chunkCaption);
      }
    }
    captionUsed = true;
  }

  // 4. Send docs
  for (const doc of docs) {
    const docCaption = captionUsed ? undefined : caption;
    await targetAdapter.sendDocument(targetChatId, doc.url, doc.filename, docCaption);
    captionUsed = true;
  }

  // 5. Send voices
  for (const voice of voices) {
    await targetAdapter.sendVoice(targetChatId, voice.url);
  }

  const attachmentTypes = attachments.map(a => a.type);
  const attachmentSummary = attachmentTypes.length > 0 ? ` with attachments [${attachmentTypes.join(", ")}]` : " (text only)";
  console.log(`[Forwarder] Successfully forwarded message from ${sourcePlatform} to ${targetPlatform} (chatId: ${targetChatId})${attachmentSummary}`);
}
