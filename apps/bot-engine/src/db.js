import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { createHash } from "crypto";

// Allowed origins
// Helper to hash refresh tokens before storing in Redis
function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

// Helper to convert Prisma objects with BigInt to JS Number safely
function serializeDbObject(obj) {
  if (!obj) return obj;
  if (Array.isArray(obj)) {
    return obj.map(serializeDbObject);
  }
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "bigint") {
      result[key] = Number(value);
    } else if (value instanceof Date) {
      result[key] = value;
    } else if (typeof value === "object" && value !== null) {
      result[key] = serializeDbObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}



// Initialize Prisma Client and Redis
const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(redisUrl);

// Bridge Cache Helpers
async function invalidateBridgeCache(platform, chatId) {
  try {
    await redis.del(`bridge:source:${platform}:${Number(chatId)}`);
  } catch (err) {
    console.error("Failed to invalidate bridge cache in Redis:", err);
  }
}

// Database helper functions
export const dbHelper = {
  // User operations
  getUser: async (username) => {
    const user = await prisma.user.findUnique({
      where: { username }
    });
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt
    };
  },

  addUser: async (username, passwordHash) => {
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash
      }
    });
    return {
      id: user.id,
      username: user.username
    };
  },

  // Bridge operations
  getBridges: async (userId) => {
    const bridges = await prisma.bridge.findMany({
      where: { userId }
    });
    return serializeDbObject(bridges);
  },

  getBridgesBySource: async (platform, chatId) => {
    const cacheKey = `bridge:source:${platform}:${Number(chatId)}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error("Redis read error in getBridgesBySource:", err);
    }

    const bridges = await prisma.bridge.findMany({
      where: {
        isActive: true,
        OR: [
          {
            sourcePlatform: platform,
            sourceChatId: BigInt(chatId),
            isReversed: false
          },
          {
            targetPlatform: platform,
            targetChatId: BigInt(chatId),
            isReversed: true
          }
        ]
      }
    });

    const serialized = serializeDbObject(bridges);

    try {
      // Cache for 1 hour
      await redis.setex(cacheKey, 3600, JSON.stringify(serialized));
    } catch (err) {
      console.error("Redis write error in getBridgesBySource:", err);
    }

    return serialized;
  },

  addBridge: async (userId, sourcePlatform, sourceChatId, targetPlatform, targetChatId, title = null, showAuthor = true) => {
    const bridge = await prisma.bridge.create({
      data: {
        userId,
        sourcePlatform,
        sourceChatId: BigInt(sourceChatId),
        targetPlatform,
        targetChatId: BigInt(targetChatId),
        title,
        showAuthor,
        isReversed: false
      }
    });

    // Invalidate caches
    await invalidateBridgeCache(sourcePlatform, sourceChatId);
    await invalidateBridgeCache(targetPlatform, targetChatId);

    return serializeDbObject(bridge);
  },

  getBridge: async (id) => {
    const bridge = await prisma.bridge.findUnique({
      where: { id }
    });
    return serializeDbObject(bridge);
  },

  deleteBridge: async (id) => {
    const bridge = await prisma.bridge.findUnique({
      where: { id }
    });
    if (bridge) {
      await prisma.bridge.delete({
        where: { id }
      });
      // Invalidate caches
      await invalidateBridgeCache(bridge.sourcePlatform, bridge.sourceChatId);
      await invalidateBridgeCache(bridge.targetPlatform, bridge.targetChatId);
    }
  },

  updateBridge: async (id, fields) => {
    const allowedFields = ["isActive", "showAuthor", "title", "sourcePlatform", "sourceChatId", "targetPlatform", "targetChatId", "isReversed"];
    
    // Map fields supporting camelCase inputs
    const dbFields = {};
    if (fields.isActive !== undefined) dbFields.isActive = !!fields.isActive;
    if (fields.showAuthor !== undefined) dbFields.showAuthor = !!fields.showAuthor;
    if (fields.isReversed !== undefined) dbFields.isReversed = !!fields.isReversed;
    if (fields.title !== undefined) dbFields.title = fields.title;
    if (fields.sourcePlatform !== undefined) dbFields.sourcePlatform = fields.sourcePlatform;
    if (fields.sourceChatId !== undefined) dbFields.sourceChatId = BigInt(fields.sourceChatId);
    if (fields.targetPlatform !== undefined) dbFields.targetPlatform = fields.targetPlatform;
    if (fields.targetChatId !== undefined) dbFields.targetChatId = BigInt(fields.targetChatId);

    // Get original to invalidate old caches
    const original = await prisma.bridge.findUnique({
      where: { id }
    });

    if (original) {
      await invalidateBridgeCache(original.sourcePlatform, original.sourceChatId);
      await invalidateBridgeCache(original.targetPlatform, original.targetChatId);
    }

    const updated = await prisma.bridge.update({
      where: { id },
      data: dbFields
    });

    // Invalidate new caches
    await invalidateBridgeCache(updated.sourcePlatform, updated.sourceChatId);
    await invalidateBridgeCache(updated.targetPlatform, updated.targetChatId);

    return serializeDbObject(updated);
  },

  // Connected Chats operations
  getConnectedChats: async (userId) => {
    const chats = await prisma.connectedChat.findMany({
      where: { userId }
    });
    const serialized = serializeDbObject(chats);
    
    return {
      vk: serialized.filter(c => c.platform === "vk"),
      tg: serialized.filter(c => c.platform === "tg")
    };
  },

  addConnectedChat: async (userId, platform, chatId, title) => {
    const chat = await prisma.connectedChat.upsert({
      where: {
        userId_platform_chatId: {
          userId,
          platform,
          chatId: BigInt(chatId)
        }
      },
      update: {
        title
      },
      create: {
        userId,
        platform,
        chatId: BigInt(chatId),
        title
      }
    });
    return serializeDbObject(chat);
  },

  deleteConnectedChat: async (userId, platform, chatId) => {
    await prisma.connectedChat.deleteMany({
      where: {
        userId,
        platform,
        chatId: BigInt(chatId)
      }
    });
  },

  // Temp Codes operations (Moved to Redis)
  addTempCode: async (userId, platform, code) => {
    const userKey = `temp_code:user:${userId}:${platform}`;
    const codeKey = `temp_code:code:${code}:${platform}`;

    // Read and remove old code mapping if exists
    try {
      const oldCode = await redis.get(userKey);
      if (oldCode) {
        await redis.del(`temp_code:code:${oldCode}:${platform}`);
      }
      
      // Save new code (expires in 10 minutes)
      await redis.setex(userKey, 600, code);
      await redis.setex(codeKey, 600, String(userId));
    } catch (err) {
      console.error("Redis temp code operations failed:", err);
    }

    return {
      code,
      userId,
      platform
    };
  },

  validateTempCode: async (code, platform) => {
    const codeKey = `temp_code:code:${code}:${platform}`;
    try {
      const userId = await redis.get(codeKey);
      if (userId) {
        // One-time code: delete immediately
        await redis.del(codeKey);
        await redis.del(`temp_code:user:${userId}:${platform}`);
        return {
          userId: Number(userId),
          platform
        };
      }
    } catch (err) {
      console.error("Redis temp code validation failed:", err);
    }
    return null;
  },

  clearExpiredTempCodes: async () => {
    // Redis handles expiration automatically via TTL
  },

  // Refresh Token operations (Moved to Redis)
  addRefreshToken: async (token, userId) => {
    const hashed = hashToken(token);
    const userKey = `user:${userId}:active_refresh_token`;
    const tokenKey = `refresh_token:${hashed}`;

    try {
      // Rotation: delete previous active refresh token for this user
      const oldHashed = await redis.get(userKey);
      if (oldHashed) {
        await redis.del(`refresh_token:${oldHashed}`);
      }

      // Store new refresh token (expires in 7 days)
      await redis.setex(tokenKey, 7 * 24 * 3600, String(userId));
      await redis.setex(userKey, 7 * 24 * 3600, hashed);
    } catch (err) {
      console.error("Redis add refresh token failed:", err);
    }

    return {
      token: hashed,
      userId
    };
  },

  validateRefreshToken: async (token) => {
    const hashed = hashToken(token);
    const tokenKey = `refresh_token:${hashed}`;
    try {
      const userId = await redis.get(tokenKey);
      if (userId) {
        return {
          token: hashed,
          userId: Number(userId)
        };
      }
    } catch (err) {
      console.error("Redis validate refresh token failed:", err);
    }
    return null;
  },

  deleteRefreshToken: async (token) => {
    const hashed = hashToken(token);
    const tokenKey = `refresh_token:${hashed}`;
    try {
      const userId = await redis.get(tokenKey);
      if (userId) {
        await redis.del(tokenKey);
        await redis.del(`user:${userId}:active_refresh_token`);
      }
    } catch (err) {
      console.error("Redis delete refresh token failed:", err);
    }
  },

  clearExpiredRefreshTokens: async () => {
    // Redis handles expiration automatically via TTL
  }
};

// Export prisma and redis clients for external usage
export { prisma, redis };
export default prisma;
