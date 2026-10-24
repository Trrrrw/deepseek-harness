# Linux 桌面应用

[English](LINUX.md) | 中文

本 fork 将 Electron 应用构建为 Linux x86_64 的无签名 AppImage、RPM 或解包应用目录。Linux 构建不使用官方签名、发布、强制更新或自动更新服务。

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

## 平台行为

Host、CLI 和包管理器使用内置独立 Node，以及完整的 `resources/app.asar.unpacked/dsh` 目录。这使原生图像处理与 [Electron 在 Linux 上的 GLib 冲突](https://sharp.pixelplumbing.com/install/#electron-and-linux)分离。运行时描述文件记录此解释器的 Node 版本。

Linux 使用原生窗口边框和应用图标。桌面入口与 Wayland 应用标识使用相同的已配置应用 ID。关闭最后一个窗口会退出应用；Linux 不创建托盘图标。文件夹选择沿用现有的 Electron 和浏览目录选择器。

内置终端启动脚本使用内置 Node 解释器和解包的 CLI 入口。Linux 不提供自动命令安装。AppImage 的解包运行时属于挂载镜像，不能将其中路径链接为进程退出后仍然可用的持久命令。

账户请求使用现有 Web 协议标识，因为 Platform 协议没有 Linux 桌面标识。Host 账户提供方与内嵌账户页均使用此行为。浏览器登录仍需要桌面环境中的 `dsh://` 处理程序；解包目录不会安装桌面入口。

应用在未保存语言偏好时继承桌面会话语言。即使桌面会话使用中文，带有 `LC_ALL=C.UTF-8` 的终端或自动化进程也会请求英文。

Fedora 与 niri/Wayland 是主要验证环境。已安装 RPM 的升级和移除、AppImage 桌面集成、输入法、文件对话框、浏览器登录，以及真实模型对话需要单独验证。本 fork 不提供官方 Linux 发布或更新源。
