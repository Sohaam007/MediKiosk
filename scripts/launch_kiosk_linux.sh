#!/usr/bin/env bash
# ==============================================================================
# MediKiosk - Linux Edge Hardware Lockdown Launch Script
# ==============================================================================
# Purpose: Launches Chromium or Google Chrome in strict OS-level kiosk mode
# targeting the local MediKiosk Vite production build on touchscreens and tablets.
#
# Hardware Targets: Linux x86_64, Raspberry Pi OS, Ubuntu Core, Debian Touch.
# Mandated Flags: --kiosk, --incognito, --disable-pinch, --disable-context-menu,
#                 --overscroll-history-navigation=0, --disable-infobars, --no-first-run
# ==============================================================================

set -euo pipefail

# Kiosk target URL (default to local Vite preview port 4173)
KIOSK_URL="${KIOSK_URL:-http://localhost:4173}"

# Ensure X11 display is initialized
export DISPLAY="${DISPLAY:-:0}"
export XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"

echo "[MediKiosk] Initializing edge terminal on display ${DISPLAY}..."
echo "[MediKiosk] Target URL: ${KIOSK_URL}"

# 1. Disable screen blanking, screensaver, and energy saving (DPMS)
if command -v xset >/dev/null 2>&1; then
    echo "[MediKiosk] Disabling screen blanking and DPMS power-saving..."
    xset s off 2>/dev/null || true
    xset -dpms 2>/dev/null || true
    xset s noblank 2>/dev/null || true
fi

# 2. Hide mouse cursor when inactive (ideal for touchscreen tablets)
if command -v unclutter >/dev/null 2>&1; then
    echo "[MediKiosk] Starting unclutter cursor hiding daemon..."
    killall unclutter 2>/dev/null || true
    unclutter -idle 0.5 -root &
fi

# 3. Detect installed Chromium / Chrome browser binary
BROWSER_BIN=""
for candidate in chromium-browser chromium google-chrome-stable google-chrome; do
    if command -v "${candidate}" >/dev/null 2>&1; then
        BROWSER_BIN="${candidate}"
        break
    fi
done

if [ -z "${BROWSER_BIN}" ]; then
    echo "[MediKiosk ERROR] No Chromium or Google Chrome browser found on system PATH!" >&2
    echo "[MediKiosk ERROR] Please install chromium: sudo apt-get install -y chromium-browser" >&2
    exit 1
fi

echo "[MediKiosk] Using browser binary: ${BROWSER_BIN}"

# 4. Wait for local MediKiosk web server to be reachable before launching
MAX_RETRIES=30
RETRY_COUNT=0
if command -v curl >/dev/null 2>&1; then
    echo "[MediKiosk] Checking backend/frontend availability at ${KIOSK_URL}..."
    until curl -s --head "${KIOSK_URL}" >/dev/null 2>&1 || [ ${RETRY_COUNT} -eq ${MAX_RETRIES} ]; do
        sleep 1
        RETRY_COUNT=$((RETRY_COUNT + 1))
    done
    if [ ${RETRY_COUNT} -eq ${MAX_RETRIES} ]; then
        echo "[MediKiosk WARNING] Server at ${KIOSK_URL} not yet responding; launching browser anyway..."
    else
        echo "[MediKiosk] Server is responsive. Launching locked down kiosk view."
    fi
fi

# 5. Lockdown Chrome / Chromium flags
CHROME_FLAGS=(
    # Fullscreen & Edge Lockdown
    "--kiosk"
    "--incognito"
    "--disable-pinch"
    "--overscroll-history-navigation=0"
    "--disable-context-menu"

    # UI & Crash suppression
    "--disable-infobars"
    "--no-first-run"
    "--noerrdialogs"
    "--disable-session-crashed-bubble"
    "--disable-translate"
    "--disable-features=Translate,TouchpadOverscrollHistoryNavigation"

    # Touch & Media optimizations
    "--touch-events=enabled"
    "--enable-viewport"
    "--autoplay-policy=no-user-gesture-required"

    # Memory & Security hardening
    "--password-store=basic"
    "--disable-component-update"
    "--check-for-update-interval=31536000"
    "--disk-cache-dir=/tmp/chromium-kiosk-cache"
)

# 6. Infinite watchdog loop to automatically relaunch browser if terminated
while true; do
    echo "[MediKiosk] Launching ${BROWSER_BIN}..."
    "${BROWSER_BIN}" "${CHROME_FLAGS[@]}" "${KIOSK_URL}" || true
    echo "[MediKiosk] Browser closed or crashed. Restarting in 2 seconds..."
    sleep 2
done
