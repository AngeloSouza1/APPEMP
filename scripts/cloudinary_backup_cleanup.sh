#!/usr/bin/env bash
set -euo pipefail

APP_BASE_URL="${APP_BASE_URL:-https://appemp.onrender.com}"
WORKDIR="${WORKDIR:-/tmp/appemp-cloudinary}"
AUTO_CONFIRM="${AUTO_CONFIRM:-false}"

usage() {
  cat <<'EOF'
Uso:
  scripts/cloudinary_backup_cleanup.sh --token TOKEN --download-url URL
  scripts/cloudinary_backup_cleanup.sh --token TOKEN --batch-key BATCH_KEY

Opcoes:
  --token TOKEN         JWT de admin/backoffice.
  --download-url URL    URL retornada pelo backup (downloadUrl).
  --batch-key KEY       batchKey retornado pelo backup. Monta a URL automaticamente.
  --app-base-url URL    Base da API. Padrao: https://appemp.onrender.com
  --workdir DIR         Pasta temporaria local. Padrao: /tmp/appemp-cloudinary
  --yes                 Confirma a limpeza sem perguntar.

Fluxo:
  1. Baixa o zip do backup
  2. Lista o conteudo do zip
  3. Extrai o manifest.json
  4. Envia o manifest.files para a rota de limpeza
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Comando obrigatorio nao encontrado: $1" >&2
    exit 1
  fi
}

TOKEN=""
DOWNLOAD_URL=""
BATCH_KEY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --token)
      TOKEN="${2:-}"
      shift 2
      ;;
    --download-url)
      DOWNLOAD_URL="${2:-}"
      shift 2
      ;;
    --batch-key)
      BATCH_KEY="${2:-}"
      shift 2
      ;;
    --app-base-url)
      APP_BASE_URL="${2:-}"
      shift 2
      ;;
    --workdir)
      WORKDIR="${2:-}"
      shift 2
      ;;
    --yes)
      AUTO_CONFIRM="true"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Opcao invalida: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$TOKEN" ]]; then
  echo "--token e obrigatorio." >&2
  usage
  exit 1
fi

if [[ -z "$DOWNLOAD_URL" && -z "$BATCH_KEY" ]]; then
  echo "Informe --download-url ou --batch-key." >&2
  usage
  exit 1
fi

require_cmd curl
require_cmd unzip
require_cmd mktemp

if [[ -n "$BATCH_KEY" && -z "$DOWNLOAD_URL" ]]; then
  APP_BASE_URL="${APP_BASE_URL%/}"
  DOWNLOAD_URL="${APP_BASE_URL}/admin/monitoramento/cloudinary/backup/${BATCH_KEY}/download"
fi

mkdir -p "$WORKDIR"
TMP_DIR="$(mktemp -d "${WORKDIR%/}/run.XXXXXX")"
ZIP_PATH="$TMP_DIR/backup-cloudinary.zip"
MANIFEST_PATH="$TMP_DIR/manifest.json"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "Baixando backup..."
curl -fsSL \
  -H "Authorization: Bearer $TOKEN" \
  -o "$ZIP_PATH" \
  "$DOWNLOAD_URL"

echo "Zip salvo em: $ZIP_PATH"
echo
echo "Conteudo do zip:"
unzip -l "$ZIP_PATH"

unzip -p "$ZIP_PATH" manifest.json > "$MANIFEST_PATH"
echo
echo "Manifest extraido em: $MANIFEST_PATH"

if command -v jq >/dev/null 2>&1; then
  FILES_COUNT="$(jq '.files | length' "$MANIFEST_PATH")"
  PAYLOAD="$(jq -c '{files: .files}' "$MANIFEST_PATH")"
else
  require_cmd node
  FILES_COUNT="$(node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write(String((m.files||[]).length));" "$MANIFEST_PATH")"
  PAYLOAD="$(node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write(JSON.stringify({files:m.files||[]}));" "$MANIFEST_PATH")"
fi

echo "Arquivos listados no manifest: $FILES_COUNT"

if [[ "$AUTO_CONFIRM" != "true" ]]; then
  echo
  read -r -p "Executar limpeza do Cloudinary com este lote? [y/N] " ANSWER
  case "${ANSWER:-}" in
    y|Y|yes|YES)
      ;;
    *)
      echo "Limpeza cancelada. O zip e o manifest foram validados localmente."
      exit 0
      ;;
  esac
fi

echo
echo "Enviando limpeza..."
curl -i --max-time 120 -X POST "${APP_BASE_URL%/}/admin/monitoramento/cloudinary/limpar" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data "$PAYLOAD"

