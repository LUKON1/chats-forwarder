import crypto from "crypto";
import http from "node:http";
import bcrypt from "bcryptjs";
import { adapterRegistry } from "./adapters/registry.js";
import { startQueueWorkers } from "./queue.js";
import { dbHelper } from "./db.js";
import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from "./jwt.js";
import { bot } from "./tg.js";

// In-memory request store for rate limiting
const ipRequests = new Map();

// Simple in-memory rate limiter middleware
function rateLimit(options = {}) {
  const windowMs = options.windowMs || 60000;
  const max = options.max || 100;
  const message = options.message || "Too many requests, please try again later.";

  // Periodic cleanup to avoid memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of ipRequests.entries()) {
      if (now - data.resetTime > windowMs) {
        ipRequests.delete(ip);
      }
    }
  }, windowMs);

  return (req) => {
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";
    const now = Date.now();

    if (!ipRequests.has(ip)) {
      ipRequests.set(ip, {
        count: 1,
        resetTime: now + windowMs,
      });
      return null;
    }

    const clientData = ipRequests.get(ip);
    if (now > clientData.resetTime) {
      clientData.count = 1;
      clientData.resetTime = now + windowMs;
      return null;
    }

    clientData.count++;
    if (clientData.count > max) {
      return new Response(JSON.stringify({ error: message }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }

    return null;
  };
}

// Helper to parse cookies from Request headers
function getCookie(req, name) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const parts = cookie.split("=");
    const key = parts[0].trim();
    if (key === name) {
      return parts.slice(1).join("=").trim();
    }
  }
  return null;
}

// Configured auth rate limiter
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: "Too many login or registration attempts. Please try again in a minute."
});

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

      if (!headers.has("x-forwarded-for") && nodeReq.socket.remoteAddress) {
        headers.set("x-forwarded-for", nodeReq.socket.remoteAddress);
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
console.log("DEBUG: PROXY_URL in env =", process.env.PROXY_URL);

const RUN_MODE = process.env.RUN_MODE || "all";

if (RUN_MODE === "all" || RUN_MODE === "worker") {
  startQueueWorkers();
}

if (RUN_MODE === "all" || RUN_MODE === "api") {
  console.log(`Starting HTTP API server on port ${API_PORT}...`);

  // Auto-configure Telegram Webhook if BASE_DOMAIN is set in environment
  if (process.env.BASE_DOMAIN) {
    const domain = process.env.BASE_DOMAIN;
    const protocol = domain.startsWith("http://") || domain.startsWith("https://") ? "" : "https://";
    const tgWebhookUrl = `${protocol}${domain}/api/webhooks/tg`;
    console.log(`Configuring Telegram webhook URL: ${tgWebhookUrl}`);
    bot.api.setWebhook(tgWebhookUrl).then(() => {
      console.log("Telegram webhook set successfully");
    }).catch(err => {
      console.error("Failed to set Telegram webhook:", err.message);
    });
  }

  // Start HTTP REST API Server
  createFetchServer(async (req) => {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // CORS Headers for API requests supporting cookies
    const origin = req.headers.get("origin");
    const headers = {
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json"
    };

    if (origin) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Credentials"] = "true";
    } else {
      headers["Access-Control-Allow-Origin"] = "*";
    }

    if (method === "OPTIONS") {
      return new Response(null, { headers });
    }

    // Apply Rate Limiter to login and register routes
    if (path.startsWith("/api/auth/login") || path.startsWith("/api/auth/register")) {
      const limitResponse = authLimiter(req);
      if (limitResponse) {
        Object.entries(headers).forEach(([k, v]) => limitResponse.headers.set(k, v));
        return limitResponse;
      }
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

        const user = await dbHelper.getUser(username);
        if (!user) {
          return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers });
        }

        // Verify password hash using bcryptjs
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers });
        }

        // Generate access and refresh tokens for client session
        const accessToken = generateAccessToken({ id: user.id, username: user.username });
        const refreshToken = generateRefreshToken({ id: user.id, username: user.username });

        // Save refresh token hash to SQLite database (and clear old ones)
        await dbHelper.addRefreshToken(refreshToken, user.id);

        const resHeaders = new Headers(headers);
        resHeaders.append(
          "Set-Cookie",
          `refresh_token=${refreshToken}; HttpOnly; Path=/api/auth; SameSite=Strict; Max-Age=604800; Secure`
        );

        return new Response(JSON.stringify({
          success: true,
          accessToken,
          user: { id: user.id, username: user.username }
        }), { headers: resHeaders });
      }

      // 2. PUBLIC ROUTE: Auth register (using Bun.password)
      if (path === "/api/auth/register" && method === "POST") {
        const { username, password } = await req.json();
        if (!username || !password) {
          return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers });
        }

        // Validate lengths and characters
        if (username.length < 3 || username.length > 20) {
          return new Response(JSON.stringify({ error: "Username must be between 3 and 20 characters long" }), { status: 400, headers });
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
          return new Response(JSON.stringify({ error: "Username can only contain letters, numbers, underscores and hyphens" }), { status: 400, headers });
        }
        if (password.length < 6) {
          return new Response(JSON.stringify({ error: "Password must be at least 6 characters long" }), { status: 400, headers });
        }

        const existingUser = await dbHelper.getUser(username);
        if (existingUser) {
          return new Response(JSON.stringify({ error: "Username already taken" }), { status: 409, headers });
        }

        // Hash password using bcryptjs
        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = await dbHelper.addUser(username, passwordHash);

        return new Response(JSON.stringify({
          success: true,
          user: { id: newUser.id, username: newUser.username }
        }), { headers });
      }

      // PUBLIC ROUTE: Auth token refresh (HttpOnly cookie and Token Rotation)
      if (path === "/api/auth/refresh" && method === "POST") {
        const refreshToken = getCookie(req, "refresh_token");
        if (!refreshToken) {
          return new Response(JSON.stringify({ error: "Missing refresh token" }), { status: 401, headers });
        }

        // Verify refresh token cryptographically
        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded || !decoded.id) {
          const resHeaders = new Headers(headers);
          resHeaders.append("Set-Cookie", "refresh_token=; HttpOnly; Path=/api/auth; SameSite=Strict; Max-Age=0; Secure");
          return new Response(JSON.stringify({ error: "Invalid refresh token" }), { status: 401, headers: resHeaders });
        }

        // Validate token exists in database (compares hash)
        const dbRecord = await dbHelper.validateRefreshToken(refreshToken);
        if (!dbRecord) {
          const resHeaders = new Headers(headers);
          resHeaders.append("Set-Cookie", "refresh_token=; HttpOnly; Path=/api/auth; SameSite=Strict; Max-Age=0; Secure");
          return new Response(JSON.stringify({ error: "Expired or revoked refresh token" }), { status: 401, headers: resHeaders });
        }

        // Token Rotation: Generate new access AND refresh tokens
        const accessToken = generateAccessToken({ id: decoded.id, username: decoded.username });
        const newRefreshToken = generateRefreshToken({ id: decoded.id, username: decoded.username });
        await dbHelper.addRefreshToken(newRefreshToken, decoded.id);

        const resHeaders = new Headers(headers);
        resHeaders.append(
          "Set-Cookie",
          `refresh_token=${newRefreshToken}; HttpOnly; Path=/api/auth; SameSite=Strict; Max-Age=604800; Secure`
        );

        return new Response(JSON.stringify({
          success: true,
          accessToken
        }), { headers: resHeaders });
      }

      // PUBLIC ROUTE: Auth logout (revokes refresh token and clears cookie)
      if (path === "/api/auth/logout" && method === "POST") {
        const refreshToken = getCookie(req, "refresh_token");
        if (refreshToken) {
          await dbHelper.deleteRefreshToken(refreshToken);
        }
        
        const resHeaders = new Headers(headers);
        resHeaders.append("Set-Cookie", "refresh_token=; HttpOnly; Path=/api/auth; SameSite=Strict; Max-Age=0; Secure");
        
        return new Response(JSON.stringify({ success: true }), { headers: resHeaders });
      }

      // PUBLIC ROUTE: Webhook for Telegram
      if (path === "/api/webhooks/tg" && method === "POST") {
        const tgAdapter = adapterRegistry.get("tg");
        return tgAdapter.handleWebhook(req);
      }

      // PUBLIC ROUTE: Webhook for VK
      if (path === "/api/webhooks/vk" && method === "POST") {
        const vkAdapter = adapterRegistry.get("vk");
        return vkAdapter.handleWebhook(req);
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
        const queryUserId = Number(url.searchParams.get("userId") || 1);
        const userId = enforcedUserId !== null ? enforcedUserId : queryUserId;
        
        const bridges = await dbHelper.getBridges(userId);
        return new Response(JSON.stringify(bridges), { headers });
      }

      // POST /api/bridges - Create a new bridge
      if (path === "/api/bridges" && method === "POST") {
        const body = await req.json();
        const { userId: bodyUserId, sourcePlatform, sourceChatId, targetPlatform, targetChatId, title, showAuthor } = body;
        
        const userId = enforcedUserId !== null ? enforcedUserId : Number(bodyUserId || 1);

        if (!sourcePlatform || !sourceChatId || !targetPlatform || !targetChatId) {
          return new Response(JSON.stringify({ error: "Missing required fields" }), {
            status: 400,
            headers
          });
        }

        // Prevent bridging a chat to itself
        if (sourcePlatform === targetPlatform && Number(sourceChatId) === Number(targetChatId)) {
          return new Response(JSON.stringify({ error: "Cannot bridge a chat to itself" }), {
            status: 400,
            headers
          });
        }

        const newBridge = await dbHelper.addBridge(
          userId,
          sourcePlatform,
          Number(sourceChatId),
          targetPlatform,
          Number(targetChatId),
          title,
          showAuthor !== false
        );
        return new Response(JSON.stringify(newBridge), { headers });
      }

      // PUT /api/bridges/:id - Update bridge settings
      if (path.startsWith("/api/bridges/") && method === "PUT") {
        const id = Number(path.split("/").pop());
        if (!id || isNaN(id)) {
          return new Response(JSON.stringify({ error: "Invalid bridge ID" }), { status: 400, headers });
        }
        
        const bridge = await dbHelper.getBridge(id);
        if (!bridge) {
          return new Response(JSON.stringify({ error: "Bridge not found" }), { status: 404, headers });
        }

        // Verify ownership if not system access
        if (enforcedUserId !== null && bridge.userId !== enforcedUserId) {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
        }

        const body = await req.json();
        const updated = await dbHelper.updateBridge(id, body);
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

        const bridge = await dbHelper.getBridge(id);
        if (!bridge) {
          return new Response(JSON.stringify({ error: "Bridge not found" }), { status: 404, headers });
        }

        // Verify ownership if not system access
        if (enforcedUserId !== null && bridge.userId !== enforcedUserId) {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
        }

        await dbHelper.deleteBridge(id);
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // GET /api/chats - Get user's connected chats
      if (path === "/api/chats" && method === "GET") {
        const queryUserId = Number(url.searchParams.get("userId") || 1);
        const userId = enforcedUserId !== null ? enforcedUserId : queryUserId;

        const chats = await dbHelper.getConnectedChats(userId);
        return new Response(JSON.stringify(chats), { headers });
      }

      // DELETE /api/chats/:platform/:chat_id - Disconnect chat
      if (path.startsWith("/api/chats/") && method === "DELETE") {
        const parts = path.split("/");
        const chatId = Number(parts.pop());
        const platform = parts.pop();
        const queryUserId = Number(url.searchParams.get("userId") || 1);
        const userId = enforcedUserId !== null ? enforcedUserId : queryUserId;

        if (!platform || !chatId || isNaN(chatId)) {
          return new Response(JSON.stringify({ error: "Invalid request parameters" }), { status: 400, headers });
        }

        await dbHelper.deleteConnectedChat(userId, platform, chatId);
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // POST /api/connect/code - Generate pin-code for onboarding
      if (path === "/api/connect/code" && method === "POST") {
        const body = await req.json();
        const { userId: bodyUserId, platform } = body;
        
        const userId = enforcedUserId !== null ? enforcedUserId : Number(bodyUserId || 1);

        if (!platform || !["vk", "tg"].includes(platform)) {
          return new Response(JSON.stringify({ error: "Missing or invalid parameters" }), { status: 400, headers });
        }

        // Generate 6 digit pin code
        const code = String(crypto.randomInt(100000, 999999));
        const record = await dbHelper.addTempCode(userId, platform, code);

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
}
