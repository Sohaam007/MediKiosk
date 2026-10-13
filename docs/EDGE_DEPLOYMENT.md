# MediKiosk Edge Hardware Deployment & Lockdown Guide

This guide is intended for Hospital IT Administrators and Biomedical Systems Engineers deploying **MediKiosk** onto physical touchscreens, hospital admission kiosks, and tablets in OPD waiting areas.

---

## 1. Hardware Architecture & Terminal Specifications

| Component | Minimum Specification | Recommended Specification |
|---|---|---|
| **Display** | 10.1" Capacitive Touchscreen (1280x800) | 15.6"–21.5" IPS Capacitive Touchscreen (1920x1080) |
| **Touch Targets** | WCAG AAA 48x48px target compliance | Compliant out of the box in MediKiosk UI |
| **Microphone** | Standard USB microphone | Directional Noise-Cancelling Array (Far-Field Audio) |
| **Audio Output** | Internal stereo speakers (>= 2W) | Front-facing high-clarity speaker (for Ayush Sahayak TTS) |
| **Camera** | 5MP Auto-focus USB Webcam | 8MP High-Resolution Autofocus (Prescription Scanner) |
| **Edge Compute** | 4-Core x86_64 / ARM64, 4GB RAM | 8-Core Intel Core i3 / Raspberry Pi 5 (8GB) |
| **Network** | Ethernet 100 Mbps or 802.11ac Wi-Fi | Isolated Hospital Kiosk VLAN with WPA3-Enterprise |

---

## 2. Linux Edge Terminal Deployment (Ubuntu / Debian / Raspberry Pi OS)

Linux with X11 / Wayland is the recommended operating system for physical hospital kiosk hardware due to robust systemd service supervision and total OS shell lockdown.

### 2.1. Prerequisites & Dependencies

On the terminal machine, install Chromium, audio utilities, cursor management, and curl:

```bash
sudo apt-get update
sudo apt-get install -y \
    chromium-browser \
    unclutter \
    x11-xserver-utils \
    curl \
    pulseaudio-utils
```

### 2.2. Dedicated Unprivileged Kiosk User

Create a locked-down `kiosk` user without sudo privileges:

```bash
sudo useradd -m -s /bin/bash kiosk
sudo usermod -aG audio,video kiosk
```

### 2.3. Deploy Launch Script & Configure Flags

The repository provides the production launch script at [`scripts/launch_kiosk_linux.sh`](file:///C:/Users/Acer/Documents/Hackathon_and_Others/STARTUPX/medikiosk/scripts/launch_kiosk_linux.sh).

Ensure execute permissions are granted:
```bash
chmod +x /opt/medikiosk/scripts/launch_kiosk_linux.sh
```

#### Enforced Chromium Lockdown Flags:
- `--kiosk`: Opens browser in true fullscreen mode; hides title bar, URL bar, tabs, and window controls.
- `--incognito`: Launches an ephemeral private session preventing persistent cookies or credentials across patient sessions.
- `--disable-pinch`: Disables touch pinch-to-zoom gestures, preserving layout stability.
- `--overscroll-history-navigation=0`: Prevents edge swipe gestures from triggering back/forward page navigation.
- `--disable-context-menu`: Disables right-click, long-press inspect, and context menus.
- `--disable-infobars`: Suppresses notifications and extension alerts.
- `--no-first-run`: Skips onboarding wizards and profile sign-in screens.
- `--noerrdialogs`: Suppresses crash popup dialogues.
- `--disable-session-crashed-bubble`: Prevents "Restore pages after crash" banners.
- `--autoplay-policy=no-user-gesture-required`: Ensures Ayush Sahayak voice questions play seamlessly without requiring additional taps.

### 2.4. Systemd Autostart Service Setup

Install the systemd unit file from [`scripts/medikiosk-ui.service`](file:///C:/Users/Acer/Documents/Hackathon_and_Others/STARTUPX/medikiosk/scripts/medikiosk-ui.service):

```bash
# 1. Copy unit file to systemd directory
sudo cp /opt/medikiosk/scripts/medikiosk-ui.service /etc/systemd/system/medikiosk-ui.service

# 2. Reload systemd daemon
sudo systemctl daemon-reload

# 3. Enable service to start on every boot
sudo systemctl enable medikiosk-ui.service

# 4. Start service immediately
sudo systemctl start medikiosk-ui.service
```

### 2.5. Verification & Service Logs

Check live status and journal logs:
```bash
sudo systemctl status medikiosk-ui.service
sudo journalctl -u medikiosk-ui.service -f
```

---

## 3. Windows Terminal Deployment (Assigned Access / Single-App Kiosk)

For hospital environments operating Windows 10/11 Enterprise or Pro tablets (e.g., Microsoft Surface devices in OPD casualty).

### 3.1. Windows Assigned Access (Built-in Kiosk Mode)

1. Open **Settings** > **Accounts** > **Other users** > **Set up a kiosk (Assigned access)**.
2. Select **Get started**, name the account (e.g., `MediKioskTerminal`).
3. Choose **Microsoft Edge** as the kiosk app.
4. Select **As a digital sign or interactive kiosk (Full screen)**.
5. Enter the MediKiosk URL (e.g., `http://localhost:4173` or your hospital's secure ingress URL).
6. Set the idle reset time to **5 minutes** (matches DPDP walk-away session rules).
7. Sign in with the `MediKioskTerminal` account. Windows will lock down the desktop, start menu, and keyboard shortcuts (`Ctrl+Alt+Del`, `Win+L`, `Alt+Tab`).

### 3.2. Command-Line Edge Kiosk Launcher

Alternatively, run Edge in dedicated kiosk mode via a scheduled task or startup batch script:

```cmd
msedge.exe ^
  --kiosk "http://localhost:4173" ^
  --edge-kiosk-type=fullscreen ^
  --no-first-run ^
  --inprivate ^
  --disable-pinch ^
  --disable-features=Translate ^
  --autoplay-policy=no-user-gesture-required
```

---

## 4. Android Tablet Deployment (COSU / Lock Task Mode)

For portable hospital intake tablets (e.g., Samsung Galaxy Tab Active series carried by ASHA workers or triage nurses).

### 4.1. Screen Pinning (Quick Evaluation)

1. Navigate to **Settings** > **Security** > **Advanced** > **App Pinning (Screen Pinning)**.
2. Toggle **On** and require PIN/Pattern to unpin.
3. Open Google Chrome or the installed MediKiosk PWA.
4. Open the App Switcher (Overview), tap the MediKiosk icon at the top of the card, and select **Pin**.
5. The device will be locked into the MediKiosk app until the unpin button sequence and administrator PIN are entered.

### 4.2. Fully Managed Device / Enterprise Kiosk (Production)

For unattended OPD lobby kiosks, use an Android Enterprise Device Policy Controller (DPC) or **Fully Kiosk Browser**:
1. Install **Fully Kiosk Browser & Launcher**.
2. Configure **Start URL**: `http://<hospital-server-ip>:4173`.
3. Enable **Kiosk Mode (Lock Task Mode)**.
4. Enable **Motion Detection / Screen Keep Awake**.
5. Grant Camera and Audio Record permissions permanently.
6. Disable Status Bar pull-down, Navigation Bar, and Power Button menu.

---

## 5. Security & Hospital Network Hardening

### 5.1. Network Isolation (VLAN)
- Physical terminals must reside on an isolated **Kiosk VLAN**.
- Block all outbound access to local hospital EHR/HIS subnets except for the designated MediKiosk API gateway (`/api/*`).
- Allow HTTPS outbound access to the National Health Authority (NHA) ABDM Gateway (`abdm.gov.in`) and PM-JAY endpoints.

### 5.2. DPDP Act 2023 Zero-Retention at the Edge
- MediKiosk runs in `--incognito` / private browsing mode on the edge hardware.
- No patient transcripts, scanned prescriptions, or audio recordings are stored on the edge terminal filesystem.
- When the patient walks away or completes intake, the 15-second DPDP hard purge evicts all memory tokens.
- All hardware ports (USB mass storage) should be disabled in BIOS/UEFI to prevent unauthorized data extraction.

---

## 6. Troubleshooting Runbook

| Issue | Root Cause | Remediation |
|---|---|---|
| **Terminal boots to black screen** | X11/Wayland display server started after kiosk service | Ensure `After=graphical.target` is set in `medikiosk-ui.service`. |
| **Microphone fails to capture audio** | Browser permissions blocked or PulseAudio socket unavailable | Verify PulseAudio server environment: `Environment=PULSE_SERVER=unix:/run/user/1000/pulse/native` and user is in `audio` group. |
| **Prescription camera feed is blank** | USB camera not detected or permissions missing | Run `v4l2-ctl --list-devices` and ensure `kiosk` user is in `video` group. |
| **Terminal screen blanks after 10 mins** | DPMS power management is active | Verify `xset -dpms s off` was executed in `launch_kiosk_linux.sh`. |
