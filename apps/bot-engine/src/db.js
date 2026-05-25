import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";

// Allowed paths: database file is saved inside data/ directory
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
  CREATE TABLE IF NOT EXISTS bridges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    vk_peer_id INTEGER NOT NULL,
    tg_chat_id INTEGER NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('vk_to_tg', 'tg_to_vk')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    show_author INTEGER NOT NULL DEFAULT 1 CHECK(show_author IN (0, 1)),
    filters TEXT NOT NULL DEFAULT '{}'
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

// Database helper functions
export const dbHelper = {
  // Bridge operations
  getBridges: () => {
    const query = db.query("SELECT * FROM bridges WHERE is_active = 1");
    return query.all();
  },

  getBridgeByVk: (vkPeerId) => {
    const query = db.query("SELECT * FROM bridges WHERE vk_peer_id = $vkPeerId AND is_active = 1");
    return query.get({ $vkPeerId: vkPeerId });
  },

  getBridgeByTg: (tgChatId) => {
    const query = db.query("SELECT * FROM bridges WHERE tg_chat_id = $tgChatId AND is_active = 1");
    return query.get({ $tgChatId: tgChatId });
  },

  addBridge: (vkPeerId, tgChatId, direction = "vk_to_tg", title = null, showAuthor = true, filters = {}) => {
    const query = db.query(`
      INSERT INTO bridges (vk_peer_id, tg_chat_id, direction, title, show_author, filters)
      VALUES ($vkPeerId, $tgChatId, $direction, $title, $showAuthor, $filters)
      RETURNING *
    `);
    return query.get({
      $vkPeerId: Number(vkPeerId),
      $tgChatId: Number(tgChatId),
      $direction: direction,
      $title: title,
      $showAuthor: showAuthor ? 1 : 0,
      $filters: JSON.stringify(filters)
    });
  },

  deleteBridge: (id) => {
    const query = db.query("DELETE FROM bridges WHERE id = $id");
    query.run({ $id: id });
  },

  updateBridgeStatus: (id, isActive) => {
    const query = db.query("UPDATE bridges SET is_active = $isActive WHERE id = $id RETURNING *");
    return query.get({ $isActive: isActive ? 1 : 0, $id: id });
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

  getLogs: (limit = 50) => {
    const query = db.query(`
      SELECT l.*, b.vk_peer_id, b.tg_chat_id 
      FROM logs l
      LEFT JOIN bridges b ON l.bridge_id = b.id
      ORDER BY l.created_at DESC
      LIMIT $limit
    `);
    return query.all({ $limit: limit });
  }
};

export default db;
