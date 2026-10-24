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

/**
 * Read one fork release version, which pairs the upstream product version with a packaging revision.
 * @param version - Release version to read, as `app.getVersion()` and the updater see it.
 * @param productVersion - Version the manifests declare.
 * @returns Packaging revision of that upstream version.
 * @throws When the version is not `<productVersion>-linux.<revision>`.
 */
export function linuxReleaseVersionParts(version: string, productVersion: string): { revision: number }

/**
 * Resolve the build version of one Linux release run.
 * @param environment - Packaging environment carrying the release version.
 * @param productVersion - Version the manifests declare.
 * @returns Requested fork release version, or the product version for a local build.
 * @throws When the requested version does not extend the product version with a packaging revision.
 */
export function resolveLinuxReleaseBuildVersion(environment: NodeJS.ProcessEnv, productVersion: string): string
