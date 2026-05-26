import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";

const dbPath = process.env.DATABASE_PATH || "./data/db.sqlite";

// Ensure database directory exists
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite database
const db = new Database(dbPath);

// Enable WAL mode for high performance concurrency
db.run("PRAGMA journal_mode = WAL;");

// Initialize tables
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS connected_chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    platform TEXT NOT NULL,
    chat_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, platform, chat_id)
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS temp_codes (
    code TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    platform TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS bridges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT,
    source_chat_id INTEGER NOT NULL,
    source_platform TEXT NOT NULL,
    target_chat_id INTEGER NOT NULL,
    target_platform TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    show_author INTEGER NOT NULL DEFAULT 1 CHECK(show_author IN (0, 1)),
    filters TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bridge_id INTEGER,
    direction TEXT NOT NULL,
    status TEXT NOT NULL,
    message_text TEXT,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(bridge_id) REFERENCES bridges(id) ON DELETE SET NULL
  );
`);

// Auto-provision default admin user (admin / admin) if users table is empty
const setupDefaultAdmin = async () => {
  try {
    const userCount = db.query("SELECT COUNT(*) as count FROM users").get();
    if (userCount.count === 0) {
      // Use Bun's native password hashing (bcrypt)
      const hash = await Bun.password.hash("admin");
      db.query("INSERT INTO users (username, password_hash) VALUES ($username, $hash)").run({
        $username: "admin",
        $hash: hash
      });
      console.log("Default admin user created: admin / admin");
    }
  } catch (err) {
    console.error("Failed to provision default admin:", err);
  }
};
setupDefaultAdmin();

// Database helper functions
export const dbHelper = {
  // User operations
  getUser: (username) => {
    return db.query("SELECT * FROM users WHERE username = $username").get({ $username: username });
  },

  addUser: (username, passwordHash) => {
    const query = db.query("INSERT INTO users (username, password_hash) VALUES ($username, $hash) RETURNING id, username");
    return query.get({ $username: username, $hash: passwordHash });
  },

  // Bridge operations
  getBridges: (userId) => {
    const query = db.query("SELECT * FROM bridges WHERE user_id = $userId");
    return query.all({ $userId: userId });
  },

  getBridgesBySource: (platform, chatId) => {
    const query = db.query(`
      SELECT * FROM bridges 
      WHERE source_platform = $platform AND source_chat_id = $chatId AND is_active = 1
    `);
    return query.all({ $platform: platform, $chatId: Number(chatId) });
  },

  addBridge: (userId, sourcePlatform, sourceChatId, targetPlatform, targetChatId, title = null, showAuthor = true, filters = {}) => {
    const query = db.query(`
      INSERT INTO bridges (user_id, source_platform, source_chat_id, target_platform, target_chat_id, title, show_author, filters)
      VALUES ($userId, $sourcePlatform, $sourceChatId, $targetPlatform, $targetChatId, $title, $showAuthor, $filters)
      RETURNING *
    `);
    return query.get({
      $userId: userId,
      $sourcePlatform: sourcePlatform,
      $sourceChatId: Number(sourceChatId),
      $targetPlatform: targetPlatform,
      $targetChatId: Number(targetChatId),
      $title: title,
      $showAuthor: showAuthor ? 1 : 0,
      $filters: JSON.stringify(filters)
    });
  },

  deleteBridge: (id) => {
    const query = db.query("DELETE FROM bridges WHERE id = $id");
    query.run({ $id: id });
  },

  updateBridge: (id, fields) => {
    const keys = Object.keys(fields);
    const setClause = keys.map(k => `${k} = $${k}`).join(", ");
    const query = db.query(`UPDATE bridges SET ${setClause} WHERE id = $id RETURNING *`);
    
    const params = { $id: id };
    keys.forEach(k => {
      params[`$${k}`] = fields[k];
    });
    
    return query.get(params);
  },

  // Connected Chats operations
  getConnectedChats: (userId) => {
    const vk = db.query("SELECT * FROM connected_chats WHERE user_id = $userId AND platform = 'vk'").all({ $userId: userId });
    const tg = db.query("SELECT * FROM connected_chats WHERE user_id = $userId AND platform = 'tg'").all({ $userId: userId });
    return { vk, tg };
  },

  addConnectedChat: (userId, platform, chatId, title) => {
    const query = db.query(`
      INSERT OR REPLACE INTO connected_chats (user_id, platform, chat_id, title)
      VALUES ($userId, $platform, $chatId, $title)
      RETURNING *
    `);
    return query.get({
      $userId: userId,
      $platform: platform,
      $chatId: Number(chatId),
      $title: title
    });
  },

  deleteConnectedChat: (userId, platform, chatId) => {
    const query = db.query("DELETE FROM connected_chats WHERE user_id = $userId AND platform = $platform AND chat_id = $chatId");
    query.run({
      $userId: userId,
      $platform: platform,
      $chatId: Number(chatId)
    });
  },

  // Temp Codes operations
  addTempCode: (userId, platform, code) => {
    db.query("DELETE FROM temp_codes WHERE user_id = $userId AND platform = $platform").run({
      $userId: userId,
      $platform: platform
    });

    const query = db.query(`
      INSERT INTO temp_codes (code, user_id, platform, expires_at)
      VALUES ($code, $userId, $platform, datetime('now', '+10 minutes'))
      RETURNING *
    `);
    return query.get({
      $code: code,
      $userId: userId,
      $platform: platform
    });
  },

  validateTempCode: (code, platform) => {
    const query = db.query(`
      SELECT * FROM temp_codes 
      WHERE code = $code AND platform = $platform AND expires_at > datetime('now')
    `);
    const record = query.get({ $code: code, $platform: platform });
    
    if (record) {
      db.query("DELETE FROM temp_codes WHERE code = $code").run({ $code: code });
      return record;
    }
    return null;
  },

  clearExpiredTempCodes: () => {
    db.query("DELETE FROM temp_codes WHERE expires_at < datetime('now')").run();
  },

  // Log operations
  addLog: (bridgeId, direction, status, messageText = "", errorMessage = "") => {
    const query = db.query(`
      INSERT INTO logs (bridge_id, direction, status, message_text, error_message)
      VALUES ($bridgeId, $direction, $status, $messageText, $errorMessage)
    `);
    query.run({
      $bridgeId: bridgeId,
      $direction: direction,
      $status: status,
      $messageText: messageText ? messageText.substring(0, 1000) : null,
      $errorMessage: errorMessage || null
    });
  },

  getLogs: (userId = null, limit = 50) => {
    const sql = userId !== null
      ? `
        SELECT l.*, b.source_platform, b.source_chat_id, b.target_platform, b.target_chat_id, b.title as bridge_title
        FROM logs l
        JOIN bridges b ON l.bridge_id = b.id
        WHERE b.user_id = $userId
        ORDER BY l.created_at DESC
        LIMIT $limit
      `
      : `
        SELECT l.*, b.source_platform, b.source_chat_id, b.target_platform, b.target_chat_id, b.title as bridge_title
        FROM logs l
        LEFT JOIN bridges b ON l.bridge_id = b.id
        ORDER BY l.created_at DESC
        LIMIT $limit
      `;
    const query = db.query(sql);
    return userId !== null ? query.all({ $userId: userId, $limit: limit }) : query.all({ $limit: limit });
  }
};

export default db;
