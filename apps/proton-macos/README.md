# Proton macOS Doctor Desktop App

A native macOS clinical desktop application for physicians and healthcare providers using the **Proton Clinical AI Copilot**.

## Features

- **Exact Design Match**: Frameless floating glassmorphism card centered over a cinematic sunset landscape backdrop with specular amber rim lighting.
- **Botanical Anatomical Hero Art**: The classical Da Vinci / Vesalius muscle anatomy figure blooming with vibrant wildflowers, vines, and fluttering butterflies.
- **Atmospheric Visual Polish**:
  - Continuous drifting ambient ember fireflies with physics canvas.
  - Dark glassmorphic input fields with SF Pro system typography.
  - Interactive password reveal / hide toggle.
  - Terms & Privacy policy checkbox.
  - Signature warm-cream action pill button (`Create Account →` / `Sign In →`).
  - Google, Apple, and Phone social authentication capsules.
  - Dual Mode: Instant toggle between **Sign up** and **Log in**.
- **Physician Workflow Ready**:
  - **Demo Doctor** shortcut button to instantly pre-fill doctor credentials (`dr.sarah.mitchell@protoncare.ai`).
  - Interactive transition to the **Doctor Clinical Console**:
    - Ambient consultation audio listening with real-time `● REC` indicator.
    - Today's Patient Queue with clinical status badges (Waiting room, Nurse prepared, Scheduled).
    - Instant Chart view actions.
- **Native macOS Integration**:
  - Built with Swift AppKit & WebKit.
  - Zero heavy Electron bloatware (~5 MB total).
  - Native window dragging by background.
  - Standard macOS Edit keyboard shortcuts (`Cmd+C`, `Cmd+V`, `Cmd+A`, `Cmd+Z`, `Cmd+Q`).

## Quick Start

### Build and Launch

From the repository root:
```bash
npm run dev:macos
```

Or directly from the app folder:
```bash
./apps/proton-macos/Scripts/build_and_run.sh
```

## Structure

```
apps/proton-macos/
├── Proton.app/             # Bundled native macOS application
├── Scripts/
│   └── build_and_run.sh    # Swift compiler, bundler, and launcher script
└── Sources/
    └── Proton/
        ├── main.swift      # Native AppKit Cocoa lifecycle, NSWindow, and WKWebView
        └── Resources/
            ├── index.html  # Authentication card & Doctor Clinical Console
            ├── style.css   # Glassmorphic design system & animations
            ├── app.js      # Mode switching, validation, embers canvas, & clinical queue
            ├── hero_anatomy.jpg    # Blooming botanical human figure
            ├── ambient_sunset.jpg  # Sunset landscape backdrop
            └── full_scene.jpg      # Full resolution scene
```
