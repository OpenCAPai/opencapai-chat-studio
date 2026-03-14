const { encrypt, decrypt, isEncrypted } = require("../../srv/crypto-utils");

describe("Crypto Utils", () => {
  const plainText = "SuperSecretPassword123!";

  test("should encrypt a string", () => {
    const encrypted = encrypt(plainText);
    expect(encrypted).not.toBe(plainText);
    expect(encrypted).toContain(":");
  });

  test("should decrypt an encrypted string", () => {
    const encrypted = encrypt(plainText);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plainText);
  });

  test("should identify encrypted strings", () => {
    const encrypted = encrypt(plainText);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(isEncrypted(plainText)).toBe(false);
  });

  test("should return original text if not encrypted during decryption", () => {
    const notEncrypted = "Just some text";
    const decrypted = decrypt(notEncrypted);
    expect(decrypted).toBe(notEncrypted);
  });

  test("should handle empty strings", () => {
    expect(encrypt("")).toBe("");
    expect(decrypt("")).toBe("");
  });
});
