#!/usr/bin/env bash
# 배포/업데이트: (git pull) → npm ci → build → pm2 reload. 앱 유저로 프로젝트 루트에서 실행.
# 사용: bash deploy/deploy.sh [--no-pull]
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${1:-}" != "--no-pull" ]] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git pull --ff-only
fi

[[ -f .env.local ]] || { echo ".env.local 없음"; exit 1; }
grep -q '^AUTH_TRUST_HOST=1' .env.local || echo "경고: AUTH_TRUST_HOST=1 이 없으면 nginx 뒤에서 Auth.js 가 호스트를 거부할 수 있음"

# 빌드 전 DB 백업 (마이그레이션은 서버 시작 시 자동 적용되므로 되돌릴 지점 확보)
[[ -f data/app.db ]] && bash deploy/backup-db.sh || true

npm ci --no-audit --no-fund
npm run typecheck
npm test
npm run build

if pm2 describe maple-board >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save

sleep 2
curl -fsS http://127.0.0.1:3000/api/health && echo && echo "DEPLOY OK"
