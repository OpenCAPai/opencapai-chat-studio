const crypto = require("crypto");

const IV_LENGTH = 16;
const ALGORITHM = "aes-256-cbc";

let ENCRYPTION_KEY;

if (process.env.ENCRYPTION_KEY) {
  try {
    ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
    if (ENCRYPTION_KEY.length !== 32) {
      throw new Error(
        `Invalid key length: ${ENCRYPTION_KEY.length} bytes (expected 32)`,
      );
    }
  } catch (error) {
    console.error("❌ ERROR: Invalid ENCRYPTION_KEY format:", error.message);
    console.error(
      "❌ The key must be a 64-character hexadecimal string (32 bytes)",
    );
    console.error(
      "❌ Generate a valid key with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
    process.exit(1);
  }
} else {
  ENCRYPTION_KEY = crypto.randomBytes(32);
  console.warn(
    "⚠️  WARNING: ENCRYPTION_KEY is not set in environment variables!",
  );
  console.warn(
    "⚠️  A random key will be generated, but encrypted data will be lost on restart.",
  );
  console.warn("⚠️  Set ENCRYPTION_KEY in your .env file for production use.");
  console.warn(
    "⚠️  Generate a key with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
}

/**
 * Encrypts a string using AES-256-CBC with a random IV.
 * @param {string} text - Text to encrypt
 * @returns {string} Encrypted text in the format "iv:encryptedData"
 */
function encrypt(text) {
  if (!text) return text;

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypts a string using AES-256-CBC with the IV prepended in the format "iv:encryptedData".
 * @param {string} text - Encrypted text to decrypt
 * @returns {string} Decrypted text
 */
function decrypt(text) {
  if (!text) return text;

  try {
    const parts = text.split(":");
    if (parts.length !== 2) {
      return text;
    }

    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    console.error(
      "This usually means the ENCRYPTION_KEY has changed or the data was encrypted with a different key.",
    );
    return text;
  }
}

/**
 * Checks if a string is encrypted (starts with an IV followed by a colon and encrypted data).
 * @param {string} text - Text to check
 * @returns {boolean} True if the text appears to be encrypted
 */
function isEncrypted(text) {
  if (!text) return false;
  const parts = text.split(":");
  return parts.length === 2 && parts[0].length === IV_LENGTH * 2;
}

module.exports = {
  encrypt,
  decrypt,
  isEncrypted,
};
