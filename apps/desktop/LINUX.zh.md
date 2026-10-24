# Linux 桌面应用

[English](LINUX.md) | 中文

本 fork 将 Electron 应用构建为 Linux x86_64 的无签名 AppImage、RPM 或解包应用目录，并将这些安装包及其更新元数据发布在本 fork 的 GitHub Releases 上。官方签名、上游发布、强制更新以及其他平台的发布服务在这里都不适用。

## 安装与更新

从本 fork 的 [releases](https://github.com/Trrrrw/deepseek-harness/releases) 下载 AppImage 或 RPM。AppImage 加上可执行权限即可运行；RPM 通过系统包管理器安装，由包管理器请求权限。安装包没有签名，操作系统不会验证其发布者，因此请用 `sha256sum --check SHA256SUMS` 将下载文件与已发布的 `SHA256SUMS` 对照。

应用菜单中的“检查更新”会报告已发布的更新版本，仅在确认该确切版本后下载，并在再次确认后安装。安装会停止正在运行的任务，用 `nightly-linux.yml` 校验下载内容的 SHA-512，然后交给对应机制：AppImage 替换正在运行的镜像并重新启动，RPM 则由 `zypper`、`dnf`、`yum` 或 `rpm` 在其所需的权限下安装。检查、下载或安装失败时会报告失败，已安装版本保持不变。

更新源是本 fork `Trrrrw/deepseek-harness` 的公开 GitHub 提供方，因此更新需要可访问的 GitHub 主机。它只提供以普通版本发布的 Release，并优先取最新版本；`nightly` 是元数据通道与文件的名字，不表示该版本必须是 prerelease。`0.2.1-rc.3` 这类版本后缀在这里属于普通版本。没有发布源的构建会报告该应用没有打包的更新源。

## 构建与启动

使用 Linux x86_64 主机、Node.js 24.9 或更高版本、仓库锁定的 pnpm、GNU tar，以及 Electron 所需的系统库。RPM 打包还需要 `rpmbuild`；在 Fedora 上，内置 FPM 工具需要 `libxcrypt-compat` 提供的 `libcrypt.so.1`。

```sh
pnpm install --frozen-lockfile
pnpm run package:desktop:linux:x64:dir
apps/desktop/.desktop-build/targets/linux-x64/unsigned-artifacts/linux-unpacked/deepseek-harness
```

生成 AppImage 和 RPM：

```sh
pnpm run package:desktop:linux:x64
```

产物写入 `apps/desktop/.desktop-build/targets/linux-x64/unsigned-artifacts/`。打包流程会验证内置 Node/Python 运行时，并对组装后的运行时执行冒烟检查。`--build-version auto` 根据本地产物为 Linux 构建编号；Linux 没有远程发布历史。

源码开发使用 `pnpm run dev:desktop`。启动器会准备独立的开发主目录与浏览器数据目录。不要通过关闭 Chromium 沙箱来绕过启动失败。

## 发布版本

`.github/workflows/linux-release.yml` 负责构建并发布这些安装包。它响应 `v*` 标签推送和从 `master` 手动触发，且只在 `Trrrrw/deepseek-harness` 中运行。其构建 job 只有仓库只读权限：安装 Linux 打包工具、运行 Linux 发布测试、以 `DSH_DESKTOP_LINUX_RELEASE=1` 打包、在 `xvfb-run` 下验证更新下载，并核对构建出的安装包与更新元数据。发布 job 只接收下列文件，接收后先用 `SHA256SUMS` 复核传输的字节：

| 资产 | 内容 |
| --- | --- |
| `deepseek-harness-<version>-linux-x86_64-unsigned.AppImage` | AppImage 安装包 |
| `deepseek-harness-<version>-linux-x86_64-unsigned.rpm` | RPM 安装包 |
| `nightly-linux.yml` | 更新器校验的版本、大小与 SHA-512 摘要 |
| `SHA256SUMS` | 上述三个文件的 SHA-256 |

发布流程先创建草稿，上传全部文件，再把该 Release 设为公开、非 prerelease 的 latest。上传失败会留下该草稿，重跑失败的发布 job 会替换它；已发布的版本不会被覆盖，重新构建需要使用新版本。`DSH_DESKTOP_LINUX_RELEASE=1 pnpm run package:desktop:linux:x64` 可在本地复现发布包，未设置或设为 `0` 则得到不带更新源的测试包；其他取值，或在其他平台使用该开关，会打包失败。

`LINUX_RELEASE_VERSION=<version> LINUX_RELEASE_DIRECTORY=<directory> pnpm exec tsx apps/desktop/scripts/linux-release.ts verify` 会按元数据核对产物目录，包括确切的大小与 SHA-512 摘要，并写出其中的 `SHA256SUMS`。`pnpm --filter @deepseek-ai/dsh-desktop run test:updates:linux` 针对一个回环地址上的更新源验证真实 Electron 更新传输，其安装包字节是惰性内容，安装动作只被记录而不执行。

## 平台行为

Host、CLI 和包管理器使用内置独立 Node，以及完整的 `resources/app.asar.unpacked/dsh` 目录。这使原生图像处理与 [Electron 在 Linux 上的 GLib 冲突](https://sharp.pixelplumbing.com/install/#electron-and-linux)分离。运行时描述文件记录此解释器的 Node 版本。

Linux 使用原生窗口边框和应用图标。桌面入口与 Wayland 应用标识使用相同的已配置应用 ID。关闭最后一个窗口会退出应用；Linux 不创建托盘图标。文件夹选择沿用现有的 Electron 和浏览目录选择器。

内置终端启动脚本使用内置 Node 解释器和解包的 CLI 入口。Linux 不提供自动命令安装。AppImage 的解包运行时属于挂载镜像，不能将其中路径链接为进程退出后仍然可用的持久命令。

账户请求使用现有 Web 协议标识，因为 Platform 协议没有 Linux 桌面标识。Host 账户提供方与内嵌账户页均使用此行为。浏览器登录仍需要桌面环境中的 `dsh://` 处理程序；解包目录不会安装桌面入口。

应用在未保存语言偏好时继承桌面会话语言。即使桌面会话使用中文，带有 `LC_ALL=C.UTF-8` 的终端或自动化进程也会请求英文。

Chromium 的沙箱需要非特权用户命名空间。限制这些命名空间的系统策略（例如 Ubuntu 24.04 的 AppArmor 默认设置）需要放行该应用；应用从不在关闭沙箱的情况下运行，发布工作流则会在启动 Electron 之前先在自己的运行器上解除该限制。

Fedora 与 niri/Wayland 是主要验证环境。通过更新流程替换已安装的 AppImage 或 RPM、经由包管理器原位安装、桌面集成、输入法、文件对话框、浏览器登录，以及真实模型对话需要单独验证。发布及其更新源只存在于本 fork 的 GitHub 仓库中。
