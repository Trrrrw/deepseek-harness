# Linux desktop

English | [中文](LINUX.zh.md)

This fork builds the Electron application for Linux x86_64 as an unsigned AppImage, RPM, or unpacked application directory. Linux builds do not use the official signing, publication, mandatory-update, or automatic-update services.

## Build and launch

Use a Linux x86_64 host with Node.js 24.9 or later, the repository's pinned pnpm, GNU tar, and the system libraries required by Electron. RPM packaging also requires `rpmbuild`; on Fedora, the bundled FPM tool needs `libcrypt.so.1` from `libxcrypt-compat`.

```sh
pnpm install --frozen-lockfile
pnpm run package:desktop:linux:x64:dir
apps/desktop/.desktop-build/targets/linux-x64/unsigned-artifacts/linux-unpacked/deepseek-harness
```

To generate AppImage and RPM artifacts:

```sh
pnpm run package:desktop:linux:x64
```

Artifacts are written under `apps/desktop/.desktop-build/targets/linux-x64/unsigned-artifacts/`. Packaging verifies the bundled Node/Python runtime and runs the assembled runtime smoke checks. `--build-version auto` numbers Linux builds from local artifacts; Linux has no remote release history.

For source development, use `pnpm run dev:desktop`. The launcher prepares a separate development home and browser-data directory. Do not disable Chromium's sandbox to work around a launch failure.

## Platform behavior

The Host, CLI and package manager run with bundled standalone Node and the complete `resources/app.asar.unpacked/dsh` tree. This separates native image processing from the [Electron Linux GLib conflict](https://sharp.pixelplumbing.com/install/#electron-and-linux). The runtime descriptor records this interpreter's Node version.

Linux uses the native window frame and the packaged application icon. The desktop entry and Wayland application identifier share the configured application ID. Closing the last window quits the application; Linux does not create a tray icon. Folder selection follows the existing Electron and browse-picker providers.

The bundled terminal launcher uses the bundled Node interpreter and unpacked CLI entry. Automatic command installation is unavailable on Linux. An AppImage's extracted runtime belongs to its mounted image and must not be linked as a persistent command after that process exits.

Account requests use the existing Web protocol identifier because the Platform protocol has no Linux desktop identifier. This applies to both the Host account provider and embedded account pages. Browser sign-in still needs the desktop environment's `dsh://` handler; an unpacked directory does not install a desktop entry.

The application inherits the desktop session language unless a language preference has been saved. A terminal or automation process with `LC_ALL=C.UTF-8` requests English even when the desktop session uses Chinese.

Fedora with niri/Wayland is the primary qualification environment. Installed-RPM upgrade/removal, AppImage desktop integration, input methods, file dialogs, browser sign-in, and a real model round require separate runtime qualification. No official Linux release or update feed is provided.
