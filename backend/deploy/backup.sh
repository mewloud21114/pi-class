#!/bin/sh
# Nightly database dump, kept 14 days. Cron (as root):  0 3 * * * /opt/pi-class/deploy/backup.sh
# Copy deploy/backups somewhere else too (another server, R2 bucket, ...): a backup on the same disk
# does not survive losing the server.
set -eu
cd "$(dirname "$0")"
mkdir -p backups
file="backups/piclass-$(date +%Y-%m-%d-%H%M).dump"
docker compose exec -T db pg_dump -U piclass -d piclass --format=custom > "$file"
find backups -name 'piclass-*.dump' -mtime +14 -delete
echo "backup written: $file ($(du -h "$file" | cut -f1))"
