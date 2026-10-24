/** Public feed attached only to Linux release builds. */
export interface LinuxReleaseConfig {
  readonly provider: 'github'
  readonly owner: string
  readonly repo: string
  readonly channel: 'nightly'
  readonly releaseType: 'release'
}

/**
 * Select this fork's public GitHub update feed without credentials.
 * @param environment Packaging environment with the explicit Linux release switch.
 * @param platform Target operating system.
 * @returns Feed configuration, or undefined for local builds.
 * @throws When the switch is invalid or selects another platform.
 */
export function linuxReleaseConfig(environment: NodeJS.ProcessEnv, platform: NodeJS.Platform): LinuxReleaseConfig | undefined
