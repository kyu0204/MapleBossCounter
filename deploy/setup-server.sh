#!/usr/bin/env bash
# Ubuntu 22.04/24.04 서버 최초 1회 셋업: Node 22, 빌드 도구(better-sqlite3 네이티브), pm2, nginx, certbot, sqlite3 CLI.
# x86_64 와 arm64(Oracle Ampere, AWS Graviton) 양쪽에서 돈다.
#
# 사용: sudo bash deploy/setup-server.sh <domain> [app-user=ubuntu]
#
# Oracle Cloud 주의 — 방화벽이 두 겹이다.
#   1) 콘솔의 Security List(또는 NSG)에서 80·443 인그레스를 열어야 한다. 이 스크립트는 못 건드린다.
#   2) OCI 우분투 이미지는 iptables 에 REJECT 규칙을 깔고 나온다. 아래에서 80·443 만 열고 저장한다.
# 둘 중 하나만 열면 접속이 안 되고, 증상이 똑같아서 찾기 어렵다.
set -euo pipefail

DOMAIN="${1:?사용법: setup-server.sh <domain> [app-user]}"
APP_USER="${2:-ubuntu}"
APP_DIR="/home/${APP_USER}/maple-board"

echo "== 환경: $(uname -m), $(. /etc/os-release && echo "$PRETTY_NAME")"

echo "== apt"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git build-essential python3 sqlite3 nginx certbot python3-certbot-nginx

echo "== Node 22"
# Node 20 은 2026-04 EOL. Next 16 요구는 >=20.9 지만 보안 패치가 끊겼다.
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v && npm -v

echo "== pm2"
npm install -g pm2
# 재부팅 시 자동 시작 (앱 유저 기준)
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "/home/${APP_USER}" >/dev/null || true

echo "== 방화벽 (80/443)"
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q '^Status: active'; then
  ufw allow 'Nginx Full'
fi
if command -v iptables >/dev/null; then
  # OCI 이미지의 REJECT 규칙보다 앞에 넣어야 하므로 맨 위(-I)에 꽂는다. 이미 있으면 -C 가 참이라 건너뛴다.
  for port in 80 443; do
    iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport "$port" -j ACCEPT
  done
  if command -v netfilter-persistent >/dev/null; then
    netfilter-persistent save
  else
    apt-get install -y iptables-persistent && netfilter-persistent save
  fi
fi
echo "   ※ 클라우드 콘솔 쪽 인그레스(Security List / 보안 그룹)도 80·443 을 열어야 한다."

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
     - DuckDNS 를 쓰면 먼저 deploy/duckdns-update.sh 로 IP 를 등록해 두고,
       dig +short ${DOMAIN} 가 이 서버 IP 를 돌려주는지 확인한 뒤에 실행할 것.
  3. su - ${APP_USER} -c "cd ${APP_DIR} && bash deploy/deploy.sh"
  4. 넥슨 서비스 키 발급 후 NEXON_SERVER_API_KEY 교체, NEXON_SERVER_RATE_PER_SEC=500
EOF
