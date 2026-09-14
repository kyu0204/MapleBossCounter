import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * 넥슨 API 키 저장용 AES-256-GCM.
 * 키: NEXON_KEY_ENC_SECRET (32바이트 base64). AAD 로 user_id 를 묶어 다른 유저 row 로 옮겨 붙이는 것을 막는다.
 * 저장 형식: base64(iv):base64(tag):base64(ct)
 */
function secret(): Buffer {
  const raw = process.env.NEXON_KEY_ENC_SECRET;
  if (!raw) throw new Error("NEXON_KEY_ENC_SECRET 미설정");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("NEXON_KEY_ENC_SECRET 은 32바이트 base64 여야 함 (openssl rand -base64 32)");
  return buf;
}

export function encryptSecret(plain: string, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret(), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(stored: string, aad: string): string {
  const [ivB, tagB, ctB] = stored.split(":");
  if (!ivB || !tagB || !ctB) throw new Error("암호문 형식 오류");
  const decipher = createDecipheriv("aes-256-gcm", secret(), Buffer.from(ivB, "base64"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB, "base64")), decipher.final()]).toString("utf8");
}
