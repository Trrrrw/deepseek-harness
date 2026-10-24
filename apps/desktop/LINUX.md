# Linux desktop

English | [中文](LINUX.zh.md)

This fork builds the Electron application for Linux x86_64 as an unsigned AppImage, RPM, or unpacked application directory, and publishes those installers with their update metadata on this fork's GitHub Releases. Official signing, upstream publication, mandatory updates, and the release services of other platforms do not apply.

## Install and update

Download the AppImage or RPM from the [releases](https://github.com/Trrrrw/deepseek-harness/releases) of this fork. An AppImage runs after `chmod +x`; an RPM installs through the system package manager, which asks for privileges. Installers are unsigned, so the operating system does not verify their publisher: compare each download against the published `SHA256SUMS` with `sha256sum --check SHA256SUMS`.

The application menu's Check for Updates reports a newer published version, downloads it only after confirmation for that exact version, and installs it after a separate confirmation. Installation stops the running tasks, checks the download's SHA-512 against `nightly-linux.yml`, and then hands over: an AppImage replaces the running image and relaunches it, while an RPM is installed by `zypper`, `dnf`, `yum`, or `rpm` with the privileges that command needs. A failed check, download, or installation reports the failure and leaves the installed version in place.

The feed is the public GitHub provider for `Trrrrw/deepseek-harness`, so updates need reachable GitHub hosts. It offers only releases published as ordinary releases, newest first; `nightly` names the metadata channel and file rather than a prerelease requirement. Version suffixes such as `0.2.1-rc.3` are ordinary versions here. A package built without a release feed reports that the application has no packaged update source.

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

## Publish a release

`.github/workflows/linux-release.yml` builds and publishes these installers. It runs for a `v*` tag push and for a manual dispatch from `master`, only in `Trrrrw/deepseek-harness`. Its build job holds read-only repository access: it installs Linux build tools, runs the Linux release tests, packages with `DSH_DESKTOP_LINUX_RELEASE=1`, qualifies the update downloads under `xvfb-run`, and verifies the built installers against the update metadata. Its publish job receives only these files, after `SHA256SUMS` re-verifies the transferred bytes:

| Asset | Content |
| --- | --- |
| `deepseek-harness-<version>-linux-x86_64.AppImage` | AppImage installer |
| `deepseek-harness-<version>-linux-x86_64.rpm` | RPM installer |
| `nightly-linux.yml` | Version, sizes, and SHA-512 digests the updater checks |
| `SHA256SUMS` | SHA-256 of the three files above |

Publishing creates a draft, uploads every file, then makes the release public, non-prerelease, and latest. A failed upload leaves that draft behind; re-running the failed publish job replaces the draft, and a published version is never overwritten, so a rebuild needs a new revision.

A release version pairs the upstream product version with this fork's packaging revision, such as `0.2.1-rc.3-linux.1`, and its tag is that version with a `v` prefix. `prepare` refuses a tag whose revision was already released, and it refuses a build that does not contain the upstream tag `dsh-v<product version>`; a version therefore always names the upstream release it was built from. To publish, merge that upstream tag into this branch and push the upstream tags with the branch. `master` mirrors upstream, and this branch carries the Linux changes on top of it, takes each upstream tag as a merge, and is the source of every release tag. `DSH_DESKTOP_LINUX_RELEASE=1 DSH_DESKTOP_BUILD_VERSION=<version> pnpm run package:desktop:linux:x64` reproduces the release package locally, and unset or `0` keeps a test package without an update source; another value, or this switch on another platform, fails packaging.

`LINUX_RELEASE_VERSION=<version> LINUX_RELEASE_DIRECTORY=<directory> pnpm exec tsx apps/desktop/scripts/linux-release.ts verify` checks an artifact directory against its metadata, including exact sizes and SHA-512 digests, and writes its `SHA256SUMS`. `pnpm --filter @deepseek-ai/dsh-desktop run test:updates:linux` qualifies the real Electron update transports against a loopback feed whose installer bytes are inert, and records the requested installation instead of running it.

## Platform behavior

The Host, CLI and package manager run with bundled standalone Node and the complete `resources/app.asar.unpacked/dsh` tree. This separates native image processing from the [Electron Linux GLib conflict](https://sharp.pixelplumbing.com/install/#electron-and-linux). The runtime descriptor records this interpreter's Node version.

Linux uses the native window frame and the packaged application icon. The desktop entry and Wayland application identifier share the configured application ID. Closing the last window quits the application; Linux does not create a tray icon. Folder selection follows the existing Electron and browse-picker providers.

The bundled terminal launcher uses the bundled Node interpreter and unpacked CLI entry. Automatic command installation is unavailable on Linux. An AppImage's extracted runtime belongs to its mounted image and must not be linked as a persistent command after that process exits.

Account requests use the existing Web protocol identifier because the Platform protocol has no Linux desktop identifier. This applies to both the Host account provider and embedded account pages. Browser sign-in still needs the desktop environment's `dsh://` handler; an unpacked directory does not install a desktop entry.

The application inherits the desktop session language unless a language preference has been saved. A terminal or automation process with `LC_ALL=C.UTF-8` requests English even when the desktop session uses Chinese.

Chromium's sandbox needs unprivileged user namespaces. A system policy that restricts them, such as Ubuntu 24.04's AppArmor default, must allow the application instead; the application never runs without its sandbox, and the release workflow lifts that restriction on its own runner before it launches Electron.

Fedora with niri/Wayland is the primary qualification environment. Replacing an installed AppImage or RPM through the update flow, in-place installation through a package manager, desktop integration, input methods, file dialogs, browser sign-in, and a real model round require separate runtime qualification. Releases and their update feed exist only in this fork's GitHub repository.
