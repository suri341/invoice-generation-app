#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
NETWORK_NAME="${NETWORK_NAME:-invoice-network}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-invoice-postgres}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-invoice-backend}"
FRONTEND_CONTAINER="${FRONTEND_CONTAINER:-invoice-frontend}"
POSTGRES_VOLUME="${POSTGRES_VOLUME:-invoice_db_data}"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/backups}"
GDRIVE_REMOTE="${GDRIVE_REMOTE:-gdrive:invoice-backups}"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:15-alpine}"
BACKEND_IMAGE="${BACKEND_IMAGE:-invoice-backend:local}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-invoice-frontend:local}"

log() { printf '\n==> %s\n' "$*"; }
warn() { printf '!! %s\n' "$*" >&2; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

require_docker() {
  command -v docker >/dev/null 2>&1 || die "Docker is not installed or is not on PATH"
  docker info >/dev/null 2>&1 || die "Docker Desktop is not running"
}

ensure_network() {
  docker network inspect "$NETWORK_NAME" >/dev/null 2>&1 || \
    docker network create "$NETWORK_NAME" >/dev/null
}

ensure_volume() {
  docker volume inspect "$POSTGRES_VOLUME" >/dev/null 2>&1 || \
    docker volume create "$POSTGRES_VOLUME" >/dev/null
}

remove_container() {
  docker rm -f "$1" >/dev/null 2>&1 || true
}

wait_for_postgres() {
  log "Waiting for PostgreSQL"
  for _ in $(seq 1 60); do
    if docker exec "$POSTGRES_CONTAINER" pg_isready -U postgres -d invoice_db >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  docker logs "$POSTGRES_CONTAINER" --tail 60 || true
  die "PostgreSQL did not become ready"
}

build_images() {
  log "Building application images"
  docker build -t "$BACKEND_IMAGE" "$SCRIPT_DIR/backend"
  docker build -t "$FRONTEND_IMAGE" "$SCRIPT_DIR/frontend"
}

seed_database() {
  log "Seeding missing sample data and normalizing categories"
  docker exec "$BACKEND_CONTAINER" python3 -c "from app.seed_data import RICE_MILL_PARTS,SAMPLE_CUSTOMERS; from app.database import SessionLocal,init_db; from app.models.part import Part; from app.models.customer import Customer; init_db(); db=SessionLocal(); renames={'Belts & Pulleys':'Belts','Motors':'Motor','Screens & Sieves':'Sieves','Stones & Abrasives':'Stones'}; [setattr(part, 'category', renames[part.category]) for part in db.query(Part).all() if part.category in renames]; existing_parts={x.name for x in db.query(Part).all()}; existing_emails={x.email for x in db.query(Customer).all()}; db.add_all([Part(**x) for x in RICE_MILL_PARTS if x['name'] not in existing_parts]); db.add_all([Customer(**x) for x in SAMPLE_CUSTOMERS if x['email'] not in existing_emails]); db.commit(); print('Local seed completed'); db.close()"
}

apply_stack() {
  require_docker
  ensure_network
  ensure_volume
  build_images

  remove_container "$FRONTEND_CONTAINER"
  remove_container "$BACKEND_CONTAINER"
  remove_container "$POSTGRES_CONTAINER"

  log "Starting PostgreSQL"
  docker run -d --name "$POSTGRES_CONTAINER" --network "$NETWORK_NAME" \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}" \
    -e POSTGRES_DB=invoice_db \
    -p "127.0.0.1:${POSTGRES_PORT:-5432}:5432" \
    -v "$POSTGRES_VOLUME:/var/lib/postgresql/data" \
    "$POSTGRES_IMAGE" >/dev/null
  wait_for_postgres

  log "Starting backend"
  docker run -d --name "$BACKEND_CONTAINER" --network "$NETWORK_NAME" \
    -p "127.0.0.1:${BACKEND_PORT:-8000}:8000" \
    -e DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD:-postgres}@${POSTGRES_CONTAINER}:5432/invoice_db" \
    -e SECRET_KEY="${SECRET_KEY:-change-this-in-production}" \
    -e CORS_ORIGINS="${CORS_ORIGINS:-http://localhost,http://localhost:3000,http://localhost:5173}" \
    -e DEBUG="False" \
    "$BACKEND_IMAGE" >/dev/null

  log "Starting frontend"
  docker run -d --name "$FRONTEND_CONTAINER" --network "$NETWORK_NAME" \
    -p "127.0.0.1:${FRONTEND_PORT:-80}:80" \
    "$FRONTEND_IMAGE" >/dev/null

  sleep 3
  seed_database
  log "Application is running at http://localhost"
  log "API health: http://localhost:${BACKEND_PORT:-8000}/health"
}

backup_database() {
  require_docker
  mkdir -p "$BACKUP_DIR"
  docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1 || die "PostgreSQL container is not running"
  wait_for_postgres

  local stamp backup_file
  stamp="$(date +%Y-%m-%d_%H-%M-%S)"
  backup_file="$BACKUP_DIR/invoice_db_${stamp}.sql.gz"
  log "Creating compressed PostgreSQL backup: $backup_file"
  docker exec "$POSTGRES_CONTAINER" pg_dump -U postgres -d invoice_db --no-owner --no-privileges | gzip > "$backup_file"

  if command -v rclone >/dev/null 2>&1; then
    log "Uploading backup to Google Drive: $GDRIVE_REMOTE"
    rclone copy "$backup_file" "$GDRIVE_REMOTE"
    log "Google Drive upload complete"
  else
    warn "rclone is not installed; backup remains local only: $backup_file"
  fi
}

restore_database() {
  require_docker
  local backup_file="${2:-}"
  [ -n "$backup_file" ] || die "Usage: $0 restore <backup.sql.gz>"
  [ -f "$backup_file" ] || die "Backup file not found: $backup_file"
  wait_for_postgres
  warn "Restoring replaces current database contents"
  read -r -p "Type RESTORE to continue: " confirm
  [ "$confirm" = "RESTORE" ] || die "Restore cancelled"
  gunzip -c "$backup_file" | docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d invoice_db
  log "Database restore complete"
}

show_status() {
  require_docker
  docker ps -a --filter "name=^/${POSTGRES_CONTAINER}$" --filter "name=^/${BACKEND_CONTAINER}$" --filter "name=^/${FRONTEND_CONTAINER}$" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
  docker volume inspect "$POSTGRES_VOLUME" >/dev/null 2>&1 && log "Persistent volume: $POSTGRES_VOLUME"
}

destroy_stack() {
  require_docker
  remove_container "$FRONTEND_CONTAINER"
  remove_container "$BACKEND_CONTAINER"
  remove_container "$POSTGRES_CONTAINER"
  log "Containers removed; database volume preserved: $POSTGRES_VOLUME"

  if [ "${2:-}" = "--purge-data" ]; then
    warn "This permanently deletes the PostgreSQL volume"
    read -r -p "Type DELETE-DATABASE to continue: " confirm
    [ "$confirm" = "DELETE-DATABASE" ] || die "Database deletion cancelled"
    docker volume rm "$POSTGRES_VOLUME"
    log "Database volume deleted"
  fi
}

case "${1:-status}" in
  apply) apply_stack ;;
  backup) backup_database ;;
  restore) restore_database "$@" ;;
  status) show_status ;;
  destroy) destroy_stack "$@" ;;
  *) die "Usage: $0 {apply|backup|restore <backup.sql.gz>|status|destroy [--purge-data]}" ;;
esac