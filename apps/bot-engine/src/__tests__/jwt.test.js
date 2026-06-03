import { describe, test, expect } from "bun:test";
import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from "../jwt.js";
import jwt from "jsonwebtoken";

describe("JWT Utility Module", () => {
  const userPayload = { id: 42, username: "testuser" };

  test("должен корректно генерировать и валидировать access токен", () => {
    const token = generateAccessToken(userPayload);
    expect(token).toBeTypeOf("string");

    const decoded = verifyAccessToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded.id).toBe(userPayload.id);
    expect(decoded.username).toBe(userPayload.username);
  });

  test("должен корректно генерировать и валидировать refresh токен", () => {
    const token = generateRefreshToken(userPayload);
    expect(token).toBeTypeOf("string");

    const decoded = verifyRefreshToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded.id).toBe(userPayload.id);
    expect(decoded.username).toBe(userPayload.username);
  });

  test("должен возвращать null для невалидного токена", () => {
    const invalidToken = "not.a.valid.jwt.token";
    expect(verifyAccessToken(invalidToken)).toBeNull();
    expect(verifyRefreshToken(invalidToken)).toBeNull();
  });

  test("должен возвращать null для измененного токена", () => {
    const token = generateAccessToken(userPayload);
    const tamperedToken = token + "amended";
    expect(verifyAccessToken(tamperedToken)).toBeNull();
  });

  test("должен возвращать null для просроченного токена", async () => {
    // Generate a token that expires instantly (using jsonwebtoken directly for the test setup)
    const instantExpiryToken = jwt.sign(userPayload, "default_access_secret_only_for_dev_and_tests", { expiresIn: "0s" });
    
    // Allow a tiny delay to ensure token is expired
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(verifyAccessToken(instantExpiryToken)).toBeNull();
  });
});
