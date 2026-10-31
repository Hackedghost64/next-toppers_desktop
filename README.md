# Next Toppers Desktop for Linux

A native, high-performance Linux desktop client for Next Toppers, faithfully replicating the mobile app experience on PC for students.

## Features

- **Mobile Phone OTP Login**: Seamless authentication matching the mobile app with automated SMS OTP verification and persistent session storage.
- **My Courses & Batches Catalog**: Instant access to all enrolled batches, subjects, chapters, topics, and live/recorded content.
- **Theater-Mode Video Player**:
  - Full-featured HLS streaming with custom controls.
  - VideoCrypt AES-128 decrypted streaming via an integrated local low-latency proxy.
  - YouTube embedded lecture support.
  - Multi-resolution selector (Auto, 1080p, 720p, 480p, 360p, 240p).
  - Playback speed controls (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x).
  - Keyboard shortcuts (Space/K: play/pause, J/L: rewind/forward 10s, F: fullscreen, M: mute, Up/Down: volume).
  - Dynamic anti-piracy floating student watermark with phone number/ID.
- **PDF & Notes Viewer**: In-app PDF reader for class notes, DPPs (Daily Practice Problems), and formula sheets with one-click download/save dialog.
- **Desktop Integration**:
  - Desktop entry (`next-toppers.desktop`) registered in GNOME/KDE application menu.
  - Official high-resolution app icons and dark aesthetic matching the official Next Toppers teal branding (`#30cfaa`).
  - Wayland and X11 graphics compatibility out of the box.

## How to Launch

### 1. From Desktop Application Menu
Search for **"Next Toppers"** in your application launcher (GNOME Dash, Rofi, or App Menu) and click the icon.

### 2. From Terminal
```bash
cd /home/divyam/Desktop/projects/next-toppers_desktop
./launch.sh
```
or
```bash
npm start
```

## Directory Structure
- `main.js`: Electron main process, IPC coordination, session management, and window lifecycle.
- `preload.js`: Secure IPC context bridge (`window.nextToppers`).
- `src/api.js`: Next Toppers microservices client (Auth, Courses, Content, Watch time).
- `src/proxy.js`: Local stream decryption proxy for HLS MPEG-TS chunks.
- `src/decryptor.js`: AES-128-CBC key and IV derivation algorithm.
- `src/storage.js`: Local session store in `~/.config/next-toppers/session.json`.
- `renderer/`: Web front-end UI (Tailwind dark theme, video player, PDF viewer, course navigator).
- `assets/icons/`: High-resolution application icons extracted from the Android build.
