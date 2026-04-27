import crypto from "node:crypto";

const algorithm = "aes-256-cbc";

function getKey(): Buffer {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "0".repeat(64);
  const buf = Buffer.from(ENCRYPTION_KEY, "hex");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }
  return buf;
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(text: string): string {
  const parts = text.split(":");
  const iv = Buffer.from(parts[0]!, "hex");
  const encryptedText = Buffer.from(parts[1]!, "hex");
  const decipher = crypto.createDecipheriv(algorithm, getKey(), iv);
  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  return decrypted.toString("utf8");
}
