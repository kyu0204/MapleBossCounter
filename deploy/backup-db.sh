#!/usr/bin/env bash
# SQLite 온라인 백업 (WAL 안전). backups/app-YYYYmmdd-HHMMSS.db.gz, 14일 보관.
# 크론: 30 19 * * * (UTC) = 04:30 KST. setup-server.sh 가 등록한다.
# 복구: gunzip -c backups/app-....db.gz > data/app.db  (pm2 stop 후)
set -euo pipefail
cd "$(dirname "$0")/.."

DB="${DATABASE_PATH:-data/app.db}"
OUT_DIR="backups"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
[[ -f "$DB" ]] || { echo "DB 없음: $DB"; exit 0; }
mkdir -p "$OUT_DIR"

STAMP="$(date -u +%Y%m%d-%H%M%S)"
TMP="${OUT_DIR}/app-${STAMP}.db"
sqlite3 "$DB" ".backup '${TMP}'"
sqlite3 "$TMP" "PRAGMA integrity_check;" | grep -q '^ok$' || { echo "integrity_check 실패"; rm -f "$TMP"; exit 1; }
gzip -f "$TMP"
find "$OUT_DIR" -name 'app-*.db.gz' -mtime "+${KEEP_DAYS}" -delete
echo "$(date -u +%FT%TZ) backup ok ${TMP}.gz ($(du -h "${TMP}.gz" | cut -f1))"
