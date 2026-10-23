# Linux Desktop (work in progress)

This fork is experimenting with a native Linux x86_64 build of the existing Electron application.

## Local build

Prerequisites: Linux x86_64, Node.js 24, pnpm 11.28.5, GNU tar and standard Electron/AppImage packaging dependencies.

```bash
pnpm install --frozen-lockfile
pnpm run package:desktop:linux:x64
```

The command attempts to assemble an **unsigned**, local-only AppImage and RPM. For an unpacked application directory:

```bash
pnpm run package:desktop:linux:x64:dir
```

Outputs are expected under `apps/desktop/.desktop-build/targets/linux-x64/unsigned-artifacts/`.

**Not yet verified:** The full native addon/Office closure, launcher registration, Linux command management, update UX, and runtime smoke checks require testing on Linux. This is not an official signed release; automatic updates are disabled for Linux packages.

Fedora with niri/Wayland is the primary intended test target. Check the installed Electron permissions, dialogs and tray behavior in that environment before using this build for important work.
