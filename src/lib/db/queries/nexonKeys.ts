import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { nexonKeys } from "@/lib/db/schema";

/** enc_key 는 절대 select 하지 않는다. 복호화는 lib/nexon/credentials.ts 만. */
export async function nexonKeyStatus(userId: string) {
  const [row] = await db
    .select({ keyHint: nexonKeys.keyHint, status: nexonKeys.status, accountIds: nexonKeys.accountIds, lastOkAt: nexonKeys.lastOkAt, lastError: nexonKeys.lastError, updatedAt: nexonKeys.updatedAt })
    .from(nexonKeys)
    .where(eq(nexonKeys.userId, userId))
    .limit(1);
  return row ?? null;
}
