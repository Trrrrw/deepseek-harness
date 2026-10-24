/** Select the Host interpreter independently of Electron's Linux GLib dependencies. */
import { join } from 'node:path'

/**
 * Resolve the interpreter shared by Host, CLI, and package operations.
 * Linux uses bundled Node because Electron's GLib symbols conflict with sharp.
 * @param electron - Electron executable for macOS and Windows.
 * @param primaryRuntime - Prepared dependency payload directory.
 * @param platform - Target operating system.
 * @returns Absolute interpreter path within the application resources.
 */
export function desktopHostExecutable(electron: string, primaryRuntime: string, platform: NodeJS.Platform): string {
  return platform === 'linux' ? join(primaryRuntime, 'dependencies', 'node', 'bin', 'node') : electron
}
