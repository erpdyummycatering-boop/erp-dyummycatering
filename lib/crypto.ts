import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

function loadKey(version = 1): Buffer {
  const raw =
    version <= 1
      ? process.env.INTEGRATION_ENC_KEY
      : process.env[`INTEGRATION_ENC_KEY_V${version}`] || process.env.INTEGRATION_ENC_KEY_V2;
  if (!raw || !raw.trim()) {
    throw new Error(version <= 1 ? "INTEGRATION_ENC_KEY belum diset" : `Kunci enkripsi versi ${version} belum diset`);
  }
  const trimmed = raw.trim();
  const buf = /^[0-9a-fA-F]{64}$/.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : Buffer.from(trimmed, "base64");
  if (buf.length !== 32) {
    throw new Error("INTEGRATION_ENC_KEY harus 32 byte (base64, atau 64 karakter hex)");
  }
  return buf;
}

export function encryptionReady(): boolean {
  try {
    loadKey(1);
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plain: string, keyVersion = 1): {
  ciphertext: string;
  iv: string;
  tag: string;
  last4: string;
  keyVersion: number;
} {
  const key = loadKey(keyVersion);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    last4: plain.slice(-4),
    keyVersion,
  };
}

export function decryptSecret(payload: {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion?: number;
}): string {
  const key = loadKey(payload.keyVersion || 1);
  const decipher = createDecipheriv(ALGO, key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}
