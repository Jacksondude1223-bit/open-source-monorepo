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
UPDATE_MODE="ask"   # ask | always | never

# Kept before parsing eats them: after a self-update the script re-runs itself
# with exactly the arguments it was given.
ORIGINAL_ARGS=("$@")

usage() {
  cat <<'EOF'
ReAdmin installer

Usage: sudo ./install.sh [options]

Options:
  --update             Pull the latest commit from the repository before doing
                       anything else, without asking. The script then re-runs
                       itself so the new version is what installs.
  --no-update          Never check the repository for a newer commit.
  --yes, -y            Accept every confirmation (still prompts for credentials
                       that have no existing value). Includes the update prompt.
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
    --update) UPDATE_MODE="always" ;;
    --no-update) UPDATE_MODE="never" ;;
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

# Set when a read hits end-of-input. Without it, a required prompt that can never
# be answered — piped input that ran out, a closed terminal — re-asks forever.
ASK_EOF=0

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
  IFS= read -r __reply < "$TTY_IN" || ASK_EOF=1
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
  IFS= read -rs __reply < "$TTY_IN" || ASK_EOF=1
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

# Whoever owns the checkout owns its git history. Running git as root against a
# user-owned repo trips "detected dubious ownership" and every command fails, so
# all git work here goes through the owner.
REPO_OWNER="$(stat -c '%U' "$APP_DIR" 2>/dev/null || echo root)"
IS_GIT_REPO=0
if command -v git >/dev/null 2>&1 && [[ -d "$APP_DIR/.git" ]]; then
  IS_GIT_REPO=1
fi
repo_git() { run_as_user "$REPO_OWNER" git -C "$APP_DIR" "$@"; }

# Print what this checkout actually is. A stale copy is the likeliest reason for
# "the installer is not asking me what I expected" — this makes that visible
# instead of leaving you to guess.
if (( IS_GIT_REPO )); then
  note "Checkout $(repo_git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?') @ $(repo_git rev-parse --short HEAD 2>/dev/null || echo '?')  ($(repo_git log -1 --format=%cs 2>/dev/null || echo '?'))"
fi

# ── 1b. update to the latest version ──────────────────────────────────────────
# Running a stale checkout is the single most confusing way for this to go
# wrong: the installer skips a question you were told to expect, or installs
# code without a fix you already have. So it offers to bring itself up to date
# first, and re-runs the NEW script rather than carrying on as the old one.

self_update() {
  [[ "$UPDATE_MODE" == "never" ]] && { note "Update check skipped (--no-update)"; return; }
  (( IS_GIT_REPO )) || { note "Not a git checkout — nothing to update from."; return; }
  # Set on the re-exec below. Without it a bad comparison could loop forever.
  [[ -n "${READMIN_SELF_UPDATED:-}" ]] && { ok "Running the updated installer."; return; }

  step "Checking for a newer version"

  local branch
  branch="$(repo_git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
  if [[ -z "$branch" ]]; then
    warn "Cannot read this checkout's branch — skipping the update check."
    return
  fi
  if [[ "$branch" == "HEAD" ]]; then
    warn "Detached HEAD, so there is no branch to update."
    note "  git checkout $REPO_BRANCH   then re-run to get updates."
    return
  fi

  info "Fetching origin/$branch ..."
  if ! repo_git fetch --quiet origin "$branch" 2>/dev/null; then
    warn "Could not reach the repository. Continuing with the local copy."
    return
  fi
  if ! repo_git rev-parse --verify --quiet "origin/$branch" >/dev/null 2>&1; then
    warn "origin/$branch does not exist. Continuing with the local copy."
    return
  fi

  local behind
  behind="$(repo_git rev-list --count "HEAD..origin/$branch" 2>/dev/null || echo 0)"
  if [[ "$behind" == "0" ]]; then
    ok "Already up to date ($branch @ $(repo_git rev-parse --short HEAD))."
    return
  fi

  warn "$behind new commit(s) on origin/$branch:"
  { repo_git log --oneline --no-decorate "HEAD..origin/$branch" 2>/dev/null | head -10 || true; } | while IFS= read -r line; do
    note "  $line"
  done

  if [[ "$UPDATE_MODE" != "always" ]] && ! confirm "Update to the latest version before installing?"; then
    note "Continuing on the current commit."
    return
  fi

  # Only tracked files matter — .env and node_modules are gitignored, so a
  # normal deployment has nothing in the way here.
  if [[ -n "$(repo_git status --porcelain --untracked-files=no 2>/dev/null)" ]]; then
    warn "You have local edits to tracked files, so the update was not applied:"
    { repo_git status --short --untracked-files=no 2>/dev/null | head -10 || true; } | while IFS= read -r line; do
      note "  $line"
    done
    note "Keep them:    git stash && sudo ./install.sh --update"
    note "Discard them: git reset --hard origin/$branch && sudo ./install.sh"
    note "Your .env is untouched either way — it is not tracked."
    return
  fi

  if ! repo_git merge --ff-only "origin/$branch" >/dev/null 2>&1; then
    warn "The local branch has diverged from origin/$branch, so it was left alone."
    note "To take the remote version: git reset --hard origin/$branch"
    return
  fi
  ok "Updated to $(repo_git rev-parse --short HEAD) ($(repo_git log -1 --format=%cs))."

  # bash reads a script as it runs, so continuing now would execute a mixture of
  # the old and new file. Hand over to the new one instead, with the same args.
  info "Restarting the installer on the new version ..."
  printf '\n'
  exec env READMIN_SELF_UPDATED=1 bash "$APP_DIR/install.sh" ${ORIGINAL_ARGS[@]+"${ORIGINAL_ARGS[@]}"}
}

self_update

# A second checkout nested inside this one is almost always an accidental
# re-clone. The build no longer typechecks it (tsconfig scopes itself to src/),
# but it is still a stale copy someone will eventually edit by mistake.
while IFS= read -r stray; do
  [[ -z "$stray" ]] && continue
  warn "Stray checkout at ${stray%/package.json} — a duplicate clone inside this one."
  note "Nothing reads it. Remove it once you have checked it holds no local edits."
done < <(find "$APP_DIR" -mindepth 2 -maxdepth 3 -name package.json -not -path '*/node_modules/*' 2>/dev/null \
  | xargs -r grep -l '"name": *"readmin"' 2>/dev/null)

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
      as_root env DEBIAN_FRONTEND=noninteractive apt-get update -qq >/dev/null \
        && as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
             -o Dpkg::Use-Pty=0 "$@" >/dev/null
      ;;
    dnf|yum) as_root "$PKG" install -y -q "$@" >/dev/null ;;
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
      (( ASK_EOF )) && die "Input ended while $key was still unanswered. $key is required."
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

# Hostname only — for nginx server_name and DNS instructions.
host_of() { sed -E 's#^[a-zA-Z][a-zA-Z0-9+.-]*://##; s#[:/].*$##' <<<"$1"; }
# Hostname WITH port — for CSP sources, where the port is significant.
authority_of() { sed -E 's#^[a-zA-Z][a-zA-Z0-9+.-]*://##; s#/.*$##' <<<"$1"; }

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

# HTTPS is asked here, not at the end, because the answer changes the URLs that
# get written to .env — and those are baked into the panel at build time. Asking
# after the build would mean building twice.
note ""
note "HTTPS needs two hostnames already pointing at this server. Without it the"
note "panel runs on plain HTTP, which Discord and Roblox OAuth usually refuse,"
note "and logins travel unencrypted."
ask_var READMIN_TLS "Get free HTTPS certificates with Let's Encrypt? 1 = yes, 2 = no" "1"
case "${VALUES[READMIN_TLS],,}" in
  1|y|yes|true) set_var READMIN_TLS 'true' ;;
  2|n|no|false) set_var READMIN_TLS 'false' ;;
esac
while [[ "${VALUES[READMIN_TLS]}" != "true" && "${VALUES[READMIN_TLS]}" != "false" ]]; do
  warn "Answer 1 (yes) or 2 (no)."
  { (( NON_INTERACTIVE )) || ! have_tty; } && die "READMIN_TLS must be 1/yes or 2/no."
  ask_var READMIN_TLS "Get free HTTPS certificates with Let's Encrypt? 1 = yes, 2 = no" "1"
  case "${VALUES[READMIN_TLS],,}" in
    1|y|yes|true) set_var READMIN_TLS 'true' ;;
    2|n|no|false) set_var READMIN_TLS 'false' ;;
  esac
done

# A certificate can only be issued for a name, never for a bare address.
is_ip_literal() { [[ "$1" =~ ^[0-9]+(\.[0-9]+){3}$ || "$1" == *:* ]]; }

if [[ "${VALUES[READMIN_TLS]}" == "true" ]]; then
  while true; do
    ask_var READMIN_PANEL_HOST "Panel hostname (e.g. panel.example.com)" ""
    ask_var READMIN_API_HOST "API hostname (e.g. api.example.com)" ""
    local_bad=0
    for candidate in "${VALUES[READMIN_PANEL_HOST]}" "${VALUES[READMIN_API_HOST]}"; do
      if is_ip_literal "$candidate"; then
        warn "$candidate is an IP address. Let's Encrypt only issues for hostnames."
        local_bad=1
      elif [[ "$candidate" != *.* ]]; then
        warn "$candidate does not look like a domain name."
        local_bad=1
      fi
    done
    if [[ "${VALUES[READMIN_PANEL_HOST]}" == "${VALUES[READMIN_API_HOST]}" ]]; then
      warn "The panel and the API need different hostnames — the panel calls the API cross-origin."
      local_bad=1
    fi
    (( local_bad == 0 )) && break
    { (( NON_INTERACTIVE )) || ! have_tty; } && die "Two distinct hostnames are required for HTTPS."
  done
  # nginx terminates TLS on 443 and proxies to the local ports, so the public
  # URLs carry no port.
  set_var NEXT_PUBLIC_PANEL_URL "https://${VALUES[READMIN_PANEL_HOST]}"
  set_var NEXT_PUBLIC_API_URL "https://${VALUES[READMIN_API_HOST]}"
  note "Let's Encrypt emails you before a certificate expires. Renewal is automatic."
  ask_var READMIN_TLS_EMAIL "Email for expiry notices (blank to register without one)" "" --optional
  ok "Panel ${VALUES[NEXT_PUBLIC_PANEL_URL]} · API ${VALUES[NEXT_PUBLIC_API_URL]}"
else
  ask_url_var NEXT_PUBLIC_PANEL_URL "Public URL of the panel" "http://${PUBLIC_IP}:${PANEL_PORT}"
  ask_url_var NEXT_PUBLIC_API_URL "Public URL of the API" "http://${PUBLIC_IP}:${API_PORT}"
fi

printf '\n  %s— MongoDB and Redis —%s\n' "$BOLD" "$RESET"
ask_url_var MONGODB_URI "MongoDB connection string" "mongodb://127.0.0.1:27017" --secret
ask_var MONGODB_DATABASE "MongoDB database name" "readmin"
ask_url_var REDIS_URL "Redis / Valkey URL" "redis://127.0.0.1:6379" --secret

printf '\n  %s— File storage —%s\n' "$BOLD" "$RESET"
note "Logos, banners, evidence, attachments and workspace exports go somewhere."
note "  1) local  this server's own disk. No bucket, no account, nothing to pay."
note "  2) s3     an S3-compatible bucket: DO Spaces, Cloudflare R2, MinIO, S3."
note "Choosing 1 skips every S3 question below."
ask_var STORAGE_DRIVER "Storage: 1 for local disk, 2 for S3" "1"
# Accept the numbers people are shown and the names the variable actually takes.
case "${VALUES[STORAGE_DRIVER],,}" in
  1|local) set_var STORAGE_DRIVER 'local' ;;
  2|s3)    set_var STORAGE_DRIVER 's3' ;;
esac
while [[ "${VALUES[STORAGE_DRIVER]}" != "local" && "${VALUES[STORAGE_DRIVER]}" != "s3" ]]; do
  warn "Answer 1 (local disk) or 2 (S3)."
  { (( NON_INTERACTIVE )) || ! have_tty; } && die "STORAGE_DRIVER must be 'local' or 's3'."
  ask_var STORAGE_DRIVER "Storage: 1 for local disk, 2 for S3" "1"
  case "${VALUES[STORAGE_DRIVER],,}" in
    1|local) set_var STORAGE_DRIVER 'local' ;;
    2|s3)    set_var STORAGE_DRIVER 's3' ;;
  esac
done

if [[ "${VALUES[STORAGE_DRIVER]}" == "local" ]]; then
  ok "Using this server's disk — no S3 credentials needed."
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
# The CSP needs every host the browser loads from, WITH its port: a CSP source
# without one only matches the scheme's default port, so a bare 1.2.3.4 does not
# allow http://1.2.3.4:3001 and the panel's own API calls get blocked.
# next.config.js derives these too; writing them keeps .env self-describing.
CSP_HOSTS="$(authority_of "${VALUES[NEXT_PUBLIC_PANEL_URL]}") $(authority_of "${VALUES[NEXT_PUBLIC_API_URL]}")"
[[ -n "${VALUES[CDN_URL]:-}" ]] && CSP_HOSTS="$CSP_HOSTS $(authority_of "${VALUES[CDN_URL]}")"
# Panel and API often share a host, so drop repeats.
CSP_HOSTS="$(tr ' ' '\n' <<<"$CSP_HOSTS" | awk 'NF && !seen[$0]++' | tr '\n' ' ')"
set_var CSP_EXTRA_DOMAINS "${CSP_HOSTS% }"
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

  # Anything already in .env that this script does not ask about — brand assets,
  # a hand-tuned override, a variable added by a later version — is carried
  # through untouched. Without this a re-run silently deletes it, and the loss
  # only shows up as behaviour quietly reverting.
  preserved=0
  for key in "${!CURRENT[@]}"; do
    [[ -n "${VALUES[$key]+x}" ]] && continue
    if (( preserved == 0 )); then
      printf '\n# Kept from your previous .env — install.sh does not manage these.\n'
      preserved=1
    fi
    env_line "$key" "${CURRENT[$key]}"
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

# ── data store reachability ───────────────────────────────────────────────────
# MongoDB and Redis are prerequisites this installer does not provide. Nothing
# notices they are missing until the first query, which surfaces deep in the UI
# as "Topology is closed" — so check now, while the URI is on screen.
probe_tcp() { # probe_tcp <host> <port>
  timeout 3 bash -c ": >/dev/tcp/$1/$2" 2>/dev/null
}

# Strip scheme, credentials, path and any extra seed hosts, leaving host[:port].
store_authority() { sed -E 's#^[a-zA-Z][a-zA-Z0-9+.-]*://##; s#^[^@]*@##; s#[/?].*$##; s#,.*$##' <<<"$1"; }
store_host() { local a; a="$(store_authority "$1")"; printf '%s' "${a%%:*}"; }
store_port() { # store_port <uri> <default>
  local a p; a="$(store_authority "$1")"; p="${a##*:}"
  [[ "$p" == "$a" ]] && p="$2"
  printf '%s' "$p"
}

check_store() { # check_store <label> <uri> <default-port>
  local label="$1" uri="$2" default_port="$3"
  # A +srv URI resolves through DNS SRV records to hosts we cannot guess; skip.
  [[ "$uri" == *+srv://* ]] && return 0
  local host port
  host="$(store_host "$uri")"
  port="$(store_port "$uri" "$default_port")"
  [[ -z "$host" ]] && return 0
  if probe_tcp "$host" "$port"; then
    ok "$label reachable at $host:$port"
  else
    warn "$label is NOT reachable at $host:$port"
    return 1
  fi
}

is_loopback_host() { [[ "$1" == "localhost" || "$1" == "127.0.0.1" || "$1" == "::1" ]]; }

# Enable and start a unit, saying plainly when there is no systemd to do it —
# otherwise the package installs and the follow-up probe fails for a reason the
# output never mentions.
start_service() { # start_service <unit>
  if [[ ! -d /run/systemd/system ]]; then
    warn "systemd is not running here, so $1 was installed but not started."
    return 0
  fi
  as_root systemctl enable --now "$1" 2>/dev/null || warn "$1 installed but would not start — check: systemctl status $1"
}

# Host distro, for the MongoDB apt repository which is per-release.
os_id() { sed -n 's/^ID=//p' /etc/os-release 2>/dev/null | tr -d '"'; }
os_codename() { sed -n 's/^VERSION_CODENAME=//p' /etc/os-release 2>/dev/null | tr -d '"'; }

install_mongodb() {
  local id codename
  id="$(os_id)"; codename="$(os_codename)"
  case "$PKG" in
    apt-get)
      # Ubuntu and Debian do not package MongoDB, so its own repository is the
      # only supported route. The keyring and list are per major version.
      if [[ "$id" != "ubuntu" && "$id" != "debian" ]] || [[ -z "$codename" ]]; then
        warn "Unrecognised apt distro ($id ${codename:-?}) — install MongoDB by hand:"
        note "  https://www.mongodb.com/docs/manual/administration/install-on-linux/"
        return 1
      fi
      info "Adding the MongoDB $MONGO_MAJOR repository for $id/$codename ..."
      as_root install -m 0755 -d /usr/share/keyrings
      if ! curl -fsSL "https://www.mongodb.org/static/pgp/server-${MONGO_MAJOR}.asc" \
           | as_root gpg --batch --yes --dearmor -o "/usr/share/keyrings/mongodb-server-${MONGO_MAJOR}.gpg"; then
        warn "Could not fetch the MongoDB signing key."
        return 1
      fi
      local component="multiverse"
      [[ "$id" == "debian" ]] && component="main"
      echo "deb [ arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/mongodb-server-${MONGO_MAJOR}.gpg ] https://repo.mongodb.org/apt/${id} ${codename}/mongodb-org/${MONGO_MAJOR} ${component}" \
        | as_root tee "/etc/apt/sources.list.d/mongodb-org-${MONGO_MAJOR}.list" >/dev/null
      install_packages mongodb-org || { warn "MongoDB packages failed to install."; return 1; }
      ;;
    dnf|yum)
      as_root tee "/etc/yum.repos.d/mongodb-org-${MONGO_MAJOR}.repo" >/dev/null <<REPO
[mongodb-org-${MONGO_MAJOR}]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/\$releasever/mongodb-org/${MONGO_MAJOR}/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-${MONGO_MAJOR}.asc
REPO
      install_packages mongodb-org || { warn "MongoDB packages failed to install."; return 1; }
      ;;
    *) return 1 ;;
  esac
  start_service mongod
  return 0
}

install_redis() {
  case "$PKG" in
    apt-get) install_packages redis-server || return 1; start_service redis-server ;;
    dnf|yum) install_packages redis || return 1; start_service redis ;;
    *) return 1 ;;
  esac
  return 0
}

step "Checking the data stores"
MONGO_MAJOR="${READMIN_MONGO_MAJOR:-8.0}"
MONGO_HOST="$(store_host "${VALUES[MONGODB_URI]}" 27017)"; MONGO_PORT="$(store_port "${VALUES[MONGODB_URI]}" 27017)"
REDIS_HOST="$(store_host "${VALUES[REDIS_URL]}" 6379)";     REDIS_PORT="$(store_port "${VALUES[REDIS_URL]}" 6379)"

STORES_OK=1
check_store "MongoDB" "${VALUES[MONGODB_URI]}" 27017 || STORES_OK=0
check_store "Redis"   "${VALUES[REDIS_URL]}"   6379  || STORES_OK=0

if (( STORES_OK == 0 )); then
  # Only offer to install what is supposed to live on this machine. A URI naming
  # somewhere else is unreachable for a reason we cannot fix from here.
  WANT_MONGO=0; WANT_REDIS=0
  { [[ "${VALUES[MONGODB_URI]}" != *+srv://* ]] && is_loopback_host "$MONGO_HOST" \
      && ! probe_tcp "$MONGO_HOST" "$MONGO_PORT"; } && WANT_MONGO=1
  { is_loopback_host "$REDIS_HOST" && ! probe_tcp "$REDIS_HOST" "$REDIS_PORT"; } && WANT_REDIS=1

  if (( WANT_MONGO || WANT_REDIS )); then
    info "Your URIs point at this machine, so these can be installed here."
    note "Both bind to localhost only — nothing is exposed to the internet."
    if confirm "Install the missing data store(s) now?"; then
      (( WANT_MONGO )) && { install_mongodb && ok "MongoDB installed" || warn "MongoDB install failed."; }
      (( WANT_REDIS )) && { install_redis   && ok "Redis installed"   || warn "Redis install failed."; }
      # Give the daemons a moment to bind before re-checking.
      sleep 3
      STORES_OK=1
      check_store "MongoDB" "${VALUES[MONGODB_URI]}" 27017 || STORES_OK=0
      check_store "Redis"   "${VALUES[REDIS_URL]}"   6379  || STORES_OK=0
    fi
  fi
fi

if (( STORES_OK == 0 )); then
  warn "The panel cannot work until both are reachable."
  note "  MongoDB — https://www.mongodb.com/docs/manual/administration/install-on-linux/"
  note "  Redis   — sudo apt install redis-server && sudo systemctl enable --now redis-server"
  note "Continuing anyway — the build itself does not need them."
fi

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

# Set only when certbot reports success, so the closing summary never claims
# HTTPS is live when it is not.
TLS_ISSUED=0

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
  # A host with IPv6 disabled cannot bind [::], and nginx fails its config test
  # outright rather than skipping the line — so drop it when there is no IPv6.
  if [[ ! -e /proc/net/if_inet6 ]]; then
    sed -i '/listen \[::\]/d' "$NGINX_OUT"
    note "No IPv6 on this host — removed the IPv6 listen directives."
  fi
  ok "nginx config written to $NGINX_OUT"

  WANT_TLS=0
  [[ "${VALUES[READMIN_TLS]:-false}" == "true" ]] && WANT_TLS=1

  # With HTTPS chosen the .env already says https://, so nginx is not optional —
  # without it nothing serves those URLs at all.
  if ! command -v nginx >/dev/null 2>&1; then
    if (( WANT_TLS )) || confirm "nginx is not installed. Install it now?"; then
      info "Installing nginx ..."
      install_packages nginx || warn "Could not install nginx."
    fi
  fi

  if command -v nginx >/dev/null 2>&1 && { (( WANT_TLS )) || confirm "Install this config into nginx and reload?"; }; then
    as_root cp "$NGINX_OUT" /etc/nginx/sites-available/readmin
    as_root ln -sf /etc/nginx/sites-available/readmin /etc/nginx/sites-enabled/readmin
    # Debian ships a default site on port 80 that would answer first for any
    # name it also matches; drop it so our server_names win.
    [[ -e /etc/nginx/sites-enabled/default ]] && as_root rm -f /etc/nginx/sites-enabled/default
    if as_root nginx -t >/dev/null 2>&1; then
      # Same guard as the services step: containers ship systemctl without
      # running systemd, where every call fails with "Host is down".
      if [[ -d /run/systemd/system ]]; then
        as_root systemctl enable --quiet nginx 2>/dev/null || true
        if as_root systemctl reload nginx 2>/dev/null || as_root systemctl restart nginx 2>/dev/null; then
          ok "nginx serving $PANEL_HOST and $API_HOST on port 80"
        else
          warn "nginx would not start — check: systemctl status nginx"
          WANT_TLS=0
        fi
      else
        warn "systemd is not running here, so nginx was not started."
        note "Config is installed; start nginx yourself, then run certbot."
        WANT_TLS=0
      fi
    else
      warn "nginx rejected the config:"
      as_root nginx -t 2>&1 | while IFS= read -r line; do note "  $line"; done
      WANT_TLS=0
    fi
  else
    note "Install it by hand — the header of that file has the commands."
    WANT_TLS=0
  fi

  # ── certificates ────────────────────────────────────────────────────────────
  if (( WANT_TLS )); then
    step "HTTPS certificates"

    if ! command -v certbot >/dev/null 2>&1; then
      info "Installing certbot ..."
      case "$PKG" in
        apt-get) install_packages certbot python3-certbot-nginx || true ;;
        dnf|yum) install_packages certbot python3-certbot-nginx || true ;;
      esac
    fi

    if ! command -v certbot >/dev/null 2>&1; then
      warn "certbot could not be installed. The panel is built for https:// but"
      note "nothing is serving TLS yet. Install certbot, then run:"
      note "  sudo certbot --nginx -d $PANEL_HOST -d $API_HOST"
    else
      # Let's Encrypt validates over port 80 from outside. A host firewall that
      # blocks it fails the challenge with a confusing timeout, so clear it first.
      if command -v ufw >/dev/null 2>&1 && as_root ufw status 2>/dev/null | grep -q "Status: active"; then
        if ! as_root ufw status 2>/dev/null | grep -qE "^(80|443)[/ ]|Nginx Full"; then
          warn "ufw is active and does not appear to allow HTTP/HTTPS."
          if confirm "Allow ports 80 and 443 through ufw?"; then
            as_root ufw allow 80/tcp >/dev/null 2>&1 || true
            as_root ufw allow 443/tcp >/dev/null 2>&1 || true
            ok "ufw now allows 80 and 443"
          else
            warn "Leaving ufw as is — the certificate request will likely time out."
          fi
        fi
      fi

      # Let's Encrypt reaches this box over the public internet on port 80. If
      # DNS is wrong the challenge fails, so say so before spending a rate limit.
      dns_ok=1
      for host in "$PANEL_HOST" "$API_HOST"; do
        resolved="$(getent ahostsv4 "$host" 2>/dev/null | awk '{print $1; exit}')"
        if [[ -z "$resolved" ]]; then
          warn "$host does not resolve yet."
          dns_ok=0
        elif [[ -n "$PUBLIC_IP" && "$resolved" != "$PUBLIC_IP" ]]; then
          warn "$host resolves to $resolved, but this server looks like $PUBLIC_IP."
          dns_ok=0
        else
          ok "$host → $resolved"
        fi
      done

      if (( dns_ok == 0 )); then
        warn "DNS is not pointing here yet, so the certificate request would fail."
        note "Point both names at this server, wait for propagation, then run:"
        note "  sudo certbot --nginx -d $PANEL_HOST -d $API_HOST"
      else
        certbot_args=(--nginx -d "$PANEL_HOST" -d "$API_HOST"
                      --non-interactive --agree-tos --redirect --keep-until-expiring)
        if [[ -n "${VALUES[READMIN_TLS_EMAIL]:-}" ]]; then
          certbot_args+=(-m "${VALUES[READMIN_TLS_EMAIL]}")
        else
          certbot_args+=(--register-unsafely-without-email)
        fi

        info "Requesting certificates from Let's Encrypt ..."
        if as_root certbot "${certbot_args[@]}"; then
          TLS_ISSUED=1
          ok "HTTPS live on $PANEL_HOST and $API_HOST, with HTTP redirecting to it"
          # certbot installs its own systemd timer or cron job; confirm one exists
          # rather than claiming renewal works.
          if as_root systemctl list-timers 2>/dev/null | grep -q certbot \
             || [[ -e /etc/cron.d/certbot ]]; then
            ok "Automatic renewal is scheduled (certbot renew)"
          else
            warn "No renewal timer found — add one, or certificates lapse in 90 days."
          fi
        else
          warn "certbot failed. The panel is built for https:// but TLS is not up."
          note "Common causes: port 80 blocked by a firewall, DNS not propagated,"
          note "or Let's Encrypt rate limits. Retry with:"
          note "  sudo certbot --nginx -d $PANEL_HOST -d $API_HOST"
        fi
      fi
    fi
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
if [[ "${VALUES[READMIN_TLS]:-false}" == "true" ]]; then
  if (( TLS_ISSUED )); then
    info "1. HTTPS is live — nothing to do. Certificates renew automatically."
  else
    info "1. Point $PANEL_HOST and $API_HOST at this server, then finish TLS:"
    info "     sudo certbot --nginx -d $PANEL_HOST -d $API_HOST"
  fi
else
  info "1. Point $PANEL_HOST and $API_HOST at this server, then add TLS (certbot)."
fi
info "2. Add your Roblox OAuth redirect URI: ${VALUES[NEXT_PUBLIC_PANEL_URL]}/auth/roblox"
info "3. Add BOTH Discord redirect URIs (Discord matches them exactly):"
info "     ${VALUES[NEXT_PUBLIC_PANEL_URL]}/auth/discord              login + account linking"
info "     ${VALUES[NEXT_PUBLIC_PANEL_URL]}/workspaces/discord/link   adding the bot to a guild"
info "   and its interactions endpoint:     ${VALUES[NEXT_PUBLIC_API_URL]}/internal/discord"
info "4. Publish your own copies of the in-game Roblox modules — README §6.1."
info "   Nothing works in-game until you do; it is a Studio job, not a code edit."
info "5. Walk the post-deploy checklist in README §7."

printf '\n  %sTo update later:%s sudo ./install.sh --update\n\n' "$DIM" "$RESET"
