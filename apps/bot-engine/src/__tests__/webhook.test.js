import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";

// Mock db.js dependency before importing index.js
mock.module("../db.js", () => {
  return {
    dbHelper: {
      getUser: mock(() => Promise.resolve(null)),
      addUser: mock(() => Promise.resolve(null)),
      getBridgesBySource: mock(() => Promise.resolve([])),
      validateTempCode: mock(() => Promise.resolve(null)),
      addConnectedChat: mock(() => Promise.resolve(null)),
      addRefreshToken: mock(() => Promise.resolve(null)),
    },
    prisma: {},
    redis: {
      get: mock(() => Promise.resolve(null)),
      set: mock(() => Promise.resolve(null)),
    }
  };
});

// Mock tg.js to isolate Grammy API
mock.module("../tg.js", () => ({
  bot: {
    handleUpdate: mock(() => Promise.resolve()),
    init: mock(() => Promise.resolve()),
    api: {
      sendMessage: mock(() => Promise.resolve()),
    }
  }
}));

// Mock vk.js to isolate VK-IO updates
mock.module("../vk.js", () => ({
  vk: {
    updates: {
      handleWebhookUpdate: mock(() => Promise.resolve()),
      groupId: 99999,
    }
  }
}));

import { apiHandler } from "../index.js";
import { dbHelper } from "../db.js";
import { bot } from "../tg.js";
import { vk } from "../vk.js";

const testApiSecret = "test_api_secret_key_123";
const originalApiSecret = process.env.API_SECRET;
const originalVkSecret = process.env.VK_SECRET_KEY;

describe("REST API и Webhooks Эндпоинты", () => {
  beforeEach(() => {
    // Reset mock call trackers
    dbHelper.getUser.mockClear();
    dbHelper.addUser.mockClear();
    bot.handleUpdate.mockClear();
    vk.updates.handleWebhookUpdate.mockClear();

    // Set test environment secrets
    process.env.API_SECRET = testApiSecret;
    delete process.env.VK_SECRET_KEY;
  });

  afterEach(() => {
    // Restore original environment values
    process.env.API_SECRET = originalApiSecret;
    process.env.VK_SECRET_KEY = originalVkSecret;
  });

  test("должен возвращать 404 для неизвестных роутов", async () => {
    const req = new Request("http://localhost:4000/api/unknown-endpoint", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${testApiSecret}`
      }
    });
    const res = await apiHandler(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Not Found");
  });

  test("должен возвращать 401 при неверных учетных данных авторизации", async () => {
    dbHelper.getUser.mockResolvedValue(null);

    const req = new Request("http://localhost:4000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "testuser", password: "wrongpassword" })
    });

    const res = await apiHandler(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid credentials");
  });

  test("должен принимать вебхуки Telegram и отправлять их в Grammy", async () => {
    const updatePayload = {
      update_id: 12345,
      message: {
        chat: { id: 111, type: "private" },
        text: "hello"
      }
    };

    const req = new Request("http://localhost:4000/api/webhooks/tg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatePayload)
    });

    const res = await apiHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(bot.handleUpdate).toHaveBeenCalledWith(updatePayload);
  });

  test("должен подтверждать VK Callback API при запросе confirmation", async () => {
    // Mock the VK confirmation code
    process.env.VK_CONFIRMATION_CODE = "vk_confirm_123";

    const req = new Request("http://localhost:4000/api/webhooks/vk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "confirmation",
        group_id: 99999
      })
    });

    const res = await apiHandler(req);
    expect(res.status).toBe(200);
    const bodyText = await res.text();
    expect(bodyText).toBe("vk_confirm_123");
  });

  test("должен направлять новые сообщения VK в обработчик VK-IO", async () => {
    const messagePayload = {
      type: "message_new",
      object: {
        message: {
          peer_id: 2000000001,
          text: "VK Message text"
        }
      },
      group_id: 99999
    };

    const req = new Request("http://localhost:4000/api/webhooks/vk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messagePayload)
    });

    const res = await apiHandler(req);
    expect(res.status).toBe(200);
    const bodyText = await res.text();
    expect(bodyText).toBe("ok");
    expect(vk.updates.handleWebhookUpdate).toHaveBeenCalledWith(messagePayload);
  });
});
