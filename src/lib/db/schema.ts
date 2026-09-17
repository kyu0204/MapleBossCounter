import { sql } from "drizzle-orm";
import { bigint, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/**
 * Postgres 스키마 (Supabase).
 *
 * 시각은 timestamp 가 아니라 ISO 문자열(text)로 둔다. 앱 전체가 "2026-09-17T…Z" 문자열과
 * KST 날짜 문자열("2026-09-17")을 직접 비교·정렬하기 때문이다. 타입을 바꾸면 주간 리셋
 * 판정부터 스냅샷 키까지 다 손봐야 한다. Auth.js 어댑터가 요구하는 두 칸만 timestamp 다.
 *
 * 기본값은 SQL 함수 대신 $defaultFn 을 쓴다. 모든 삽입이 drizzle 을 거치고, 그래야
 * 저장되는 문자열 모양이 앱이 만드는 것과 정확히 같다.
 *
 * integer 는 Postgres 에서 32비트(약 21억)다. SQLite 의 integer(64비트)와 달라서
 * 전투력·epoch ms 처럼 그 범위를 넘는 값은 bigint 로 둔다. 넘치면 삽입이 실패한다.
 */
const nowIso = () => new Date().toISOString();

// ---------- Auth.js (Drizzle adapter 표준 pg 스키마) ----------

export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  createdAt: text("created_at").notNull().$defaultFn(nowIso),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ---------- 넥슨 API 키 (유저당 1개, 암호화 저장) ----------

export const nexonKeys = pgTable("nexon_keys", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  encKey: text("enc_key").notNull(), // iv:tag:ct (base64)
  keyHint: text("key_hint").notNull(), // 마지막 4자
  status: text("status").$type<"active" | "invalid" | "throttled">().notNull().default("active"),
  accountIds: jsonb("account_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  lastOkAt: text("last_ok_at"),
  lastError: text("last_error"),
  createdAt: text("created_at").notNull().$defaultFn(nowIso),
  updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
});

// ---------- 캐릭터 ----------

export const characters = pgTable(
  "characters",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    ocid: text("ocid").notNull().unique(),
    name: text("name").notNull(),
    world: text("world"),
    cls: text("class"),
    level: integer("level"),
    imageUrl: text("image_url"),
    ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    accountId: text("account_id"),
    hidden: boolean("hidden").notNull().default(false),
    // 전투력은 21억을 넘는다. integer 로 두면 어느 순간 삽입이 실패한다.
    curPower: bigint("cur_power", { mode: "number" }),
    curPowerAt: text("cur_power_at"),
    curSetupHashes: jsonb("cur_setup_hashes").$type<{ equipped: string; p1: string; p2: string; p3: string }>(),
    bestPower: bigint("best_power", { mode: "number" }),
    bestPowerAt: text("best_power_at"),
    bestSetupHash: text("best_setup_hash"),
    // 심볼 포스. 보스마다 보는 쪽이 다르다 (아케인리버 / 그란디스)
    arcaneForce: integer("arcane_force"),
    authenticForce: integer("authentic_force"),
    forceFetchedAt: text("force_fetched_at"),
    supersededBy: integer("superseded_by"),
    basicFetchedAt: text("basic_fetched_at"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
  },
  (t) => [index("characters_name_idx").on(t.name), index("characters_owner_idx").on(t.ownerUserId), index("characters_world_idx").on(t.world)],
);

export const powerLog = pgTable(
  "power_log",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    characterId: integer("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
    power: bigint("power", { mode: "number" }).notNull(),
    setupHash: text("setup_hash"),
    measuredAt: text("measured_at").notNull(),
  },
  (t) => [index("power_log_char_idx").on(t.characterId, t.measuredAt)],
);

// ---------- 스케줄러 스냅샷 ----------

export const schedulerSnapshots = pgTable(
  "scheduler_snapshots",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    characterId: integer("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
    snapshotDate: text("snapshot_date").notNull(), // YYYY-MM-DD KST
    kind: text("kind").$type<"realtime" | "dated">().notNull(),
    weekStart: text("week_start").notNull(), // 목요일
    weeklyClearCount: integer("weekly_clear_count").notNull().default(0),
    weeklyLimit: integer("weekly_limit").notNull().default(12),
    raw: jsonb("raw").notNull(),
    fetchedAt: text("fetched_at").notNull().$defaultFn(nowIso),
  },
  (t) => [
    uniqueIndex("sched_snap_unique").on(t.characterId, t.snapshotDate, t.kind),
    index("sched_snap_week_idx").on(t.characterId, t.weekStart),
  ],
);

export const bossClears = pgTable(
  "boss_clears",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    snapshotId: integer("snapshot_id").notNull().references(() => schedulerSnapshots.id, { onDelete: "cascade" }),
    characterId: integer("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
    weekStart: text("week_start").notNull(),
    boss: text("boss").notNull(),
    difficulty: text("difficulty").notNull(),
    cycle: text("cycle").notNull(),
    registered: boolean("registered").notNull(),
    completed: boolean("completed").notNull(),
    listOrderNo: integer("list_order_no").notNull().default(0),
  },
  (t) => [index("boss_clears_char_week_idx").on(t.characterId, t.weekStart), index("boss_clears_boss_idx").on(t.boss, t.difficulty, t.weekStart)],
);

// ---------- 파티 ----------

export const parties = pgTable(
  "parties",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name"),
    boss: text("boss").notNull(),
    difficulty: text("difficulty").notNull(),
    world: text("world"),
    /** 예전 자유 입력 메모. 요일·시각이 칸으로 나뉘면서 새 파티에는 안 쓴다. */
    scheduleNote: text("schedule_note"),
    /** 0=일 … 6=토. 안 정했으면 null */
    dayOfWeek: integer("day_of_week"),
    /** 0~23. 안 정했으면 null */
    hour: integer("hour"),
    /** 0~59. 안 정했으면 null */
    minute: integer("minute"),
    /** 매주 도는 고정 파티인지. false 면 만든 주에만 유효하다. */
    repeats: boolean("repeats").notNull().default(true),
    /** 만든 주의 시작(목요일). 반복이 아닌 파티의 유효 기간 판정에 쓴다. */
    weekStart: text("week_start"),
    memo: text("memo"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
  },
  (t) => [index("parties_owner_idx").on(t.ownerUserId), index("parties_boss_idx").on(t.boss, t.difficulty)],
);

export const partyMembers = pgTable(
  "party_members",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    partyId: integer("party_id").notNull().references(() => parties.id, { onDelete: "cascade" }),
    nickname: text("nickname").notNull(),
    characterId: integer("character_id").references(() => characters.id, { onDelete: "set null" }),
    /** 파티장 표시는 화면에서 뺐다. 컬럼은 예전 데이터 때문에 남겨 두고 늘 기본값이다. */
    isLeader: boolean("is_leader").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("party_members_unique").on(t.partyId, t.nickname), index("party_members_nick_idx").on(t.nickname), index("party_members_char_idx").on(t.characterId)],
);

// ---------- 플래너 설정 ----------

export const planConfigs = pgTable(
  "plan_configs",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    world: text("world").notNull(),
    config: jsonb("config").notNull(),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
  },
  (t) => [uniqueIndex("plan_configs_unique").on(t.userId, t.world)],
);

// ---------- API 캐시 / 잡 ----------

export const apiCache = pgTable(
  "api_cache",
  {
    cacheKey: text("cache_key").primaryKey(),
    body: text("body").notNull(),
    // epoch ms 는 1.7e12 라 integer 범위를 한참 넘는다
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  },
  (t) => [index("api_cache_expires_idx").on(t.expiresAt)],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    jobName: text("job_name").notNull(),
    startedAt: text("started_at").notNull().$defaultFn(nowIso),
    finishedAt: text("finished_at"),
    status: text("status").$type<"running" | "ok" | "partial" | "failed">().notNull().default("running"),
    stats: jsonb("stats"),
    error: text("error"),
  },
  (t) => [index("job_runs_name_idx").on(t.jobName, t.startedAt)],
);

// ---------- 모집 게시판 (2차) ----------

export const posts = pgTable(
  "posts",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    authorUserId: text("author_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** 연결된 고정 파티. 수락 시 party_members 에 추가된다. 없으면 자유 모집. */
    partyId: integer("party_id").references(() => parties.id, { onDelete: "set null" }),
    boss: text("boss").notNull(),
    difficulty: text("difficulty").notNull(),
    world: text("world"),
    title: text("title").notNull(),
    body: text("body"),
    /** 모집 인원 (남은 자리 = slots - accepted) */
    slots: integer("slots").notNull().default(1),
    minPower: bigint("min_power", { mode: "number" }),
    scheduleNote: text("schedule_note"),
    status: text("status").$type<"open" | "closed">().notNull().default("open"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
  },
  (t) => [index("posts_status_idx").on(t.status, t.createdAt), index("posts_boss_idx").on(t.boss, t.difficulty), index("posts_author_idx").on(t.authorUserId)],
);

export const applications = pgTable(
  "applications",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    applicantUserId: text("applicant_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    characterId: integer("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
    message: text("message"),
    status: text("status").$type<"pending" | "accepted" | "rejected" | "withdrawn">().notNull().default("pending"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    decidedAt: text("decided_at"),
  },
  (t) => [uniqueIndex("applications_unique").on(t.postId, t.characterId), index("applications_post_idx").on(t.postId, t.status), index("applications_user_idx").on(t.applicantUserId)],
);

export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
export type NexonKey = typeof nexonKeys.$inferSelect;
export type Party = typeof parties.$inferSelect;
export type PartyMember = typeof partyMembers.$inferSelect;
export type SchedulerSnapshot = typeof schedulerSnapshots.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Application = typeof applications.$inferSelect;
