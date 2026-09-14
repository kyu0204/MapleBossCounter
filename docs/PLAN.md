# 메이플 파티 보드 + 주간 결정 플래너 — 사이트 구현 계획

## Context

`C:\Users\SSAFY\Downloads\maple-proto.js` 로 넥슨 Open API 조회·전투력 기록·스케줄러 파싱·주간 결정 90개 배분(`plan`)까지 CLI로 검증 끝남. 이제 이걸 웹 사이트로 옮긴다. 목표: (1) 내 캐릭터 대시보드, (2) 고정 파티 등록(솔격/다인격 구분의 근거), (3) 주간 결정 플래너 웹화, (4) 공개 티어표·결정 가격표. 파티 모집 게시판·닉네임 공개 조회는 2차.

사용자 결정 사항:
- 스택: **Next.js (App Router, TS) + Tailwind + SQLite**. 로컬 `next dev`로 먼저, 이후 EC2(ubuntu)에서 `next start` + pm2 + nginx 공개. 애드센스/SEO 고려해 Next.js 선택.
- 인증: **Discord OAuth** (Auth.js v5) + 계정 내 **넥슨 API 키 등록**(암호화 저장). 넥슨 Open ID는 파트너스 전용이라 보류, 자격증명 계층을 교체 가능하게 설계.
- 파티 구성원: 닉네임 입력, 사이트 유저 캐릭터면 자동 연결. 인원 = 멤버 수.
- 프로젝트 위치: `C:\Users\SSAFY\Documents\pjt\maple-board` (신규 폴더, `pjt`는 프로젝트 모음 폴더).

검증된 API 사실 (설계 제약):
- 계정 한정 엔드포인트: `/character/list`, `/scheduler/character-state` → 유저 본인 키 필수. 나머지(id/basic/stat/item-equipment)는 공개.
- 스케줄러: `date` 는 어제~13일 전만, 기록 없는 날은 400 OPENAPI00004. 행 목록 가변(56→80). `registration_flag`와 `complete_flag` 행 단위 독립. 주간 리셋 목 00:00 KST. 보스 클리어는 즉시 반영.
- 월드 리프 시 ocid 변경, 이력 단절.
- 결정 판매가 = 표 가격 ÷ 파티 인원. 캐릭터당 주간 보스 입장 12회(`weekly_boss_clear_limit_count`). 월드 주간 판매 한도 기본 90(공식 미확인, 설정값).
- 가격 전환 2026-09-17(검마 10-01) → `crystalPrice(boss, diff, date)` 이미 처리.
- dev 키 5건/초·1,000건/일. 공개 전 서비스 키 필요.

## 핵심 결정

| 항목 | 결정 |
|---|---|
| DB | Drizzle ORM + better-sqlite3 (`serverExternalPackages: ['better-sqlite3']`, WAL, 시작 시 migrate) |
| 가격/티어 데이터 | JSON을 repo `src/data/`에 유지 (테이블 X) |
| 뮤테이션 | Server Actions 기본. Route Handler는 auth, 잡 트리거만 |
| 플래너 계산 | `allocatePlan()` 순수 함수, 클라이언트에서도 실행 → 인원 바꾸면 즉시 재계산 |
| 크론 | `src/instrumentation.ts` + node-cron (env `CRON_ENABLED=1`, `job_runs` 락, pm2 fork 1인스턴스) |
| API 캐시 | SQLite `api_cache` 테이블 (dev 리로드에도 유지, 쿼터 보호) |
| 검증 | vitest, 프로토타입 출력과 회귀 비교 |

## 폴더 구조 (요지)

```
maple-board/
├─ drizzle.config.ts  drizzle/  ecosystem.config.js  .env.local
├─ scripts/run-job.ts            # 잡 수동 실행
├─ tests/fixtures/               # Downloads의 sched_*.json, power_log.json, plan_config.json 복사
└─ src/
   ├─ instrumentation.ts  middleware.ts  auth.ts
   ├─ data/boss_crystal_prices.json  boss_tiers.json      # Downloads에서 복사
   ├─ app/
   │  ├─ (public)/bosses/tiers  bosses/crystals
   │  ├─ (app)/me  me/characters/[ocid]  settings/nexon-key  parties  parties/new  parties/[id]  planner
   │  └─ api/auth/[...nextauth]  api/jobs/[name]
   ├─ actions/  nexon-key.ts characters.ts parties.ts planner.ts
   ├─ lib/
   │  ├─ nexon/  client.ts(nx 포팅) endpoints.ts credentials.ts rateLimit.ts cache.ts errors.ts
   │  ├─ maple/  prices.ts tiers.ts bossKey.ts power.ts format.ts kst.ts scheduler.ts planner.ts
   │  ├─ crypto.ts
   │  └─ db/  index.ts schema.ts queries/
   ├─ services/  characterSync.ts characterRefresh.ts snapshotService.ts partyLink.ts planInput.ts
   ├─ jobs/  index.ts weeklySnapshot.ts dailySnapshot.ts cacheSweep.ts
   └─ components/  character/ party/ planner/ ui/
```

## 프로토타입 → 모듈 포팅 매핑 (`maple-proto.js` 기준)

| 프로토타입 | 이동 위치 | 변경 |
|---|---|---|
| `nx`, `sleep` | `lib/nexon/client.ts` | 캐시·크레덴셜별 큐(p-queue)·에러 매핑 추가. 00007 재시도 유지 |
| `getOcid` `getBasic` `getEquipment` `getCombatPower` `getScheduler` `getMyCharacterList` | `lib/nexon/endpoints.ts` | 마지막 인자로 `cred` |
| `normalizeItem` `hashItemList` `setupHashes` `updateBest` | `lib/maple/power.ts` | 그대로 (I/O 없음) |
| `crystalPrice` `weeklyCandidates` `PRICE_TABLE` | `lib/maple/prices.ts` | JSON import |
| `TIER_MAP` `tierOf` `tierLabel` | `lib/maple/tiers.ts` | 그대로 |
| `parseBossKey` `normalizeBossList` | `lib/maple/bossKey.ts` | 그대로 |
| `fmtPower` | `lib/maple/format.ts` | 그대로 |
| `kstDateStr` `lastWednesdayKst` | `lib/maple/kst.ts` | `weekStartOf(date)` 추가 |
| `cmdSched` 출력부 | `lib/maple/scheduler.ts` `parseSnapshot`, `estimateRevenue` | 콘솔 → 데이터 반환 |
| `cmdPlan` 캐릭터 루프 | `lib/maple/planner.ts` `buildProfile()` | I/O 분리 |
| `cmdPlan` 월드 루프(pool/greedy/rows/warn) | `lib/maple/planner.ts` `allocatePlan(input)` | 순수 함수 |
| `cmdPlanInit` | `actions/planner.ts` `initFromScheduler` | registration_flag 기반, party/skip/auto/ceiling 유지 |

`allocatePlan` 시그니처:
```ts
PlanInput  = { priceDate, worldLimit, candidates: {boss,diff,price}[],
               profiles: { charId, name, cls, level, cap, party, auto,
                           ceiling: {boss,diff,rank}|null, fixed: {boss,diff,price,party}[] }[] }
PlanOutput = { rows: {charId, picks, value, gross}[], count, worldValue, worldGross, idle: charId[], warnings: string[] }
```

## SQLite 스키마 (Drizzle)

Auth.js 어댑터 표준 4테이블(`users accounts sessions verification_tokens`) + 아래.

- `nexon_keys` — user_id PK, enc_key(AES-GCM), key_hint, status(active|invalid|throttled), account_ids JSON, last_ok_at, last_error
- `characters` — ocid UNIQUE, name, world, class, level, image_url, owner_user_id NULL, account_id, hidden, cur_power/cur_power_at/cur_setup_hashes, best_power/best_power_at/best_setup_hash, superseded_by(리프 시 구 row) · INDEX(name),(owner_user_id),(world)
- `power_log` — character_id, power, setup_hash, measured_at
- `scheduler_snapshots` — character_id, snapshot_date, kind(realtime|dated), week_start(목요일), weekly_clear_count, weekly_limit, raw JSON · UNIQUE(character_id, snapshot_date, kind)
- `boss_clears` — snapshot_id, character_id, week_start, boss, difficulty, cycle, registered, completed, list_order_no · INDEX(character_id, week_start),(boss,difficulty,week_start)
- `parties` — owner_user_id, name, boss, difficulty, world, schedule_note, memo
- `party_members` — party_id, nickname, character_id NULL(자동 연결), is_leader, sort_order · UNIQUE(party_id, nickname) · 인원 = COUNT
- `plan_configs` — user_id, world, config JSON(프로토타입 plan_config.json 구조, 키는 닉네임→ocid) · UNIQUE(user_id, world)
- `api_cache` — cache_key PK, body, expires_at
- `job_runs` — job_name, started_at, finished_at, status, stats, error
- (2차) `posts`, `applications`

## Nexon 클라이언트

- `NexonCredential { id, kind:'api_key'|'openid', headers(), ratePerSec, onAuthError }`. `resolveCredential({userId, scope:'account'|'public'})`: account 스코프는 유저 키 필수, public 스코프는 유저 키 있으면 유저 키(쿼터 분산) 없으면 서버 키 `NEXON_SERVER_API_KEY`. Open ID 도입 시 `OpenIdCredential` 추가만.
- 큐: 크레덴셜 id별 p-queue, `ratePerSec - 1`/초.
- TTL: `/id` 24h · basic/stat/equip 1h · `/character/list` 10m · scheduler realtime 5m · scheduler dated는 스냅샷 테이블에 영구.
- 에러: 00007 → 1.2s 후 2회 재시도 · 00005 → 키 invalid · 00004(+date) → null(기록 없음, 24h negative cache) · 점검 코드 → 사용자 메시지.

## 백그라운드 잡 (node-cron, Asia/Seoul)

| 크론 | 잡 |
|---|---|
| `30 23 * * 3` | 수 23:30 링크 캐릭터 전체 realtime 스냅샷 (리셋 전 안전본) |
| `0 4 * * 4` | 목 04:00 `date=수요일` 조회로 권위본 backfill |
| `10 4 * * *` | 일간 `date=어제` (opt-in) |
| `0 5 * * 4` | 목 05:00 전투력 갱신(basic/stat/equip → updateBest) |
| `0 * * * *` | 만료 캐시 삭제 |

`instrumentation.ts`: `NEXT_RUNTIME==='nodejs' && CRON_ENABLED==='1'`, `globalThis` 가드로 dev HMR 중복 방지, 동적 import. `POST /api/jobs/[name]` (Bearer `JOBS_SECRET`) + `scripts/run-job.ts`로 수동 실행.

## 페이지 (1차)

- `/settings/nexon-key` — 키 입력 → `/character/list`로 검증 → 암호화 저장 → `characterSync`. 상태·힌트(`****ab12`)·교체/삭제.
- `/me` — 월드별 캐릭터 카드: 대표 전투력(`best_power`) + 현재값(다르면 "다른 세팅" 뱃지), 주간 보스 n/12, 이번 주 결정 수익 추정(파티 등록 인원 반영). 새로고침(TTL 쿨다운), 숨기기.
- `/me/characters/[ocid]` — 보스 표(주간/일간/월간, 완료·등록·가격·÷N), 수익 합계, 전투력 이력, 일간/주간 콘텐츠, 지난주 스냅샷 비교.
- `/parties`, `/parties/new`, `/parties/[id]` — 보스·난이도 셀렉트, 멤버 칩 입력(`resolveNickname`: characters.name 매칭 → 없으면 서버 키로 getOcid+getBasic 해 owner null 캐릭터 생성, 월드 불일치 경고), 리더, 메모. 카드에 1인당 결정가.
  자동 연결 3규칙: 멤버 추가 시 이름 매칭 / `characterSync`로 새 캐릭터 링크 시 `party_members.character_id` 채움 / 닉 변경 감지 시 nickname 갱신.
- `/planner` — 월드 탭. 캐릭터 행: 상한(자동 추정 또는 티어표 드롭다운), auto·skip 토글, 기본 인원, 고정 픽(파티 유래=잠금, 수동=편집), 배분 결과(📌/자동, 가격 ÷ N). 월드 요약: n/90, 실수령·정가 합, 경고. 월드 한도 입력(기본 90, "미확인" 표기), 가격 기준일 토글(오늘/9-17/10-01). 액션 `savePlanConfig`, `initFromScheduler`.
  상한 입력: 이번 주 최신 realtime 스냅샷 + 지난 수요일 dated(없으면 realtime).
- `/bosses/tiers`, `/bosses/crystals` — JSON 렌더, 인원 슬라이더 계산기, old→new 변동. `generateMetadata`.

2차: `/lookup?name=`(서버 키 조회, IP 리밋), `/board` 모집 게시판(내 파티 빈자리 → 글 → 지원자에 전투력·이번 주 클리어 표시 → 수락 시 party_members 추가).

## 보안

- `lib/crypto.ts` AES-256-GCM, 키 `NEXON_KEY_ENC_SECRET`(32B base64), IV 랜덤, AAD=user_id. 복호화는 `resolveCredential` 내부만. `enc_key`는 `getDecryptedKey(userId)` 외 어떤 select에도 미포함. 액션 반환값에 키 절대 포함 X. 로그에 헤더 금지.
- `middleware.ts` matcher: `/me`, `/settings`, `/parties`, `/planner`. 액션마다 `auth()` + 소유권 검사. zod 입력 검증.
- 새로고침 10분 쿨다운, `resolveNickname` 유저당 분당 10회.
- env: `AUTH_SECRET AUTH_DISCORD_ID AUTH_DISCORD_SECRET AUTH_URL NEXON_KEY_ENC_SECRET NEXON_SERVER_API_KEY DATABASE_PATH CRON_ENABLED JOBS_SECRET WEEKLY_WORLD_SALE_LIMIT`

## 구현 순서 (마일스톤 + 검증)

**M0 스캐폴드 + 순수 로직 포팅** — `create-next-app --ts --tailwind --app --src-dir` in `Documents/pjt/maple-board`; drizzle-orm drizzle-kit better-sqlite3 vitest zod node-cron p-queue next-auth@beta @auth/drizzle-adapter 설치; `src/data/*.json`, `tests/fixtures/*` 복사; `lib/maple/*` 포팅.
검증: vitest — `crystalPrice('스우','hard','2026-09-16')=51500000`, `'2026-09-17'=48900000`, 검마 10-01 분기; `updateBest` 무효화 4시나리오(프로토타입 logic-test와 동일); `parseSnapshot(sched_다이아태훈_raw2.json)` 상한=선택받은 세렌 hard(은★9); `allocatePlan`에 plan_config.json 동등 입력 → 프로토타입 `plan --date 2026-09-17` 결과(90개, 실수령 88억 7062만)와 일치.

**M1 인증** — Auth.js Discord + Drizzle adapter, middleware. 검증: 로그인 → users 행, 비로그인 `/me` 리다이렉트. *사용자 준비물: Discord Developer Portal에서 앱 생성, redirect `http://localhost:3000/api/auth/callback/discord`.*

**M2 Nexon 클라이언트 + 키 등록** — credentials/rateLimit/cache/errors/client/endpoints, crypto, `registerNexonKey`, 설정 페이지. 검증: 잘못된 키 → invalid; 정상 키 → account_ids; 20회 연속 호출 00007 없음; 동일 요청 2회차 cache hit.

**M3 대시보드** — `characterSync`(list → characters upsert, 리프 감지 `superseded_by`), `characterRefresh`(→ setupHashes/updateBest → characters/power_log), `snapshotService.saveRealtime` + boss_clears 파생, `/me`, `/me/characters/[ocid]`. 검증: `char 알전임`/`sched 알전임` CLI 출력과 대표 전투력·수익 합계 일치.

**M4 잡** — instrumentation, jobs, job_runs, `/api/jobs/[name]`, run-job 스크립트. 검증: 수동 트리거 backfill → dated 행 생성, 00004 캐릭터 스킵 기록, 연속 실행 시 락 스킵.

**M5 파티** — CRUD, 멤버 칩 입력, resolveNickname, partyLink 3규칙. 검증: 타 유저 키 등록 후 기존 멤버 row에 character_id 채워짐; 인원 = 멤버 수; 플래너 고정 픽에 파티 유래 항목 등장.

**M6 플래너** — planInput(스냅샷 2개 + plan_configs + 파티 fixed 병합), `PlannerBoard`(클라 allocatePlan), 저장/init. 검증: 프로토타입과 픽·합계 일치; 인원 변경 즉시 재정렬; 한도 초과 경고.

**M7 공개 페이지** — tiers/crystals, metadata, sitemap.

**M8 배포(공개 시점)** — EC2 Node 20 + build-essential, `npm run build`, pm2(`CRON_ENABLED=1`, fork 1), nginx+certbot, DB 백업 cron, **서비스 키 발급**. `/api/jobs`는 127.0.0.1만.

**M9 (2차)** — `/lookup`, `/board`.

## 리스크 / 엣지

- ocid 변경(리프): 같은 owner·이름·다른 ocid → 새 row + `superseded_by`, best_power/setup_hash 복사, 파티 멤버 재연결.
- 키 무효(00005): status invalid + 배너, 잡에서 스킵.
- 쿼터: 유저 키 분산 + 캐시 TTL, 서버 키는 공개 페이지만, 공개 전 서비스 키.
- 가격 기준일 = 판매 시점(오늘 KST 기본), 9/17·10/1 모두 목요일이라 주 단위 정합.
- 이력 없는 캐릭터: ceiling null → 수동 상한 입력 유도.
- boss_contents 가변: 원본 JSON 보존, 있는 행만 파생, weeklySet은 합집합.
- 크론 중복: globalThis 가드 + job_runs 락 + pm2 fork 1.
- better-sqlite3 네이티브 빌드: Windows는 prebuilt, EC2는 build-essential python3.

## 사용자 준비물 (구현 전/중)

1. Discord 앱 Client ID/Secret (M1)
2. 넥슨 dev 키: 현재 `maple-proto.js`에 박힌 `test_...` 키를 `.env.local`의 `NEXON_SERVER_API_KEY`로 이동, 소스에서 제거
3. `openssl rand -base64 32` × 2 (`AUTH_SECRET`, `NEXON_KEY_ENC_SECRET`)
