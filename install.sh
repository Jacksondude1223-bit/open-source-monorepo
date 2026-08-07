#!/usr/bin/env bash
#
# ReAdmin one-command installer for a fresh Linux VPS.
#
#   git clone https://github.com/Jacksondude1223-bit/open-source-monorepo.git readmin
#   cd readmin && sudo ./install.sh
#
# or, without cloning first:
#
#   curl -fsSL https://raw.githubusercontent.com/Jacksondude1223-bit/open-source-monorepo/master/install.sh | sudo bash
#
# It installs Node 24, asks for every credential, writes .env, builds the panel
# and the API, and registers the three processes as systemd services. Re-running
# it is safe: existing .env values come back as the defaults.
#
# See README §2 for what each credential is and where to get it.

set -euo pipefail

REPO_URL="${READMIN_REPO_URL:-https://github.com/Jacksondude1223-bit/open-source-monorepo.git}"
REPO_BRANCH="${READMIN_REPO_BRANCH:-master}"
CLONE_DIR="${READMIN_DIR:-/opt/readmin}"
NODE_MAJOR=24

# ── options ───────────────────────────────────────────────────────────────────
ASSUME_YES=0
SKIP_NODE=0
SKIP_DEPS=0
SKIP_BUILD=0
SKIP_SERVICES=0
ENV_ONLY=0
NON_INTERACTIVE=0
SERVICE_USER=""

usage() {
  cat <<'EOF'
ReAdmin installer

Usage: sudo ./install.sh [options]

Options:
  --yes, -y            Accept every confirmation (still prompts for credentials
                       that have no existing value).
  --non-interactive    Never prompt. Requires a complete .env to already exist;
                       fails if anything is missing. Implies --yes.
  --env-only           Only run the credential wizard and write .env, then stop.
  --skip-node          Do not touch the Node.js installation.
  --skip-deps          Do not run `npm install`.
  --skip-build         Do not build the panel or the API.
  --skip-services      Do not install or start the systemd services.
  --service-user USER  Run the services as USER (default: owner of this repo).
  --dir PATH           Where to clone when the repo is not already present
                       (default: /opt/readmin).
  -h, --help           Show this message.

Environment overrides: READMIN_REPO_URL, READMIN_REPO_BRANCH, READMIN_DIR.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes) ASSUME_YES=1 ;;
    --non-interactive) NON_INTERACTIVE=1; ASSUME_YES=1 ;;
    --env-only) ENV_ONLY=1 ;;
    --skip-node) SKIP_NODE=1 ;;
    --skip-deps) SKIP_DEPS=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --skip-services) SKIP_SERVICES=1 ;;
    --service-user) SERVICE_USER="${2:-}"; shift ;;
    --dir) CLONE_DIR="${2:-}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

# ── output ────────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'
  YELLOW=$'\033[33m'; BLUE=$'\033[36m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; RESET=""
fi

STEP_NO=0
step()  { STEP_NO=$((STEP_NO + 1)); printf '\n%s==> [%d] %s%s\n' "$BOLD$BLUE" "$STEP_NO" "$*" "$RESET"; }
info()  { printf '    %s\n' "$*"; }
note()  { printf '    %s%s%s\n' "$DIM" "$*" "$RESET"; }
ok()    { printf '    %s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn()  { printf '    %s!%s %s\n' "$YELLOW" "$RESET" "$*"; }
die()   { printf '\n%s✗ %s%s\n\n' "$RED$BOLD" "$*" "$RESET" >&2; exit 1; }

# Prompts read from the terminal, not stdin — the script may itself be arriving
# on stdin from `curl … | bash`.
TTY_IN="/dev/tty"
have_tty() { [[ -r "$TTY_IN" ]]; }

ask() { # ask <varname> <prompt> [default]
  local __var="$1" __prompt="$2" __default="${3:-}" __reply=""
  if (( NON_INTERACTIVE )) || ! have_tty; then
    printf -v "$__var" '%s' "$__default"
    return
  fi
  if [[ -n "$__default" ]]; then
    printf '    %s %s[%s]%s: ' "$__prompt" "$DIM" "$__default" "$RESET" > "$TTY_IN"
  else
    printf '    %s: ' "$__prompt" > "$TTY_IN"
  fi
  IFS= read -r __reply < "$TTY_IN" || true
  printf -v "$__var" '%s' "${__reply:-$__default}"
}

ask_secret() { # ask_secret <varname> <prompt> [default] [hint]
  # `hint` is what goes in the brackets — the value itself would defeat the
  # point of not echoing, so the caller passes something safe to show.
  local __var="$1" __prompt="$2" __current="${3:-}" __hint="${4:-}" __reply=""
  if (( NON_INTERACTIVE )) || ! have_tty; then
    printf -v "$__var" '%s' "$__current"
    return
  fi
  if [[ -n "$__hint" ]]; then
    printf '    %s %s[%s]%s: ' "$__prompt" "$DIM" "$__hint" "$RESET" > "$TTY_IN"
  else
    printf '    %s: ' "$__prompt" > "$TTY_IN"
  fi
  IFS= read -rs __reply < "$TTY_IN" || true
  printf '\n' > "$TTY_IN"
  printf -v "$__var" '%s' "${__reply:-$__current}"
}

confirm() { # confirm <question> [default:Y|N]
  local question="$1" default="${2:-Y}" reply=""
  if (( ASSUME_YES )) || ! have_tty; then
    [[ "$default" == "Y" ]]
    return
  fi
  local hint="[Y/n]"; [[ "$default" == "Y" ]] || hint="[y/N]"
  printf '    %s %s%s%s ' "$question" "$DIM" "$hint" "$RESET" > "$TTY_IN"
  IFS= read -r reply < "$TTY_IN" || true
  reply="${reply:-$default}"
  [[ "$reply" =~ ^[Yy] ]]
}

# ── privileges ────────────────────────────────────────────────────────────────
SUDO=""
if [[ "$(id -u)" -ne 0 ]]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    die "Run this as root, or install sudo. Node packages and systemd units need root."
  fi
fi

as_root() { if [[ -n "$SUDO" ]]; then $SUDO "$@"; else "$@"; fi; }

# As root but keeping the current environment — the NodeSource setup scripts
# want it. `sudo -E` has no meaning when we already are root.
as_root_keep_env() { if [[ -n "$SUDO" ]]; then $SUDO -E "$@"; else "$@"; fi; }

run_as_user() { # run_as_user <user> <command...>
  local user="$1"; shift
  local home; home="$(getent passwd "$user" | cut -d: -f6)"
  if [[ "$(id -un)" == "$user" ]]; then
    env HOME="$home" "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo -u "$user" env HOME="$home" "$@"
  elif command -v runuser >/dev/null 2>&1; then
    runuser -u "$user" -- env HOME="$home" "$@"
  else
    die "Cannot run commands as '$user' — no sudo and no runuser."
  fi
}

printf '\n%s  ReAdmin installer%s\n' "$BOLD" "$RESET"
note "  Staff management, activity tracking and applications for Roblox groups."

# ── 1. locate or clone the repository ─────────────────────────────────────────
step "Locating the repository"

is_readmin_repo() { [[ -f "$1/package.json" ]] && grep -q '"name": *"readmin"' "$1/package.json" 2>/dev/null; }

SCRIPT_DIR=""
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

APP_DIR=""
if [[ -n "$SCRIPT_DIR" ]] && is_readmin_repo "$SCRIPT_DIR"; then
  APP_DIR="$SCRIPT_DIR"
elif is_readmin_repo "$PWD"; then
  APP_DIR="$PWD"
elif is_readmin_repo "$CLONE_DIR"; then
  APP_DIR="$CLONE_DIR"
else
  command -v git >/dev/null 2>&1 || die "git is not installed, and there is no ReAdmin checkout here to install from."
  info "No checkout found — cloning $REPO_URL"
  ask CLONE_DIR "Clone into" "$CLONE_DIR"
  [[ -e "$CLONE_DIR" && -n "$(ls -A "$CLONE_DIR" 2>/dev/null)" ]] && die "$CLONE_DIR exists and is not empty."
  as_root mkdir -p "$CLONE_DIR"
  # Clone as the invoking user where possible, so the checkout is not root-owned.
  if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    as_root chown "$SUDO_USER":"$(id -gn "$SUDO_USER")" "$CLONE_DIR"
    run_as_user "$SUDO_USER" git clone --branch "$REPO_BRANCH" "$REPO_URL" "$CLONE_DIR"
  else
    as_root git clone --branch "$REPO_BRANCH" "$REPO_URL" "$CLONE_DIR"
  fi
  APP_DIR="$CLONE_DIR"
fi

cd "$APP_DIR"
ok "Using $APP_DIR"

if [[ -z "$SERVICE_USER" ]]; then
  SERVICE_USER="$(stat -c '%U' "$APP_DIR")"
  # A root-owned checkout would mean running the services as root; prefer the
  # human who invoked sudo, and hand them the directory.
  if [[ "$SERVICE_USER" == "root" && -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    SERVICE_USER="$SUDO_USER"
    as_root chown -R "$SERVICE_USER":"$(id -gn "$SERVICE_USER")" "$APP_DIR"
  fi
fi
id "$SERVICE_USER" >/dev/null 2>&1 || die "Service user '$SERVICE_USER' does not exist."
SERVICE_GROUP="$(id -gn "$SERVICE_USER")"
ok "Services will run as $SERVICE_USER:$SERVICE_GROUP"

run_as_service_user() { run_as_user "$SERVICE_USER" "$@"; }

# ── 2. system packages and Node ───────────────────────────────────────────────
step "Checking prerequisites"

PKG=""
for candidate in apt-get dnf yum; do
  if command -v "$candidate" >/dev/null 2>&1; then PKG="$candidate"; break; fi
done

install_packages() {
  case "$PKG" in
    apt-get)
      as_root env DEBIAN_FRONTEND=noninteractive apt-get update -qq \
        && as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$@"
      ;;
    dnf|yum) as_root "$PKG" install -y -q "$@" ;;
    *) return 1 ;;
  esac
}

missing=()
for tool in git curl openssl; do command -v "$tool" >/dev/null 2>&1 || missing+=("$tool"); done
if (( ${#missing[@]} )); then
  info "Installing: ${missing[*]}"
  install_packages "${missing[@]}" || die "Could not install ${missing[*]}. Install them and re-run."
fi
ok "git, curl, openssl present"

node_major() { command -v node >/dev/null 2>&1 && node -v | sed 's/^v\([0-9]*\).*/\1/' || echo 0; }

if (( SKIP_NODE )); then
  note "Skipping the Node.js check (--skip-node)"
elif [[ "$(node_major)" -ge "$NODE_MAJOR" ]]; then
  ok "Node $(node -v) (>= $NODE_MAJOR required)"
else
  current="$(command -v node >/dev/null 2>&1 && node -v || echo 'not installed')"
  warn "ReAdmin needs Node $NODE_MAJOR — found $current"
  if confirm "Install Node $NODE_MAJOR now?"; then
    case "$PKG" in
      apt-get)
        curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | as_root_keep_env bash -
        as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs
        ;;
      dnf|yum)
        curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | as_root_keep_env bash -
        as_root "$PKG" install -y -q nodejs
        ;;
      *) die "Unsupported package manager. Install Node $NODE_MAJOR yourself, then re-run with --skip-node." ;;
    esac
    [[ "$(node_major)" -ge "$NODE_MAJOR" ]] || die "Node $NODE_MAJOR did not install correctly."
    ok "Node $(node -v) installed"
  else
    die "Node $NODE_MAJOR is required."
  fi
fi

NPM_BIN="$(command -v npm)" || die "npm not found after installing Node."

total_ram_mb=$(( $(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 0) / 1024 ))
if (( total_ram_mb > 0 && total_ram_mb < 2048 )); then
  warn "Only ${total_ram_mb}MB RAM. The Next.js build is memory hungry — add swap if it gets killed."
fi

# ── 3. credentials ────────────────────────────────────────────────────────────
step "Configuring environment"

ENV_FILE="$APP_DIR/.env"
declare -A CURRENT=()
declare -A VALUES=()
ENV_ORDER=()

if [[ -f "$ENV_FILE" ]]; then
  ok "Found an existing .env — its values are offered as the defaults"
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"; value="${BASH_REMATCH[2]}"
    # Strip one layer of matching quotes, the way dotenv does.
    if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi
    CURRENT["$key"]="$value"
  done < "$ENV_FILE"
elif (( NON_INTERACTIVE )); then
  die "--non-interactive needs an existing .env at $ENV_FILE."
fi

# Records a value and, the first time it sees a key, its position in the file.
# Re-setting a key (a retried prompt, a derived value) updates it in place.
set_var() {
  [[ -z "${VALUES[$1]+x}" ]] && ENV_ORDER+=("$1")
  VALUES["$1"]="$2"
}

ask_var() { # ask_var <KEY> <prompt> [default] [--secret] [--optional]
  local key="$1" prompt="$2" default="${3:-}" secret=0 optional=0 value=""
  shift 3 2>/dev/null || shift $#
  for flag in "$@"; do
    [[ "$flag" == "--secret" ]] && secret=1
    [[ "$flag" == "--optional" ]] && optional=1
  done
  # A value already in .env always beats the built-in suggestion.
  local stored=0
  if [[ -n "${CURRENT[$key]:-}" ]]; then default="${CURRENT[$key]}"; stored=1; fi

  # Secrets are never echoed, so the bracket shows where the default came from:
  # what is already in .env, or the literal we are suggesting.
  local hint=""
  if (( stored )); then hint="keep current"; elif [[ -n "$default" ]]; then hint="$default"; fi

  while true; do
    if (( secret )); then ask_secret value "$prompt" "$default" "$hint"; else ask value "$prompt" "$default"; fi
    if [[ -z "$value" ]] && (( ! optional )); then
      if (( NON_INTERACTIVE )) || ! have_tty; then die "$key is required but unset."; fi
      warn "$key is required."
      continue
    fi
    break
  done
  [[ -z "$value" ]] && (( optional )) && return 0
  set_var "$key" "$value"
}

ask_url_var() { # like ask_var, but insists on scheme://host
  local key="$1"
  while true; do
    ask_var "$@"
    local value="${VALUES[$key]:-}"
    [[ "$value" =~ ^[a-zA-Z][a-zA-Z0-9+.-]*://[^[:space:]/]+ ]] && break
    warn "$key must be a full URL like scheme://host — got '${value}'"
    { (( NON_INTERACTIVE )) || ! have_tty; } && die "$key is not a valid URL."
  done
}

ask_port_var() { # like ask_var, but insists on a TCP port
  local key="$1"
  while true; do
    ask_var "$@"
    local value="${VALUES[$key]:-}"
    [[ "$value" =~ ^[0-9]+$ ]] && (( value > 0 && value < 65536 )) && break
    warn "$key must be a port number — got '${value}'"
    { (( NON_INTERACTIVE )) || ! have_tty; } && die "$key is not a valid port."
  done
}

host_of() { sed -E 's#^[a-zA-Z][a-zA-Z0-9+.-]*://##; s#[:/].*$##' <<<"$1"; }

detect_ip() {
  local ip
  ip="$(curl -fsS --max-time 4 https://api.ipify.org 2>/dev/null || true)"
  [[ -z "$ip" ]] && ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  echo "${ip:-localhost}"
}

note "Press enter to accept the value in brackets. README §2 explains where each"
note "credential comes from; secrets are not echoed."

PUBLIC_IP="$(detect_ip)"

printf '\n  %s— How this server is reached —%s\n' "$BOLD" "$RESET"
note "The panel and the API must be on different hostnames or ports."
# These two are the installer's own, not the app's: each systemd unit turns its
# port into that process's PORT. They live in .env only so a re-run remembers
# them — nothing in the app reads them.
ask_port_var READMIN_PANEL_PORT "Local port for the panel" "3000"
ask_port_var READMIN_API_PORT "Local port for the API" "3001"
PANEL_PORT="${VALUES[READMIN_PANEL_PORT]}"; API_PORT="${VALUES[READMIN_API_PORT]}"
ask_url_var NEXT_PUBLIC_PANEL_URL "Public URL of the panel" "http://${PUBLIC_IP}:${PANEL_PORT}"
ask_url_var NEXT_PUBLIC_API_URL "Public URL of the API" "http://${PUBLIC_IP}:${API_PORT}"

printf '\n  %s— MongoDB and Redis —%s\n' "$BOLD" "$RESET"
ask_url_var MONGODB_URI "MongoDB connection string" "mongodb://127.0.0.1:27017" --secret
ask_var MONGODB_DATABASE "MongoDB database name" "readmin"
ask_url_var REDIS_URL "Redis / Valkey URL" "redis://127.0.0.1:6379" --secret

printf '\n  %s— File storage —%s\n' "$BOLD" "$RESET"
note "Logos, banners, evidence, attachments and workspace exports go somewhere."
note "  local  this server's own disk. Nothing to sign up for; back it up yourself."
note "  s3     any S3-compatible bucket: DO Spaces, Cloudflare R2, MinIO, S3."
ask_var STORAGE_DRIVER "Storage driver (local or s3)" "local"
while [[ "${VALUES[STORAGE_DRIVER]}" != "local" && "${VALUES[STORAGE_DRIVER]}" != "s3" ]]; do
  warn "Answer 'local' or 's3'."
  { (( NON_INTERACTIVE )) || ! have_tty; } && die "STORAGE_DRIVER must be 'local' or 's3'."
  ask_var STORAGE_DRIVER "Storage driver (local or s3)" "local"
done

if [[ "${VALUES[STORAGE_DRIVER]}" == "local" ]]; then
  ask_var STORAGE_LOCAL_PATH "Directory for uploaded files" "/var/lib/readmin/storage"
  note "Served by the API at ${VALUES[NEXT_PUBLIC_API_URL]}/files — private files"
  note "through expiring signed links, so the directory itself stays unexposed."
else
  ask_url_var CDN_ENDPOINT "S3 endpoint" "https://nyc3.digitaloceanspaces.com"
  ask_var CDN_REIGON "S3 region (yes, spelled that way in the schema)" "nyc3"
  ask_var CDN_BUCKET_NAME "Bucket name" "readmin-cdn"
  ask_var CDN_ACCESS_KEY_ID "Access key ID" "" --secret
  ask_var CDN_SECRET_ACCESS_KEY "Secret access key" "" --secret
  ask_url_var CDN_URL "Public URL that serves the bucket" "${VALUES[CDN_ENDPOINT]}/${VALUES[CDN_BUCKET_NAME]}"
fi

printf '\n  %s— Discord application —%s\n' "$BOLD" "$RESET"
ask_var DISCORD_CLIENT_ID "Discord client ID" ""
ask_var DISCORD_CLIENT_SECRET "Discord client secret" "" --secret
ask_var DISCORD_PUBLIC_KEY "Discord public key" ""
ask_var DISCORD_TOKEN "Discord bot token" "" --secret
set_var NEXT_PUBLIC_DISCORD_CLIENT_ID "${VALUES[DISCORD_CLIENT_ID]}"

printf '\n  %s— Roblox —%s\n' "$BOLD" "$RESET"
ask_var ROBLOX_CLIENT_ID "Roblox OAuth client ID" ""
ask_var ROBLOX_CLIENT_SECRET "Roblox OAuth client secret" "" --secret
ask_var ROBLOX_API_KEY "Roblox Open Cloud API key" "" --secret
ask_var ROBLOX_COOKIE "Bot account .ROBLOSECURITY cookie" "" --secret
ask_var ROBLOX_USER_ID "Bot account Roblox user ID" ""
set_var NEXT_PUBLIC_ROBLOX_CLIENT_ID "${VALUES[ROBLOX_CLIENT_ID]}"

printf '\n  %s— Bloxlink —%s\n' "$BOLD" "$RESET"
ask_var BLOXLINK_TOKEN "Bloxlink API v4 token" "" --secret

printf '\n  %s— Stripe (billing) —%s\n' "$BOLD" "$RESET"
note "Self-hosted instances have no Premium to sell; the placeholders are fine."
ask_var STRIPE_PUBLIC "Stripe publishable key" "unused"
ask_var STRIPE_SECRET "Stripe secret key" "unused" --secret
ask_var STRIPE_SIGNING_SECRET "Stripe webhook signing secret" "unused" --secret

printf '\n  %s— OpenSearch (optional) —%s\n' "$BOLD" "$RESET"
note "Powers Roblox user search. Leave blank to disable it."
ask_var OPENSEARCH_URL "OpenSearch URL" "" --optional
if [[ -n "${VALUES[OPENSEARCH_URL]:-}" ]]; then
  ask_var OPENSEARCH_USERNAME "OpenSearch username" "" --optional
  ask_var OPENSEARCH_PASSWORD "OpenSearch password" "" --secret --optional
fi

# Generated secrets. CRYPTO_KEY must be exactly 32 bytes — it is used verbatim
# as an AES-256-CBC key — and rotating it invalidates every stored OAuth token,
# so an existing value is always kept.
printf '\n  %s— Secrets —%s\n' "$BOLD" "$RESET"
if [[ -n "${CURRENT[CRYPTO_KEY]:-}" ]]; then
  set_var CRYPTO_KEY "${CURRENT[CRYPTO_KEY]}"
  ok "CRYPTO_KEY kept (regenerating it would invalidate every stored OAuth token)"
else
  set_var CRYPTO_KEY "$(openssl rand -hex 16)"
  ok "CRYPTO_KEY generated (32 bytes)"
fi
if [[ -n "${CURRENT[JSON_WEB_TOKEN_SECRET]:-}" ]]; then
  set_var JSON_WEB_TOKEN_SECRET "${CURRENT[JSON_WEB_TOKEN_SECRET]}"
  ok "JSON_WEB_TOKEN_SECRET kept"
else
  set_var JSON_WEB_TOKEN_SECRET "$(openssl rand -base64 48 | tr -d '\n=+/')"
  ok "JSON_WEB_TOKEN_SECRET generated"
fi

# Fixed values and the placeholders the schema demands but nothing reads (README §2.3).
set_var NODE_ENV "production"
set_var NEXT_PUBLIC_VERCEL_ENV "production"
set_var SELF_HOSTED "true"
set_var APP_NAME "panel"
set_var CORS_ORIGINS "${VALUES[NEXT_PUBLIC_PANEL_URL]}"
# The CSP needs every host the browser loads from. With local storage that is
# just the API, which serves the files itself.
CSP_HOSTS="$(host_of "${VALUES[NEXT_PUBLIC_PANEL_URL]}") $(host_of "${VALUES[NEXT_PUBLIC_API_URL]}")"
[[ -n "${VALUES[CDN_URL]:-}" ]] && CSP_HOSTS="$CSP_HOSTS $(host_of "${VALUES[CDN_URL]}")"
set_var CSP_EXTRA_DOMAINS "$CSP_HOSTS"
for placeholder in ROBLOX_SECRET AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY CONTIGUITY_SECRET; do
  set_var "$placeholder" "${CURRENT[$placeholder]:-unused}"
done

# ── write .env ────────────────────────────────────────────────────────────────
env_line() { # env_line <key> <value>
  local key="$1" value="$2"
  if [[ "$value" =~ ^[A-Za-z0-9_./:@+,%~=-]*$ ]]; then
    printf '%s=%s\n' "$key" "$value"
  elif [[ "$value" == *"'"* ]]; then
    die "$key contains a single quote, which .env cannot carry safely. Change the credential, or set $key by hand in $ENV_FILE."
  else
    # Single quotes: neither systemd nor dotenv expands anything inside them.
    printf "%s='%s'\n" "$key" "$value"
  fi
}

TMP_ENV="$(mktemp)"
trap 'rm -f "$TMP_ENV"' EXIT
{
  printf '# Generated by install.sh on %s. Secrets live here — keep it 0600.\n' "$(date -u '+%Y-%m-%d %H:%M:%SZ')"
  printf '# Re-run ./install.sh to change any of it; every value below comes back as the default.\n'
  printf '# PORT is deliberately absent: each systemd unit sets its own.\n\n'
  for key in "${ENV_ORDER[@]}"; do
    [[ -n "${VALUES[$key]+x}" ]] && env_line "$key" "${VALUES[$key]}"
  done
} > "$TMP_ENV"

if [[ -f "$ENV_FILE" ]]; then
  cp -p "$ENV_FILE" "$ENV_FILE.bak.$(date -u '+%Y%m%d%H%M%S')"
  note "Previous .env backed up alongside it"
fi
as_root cp "$TMP_ENV" "$ENV_FILE"
as_root chown "$SERVICE_USER":"$SERVICE_GROUP" "$ENV_FILE"
as_root chmod 600 "$ENV_FILE"
ok "Wrote $ENV_FILE (0600, owned by $SERVICE_USER)"

# ── local storage directory ───────────────────────────────────────────────────
# Substituted into the systemd units' ReadWritePaths. Points at the app dir when
# storage is remote, so the directive always names something that exists.
STORAGE_PATH="$APP_DIR"
if [[ "${VALUES[STORAGE_DRIVER]}" == "local" ]]; then
  STORAGE_PATH="${VALUES[STORAGE_LOCAL_PATH]}"
  step "Preparing file storage"
  as_root mkdir -p "$STORAGE_PATH/objects" "$STORAGE_PATH/meta"
  as_root chown -R "$SERVICE_USER":"$SERVICE_GROUP" "$STORAGE_PATH"
  # Uploads include staff records and evidence; keep them off other accounts.
  as_root chmod 750 "$STORAGE_PATH"
  ok "Uploads will be stored in $STORAGE_PATH (owned by $SERVICE_USER)"
  note "Back this directory up alongside MongoDB — it is not reproducible."
fi

if (( ENV_ONLY )); then
  printf '\n%s.env written. Re-run without --env-only to build and start.%s\n\n' "$GREEN" "$RESET"
  exit 0
fi

# ── 4. dependencies ───────────────────────────────────────────────────────────
step "Installing npm dependencies"
if (( SKIP_DEPS )); then
  note "Skipped (--skip-deps)"
else
  # devDependencies carry TypeScript, which `fastify:build` needs.
  run_as_service_user env NPM_CONFIG_PRODUCTION=false "$NPM_BIN" install --no-audit --no-fund \
    || die "npm install failed."
  ok "Dependencies installed"
fi

# ── 5. build ──────────────────────────────────────────────────────────────────
step "Building the panel and the API"
if (( SKIP_BUILD )); then
  note "Skipped (--skip-build)"
else
  note "next.config.js validates the whole environment during the build, so a"
  note "missing credential fails here rather than at runtime."
  run_as_service_user "$NPM_BIN" run build || die "Panel build failed. Fix the reported problem and re-run with --skip-node --skip-deps."
  ok "Panel built"
  run_as_service_user "$NPM_BIN" run fastify:build || die "API build failed."
  ok "API built to ./apiBuild"
fi

# ── 6. services ───────────────────────────────────────────────────────────────
step "Registering services"

install_unit() { # install_unit <name>
  # Separate statements on purpose: bash expands every word of a `local` before
  # assigning any of them, so `src` cannot refer to `name` on the same line.
  local name="$1"
  local src="$APP_DIR/deploy/systemd/$name.service"
  local tmp
  tmp="$(mktemp)"
  sed -e "s#__APP_DIR__#$APP_DIR#g" \
      -e "s#__SERVICE_USER__#$SERVICE_USER#g" \
      -e "s#__SERVICE_GROUP__#$SERVICE_GROUP#g" \
      -e "s#__NPM_BIN__#$NPM_BIN#g" \
      -e "s#__NODE_BIN_DIR__#$(dirname "$NPM_BIN")#g" \
      -e "s#__STORAGE_PATH__#$STORAGE_PATH#g" \
      -e "s#__PANEL_PORT__#$PANEL_PORT#g" \
      -e "s#__API_PORT__#$API_PORT#g" \
      "$src" > "$tmp"
  as_root cp "$tmp" "/etc/systemd/system/$name.service"
  rm -f "$tmp"
}

SERVICES=(readmin-panel readmin-api readmin-sync)
SERVICES_INSTALLED=0

if (( SKIP_SERVICES )); then
  note "Skipped (--skip-services)"
elif ! command -v systemctl >/dev/null 2>&1 || [[ ! -d /run/systemd/system ]]; then
  # The binary alone is not enough — containers ship systemctl without running
  # systemd as PID 1, and every call there fails with "Host is down".
  warn "systemd is not running here (a container, or a different init)."
  info "Start the three processes yourself:"
  note "  PORT=$PANEL_PORT npm run start          # panel"
  note "  PORT=$API_PORT npm run fastify:start    # API"
  note "  npm run sync:start           # worker (exactly one instance)"
elif confirm "Install and start the three systemd services (panel, API, sync worker)?"; then
  for service in "${SERVICES[@]}"; do install_unit "$service"; done
  as_root systemctl daemon-reload
  for service in "${SERVICES[@]}"; do
    as_root systemctl enable --quiet "$service"
    as_root systemctl restart "$service"
  done
  SERVICES_INSTALLED=1
  ok "readmin-panel, readmin-api and readmin-sync enabled and started"

  sleep 3
  for service in "${SERVICES[@]}"; do
    if as_root systemctl is-active --quiet "$service"; then
      ok "$service is running"
    else
      warn "$service is not running — journalctl -u $service -n 50"
    fi
  done
else
  note "Units are in deploy/systemd/ if you want them later."
fi

# ── 7. reverse proxy ──────────────────────────────────────────────────────────
PANEL_HOST="$(host_of "${VALUES[NEXT_PUBLIC_PANEL_URL]}")"
API_HOST="$(host_of "${VALUES[NEXT_PUBLIC_API_URL]}")"
NGINX_OUT="$APP_DIR/deploy/nginx/readmin.generated.conf"

url_has_port() { [[ "$(sed -E 's#^[a-zA-Z][a-zA-Z0-9+.-]*://##' <<<"$1")" =~ ^[^/]+:[0-9]+ ]]; }

step "Reverse proxy"
if [[ "$PANEL_HOST" == "$API_HOST" ]]; then
  note "Panel and API share a hostname, so there is nothing sensible to proxy."
  note "They are reachable directly on ports $PANEL_PORT and $API_PORT."
elif url_has_port "${VALUES[NEXT_PUBLIC_PANEL_URL]}" || url_has_port "${VALUES[NEXT_PUBLIC_API_URL]}"; then
  note "Your URLs name explicit ports, so the processes are already reachable"
  note "directly. Re-run with hostnames on :80/:443 if you want an nginx config."
else
  sed -e "s#__PANEL_HOST__#$PANEL_HOST#g" \
      -e "s#__API_HOST__#$API_HOST#g" \
      -e "s#__PANEL_PORT__#$PANEL_PORT#g" \
      -e "s#__API_PORT__#$API_PORT#g" \
      "$APP_DIR/deploy/nginx/readmin.conf" > "$NGINX_OUT"
  ok "nginx config written to $NGINX_OUT"
  if command -v nginx >/dev/null 2>&1 && confirm "Install it into nginx and reload?"; then
    as_root cp "$NGINX_OUT" /etc/nginx/sites-available/readmin
    as_root ln -sf /etc/nginx/sites-available/readmin /etc/nginx/sites-enabled/readmin
    if as_root nginx -t; then
      as_root systemctl reload nginx
      ok "nginx reloaded"
      note "Add TLS next: sudo certbot --nginx -d $PANEL_HOST -d $API_HOST"
    else
      warn "nginx rejected the config; left it in place for you to fix."
    fi
  else
    note "Install it by hand — the header of that file has the commands."
  fi
fi

# ── done ──────────────────────────────────────────────────────────────────────
printf '\n%s  ReAdmin is installed.%s\n\n' "$BOLD$GREEN" "$RESET"
info "Panel  ${VALUES[NEXT_PUBLIC_PANEL_URL]}   (local port $PANEL_PORT)"
info "API    ${VALUES[NEXT_PUBLIC_API_URL]}   (local port $API_PORT)"
info "Config $ENV_FILE"
if [[ "${VALUES[STORAGE_DRIVER]}" == "local" ]]; then
  info "Files  $STORAGE_PATH   (on this server — include it in your backups)"
else
  info "Files  ${VALUES[CDN_BUCKET_NAME]:-bucket} at ${VALUES[CDN_ENDPOINT]}"
fi

if (( SERVICES_INSTALLED )); then
  printf '\n  %sManaging it%s\n' "$BOLD" "$RESET"
  info "systemctl status readmin-panel readmin-api readmin-sync"
  info "journalctl -u readmin-api -f"
  info "systemctl restart readmin-panel"
fi

printf '\n  %sStill to do by hand%s\n' "$BOLD" "$RESET"
info "1. Point $PANEL_HOST and $API_HOST at this server, then add TLS (certbot)."
info "2. Add your Roblox OAuth redirect URI: ${VALUES[NEXT_PUBLIC_PANEL_URL]}/auth/roblox"
info "3. Add your Discord redirect URI:     ${VALUES[NEXT_PUBLIC_PANEL_URL]}/auth/discord"
info "   and its interactions endpoint:     ${VALUES[NEXT_PUBLIC_API_URL]}/internal/discord"
info "4. Publish your own copies of the in-game Roblox modules — README §6.1."
info "   Nothing works in-game until you do; it is a Studio job, not a code edit."
info "5. Walk the post-deploy checklist in README §7."

printf '\n  %sTo update later:%s git pull && sudo ./install.sh --yes\n\n' "$DIM" "$RESET"
