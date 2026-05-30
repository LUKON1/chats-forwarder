import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
  console.error("CRITICAL ERROR: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in environment variables.");
  process.exit(1);
}

/**
 * Generate a short-lived access token
 * @param {object} payload - User information (e.g. { id, username })
 * @returns {string} Signed JWT token
 */
export function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

/**
 * Generate a long-lived refresh token
 * @param {object} payload - User information (e.g. { id, username })
 * @returns {string} Signed JWT token
 */
export function generateRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

/**
 * Verify access token and return its decoded payload
 * @param {string} token - Signed JWT token
 * @returns {object|null} Decoded user payload if valid, null otherwise
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Verify refresh token and return its decoded payload
 * @param {string} token - Signed JWT token
 * @returns {object|null} Decoded user payload if valid, null otherwise
 */
export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (err) {
    return null;
  }
}
