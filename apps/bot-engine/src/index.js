import { startVkListener } from "./vk.js";
import { startTgListener } from "./tg.js";
import { forwardVkToTg, forwardTgToVk } from "./forwarder.js";
import { dbHelper } from "./db.js";

const API_PORT = process.env.API_PORT || 4000;
const API_SECRET = process.env.API_SECRET || "super_secret_token_123";

console.log("VK-TG Forwarder engine starting...");

// Start background listeners
startVkListener(forwardVkToTg).then(() => {
  console.log("VK integration active");
}).catch((err) => {
  console.error("VK setup failed:", err);
});

startTgListener(forwardTgToVk).then(() => {
  console.log("Telegram integration active");
}).catch((err) => {
  console.error("Telegram setup failed:", err);
});

// Helper to run temp code garbage collector once an hour
setInterval(() => {
  try {
    dbHelper.clearExpiredTempCodes();
  } catch (err) {
    console.error("Failed to clear expired temp codes:", err);
  }
}, 60 * 60 * 1000);

// Start HTTP REST API Server
Bun.serve({
  port: API_PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // CORS Headers for API requests
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json"
    };

    if (method === "OPTIONS") {
      return new Response(null, { headers });
    }

    try {
      // 1. PUBLIC ROUTE: Auth login (using Bun.password)
      if (path === "/api/auth/login" && method === "POST") {
        const { username, password } = await req.json();
        if (!username || !password) {
          return new Response(JSON.stringify({ error: "Missing credentials" }), { status: 400, headers });
        }

        const user = dbHelper.getUser(username);
        if (!user) {
          return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers });
        }

        // Verify password hash using Bun native API
        const isValid = await Bun.password.verify(password, user.password_hash);
        if (!isValid) {
          return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers });
        }

        // Return user data (Next.js will issue its own JWT session)
        return new Response(JSON.stringify({
          success: true,
          user: { id: user.id, username: user.username }
        }), { headers });
      }

      // 2. MIDDLEWARE: Verify API_SECRET bearer token for all other routes
      const authHeader = req.headers.get("Authorization");
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;

      if (!token || token !== API_SECRET) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers
        });
      }

      // --- PROTECTED ROUTES ---

      // GET /api/status - Check health and API config
      if (path === "/api/status" && method === "GET") {
        return new Response(JSON.stringify({
          status: "online",
          vk: !!process.env.VK_COMMUNITY_TOKEN,
          tg: !!process.env.TG_BOT_TOKEN
        }), { headers });
      }

      // GET /api/bridges - List user's bridges
      if (path === "/api/bridges" && method === "GET") {
        const userId = Number(url.searchParams.get("user_id") || 1);
        const bridges = dbHelper.getBridges(userId);
        return new Response(JSON.stringify(bridges), { headers });
      }

      // POST /api/bridges - Create a new bridge
      if (path === "/api/bridges" && method === "POST") {
        const body = await req.json();
        const { user_id, source_platform, source_chat_id, target_platform, target_chat_id, title, show_author, filters } = body;
        
        if (!user_id || !source_platform || !source_chat_id || !target_platform || !target_chat_id) {
          return new Response(JSON.stringify({ error: "Missing required fields" }), {
            status: 400,
            headers
          });
        }

        // Prevent bridging a chat to itself
        if (source_platform === target_platform && Number(source_chat_id) === Number(target_chat_id)) {
          return new Response(JSON.stringify({ error: "Cannot bridge a chat to itself" }), {
            status: 400,
            headers
          });
        }

        const newBridge = dbHelper.addBridge(
          Number(user_id),
          source_platform,
          Number(source_chat_id),
          target_platform,
          Number(target_chat_id),
          title,
          show_author !== false,
          filters || {}
        );
        return new Response(JSON.stringify(newBridge), { headers });
      }

      // PUT /api/bridges/:id - Update bridge settings
      if (path.startsWith("/api/bridges/") && method === "PUT") {
        const id = Number(path.split("/").pop());
        if (!id || isNaN(id)) {
          return new Response(JSON.stringify({ error: "Invalid bridge ID" }), { status: 400, headers });
        }
        
        const body = await req.json();
        const updated = dbHelper.updateBridge(id, body);
        return new Response(JSON.stringify(updated), { headers });
      }

      // DELETE /api/bridges/:id - Remove bridge link
      if (path.startsWith("/api/bridges/") && method === "DELETE") {
        const id = Number(path.split("/").pop());
        if (!id || isNaN(id)) {
          return new Response(JSON.stringify({ error: "Invalid bridge ID" }), {
            status: 400,
            headers
          });
        }
        dbHelper.deleteBridge(id);
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // GET /api/chats - Get user's connected chats
      if (path === "/api/chats" && method === "GET") {
        const userId = Number(url.searchParams.get("user_id") || 1);
        const chats = dbHelper.getConnectedChats(userId);
        return new Response(JSON.stringify(chats), { headers });
      }

      // DELETE /api/chats/:platform/:chat_id - Disconnect chat
      if (path.startsWith("/api/chats/") && method === "DELETE") {
        const parts = path.split("/");
        const chatId = Number(parts.pop());
        const platform = parts.pop();
        const userId = Number(url.searchParams.get("user_id") || 1);

        if (!platform || !chatId || isNaN(chatId)) {
          return new Response(JSON.stringify({ error: "Invalid request parameters" }), { status: 400, headers });
        }

        dbHelper.deleteConnectedChat(userId, platform, chatId);
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // POST /api/connect/code - Generate pin-code for onboarding
      if (path === "/api/connect/code" && method === "POST") {
        const body = await req.json();
        const { user_id, platform } = body;

        if (!user_id || !platform || !["vk", "tg"].includes(platform)) {
          return new Response(JSON.stringify({ error: "Missing or invalid parameters" }), { status: 400, headers });
        }

        // Generate 6 digit pin code
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const record = dbHelper.addTempCode(Number(user_id), platform, code);

        return new Response(JSON.stringify(record), { headers });
      }

      // GET /api/logs - Fetch forwarding log stream
      if (path === "/api/logs" && method === "GET") {
        const logs = dbHelper.getLogs(50);
        return new Response(JSON.stringify(logs), { headers });
      }

      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers
      });
    } catch (err) {
      console.error(`API Error handling ${method} ${path}:`, err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers
      });
    }
  }
});

console.log(`HTTP API server running on port ${API_PORT}`);
