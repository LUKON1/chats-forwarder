import crypto from "crypto";
import http from "node:http";
import bcrypt from "bcryptjs";
import { startVkListener } from "./vk.js";
import { startTgListener } from "./tg.js";
import { forwardVkToTg, forwardTgToVk } from "./forwarder.js";
import { dbHelper } from "./db.js";
import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from "./jwt.js";

const API_PORT = process.env.API_PORT || 4000;
const API_SECRET = process.env.API_SECRET || (() => {
  const generatedSecret = crypto.randomUUID();
  console.log(`[SECURITY WARNING] API_SECRET not set in env. Generated random secret for this session: ${generatedSecret}`);
  return generatedSecret;
})();

// Fetch API adapter for Node.js http server
function createFetchServer(fetchHandler, port) {
  return http.createServer(async (nodeReq, nodeRes) => {
    try {
      // 1. Build headers
      const headers = new Headers();
      for (const [key, value] of Object.entries(nodeReq.headers)) {
        if (Array.isArray(value)) {
          value.forEach(v => headers.append(key, v));
        } else if (value !== undefined) {
          headers.set(key, value);
        }
      }

      // 2. Build full URL
      const protocol = nodeReq.socket.encrypted ? "https" : "http";
      const host = nodeReq.headers.host || "localhost";
      const url = new URL(nodeReq.url, `${protocol}://${host}`);

      // 3. Read body
      const chunks = [];
      for await (const chunk of nodeReq) {
        chunks.push(chunk);
      }
      const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

      // 4. Create Fetch Request
      const fetchReq = new Request(url.toString(), {
        method: nodeReq.method,
        headers,
        body: ["GET", "HEAD"].includes(nodeReq.method) ? undefined : body,
      });

      // 5. Call handler
      const fetchRes = await fetchHandler(fetchReq);

      // 6. Write response headers and status
      nodeRes.writeHead(fetchRes.status, Object.fromEntries(fetchRes.headers.entries()));

      // 7. Write response body
      if (fetchRes.body) {
        const reader = fetchRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          nodeRes.write(value);
        }
      }
      nodeRes.end();
    } catch (err) {
      console.error("Fetch server adapter error:", err);
      nodeRes.writeHead(500, { "Content-Type": "application/json" });
      nodeRes.end(JSON.stringify({ error: "Internal Server Error" }));
    }
  }).listen(port);
}

console.log("Chat Forwarder engine starting...");

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

// Helper to run temp code and refresh token garbage collector once an hour
setInterval(() => {
  try {
    dbHelper.clearExpiredTempCodes();
    dbHelper.clearExpiredRefreshTokens();
  } catch (err) {
    console.error("Failed to clear expired temp codes or refresh tokens:", err);
  }
}, 60 * 60 * 1000);

// Start HTTP REST API Server
createFetchServer(async (req) => {
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
      // 1. PUBLIC ROUTE: Auth login (using Bun.password + JWT generation)
      if (path === "/api/auth/login" && method === "POST") {
        const { username, password } = await req.json();
        if (!username || !password) {
          return new Response(JSON.stringify({ error: "Missing credentials" }), { status: 400, headers });
        }

        // Validate credentials length
        if (username.length < 3 || username.length > 20 || password.length < 6) {
          return new Response(JSON.stringify({ error: "Invalid credentials length" }), { status: 400, headers });
        }

        const user = dbHelper.getUser(username);
        if (!user) {
          return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers });
        }

        // Verify password hash using bcryptjs
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
          return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers });
        }

        // Generate access and refresh tokens for client session
        const accessToken = generateAccessToken({ id: user.id, username: user.username });
        const refreshToken = generateRefreshToken({ id: user.id, username: user.username });

        // Save refresh token to SQLite database
        dbHelper.addRefreshToken(refreshToken, user.id);

        return new Response(JSON.stringify({
          success: true,
          accessToken,
          refreshToken,
          user: { id: user.id, username: user.username }
        }), { headers });
      }

      // 2. PUBLIC ROUTE: Auth register (using Bun.password)
      if (path === "/api/auth/register" && method === "POST") {
        const { username, password } = await req.json();
        if (!username || !password) {
          return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers });
        }

        // Validate lengths
        if (username.length < 3 || username.length > 20) {
          return new Response(JSON.stringify({ error: "Username must be between 3 and 20 characters long" }), { status: 400, headers });
        }
        if (password.length < 6) {
          return new Response(JSON.stringify({ error: "Password must be at least 6 characters long" }), { status: 400, headers });
        }

        const existingUser = dbHelper.getUser(username);
        if (existingUser) {
          return new Response(JSON.stringify({ error: "Username already taken" }), { status: 409, headers });
        }

        // Hash password using bcryptjs
        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = dbHelper.addUser(username, passwordHash);

        return new Response(JSON.stringify({
          success: true,
          user: { id: newUser.id, username: newUser.username }
        }), { headers });
      }

      // PUBLIC ROUTE: Auth token refresh
      if (path === "/api/auth/refresh" && method === "POST") {
        const { refreshToken } = await req.json();
        if (!refreshToken) {
          return new Response(JSON.stringify({ error: "Missing refresh token" }), { status: 400, headers });
        }

        // Verify refresh token cryptographically
        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded || !decoded.id) {
          return new Response(JSON.stringify({ error: "Invalid refresh token" }), { status: 401, headers });
        }

        // Validate token exists in database
        const dbRecord = dbHelper.validateRefreshToken(refreshToken);
        if (!dbRecord) {
          return new Response(JSON.stringify({ error: "Expired or revoked refresh token" }), { status: 401, headers });
        }

        // Generate new access token
        const accessToken = generateAccessToken({ id: decoded.id, username: decoded.username });

        return new Response(JSON.stringify({
          success: true,
          accessToken
        }), { headers });
      }

      // PUBLIC ROUTE: Auth logout (revokes refresh token)
      if (path === "/api/auth/logout" && method === "POST") {
        const { refreshToken } = await req.json();
        if (refreshToken) {
          dbHelper.deleteRefreshToken(refreshToken);
        }
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // 3. MIDDLEWARE: Verify API_SECRET key or JWT user token for all other routes
      const authHeader = req.headers.get("Authorization");
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;

      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers
        });
      }

      let verifiedUserId = null;
      const isSystemAccess = token === API_SECRET;

      if (isSystemAccess) {
        // System access (e.g. CLI or trusted automation)
        verifiedUserId = 1; // Default fallback to first user
      } else {
        // User JWT authentication
        const decoded = verifyAccessToken(token);
        if (!decoded || !decoded.id) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers
          });
        }
        verifiedUserId = decoded.id;
      }

      // Enforce the authenticated userId for isolation (system bypass allowed)
      const enforcedUserId = isSystemAccess ? null : verifiedUserId;

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
        const queryUserId = Number(url.searchParams.get("user_id") || 1);
        const userId = enforcedUserId !== null ? enforcedUserId : queryUserId;
        
        const bridges = dbHelper.getBridges(userId);
        return new Response(JSON.stringify(bridges), { headers });
      }

      // POST /api/bridges - Create a new bridge
      if (path === "/api/bridges" && method === "POST") {
        const body = await req.json();
        const { user_id, source_platform, source_chat_id, target_platform, target_chat_id, title, show_author } = body;
        
        const userId = enforcedUserId !== null ? enforcedUserId : Number(user_id || 1);

        if (!source_platform || !source_chat_id || !target_platform || !target_chat_id) {
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
          userId,
          source_platform,
          Number(source_chat_id),
          target_platform,
          Number(target_chat_id),
          title,
          show_author !== false
        );
        return new Response(JSON.stringify(newBridge), { headers });
      }

      // PUT /api/bridges/:id - Update bridge settings
      if (path.startsWith("/api/bridges/") && method === "PUT") {
        const id = Number(path.split("/").pop());
        if (!id || isNaN(id)) {
          return new Response(JSON.stringify({ error: "Invalid bridge ID" }), { status: 400, headers });
        }
        
        const bridge = dbHelper.getBridge(id);
        if (!bridge) {
          return new Response(JSON.stringify({ error: "Bridge not found" }), { status: 404, headers });
        }

        // Verify ownership if not system access
        if (enforcedUserId !== null && bridge.user_id !== enforcedUserId) {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
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

        const bridge = dbHelper.getBridge(id);
        if (!bridge) {
          return new Response(JSON.stringify({ error: "Bridge not found" }), { status: 404, headers });
        }

        // Verify ownership if not system access
        if (enforcedUserId !== null && bridge.user_id !== enforcedUserId) {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
        }

        dbHelper.deleteBridge(id);
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // GET /api/chats - Get user's connected chats
      if (path === "/api/chats" && method === "GET") {
        const queryUserId = Number(url.searchParams.get("user_id") || 1);
        const userId = enforcedUserId !== null ? enforcedUserId : queryUserId;

        const chats = dbHelper.getConnectedChats(userId);
        return new Response(JSON.stringify(chats), { headers });
      }

      // DELETE /api/chats/:platform/:chat_id - Disconnect chat
      if (path.startsWith("/api/chats/") && method === "DELETE") {
        const parts = path.split("/");
        const chatId = Number(parts.pop());
        const platform = parts.pop();
        const queryUserId = Number(url.searchParams.get("user_id") || 1);
        const userId = enforcedUserId !== null ? enforcedUserId : queryUserId;

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
        
        const userId = enforcedUserId !== null ? enforcedUserId : Number(user_id || 1);

        if (!platform || !["vk", "tg"].includes(platform)) {
          return new Response(JSON.stringify({ error: "Missing or invalid parameters" }), { status: 400, headers });
        }

        // Generate 6 digit pin code
        const code = String(crypto.randomInt(100000, 999999));
        const record = dbHelper.addTempCode(userId, platform, code);

        return new Response(JSON.stringify(record), { headers });
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
  }, API_PORT);

console.log(`HTTP API server running on port ${API_PORT}`);
