#!/usr/bin/env bash
# DuckDNS 주소가 이 서버를 가리키게 한다. 도메인을 사지 않고 HTTPS 를 붙일 때 쓴다.
#
# Discord OAuth 도 Let's Encrypt 도 호스트명을 요구한다. 생 IP 로는 둘 다 안 된다.
# DuckDNS 는 <이름>.duckdns.org 를 공짜로 주고, 이 스크립트가 그 이름이 가리킬 IP 를 갱신한다.
#
# 준비: https://www.duckdns.org 에서 로그인 → 이름 하나 만들고 토큰 복사.
# 사용:
#   DUCKDNS_DOMAIN=myname DUCKDNS_TOKEN=xxxx bash deploy/duckdns-update.sh
#   # 또는 .env.duckdns 에 두 값을 적어 두면 인자 없이 돈다
#
# 크론 (IP 가 바뀌어도 따라가게, 앱 유저 crontab):
#   */5 * * * * /home/ubuntu/maple-board/deploy/duckdns-update.sh >> /home/ubuntu/maple-board/logs/duckdns.log 2>&1
#
# 오라클 무료 VM 은 인스턴스를 멈췄다 켜면 공인 IP 가 바뀔 수 있다 (예약 IP 가 아니면).
# 그래서 한 번 등록하고 끝내지 말고 크론으로 걸어 두는 편이 안전하다.
set -euo pipefail
cd "$(dirname "$0")/.."

[[ -f .env.duckdns ]] && . ./.env.duckdns

: "${DUCKDNS_DOMAIN:?DUCKDNS_DOMAIN 이 필요하다 (myname.duckdns.org 의 myname 부분)}"
: "${DUCKDNS_TOKEN:?DUCKDNS_TOKEN 이 필요하다}"

# ip 를 비워 보내면 DuckDNS 가 요청한 쪽 IP 를 쓴다 — 서버에서 돌리면 그게 곧 공인 IP 다.
resp="$(curl -fsS "https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=")"

if [[ "$resp" == "OK" ]]; then
  echo "$(date '+%F %T') ${DUCKDNS_DOMAIN}.duckdns.org OK"
else
  # KO 는 대개 이름·토큰이 틀린 경우다. 토큰은 로그에 찍지 않는다.
  echo "$(date '+%F %T') ${DUCKDNS_DOMAIN}.duckdns.org 실패: ${resp}" >&2
  exit 1
fi
