import { startVkListener } from "./vk.js";
import { startTgListener } from "./tg.js";
import { forwardVkToTg, forwardTgToVk } from "./forwarder.js";
import { dbHelper } from "./db.js";

// Port for Next.js to access bot configuration and logs
const API_PORT = process.env.API_PORT || 4000;

console.log("VK-TG Forwarder engine starting...");

// 1. Start background listeners for VK and TG
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

// 2. Start Bun HTTP API Server for the Next.js admin dashboard
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

    // Handle preflight CORS request
    if (method === "OPTIONS") {
      return new Response(null, { headers });
    }

    try {
      // GET /api/status - Check health and API config
      if (path === "/api/status" && method === "GET") {
        return new Response(JSON.stringify({
          status: "online",
          vk: !!process.env.VK_COMMUNITY_TOKEN,
          tg: !!process.env.TG_BOT_TOKEN
        }), { headers });
      }

      // GET /api/bridges - List all bridges
      if (path === "/api/bridges" && method === "GET") {
        const bridges = dbHelper.getBridges();
        return new Response(JSON.stringify(bridges), { headers });
      }

      // POST /api/bridges - Create a new bridge
      if (path === "/api/bridges" && method === "POST") {
        const body = await req.json();
        const { vk_peer_id, tg_chat_id, direction, filters } = body;
        
        if (!vk_peer_id || !tg_chat_id) {
          return new Response(JSON.stringify({ error: "Missing vk_peer_id or tg_chat_id" }), {
            status: 400,
            headers
          });
        }

        const newBridge = dbHelper.addBridge(
          vk_peer_id,
          tg_chat_id,
          direction || "both",
          filters || {}
        );
        return new Response(JSON.stringify(newBridge), { headers });
      }

      // DELETE /api/bridges/:id - Remove bridge link
      if (path.startsWith("/api/bridges/") && method === "DELETE") {
        const id = path.split("/").pop();
        if (!id || isNaN(id)) {
          return new Response(JSON.stringify({ error: "Invalid bridge ID" }), {
            status: 400,
            headers
          });
        }
        dbHelper.deleteBridge(Number(id));
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // GET /api/logs - Fetch forwarding log stream
      if (path === "/api/logs" && method === "GET") {
        const logs = dbHelper.getLogs(50);
        return new Response(JSON.stringify(logs), { headers });
      }

      // 404 Route Not Found
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
