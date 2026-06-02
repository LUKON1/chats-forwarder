import { adapterRegistry } from "./adapters/registry.js";
import { forwardingQueue } from "./queue.js";
import { redis } from "./db.js";

// Buffer Telegram media group (album) parts in Redis for cluster scaling
async function handleTgMediaGroupBuffering(messageData, bridge) {
  const { mediaGroupId, attachments, text, senderName } = messageData;
  const attachmentsKey = `tg:mediagroup:${mediaGroupId}:attachments`;
  const textKey = `tg:mediagroup:${mediaGroupId}:text`;
  const senderKey = `tg:mediagroup:${mediaGroupId}:sender`;
  const startedKey = `tg:mediagroup:${mediaGroupId}:started`;

  // Store attachments in Redis list
  if (attachments && attachments.length > 0) {
    await redis.rpush(attachmentsKey, JSON.stringify(attachments));
  }

  // Store text caption if available
  if (text) {
    await redis.set(textKey, text);
  }

  // Store sender name
  await redis.set(senderKey, senderName);

  // Set TTL of 15 seconds to prevent memory leaks in case of network issues
  await redis.expire(attachmentsKey, 15);
  await redis.expire(textKey, 15);
  await redis.expire(senderKey, 15);

  // Schedule a delayed job in BullMQ to flush the media group after 1.5 seconds
  const isFirst = await redis.set(startedKey, "true", "EX", 15, "NX");
  if (isFirst) {
    await forwardingQueue.add(
      `flush_mediagroup_${mediaGroupId}`,
      {
        type: "flush_mediagroup",
        mediaGroupId,
        bridge,
        showAuthor: bridge.showAuthor
      },
      {
        delay: 1500 // Wait 1.5s for all album parts to arrive at the API nodes
      }
    );
  }
}

// Universal Forwarding Entrypoint
export async function forwardMessage(ctx, bridge, sourcePlatform) {
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

  try {
    const sourceAdapter = adapterRegistry.get(sourcePlatform);
    const messageData = await sourceAdapter.parseMessage(ctx);
    
    if (!messageData) return;

    // Route Telegram media group to delayed processing
    if (sourcePlatform === "tg" && messageData.mediaGroupId) {
      await handleTgMediaGroupBuffering(messageData, activeBridge);
      return;
    }

    // Direct routing: Queue normal message for processing
    await forwardingQueue.add(`forward_${sourcePlatform}_to_${activeBridge.targetPlatform}`, {
      sourcePlatform,
      targetPlatform: activeBridge.targetPlatform,
      targetChatId: Number(activeBridge.targetChatId),
      messageData,
      showAuthor: activeBridge.showAuthor
    });
  } catch (err) {
    console.error(`[Forwarder Error] Failed to route message from ${sourcePlatform}:`, err.message);
  }
}

// Bind listener-specific functions to the universal forwarder
export const forwardVkToTg = (ctx, bridge) => forwardMessage(ctx, bridge, "vk");
export const forwardTgToVk = (ctx, bridge) => forwardMessage(ctx, bridge, "tg");
