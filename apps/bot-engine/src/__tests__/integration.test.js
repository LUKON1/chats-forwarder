import { describe, test, expect, mock, beforeAll, afterAll, spyOn } from "bun:test";
import { forwardingQueue, startQueueWorkers } from "../queue.js";
import { adapterRegistry } from "../adapters/registry.js";
import { apiHandler } from "../index.js";
import { redis, prisma } from "../db.js";
import { TelegramAdapter } from "../adapters/tg.js";
import { VkAdapter } from "../adapters/vk.js";

// Check if database and redis services are up before running integration tests
let isDbAvailable = true;
try {
  await prisma.$connect();
  await redis.ping();
} catch (err) {
  isDbAvailable = false;
  console.warn("\n[INTEGRATION TEST WARNING] Redis or Postgres database is not running. Integration tests will be skipped.");
}

describe.skipIf(!isDbAvailable)("Сквозные интеграционные тесты пересылки", () => {
  let worker;
  let tgAdapter;
  let vkAdapter;
  let mockTgSendMessage;
  let mockVkSendMessage;
  let mockVkSendMediaGroup;
  
  const originalVkSecret = process.env.VK_SECRET_KEY;

  beforeAll(async () => {
    delete process.env.VK_SECRET_KEY;
    // 1. Get adapter instances from registry
    tgAdapter = adapterRegistry.get("tg");
    vkAdapter = adapterRegistry.get("vk");

    // 2. Spy on send methods to prevent actual API calls to VK/Telegram servers
    mockTgSendMessage = spyOn(tgAdapter, "sendMessage").mockResolvedValue({ message_id: 999 });
    mockVkSendMessage = spyOn(vkAdapter, "sendMessage").mockResolvedValue({ message_id: 888 });
    mockVkSendMediaGroup = spyOn(vkAdapter, "sendMediaGroup").mockResolvedValue({ message_id: 777 });

    // Spy on user/chat resolution to prevent VK API profile fetch errors
    spyOn(vkAdapter, "parseMessage").mockImplementation(async (ctx) => {
      return {
        text: ctx.text || "",
        senderName: "VK Test User",
        chatId: ctx.peerId,
        attachments: ctx.attachments || []
      };
    });

    // 3. Clear data from local Redis and Postgres tables
    await redis.flushdb();
    await prisma.bridge.deleteMany();
    await prisma.connectedChat.deleteMany();
    await prisma.user.deleteMany();

    // Create test user to prevent bridges foreign key violations
    await prisma.user.create({
      data: {
        id: 1,
        username: "test_integration_user",
        passwordHash: "some_mock_hash"
      }
    });

    // 4. Set up mock bridge (TG Group -> VK Chat) in local DB
    await prisma.bridge.create({
      data: {
        userId: 1,
        sourcePlatform: "tg",
        sourceChatId: -100123456789, // TG channel/group ID (always negative)
        targetPlatform: "vk",
        targetChatId: 2000000005,    // VK Chat ID
        isActive: true,
        showAuthor: true,
      }
    });

    // 5. Set up mock bridge (VK Chat -> TG Group)
    await prisma.bridge.create({
      data: {
        userId: 1,
        sourcePlatform: "vk",
        sourceChatId: 2000000005,
        targetPlatform: "tg",
        targetChatId: -100123456789,
        isActive: true,
        showAuthor: false,
      }
    });

    // 6. Start the BullMQ queue worker
    worker = startQueueWorkers();
  });

  afterAll(async () => {
    // Restore original VK secret
    process.env.VK_SECRET_KEY = originalVkSecret;

    // Clean up connections and worker
    if (worker) {
      await worker.close();
    }
    await prisma.bridge.deleteMany();
    await prisma.$disconnect();
    await redis.quit();
  });

  test("должен пересылать сообщение из Telegram вебхука в VK через очередь BullMQ", async () => {
    mockVkSendMessage.mockClear();

    // Send mock Telegram webhook payload
    const req = new Request("http://localhost:4000/api/webhooks/tg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        update_id: 111,
        message: {
          chat: { id: -100123456789, type: "supergroup", title: "Test TG Group" },
          from: { id: 7777, first_name: "John", last_name: "Doe", is_bot: false },
          text: "Hello from TG Webhook!"
        }
      })
    });

    const res = await apiHandler(req);
    expect(res.status).toBe(200);

    // Wait up to 1 second for the BullMQ worker to pick up and execute the job
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Assert VK adapter was called with correct arguments
    expect(mockVkSendMessage).toHaveBeenCalled();
    const [targetChatId, text] = mockVkSendMessage.mock.calls[0];
    expect(targetChatId).toBe(2000000005);
    expect(text).toContain("John Doe: Hello from TG Webhook!");
  });

  test("должен пересылать сообщение из VK вебхука в Telegram через очередь BullMQ", async () => {
    mockTgSendMessage.mockClear();

    // Send mock VK webhook payload
    const req = new Request("http://localhost:4000/api/webhooks/vk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "message_new",
        object: {
          message: {
            peer_id: 2000000005,
            from_id: 33333,
            text: "Hello from VK Webhook!"
          },
          client_info: {}
        },
        group_id: 99999,
        v: "5.131"
      })
    });

    const res = await apiHandler(req);
    expect(res.status).toBe(200);

    // Wait for worker processing
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Assert TG adapter was called (showAuthor is false, so no prefix)
    expect(mockTgSendMessage).toHaveBeenCalled();
    const [targetChatId, text] = mockTgSendMessage.mock.calls[0];
    expect(targetChatId).toBe(-100123456789);
    expect(text).toBe("Hello from VK Webhook!");
  });

  test("должен буферизовать медиагруппу Telegram и отправлять её в VK одним альбомом", async () => {
    mockVkSendMediaGroup.mockClear();
    const mediaGroupId = "test_media_group_999";

    // 1. Send first part of media group (photo 1)
    const req1 = new Request("http://localhost:4000/api/webhooks/tg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        update_id: 201,
        message: {
          chat: { id: -100123456789, type: "supergroup" },
          from: { id: 7777, first_name: "John", is_bot: false },
          media_group_id: mediaGroupId,
          caption: "Awesome photos!",
          photo: [{ file_id: "photo_id_111", width: 800, height: 600 }]
        }
      })
    });
    await apiHandler(req1);

    // 2. Send second part of media group (photo 2)
    const req2 = new Request("http://localhost:4000/api/webhooks/tg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        update_id: 202,
        message: {
          chat: { id: -100123456789, type: "supergroup" },
          from: { id: 7777, first_name: "John", is_bot: false },
          media_group_id: mediaGroupId,
          photo: [{ file_id: "photo_id_222", width: 800, height: 600 }]
        }
      })
    });
    await apiHandler(req2);

    // We stub getFileUrl to return mock URLs
    spyOn(tgAdapter, "getFileUrl").mockImplementation(async (fileId) => {
      return `https://api.telegram.org/mock-file/${fileId}.jpg`;
    });

    // 3. Wait for the 1.5s delay to trigger + 500ms processing buffer
    await new Promise((resolve) => setTimeout(resolve, 2200));

    // Verify that sendMediaGroup was called once with both photos
    expect(mockVkSendMediaGroup).toHaveBeenCalled();
    const [targetChatId, urls, caption] = mockVkSendMediaGroup.mock.calls[0];
    expect(targetChatId).toBe(2000000005);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain("photo_id_111.jpg");
    expect(urls[1]).toContain("photo_id_222.jpg");
    expect(caption).toContain("John: Awesome photos!");
  });
});
