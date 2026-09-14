import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { nexonKeys } from "@/lib/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { NoCredentialError } from "./errors";

/**
 * 자격증명 계층. 지금은 API 키만. 넥슨 Open ID(파트너스) 도입 시 OpenIdCredential 을 추가하면
 * client.ts 이하는 변경 없음.
 */
export interface NexonCredential {
  /** 리밋/캐시 스코프 키: 'user:<id>' | 'server' */
  id: string;
  kind: "api_key" | "openid";
  headers(): Promise<Record<string, string>>;
  /** 초당 허용 호출 수 (dev 5, service 500) */
  ratePerSec: number;
  /** 키 무효(00005) 등 인증 에러 콜백 */
  onAuthError?(code: string, message: string): Promise<void>;
}

export type CredentialScope = "account" | "public";

export class ApiKeyCredential implements NexonCredential {
  readonly kind = "api_key" as const;
  constructor(
    readonly id: string,
    private readonly key: string,
    readonly ratePerSec: number,
    readonly onAuthError?: NexonCredential["onAuthError"],
  ) {}
  async headers() {
    return { "x-nxopen-api-key": this.key };
  }
}

const DEV_RATE = Number(process.env.NEXON_RATE_PER_SEC ?? 5);

let serverCred: ApiKeyCredential | null | undefined;
export function serverCredential(): ApiKeyCredential | null {
  if (serverCred !== undefined) return serverCred;
  const key = process.env.NEXON_SERVER_API_KEY;
  serverCred = key ? new ApiKeyCredential("server", key, Number(process.env.NEXON_SERVER_RATE_PER_SEC ?? DEV_RATE)) : null;
  return serverCred;
}

/** 유저 키 복호화는 여기서만. 반환된 문자열을 클라이언트로 보내지 말 것. */
export async function userCredential(userId: string): Promise<ApiKeyCredential | null> {
  const row = db.select().from(nexonKeys).where(eq(nexonKeys.userId, userId)).get();
  if (!row || row.status === "invalid") return null;
  const key = decryptSecret(row.encKey, userId);
  return new ApiKeyCredential(`user:${userId}`, key, DEV_RATE, async (code, message) => {
    if (code === "OPENAPI00005") {
      db.update(nexonKeys)
        .set({ status: "invalid", lastError: `[${code}] ${message}`, updatedAt: new Date().toISOString() })
        .where(eq(nexonKeys.userId, userId))
        .run();
    }
  });
}

/**
 * account 스코프(캐릭터 목록/스케줄러): 반드시 유저 키.
 * public 스코프(id/basic/stat/equip): 유저 키 있으면 유저 키(쿼터 분산), 없으면 서버 키.
 */
export async function resolveCredential(opts: { userId?: string | null; scope: CredentialScope }): Promise<NexonCredential> {
  const user = opts.userId ? await userCredential(opts.userId) : null;
  if (opts.scope === "account") {
    if (!user) throw new NoCredentialError();
    return user;
  }
  const cred = user ?? serverCredential();
  if (!cred) throw new NoCredentialError("서버 넥슨 API 키(NEXON_SERVER_API_KEY)가 설정되지 않았습니다");
  return cred;
}
