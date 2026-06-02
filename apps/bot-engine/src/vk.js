import { VK } from "vk-io";
import { getProxyAgent } from "./proxy.js";
import { dbHelper } from "./db.js";

const { VK_COMMUNITY_TOKEN } = process.env;

if (!VK_COMMUNITY_TOKEN) {
  console.error("VK_COMMUNITY_TOKEN is not set in env");
  process.exit(1);
}

// Generate proxy agents for API and Updates
const apiAgent = getProxyAgent("api.vk.com");
const updatesAgent = getProxyAgent("lp.vk.com");

// Shared VK instance using community token and proxy if configured
export const vk = new VK({
  token: VK_COMMUNITY_TOKEN,
  api: {
    agent: apiAgent
  },
  updates: {
    agent: updatesAgent
  }
});

// Start Bots Long Poll and route messages dynamically based on DB routes
export async function startVkListener(forwardHandler) {
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
            await ctx.send(`Чат "${chatTitle}" успешно подключен!\n\n Обратите внимание: бот не смог прочитать название беседы. Пожалуйста, сделайте бота администратором беседы и разрешите ему доступ к переписке в настройках сообщества, чтобы пересылка работала корректно.`);
          } else {
            await ctx.send(`Чат "${chatTitle}" успешно подключен к панели управления!`);
          }
          console.log(`VK Chat connected: userId=${validation.userId} peerId=${ctx.peerId} title=${chatTitle} (accessWarning=${accessWarning})`);
        } else {
          await ctx.send("Неверный или истекший пин-код подключения.");
        }
        return;
      }

      // Dynamic routing to multiple targets (VK -> TG, VK -> VK, etc.)
      const activeBridges = await dbHelper.getBridgesBySource("vk", ctx.peerId);
      


      for (const bridge of activeBridges) {
        await forwardHandler(ctx, bridge);
      }
    } catch (err) {
      console.error("Error processing VK message:", err);
    }
  });

  await vk.updates.start().then(() => {
    console.log("VK Bots Long Poll started");
  }).catch((err) => {
    console.error("VK Long Poll failed to start:", err);
    process.exit(1);
  });
}
