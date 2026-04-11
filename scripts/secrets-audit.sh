#!/usr/bin/env bash
# scripts/secrets-audit.sh
#
# Secrets audit for the Solera codebase.
# Scans src/, supabase/functions/, public/, and key root config files for
# leaked credentials. Optionally builds the Vite client bundle and scans
# dist/ to confirm no server-side secrets made it into the browser payload.
#
# Usage:
#   bash scripts/secrets-audit.sh             # full scan + build
#   bash scripts/secrets-audit.sh --skip-build  # skip npm run build, use existing dist/
#
# Exit codes:
#   0 = no CRITICAL findings (warnings may be present)
#   1 = one or more CRITICAL findings — suitable for blocking CI
#
# Output:
#   - stdout: all findings + summary
#   - scripts/audit/secrets-report.txt: same content, written to disk

set -uo pipefail

# ──────────────────────────────────────────────────────────────────────────────
# Paths & flags
# ──────────────────────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="$REPO_ROOT/scripts/audit"
REPORT_FILE="$REPORT_DIR/secrets-report.txt"
SKIP_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --help|-h)
      echo "Usage: bash scripts/secrets-audit.sh [--skip-build]"
      echo "  --skip-build  Skip 'npm run build'; scan existing dist/ if present."
      exit 0
      ;;
  esac
done

mkdir -p "$REPORT_DIR"
> "$REPORT_FILE"

# ──────────────────────────────────────────────────────────────────────────────
# Counters
# ──────────────────────────────────────────────────────────────────────────────
CRITICAL_COUNT=0
WARNING_COUNT=0
BUNDLE_STATUS="SKIPPED"

# ──────────────────────────────────────────────────────────────────────────────
# Output helpers
# ──────────────────────────────────────────────────────────────────────────────
log() { echo "$*"; echo "$*" >> "$REPORT_FILE"; }

# Emit one finding line.
# Args: severity  rel_file  linenum  pattern_id  full_match_text
emit() {
  local severity="$1" rel_file="$2" linenum="$3" pid="$4" match_text="$5"
  local truncated="${match_text:0:40}"
  [[ ${#match_text} -gt 40 ]] && truncated+="..."
  # strip leading/trailing whitespace from match preview
  truncated="$(echo "$truncated" | sed 's/^[[:space:]]*//')"
  local line
  printf -v line "%-10s %s:%s  PATTERN:%-10s  MATCH:%s" \
    "[$severity]" "$rel_file" "$linenum" "$pid" "$truncated"
  log "$line"
  if [[ "$severity" == "CRITICAL" ]]; then
    CRITICAL_COUNT=$(( CRITICAL_COUNT + 1 ))
  else
    WARNING_COUNT=$(( WARNING_COUNT + 1 ))
  fi
}

# Parse a "filepath:linenum:content" grep hit into HIT_FILE / HIT_LINE / HIT_CONTENT.
parse_hit() {
  HIT_FILE="$(echo "$1" | cut -d: -f1)"
  HIT_LINE="$(echo "$1" | cut -d: -f2)"
  HIT_CONTENT="$(echo "$1" | cut -d: -f3-)"
  HIT_FILE="${HIT_FILE#"$REPO_ROOT"/}"  # make relative
}

# ──────────────────────────────────────────────────────────────────────────────
# Grep configuration
# ──────────────────────────────────────────────────────────────────────────────

# File types to scan in source directories
GREP_INCLUDE=(
  --include="*.ts"   --include="*.tsx"
  --include="*.js"   --include="*.jsx"
  --include="*.json" --include="*.html"
  --include="*.txt"  --include="*.toml"
)

# Directories to exclude from recursive scans
GREP_EXCL_DIR=(
  --exclude-dir=node_modules
  --exclude-dir=.git
  --exclude-dir=dist
  --exclude-dir=.lovable
)

# Individual files to exclude (env files, lock files, binaries)
GREP_EXCL_FILE=(
  --exclude=".env"
  --exclude=".env.local"
  --exclude=".env.*"
  --exclude="*.lock"
  --exclude="bun.lockb"
  --exclude="package-lock.json"
  --exclude="*.png" --exclude="*.jpg"
  --exclude="*.ico" --exclude="*.woff" --exclude="*.woff2"
)

# Directories & individual root files to scan
SOURCE_DIRS=(
  "$REPO_ROOT/src"
  "$REPO_ROOT/supabase/functions"
  "$REPO_ROOT/public"
)
ROOT_FILES=(
  "$REPO_ROOT/vite.config.ts"
  "$REPO_ROOT/index.html"
  "$REPO_ROOT/supabase/config.toml"
)
[[ -f "$REPO_ROOT/.env.example" ]] && ROOT_FILES+=("$REPO_ROOT/.env.example")

# Run grep across source dirs + individual root files.
# Emits lines in the format: "absolute/path/file:linenum:content"
source_grep() {
  local pattern="$1"
  {
    grep -rn -E "$pattern" \
      "${GREP_INCLUDE[@]}" "${GREP_EXCL_DIR[@]}" "${GREP_EXCL_FILE[@]}" \
      "${SOURCE_DIRS[@]}" 2>/dev/null || true
    for f in "${ROOT_FILES[@]}"; do
      [[ -f "$f" ]] && grep -n -E "$pattern" "$f" 2>/dev/null \
        | awk -v file="$f" -F: '{print file ":" $0}' || true
    done
  }
}

# ──────────────────────────────────────────────────────────────────────────────
# Patterns — JWT shared regex
# ──────────────────────────────────────────────────────────────────────────────
# Matches a full 3-part JWT (header.payload.signature) with long enough segments
# to exclude short test tokens or other eyJ-prefixed strings.
JWT_REGEX='eyJ[a-zA-Z0-9_-]{60,}\.[a-zA-Z0-9_-]{60,}\.[a-zA-Z0-9_-]{20,}'

# ──────────────────────────────────────────────────────────────────────────────
# Header
# ──────────────────────────────────────────────────────────────────────────────
HEADER="=== Solera Secrets Audit — $(date -u '+%Y-%m-%d %H:%M UTC') ==="
log "$HEADER"
log ""
log "Scan scope: src/  supabase/functions/  public/  vite.config.ts  index.html  supabase/config.toml"
log "Exclusions: .env*  node_modules/  .git/  dist/  *.lock  binary assets"
log ""

# ══════════════════════════════════════════════════════════════════════════════
# SOURCE SCAN
# ══════════════════════════════════════════════════════════════════════════════
log "── Source Scan ──────────────────────────────────────────────────────────"

# ──────────────────────────────────────────────────────────────────────────────
# P1 — Anthropic API key  (sk-ant-...)
# ──────────────────────────────────────────────────────────────────────────────
echo "  [P1] Anthropic API keys (sk-ant-*)..."
while IFS= read -r hit; do
  [[ -z "$hit" ]] && continue
  parse_hit "$hit"
  emit "CRITICAL" "$HIT_FILE" "$HIT_LINE" "P1" "$HIT_CONTENT"
done < <(source_grep 'sk-ant-[a-zA-Z0-9_-]{20,}')

# ──────────────────────────────────────────────────────────────────────────────
# P2 / P2b — JWT tokens
#   • CRITICAL if payload decodes to contain "service_role"
#   • WARNING   for all other long JWTs (anon keys, etc.)
# ──────────────────────────────────────────────────────────────────────────────
echo "  [P2/P2b] JWT tokens (service_role=CRITICAL, other=WARNING)..."
while IFS= read -r hit; do
  [[ -z "$hit" ]] && continue
  parse_hit "$hit"

  # Extract the first JWT from the matched line
  jwt_token="$(echo "$HIT_CONTENT" | grep -oE "$JWT_REGEX" | head -1)"
  [[ -z "$jwt_token" ]] && continue

  # Isolate the payload (middle segment between the two dots)
  payload_b64="${jwt_token#*.}"
  payload_b64="${payload_b64%.*}"

  # Re-pad base64url → standard base64
  pad=$(( (4 - ${#payload_b64} % 4) % 4 ))
  payload_padded="$payload_b64$(printf '%0.s=' $(seq 1 $pad))"
  decoded="$(printf '%s' "$payload_padded" | tr '_-' '/+' | base64 -d 2>/dev/null || echo '')"

  if echo "$decoded" | grep -q '"service_role"'; then
    emit "CRITICAL" "$HIT_FILE" "$HIT_LINE" "P2" "$jwt_token"
  else
    emit "WARNING" "$HIT_FILE" "$HIT_LINE" "P2b" "$jwt_token"
  fi
done < <(source_grep "$JWT_REGEX")

# ──────────────────────────────────────────────────────────────────────────────
# P3 — Paddle server-side API key  (pdl_sblive_* / pdl_sbtest_*)
# ──────────────────────────────────────────────────────────────────────────────
echo "  [P3] Paddle server API keys (pdl_sb...)..."
while IFS= read -r hit; do
  [[ -z "$hit" ]] && continue
  parse_hit "$hit"
  emit "CRITICAL" "$HIT_FILE" "$HIT_LINE" "P3" "$HIT_CONTENT"
done < <(source_grep 'pdl_sb(live|test)_[a-zA-Z0-9]{20,}')

# ──────────────────────────────────────────────────────────────────────────────
# P4 — Paddle client token hardcoded in source  (live_* / test_*)
#   Publishable key — safe to expose publicly, but hardcoding as a fallback
#   value means it ships in the bundle even without a .env file.
# ──────────────────────────────────────────────────────────────────────────────
echo "  [P4] Hardcoded Paddle client tokens (live_* / test_*)..."
# Match both single-quoted and double-quoted forms (TypeScript uses either)
P4_PATTERN="[\"'](live|test)_[a-zA-Z0-9]{20,}[\"']"
while IFS= read -r hit; do
  [[ -z "$hit" ]] && continue
  parse_hit "$hit"
  emit "WARNING" "$HIT_FILE" "$HIT_LINE" "P4" "$HIT_CONTENT"
done < <(source_grep "$P4_PATTERN")

# ──────────────────────────────────────────────────────────────────────────────
# P5 — Generic high-entropy string ≥40 chars in a double-quoted literal
#   Common false positives are filtered: SVG paths, data URIs, font imports,
#   the known-safe VAPID public key prefix, and TypeScript/ESM boilerplate.
# ──────────────────────────────────────────────────────────────────────────────
P5_FALSE_POSITIVES='(data:image/|url\(|font-face|\.woff|\.svg|<path |d="|fill="|viewBox|__esModule|sourceRoot|sourceMappingURL|BIGmEM4|foreignKeyName|google-site-verification)'

echo "  [P5] High-entropy strings ≥40 chars in quoted literals..."
while IFS= read -r hit; do
  [[ -z "$hit" ]] && continue
  parse_hit "$hit"
  echo "$HIT_CONTENT" | grep -qE "$P5_FALSE_POSITIVES" && continue
  emit "WARNING" "$HIT_FILE" "$HIT_LINE" "P5" "$HIT_CONTENT"
done < <(source_grep '"[a-zA-Z0-9/+_-]{40,}"')

# ──────────────────────────────────────────────────────────────────────────────
# P6 — SUPABASE_SERVICE_ROLE_KEY assigned a literal value in source
#   Catches patterns like: SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
#   (complementary to P2; catches env-var style assignments)
# ──────────────────────────────────────────────────────────────────────────────
echo "  [P6] SUPABASE_SERVICE_ROLE_KEY literal assignment..."
while IFS= read -r hit; do
  [[ -z "$hit" ]] && continue
  parse_hit "$hit"
  emit "CRITICAL" "$HIT_FILE" "$HIT_LINE" "P6" "$HIT_CONTENT"
done < <(source_grep 'SUPABASE_SERVICE_ROLE_KEY[[:space:]]*[=:][[:space:]]*"[^"]{20,}"')

# ──────────────────────────────────────────────────────────────────────────────
# P7 — Named server-side secret assigned a literal value in source
#   If any of these env var names appear with a hard-coded string value, that
#   secret is baked into the source tree and will be committed to git.
# ──────────────────────────────────────────────────────────────────────────────
P7_NAMES='(STRIPE_SECRET_KEY|ANTHROPIC_API_KEY|RESEND_API_KEY|PADDLE_API_KEY|ADMIN_PASSWORD|QUICKBOOKS_CLIENT_SECRET|LOVABLE_API_KEY)'

echo "  [P7] Named server-side secrets assigned literal values..."
while IFS= read -r hit; do
  [[ -z "$hit" ]] && continue
  parse_hit "$hit"
  emit "CRITICAL" "$HIT_FILE" "$HIT_LINE" "P7" "$HIT_CONTENT"
done < <(source_grep "${P7_NAMES}"'[[:space:]]*[=:][[:space:]]*"[^"]{8,}"')

# ══════════════════════════════════════════════════════════════════════════════
# BUNDLE VERIFICATION
# Confirms that server-side secrets are absent from the compiled client bundle.
# Any CRITICAL hit here means a secret has leaked into browser-downloadable JS.
# ══════════════════════════════════════════════════════════════════════════════
log ""
log "── Bundle Verification ──────────────────────────────────────────────────"

if [[ "$SKIP_BUILD" == "false" ]]; then
  echo "  Building client bundle..."
  cd "$REPO_ROOT"
  # Prefer bun (lockfile present) then npm
  if command -v bun &>/dev/null && [[ -f "$REPO_ROOT/bun.lockb" || -f "$REPO_ROOT/bun.lock" ]]; then
    BUILD_CMD="bun run build"
  else
    BUILD_CMD="npm run build"
  fi
  echo "  Running: $BUILD_CMD"
  if $BUILD_CMD 2>&1 | tee /tmp/solera-build.log | tail -8; then
    echo "  Build complete."
  else
    echo "  WARNING: build failed — bundle scan will use existing dist/ if present."
    echo "  (Ensure dependencies are installed before running the audit.)"
  fi
else
  echo "  --skip-build specified; using existing dist/ (if present)."
fi

DIST_DIR="$REPO_ROOT/dist"
BUNDLE_CRITICAL=0

bundle_grep() {
  local pattern="$1" pid="$2"
  while IFS= read -r hit; do
    [[ -z "$hit" ]] && continue
    local bfile bline bcontent
    bfile="$(echo "$hit" | cut -d: -f1)"
    bline="$(echo "$hit" | cut -d: -f2)"
    bcontent="$(echo "$hit" | cut -d: -f3-)"
    bfile="${bfile#"$REPO_ROOT"/}"
    local truncated="${bcontent:0:40}"
    [[ ${#bcontent} -gt 40 ]] && truncated+="..."
    local msg
    printf -v msg "%-10s %s:%s  PATTERN:%-10s  MATCH:%s" \
      "[CRITICAL]" "$bfile" "$bline" "$pid" "$truncated"
    log "$msg"
    CRITICAL_COUNT=$(( CRITICAL_COUNT + 1 ))
    BUNDLE_CRITICAL=$(( BUNDLE_CRITICAL + 1 ))
  done < <(
    grep -rn -E "$pattern" "$DIST_DIR" \
      --include="*.js" --include="*.html" --include="*.json" 2>/dev/null || true
  )
}

if [[ -d "$DIST_DIR" ]]; then
  echo "  Scanning dist/ for CRITICAL patterns..."
  bundle_grep 'service_role'                              'BUNDLE-P6'
  bundle_grep "$JWT_REGEX"                               'BUNDLE-P2'
  bundle_grep 'sk-ant-[a-zA-Z0-9_-]{20,}'               'BUNDLE-P1'
  bundle_grep 'pdl_sb(live|test)_[a-zA-Z0-9]{20,}'      'BUNDLE-P3'
  bundle_grep "${P7_NAMES}"'[[:space:]]*[=:][[:space:]]*"[^"]{8,}"' 'BUNDLE-P7'

  if [[ "$BUNDLE_CRITICAL" -eq 0 ]]; then
    BUNDLE_STATUS="CLEAN"
    echo "  Bundle scan: CLEAN — no server-side secrets detected in dist/."
  else
    BUNDLE_STATUS="COMPROMISED ($BUNDLE_CRITICAL finding(s))"
    echo "  Bundle scan: COMPROMISED — $BUNDLE_CRITICAL CRITICAL finding(s)!"
    echo "  Server-side secrets have leaked into the client bundle."
  fi
else
  BUNDLE_STATUS="NO_DIST — run without --skip-build to generate and scan dist/"
  echo "  No dist/ directory found. Run without --skip-build to perform bundle scan."
fi

# ──────────────────────────────────────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────────────────────────────────────
log ""
log "════════════════════════════════════════"
log "  SECRETS AUDIT SUMMARY"
log "════════════════════════════════════════"
log "  CRITICAL : $CRITICAL_COUNT finding(s)"
log "  WARNING  : $WARNING_COUNT finding(s)"
log "  Bundle   : $BUNDLE_STATUS"
log "════════════════════════════════════════"
log ""
log "Full report: $REPORT_FILE"

if [[ "$CRITICAL_COUNT" -gt 0 ]]; then
  echo ""
  echo "FAILED — $CRITICAL_COUNT CRITICAL finding(s) must be resolved before shipping."
  exit 1
fi

echo ""
echo "PASSED — No CRITICAL findings. Review WARNING items above as needed."
exit 0
