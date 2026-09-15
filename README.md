# 메이플 보스 카운터

메이플스토리(KMS) 주간 보스 결정 수익·확정 보상 집계 + 고정 파티 관리 + 파티 모집 게시판. Next.js 16 · Tailwind · SQLite(Drizzle) · Auth.js(Discord).

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 값 채우기 (아래 참고)
npm run dev                  # http://localhost:3000
```

`.env.local` 필수 값

| 키 | 설명 |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` | Discord Developer Portal → Applications → OAuth2. Redirect URL `http://localhost:3000/api/auth/callback/discord` |
| `NEXON_SERVER_API_KEY` | openapi.nexon.com 에서 발급한 키. 유저 키가 없을 때 공개 조회(`/lookup`, 닉네임 확인)에 사용 |
| `NEXON_KEY_ENC_SECRET` | `openssl rand -base64 32`. 유저가 등록한 넥슨 키를 AES-256-GCM 으로 암호화 |
| `AUTH_DEV_LOGIN` | `1` 이면 Discord 없이 `/api/auth/callback/dev` 로 로컬 로그인 가능 (production 무시) |

DB 는 첫 실행 시 `data/app.db` 에 자동 생성·마이그레이션됩니다.

## 스크립트

```bash
npm test                 # vitest (가격/티어/전투력/플래너/리미터 회귀)
npm run typecheck
npm run lint
npm run db:generate      # 스키마 변경 후 마이그레이션 SQL 생성 (drizzle/)
npm run job -- <name>    # 잡 수동 실행: weekly_snapshot_realtime | weekly_snapshot_backfill | daily_snapshot | weekly_power_refresh | cache_sweep
npx tsx scripts/seed-dev.ts tester 270   # dev 유저에 서버 키 등록 + 캐릭터/스냅샷/예시 파티 시드
npx tsx scripts/smoke.ts 알전임          # 별도 DB(data/smoke.db) 로 파이프라인 검증
npx tsx scripts/check-bossplan.ts 알전임 # "갈 보스" 저장→재읽기→플래너 반영 검증 (app.db 복사본, 실데이터 비변경)
node scripts/fetch-namu-boss-icons.mjs --inspect   # 보스 아이콘 매칭만 확인
node scripts/fetch-namu-boss-icons.mjs            # public/bosses 로 아이콘 재수집
```

## 페이지

| 경로 | 공개 | 내용 |
|---|---|---|
| `/bosses/tiers` `/bosses/crystals` | ○ | 티어표, 결정 가격표·인원 계산기 |
| `/lookup?name=` | ○ | 닉네임으로 전투력 조회 (서버 키, IP 분당 20회, 캐릭터당 10분 쿨다운) |
| `/board` `/board/[id]` | ○ | 파티 모집 게시판. 글쓰기·지원은 로그인 |
| `/board/new` `/board/mine` `/board/[id]/edit` | 로그인 | 모집글 작성·수정, 내 글·지원 현황 |
| `/me` | 로그인 | 캐릭터 대시보드 (기본 Lv.260+ 표시, `?all=1` 로 전체) |
| `/me/characters/[ocid]` | 로그인 | **이번 주 갈 보스 설정**, 보스 클리어·수익, 전투력 이력 |
| `/parties` | 로그인 | 고정 파티 CRUD. 인원수가 플래너 실수령에 반영 |
| `/planner` | 로그인 | 주간 결정 배분 플래너 |
| `/settings/nexon-key` | 로그인 | 넥슨 API 키 등록 |

모집 흐름: 고정 파티 연결 → 모집글 → 지원자가 본인 캐릭터 선택(작성자에게 대표 전투력·이번 주 해당 보스 클리어 여부 노출) → 수락 시 `party_members` 자동 추가, 모집 인원 충족 시 자동 마감.

## 구조

- `src/lib/maple/` — 순수 로직 (가격표·티어·전투력 대표값·스케줄러 파싱·배분 알고리즘). I/O 없음, 클라이언트에서도 실행.
- `src/lib/nexon/` — 넥슨 Open API 클라이언트 (크레덴셜별 큐 5건/초, SQLite 캐시, 에러 매핑).
- `src/lib/limiter.ts` — 프로세스 메모리 슬라이딩 윈도우 리미터 (IP/유저). pm2 fork 1인스턴스 전제.
- `src/lib/db/queries/` — 파티·게시판 조회. `src/actions/` — Server Actions (인증·소유권·zod 검증).
- `src/services/` — DB + API 조합 (캐릭터 동기화/갱신/조회, 스냅샷, 파티 연결, 플래너 입력, 공개 조회).
- `src/jobs/` — node-cron 잡. `CRON_ENABLED=1` 일 때 `instrumentation.ts` 에서 시작.
- `src/data/` — `boss_crystal_prices.json`(패치별 가격), `boss_tiers.json`(나무위키 티어), `boss_icons.json`(아이콘 매핑).
- `src/components/boss/` — 보스 표시 공통 부품. 난이도·티어 표기는 **전부 여기를 거친다**.
  - `DifficultyBadge` / `DifficultyButton` — 난이도 배지(이·노·하·카·익, 색 고정). 선택 UI도 같은 배지를 버튼으로 쓴다.
  - `TierStars` — 티어를 **등급 이름 없이 색 있는 별**로만 표시 (금 `#F0B429` / 은 `#94A3B8` / 동 `#C2703D` / 납 `#6B7280`).
    색을 못 쓰는 `<option>`·`title` 에는 `tierLabel()` 이 `🟡★★★★★` 형태 텍스트를 준다.
  - `BossIcon` / `BossChip` — 보스 아이콘, 아이콘 + 난이도 배지 + 약칭 + 실수령.
  - `DropList` / `DropChip` / `RewardChip` — 드롭 아이템 칩 (아이콘 + 여명/칠흑/에테르넬 세트별 색).
- `deploy/` — EC2 셋업·배포·nginx·DB 백업 스크립트. `ecosystem.config.js` — pm2.

### 갈 보스 설정

캐릭터 상세의 "이번 주 갈 보스"와 플래너의 고정 픽은 **같은 저장소**(`plan_configs.characters[ocid].bosses`)를 쓴다. 어느 쪽에서 고쳐도 반대쪽에 그대로 반영된다.

- 규칙: 주간 결정만 · 한 보스당 난이도 1개 · 인원 1~6. 검증은 `validateBossSelection()` 한 곳에서.
- 파티 등록(`/parties`)에서 유래한 픽은 🔒 로 표시되고 여기서 못 지운다 (파티를 고쳐야 함).
- `스케줄러 등록 불러오기` 는 인게임 스케줄러에 등록해 둔 주간 보스로 선택을 채운다.

### 보스 아이콘

`public/bosses/*.webp` 로 **자체 호스팅**한다 (런타임 외부 요청 없음). 매핑은 `src/data/boss_icons.json`.

> 이미지는 나무위키 보스 문서에서 수집했고 원저작권은 넥슨에 있다. 재배포·상업적 이용(광고 게재 포함)의 책임은 배포자에게 있다.
> 아이콘 파일이 없어도 동작한다 — `BossIcon` 이 난이도 색 + 약칭 배지(`하세렌`, `카더스크`)로 자동 폴백한다.

원본 해상도는 **160×153**. 축소해서 쓰므로 `image-rendering` 은 기본값(부드러운 축소)을 쓴다 — `pixelated` 은 확대용이라 축소에 쓰면 계단현상이 생긴다.
CSS 80px 까지는 2배 DPI 화면에서도 선명하다. 그보다 크게 쓰려면 더 높은 해상도 소스가 필요하다 (maplestory.io 몹 아이콘이 496×504 이지만 장당 약 220KB, 33장이면 7MB 라 그대로는 부적합 — webp 변환이 선행돼야 한다).

### 보스 보상

`src/data/boss_reward_items.json` + `public/items/`. 나무위키 각 보스 문서 **본문 상세표의 "주요 보상"** 칸에서 **주간 보스만** 수집한다 (`node scripts/fetch-namu-item-icons.mjs`, `--inspect` 로 미리보기).

카테고리는 두 종류다.

| 종류 | 라벨 | 의미 |
|---|---|---|
| 공통 | `장비` `소비` `개인` `기타` `공용` `공통` | 난이도 무관 |
| 난이도 | `하드` `카오스` `익스트림` … | 그 난이도 전용 |
| 난이도 이상 | `노멀+` `하드+` | 그 난이도부터 (원문 "노멀 이상") |

카테고리는 **어떤 아이템을 보여줄지 고르는 데만** 쓰고 화면에는 내보내지 않는다. 티어표는 행 자체가 (보스, 난이도)라서 난이도 라벨을 또 붙이면 중복이다 — `rewardItemsFor(boss, diff)` 가 해당하는 것만 평평한 목록으로 준다. `노멀+` 는 같은 보스 안에서 티어 rank 를 비교해 적용 여부를 판단한다.

- **아이콘은 원본 크기 그대로** 쓴다. 원본이 23×20 ~ 41×40 으로 제각각이라 정사각으로 강제하면 축소·왜곡된다. 수집 시 `w`/`h` 를 같이 저장해 레이아웃 흔들림도 막는다.
- 세트 색(여명·칠흑·에테르넬)은 `boss_drops.json` 의 이름 목록으로 유추한다. 이 파일은 이제 **색 유추 전용**이고 보상 내용은 담당하지 않는다.
- 이름 표기가 조금 달라도(`컴플리트 언더 컨트롤` / `컴플리트 언더컨트롤`) `itemIconFor()` 가 공백 제거 + 부분 일치로 아이콘을 찾는다.
- `tests/unit/drops.test.ts` 가 아이콘 파일 실재·주간 보스 전수·카테고리 라벨 유효성·난이도 필터·본문 찌꺼기 혼입을 검사한다.

## 운영 (EC2 Ubuntu)

최초 1회 (root):

```bash
git clone <repo> ~/maple-board && cd ~/maple-board
sudo bash deploy/setup-ec2.sh <domain>       # Node 20, build-essential, pm2, nginx, certbot, 백업 크론
cp .env.example .env.local && vi .env.local  # AUTH_URL=https://<domain>, AUTH_TRUST_HOST=1 필수
sudo certbot --nginx -d <domain>
```

배포/업데이트 (앱 유저):

```bash
bash deploy/deploy.sh          # git pull → DB 백업 → npm ci → typecheck/test/build → pm2 reload → /api/health 확인
pm2 logs maple-board
```

운영 메모

- **pm2 fork 1인스턴스 고정** (`ecosystem.config.js`). node-cron 잡·메모리 리미터·SQLite 단일 writer 전제. `CRON_ENABLED=1`, `TZ=Asia/Seoul` 는 여기서 지정.
- **nginx**: `deploy/nginx.conf`. `/api/jobs/` 는 `allow 127.0.0.1; deny all;`. 앱도 production 에서 `X-Real-IP` 가 루프백이 아니면 403 (`JOBS_LOOPBACK_ONLY=0` 으로 해제). `/lookup` 은 nginx `limit_req` 30r/m 추가.
- **잡 수동 실행**: 서버에서 `npm run job -- weekly_snapshot_backfill` 또는 `curl -X POST -H "Authorization: Bearer $JOBS_SECRET" http://127.0.0.1/api/jobs/cache_sweep`.
- **DB 백업**: `deploy/backup-db.sh` (sqlite3 `.backup` + integrity_check + gzip, 14일 보관). 크론 04:30 KST. 복구는 `pm2 stop maple-board` 후 `gunzip -c backups/app-<stamp>.db.gz > data/app.db`.
- **헬스체크**: `GET /api/health` → `{ ok, cron, lastJobs }`.
- **넥슨 서비스 키**: 공개 전 발급 필요 (dev 키 5건/초·1,000건/일). `NEXON_SERVER_API_KEY` 교체 + `NEXON_SERVER_RATE_PER_SEC=500`.
- **Discord**: Redirect URL 에 `https://<domain>/api/auth/callback/discord` 추가.
- **SEO**: `robots.txt`(로그인 경로 disallow), `sitemap.xml`(공개 페이지 + 열린 모집글). 기준 URL 은 `AUTH_URL`.
