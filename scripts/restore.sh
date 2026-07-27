#!/usr/bin/env bash
# Restore minikb from backup
# Usage: ./restore.sh <backup.tar.gz>
set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup.tar.gz>"
    exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "${BACKUP_FILE}" ]; then
    echo "❌ File not found: ${BACKUP_FILE}"
    exit 1
fi

echo "🔄 Restoring minikb from ${BACKUP_FILE}..."

# Load env
if [ -f .env ]; then
    set -a; source .env; set +a
fi

PG_USER="${MINIKB_POSTGRES_USER:-minikb}"
PG_DB="${MINIKB_POSTGRES_DB:-minikb}"
PG_HOST="${MINIKB_PG_HOST:-127.0.0.1}"
PG_PORT="${MINIKB_POSTGRES_PORT:-5432}"

# Extract
TMPDIR=$(mktemp -d)
echo "📂 Extracting..."
tar -xzf "${BACKUP_FILE}" -C "${TMPDIR}"

BACKUP_DIR=$(find "${TMPDIR}" -maxdepth 1 -type d -name "minikb_backup_*" | head -1)
if [ -z "${BACKUP_DIR}" ]; then
    echo "❌ Invalid backup archive"
    rm -rf "${TMPDIR}"
    exit 1
fi

# 1. Restore Postgres
if [ -f "${BACKUP_DIR}/database.dump" ]; then
    echo "🗃️  Restoring Postgres..."
    read -p "⚠️  This will DROP and recreate the database. Continue? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        PGPASSWORD="${MINIKB_POSTGRES_PASSWORD:-minikb}" \
            pg_restore -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" \
            -d postgres --clean --if-exists --create \
            "${BACKUP_DIR}/database.dump" 2>/dev/null || \
        PGPASSWORD="${MINIKB_POSTGRES_PASSWORD:-minikb}" \
            pg_restore -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" \
            -d "${PG_DB}" --clean --if-exists \
            "${BACKUP_DIR}/database.dump"
        echo "   ✓ Database restored"
    else
        echo "   ⏭ Database restore skipped"
    fi
fi

# 2. Restore MinIO
if [ -d "${BACKUP_DIR}/minio" ]; then
    echo "📁 Restoring MinIO..."
    if command -v mc &> /dev/null; then
        MINIO_ALIAS="minikb"
        S3_BUCKET="${MINIKB_S3_BUCKET:-minikb}"
        mc alias set "${MINIO_ALIAS}" "http://127.0.0.1:9000" \
            "${MINIKB_S3_ACCESS_KEY:-minioadmin}" \
            "${MINIKB_S3_SECRET_KEY:-minioadmin}" 2>/dev/null || true
        mc mirror "${BACKUP_DIR}/minio/" "${MINIO_ALIAS}/${S3_BUCKET}/" 2>/dev/null && \
            echo "   ✓ MinIO restored" || echo "   ⚠ MinIO restore failed"
    else
        echo "   ⚠ mc not found, skipping MinIO restore"
    fi
fi

# Cleanup
rm -rf "${TMPDIR}"
echo "✅ Restore complete!"
