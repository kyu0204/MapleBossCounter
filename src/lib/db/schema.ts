import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { AdapterAccountType } from "next-auth/adapters";

const nowIso = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

// ---------- Auth.js (Drizzle adapter 표준 sqlite 스키마) ----------

export const users = sqliteTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
  createdAt: text("created_at").notNull().default(nowIso),
});

export const accounts = sqliteTable(
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

export const sessions = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ---------- 넥슨 API 키 (유저당 1개, 암호화 저장) ----------

export const nexonKeys = sqliteTable("nexon_keys", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  encKey: text("enc_key").notNull(), // iv:tag:ct (base64)
  keyHint: text("key_hint").notNull(), // 마지막 4자
  status: text("status").$type<"active" | "invalid" | "throttled">().notNull().default("active"),
  accountIds: text("account_ids", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  lastOkAt: text("last_ok_at"),
  lastError: text("last_error"),
  createdAt: text("created_at").notNull().default(nowIso),
  updatedAt: text("updated_at").notNull().default(nowIso),
});

// ---------- 캐릭터 ----------

export const characters = sqliteTable(
  "characters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ocid: text("ocid").notNull().unique(),
    name: text("name").notNull(),
    world: text("world"),
    cls: text("class"),
    level: integer("level"),
    imageUrl: text("image_url"),
    ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    accountId: text("account_id"),
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
    curPower: integer("cur_power"),
    curPowerAt: text("cur_power_at"),
    curSetupHashes: text("cur_setup_hashes", { mode: "json" }).$type<{ equipped: string; p1: string; p2: string; p3: string }>(),
    bestPower: integer("best_power"),
    bestPowerAt: text("best_power_at"),
    bestSetupHash: text("best_setup_hash"),
    // 심볼 포스. 보스마다 보는 쪽이 다르다 (아케인리버 / 그란디스)
    arcaneForce: integer("arcane_force"),
    authenticForce: integer("authentic_force"),
    forceFetchedAt: text("force_fetched_at"),
    supersededBy: integer("superseded_by"),
    basicFetchedAt: text("basic_fetched_at"),
    createdAt: text("created_at").notNull().default(nowIso),
    updatedAt: text("updated_at").notNull().default(nowIso),
  },
  (t) => [index("characters_name_idx").on(t.name), index("characters_owner_idx").on(t.ownerUserId), index("characters_world_idx").on(t.world)],
);

export const powerLog = sqliteTable(
  "power_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    characterId: integer("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
    power: integer("power").notNull(),
    setupHash: text("setup_hash"),
    measuredAt: text("measured_at").notNull(),
  },
  (t) => [index("power_log_char_idx").on(t.characterId, t.measuredAt)],
);

// ---------- 스케줄러 스냅샷 ----------

export const schedulerSnapshots = sqliteTable(
  "scheduler_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    characterId: integer("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
    snapshotDate: text("snapshot_date").notNull(), // YYYY-MM-DD KST
    kind: text("kind").$type<"realtime" | "dated">().notNull(),
    weekStart: text("week_start").notNull(), // 목요일
    weeklyClearCount: integer("weekly_clear_count").notNull().default(0),
    weeklyLimit: integer("weekly_limit").notNull().default(12),
    raw: text("raw", { mode: "json" }).notNull(),
    fetchedAt: text("fetched_at").notNull().default(nowIso),
  },
  (t) => [
    uniqueIndex("sched_snap_unique").on(t.characterId, t.snapshotDate, t.kind),
    index("sched_snap_week_idx").on(t.characterId, t.weekStart),
  ],
);

export const bossClears = sqliteTable(
  "boss_clears",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    snapshotId: integer("snapshot_id").notNull().references(() => schedulerSnapshots.id, { onDelete: "cascade" }),
    characterId: integer("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
    weekStart: text("week_start").notNull(),
    boss: text("boss").notNull(),
    difficulty: text("difficulty").notNull(),
    cycle: text("cycle").notNull(),
    registered: integer("registered", { mode: "boolean" }).notNull(),
    completed: integer("completed", { mode: "boolean" }).notNull(),
    listOrderNo: integer("list_order_no").notNull().default(0),
  },
  (t) => [index("boss_clears_char_week_idx").on(t.characterId, t.weekStart), index("boss_clears_boss_idx").on(t.boss, t.difficulty, t.weekStart)],
);

// ---------- 파티 ----------

export const parties = sqliteTable(
  "parties",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
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
    repeats: integer("repeats", { mode: "boolean" }).notNull().default(true),
    /** 만든 주의 시작(목요일). 반복이 아닌 파티의 유효 기간 판정에 쓴다. */
    weekStart: text("week_start"),
    memo: text("memo"),
    createdAt: text("created_at").notNull().default(nowIso),
    updatedAt: text("updated_at").notNull().default(nowIso),
  },
  (t) => [index("parties_owner_idx").on(t.ownerUserId), index("parties_boss_idx").on(t.boss, t.difficulty)],
);

export const partyMembers = sqliteTable(
  "party_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    partyId: integer("party_id").notNull().references(() => parties.id, { onDelete: "cascade" }),
    nickname: text("nickname").notNull(),
    characterId: integer("character_id").references(() => characters.id, { onDelete: "set null" }),
    /** 파티장 표시는 화면에서 뺐다. 컬럼은 예전 데이터 때문에 남겨 두고 늘 기본값이다. */
    isLeader: integer("is_leader", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("party_members_unique").on(t.partyId, t.nickname), index("party_members_nick_idx").on(t.nickname), index("party_members_char_idx").on(t.characterId)],
);

// ---------- 플래너 설정 ----------

export const planConfigs = sqliteTable(
  "plan_configs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    world: text("world").notNull(),
    config: text("config", { mode: "json" }).notNull(),
    updatedAt: text("updated_at").notNull().default(nowIso),
  },
  (t) => [uniqueIndex("plan_configs_unique").on(t.userId, t.world)],
);

// ---------- API 캐시 / 잡 ----------

export const apiCache = sqliteTable(
  "api_cache",
  {
    cacheKey: text("cache_key").primaryKey(),
    body: text("body").notNull(),
    expiresAt: integer("expires_at").notNull(), // epoch ms
  },
  (t) => [index("api_cache_expires_idx").on(t.expiresAt)],
);

export const jobRuns = sqliteTable(
  "job_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobName: text("job_name").notNull(),
    startedAt: text("started_at").notNull().default(nowIso),
    finishedAt: text("finished_at"),
    status: text("status").$type<"running" | "ok" | "partial" | "failed">().notNull().default("running"),
    stats: text("stats", { mode: "json" }),
    error: text("error"),
  },
  (t) => [index("job_runs_name_idx").on(t.jobName, t.startedAt)],
);

// ---------- 모집 게시판 (2차) ----------

export const posts = sqliteTable(
  "posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
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
    minPower: integer("min_power"),
    scheduleNote: text("schedule_note"),
    status: text("status").$type<"open" | "closed">().notNull().default("open"),
    createdAt: text("created_at").notNull().default(nowIso),
    updatedAt: text("updated_at").notNull().default(nowIso),
  },
  (t) => [index("posts_status_idx").on(t.status, t.createdAt), index("posts_boss_idx").on(t.boss, t.difficulty), index("posts_author_idx").on(t.authorUserId)],
);

export const applications = sqliteTable(
  "applications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    applicantUserId: text("applicant_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    characterId: integer("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
    message: text("message"),
    status: text("status").$type<"pending" | "accepted" | "rejected" | "withdrawn">().notNull().default("pending"),
    createdAt: text("created_at").notNull().default(nowIso),
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
