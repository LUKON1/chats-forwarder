import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.API_SECRET || "super_secret_token_123";

/**
 * Generate a JWT token containing user payload
 * @param {object} payload - User information (e.g. { id, username })
 * @param {string|number} [expiresIn] - Token expiration duration (default: '24h')
 * @returns {string} Signed JWT token
 */
export function generateJWT(payload, expiresIn = "24h") {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Verify a JWT token and return its decoded payload
 * @param {string} token - Signed JWT token
 * @returns {object|null} Decoded user payload if valid, null otherwise
 */
export function verifyJWT(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}
