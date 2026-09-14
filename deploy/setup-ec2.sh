#!/usr/bin/env bash
# EC2 (Ubuntu 22.04/24.04) 최초 1회 셋업: Node 20, 빌드 도구(better-sqlite3 네이티브), pm2, nginx, certbot, sqlite3 CLI.
# 사용: sudo bash deploy/setup-ec2.sh <domain> <app-user=ubuntu>
set -euo pipefail

DOMAIN="${1:?사용법: setup-ec2.sh <domain> [app-user]}"
APP_USER="${2:-ubuntu}"
APP_DIR="/home/${APP_USER}/maple-board"

echo "== apt"
apt-get update -y
apt-get install -y curl git build-essential python3 sqlite3 nginx certbot python3-certbot-nginx

echo "== Node 20"
if ! command -v node >/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v && npm -v

echo "== pm2"
npm install -g pm2
# 재부팅 시 자동 시작 (앱 유저 기준)
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "/home/${APP_USER}" >/dev/null || true

echo "== nginx"
install -d /etc/nginx/snippets
install -m 644 "${APP_DIR}/deploy/maple-proxy-headers.conf" /etc/nginx/snippets/maple-proxy-headers.conf
sed "s/DOMAIN/${DOMAIN}/g" "${APP_DIR}/deploy/nginx.conf" > /etc/nginx/sites-available/maple-board
ln -sf /etc/nginx/sites-available/maple-board /etc/nginx/sites-enabled/maple-board
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "== 디렉터리"
install -d -o "$APP_USER" -g "$APP_USER" "${APP_DIR}/data" "${APP_DIR}/logs" "${APP_DIR}/backups"

echo "== DB 백업 크론 (매일 04:30 KST = 19:30 UTC 전날, TZ 무관하게 UTC 로 기록)"
CRON_LINE="30 19 * * * ${APP_DIR}/deploy/backup-db.sh >> ${APP_DIR}/logs/backup.log 2>&1"
( crontab -u "$APP_USER" -l 2>/dev/null | grep -v backup-db.sh ; echo "$CRON_LINE" ) | crontab -u "$APP_USER" -

cat <<EOF

완료. 다음 단계:
  1. ${APP_DIR}/.env.local 작성 (.env.example 참고). 필수: AUTH_URL=https://${DOMAIN}  AUTH_TRUST_HOST=1
     Discord OAuth Redirect: https://${DOMAIN}/api/auth/callback/discord
  2. sudo certbot --nginx -d ${DOMAIN}
  3. su - ${APP_USER} -c "cd ${APP_DIR} && bash deploy/deploy.sh"
  4. 넥슨 서비스 키 발급 후 NEXON_SERVER_API_KEY 교체, NEXON_SERVER_RATE_PER_SEC=500
EOF
