#!/usr/bin/env bash
# Backup minikb data (Postgres + MinIO)
# Usage: ./backup.sh [output_dir]
set -euo pipefail

OUTPUT_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${OUTPUT_DIR}/minikb_backup_${TIMESTAMP}"

echo "📦 Backing up minikb to ${BACKUP_DIR}..."
mkdir -p "${BACKUP_DIR}"

# Load env
if [ -f .env ]; then
    set -a; source .env; set +a
fi

PG_USER="${MINIKB_POSTGRES_USER:-minikb}"
PG_DB="${MINIKB_POSTGRES_DB:-minikb}"
PG_HOST="${MINIKB_PG_HOST:-127.0.0.1}"
PG_PORT="${MINIKB_POSTGRES_PORT:-5432}"
MINIO_ALIAS="minikb"
S3_BUCKET="${MINIKB_S3_BUCKET:-minikb}"

# 1. Postgres dump
echo "🗃️  Dumping Postgres..."
PGPASSWORD="${MINIKB_POSTGRES_PASSWORD:-minikb}" \
    pg_dump -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${PG_DB}" \
    --format=custom --file="${BACKUP_DIR}/database.dump"
echo "   ✓ database.dump"

# 2. MinIO snapshot
echo "📁 Backing up MinIO..."
if command -v mc &> /dev/null; then
    mc alias set "${MINIO_ALIAS}" "http://127.0.0.1:9000" \
        "${MINIKB_S3_ACCESS_KEY:-minioadmin}" \
        "${MINIKB_S3_SECRET_KEY:-minioadmin}" 2>/dev/null || true
    mc mirror "${MINIO_ALIAS}/${S3_BUCKET}" "${BACKUP_DIR}/minio/" 2>/dev/null && \
        echo "   ✓ minio/" || echo "   ⚠ MinIO backup skipped (mc not configured)"
else
    echo "   ⚠ mc (MinIO client) not found, skipping MinIO backup"
fi

# 3. Metadata
cat > "${BACKUP_DIR}/backup_metadata.json" << EOF
{
    "timestamp": "${TIMESTAMP}",
    "pg_host": "${PG_HOST}",
    "pg_db": "${PG_DB}",
    "s3_bucket": "${S3_BUCKET}",
    "files": ["database.dump", "minio/"]
}
EOF

# 4. Compress
echo "🗜️  Compressing..."
cd "${OUTPUT_DIR}"
tar -czf "minikb_backup_${TIMESTAMP}.tar.gz" "minikb_backup_${TIMESTAMP}/"
rm -rf "minikb_backup_${TIMESTAMP}"
echo "✅ Backup saved: ${OUTPUT_DIR}/minikb_backup_${TIMESTAMP}.tar.gz"
echo "   Size: $(du -h "${OUTPUT_DIR}/minikb_backup_${TIMESTAMP}.tar.gz" | cut -f1)"
