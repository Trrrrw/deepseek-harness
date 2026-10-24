/** Public GitHub distribution for this fork's Linux installers. */

/**
 * Enable GitHub update metadata only for explicitly selected Linux release builds.
 * GitHub published releases define the feed; the upstream version may contain prerelease fields.
 * @param {NodeJS.ProcessEnv} environment Packaging environment.
 * @param {NodeJS.Platform} platform Target operating system.
 * @returns {{ provider: 'github', owner: string, repo: string, channel: 'nightly', releaseType: 'release' } | undefined} Public feed configuration, without authentication data.
 * @throws When the release switch is invalid or selects another platform.
 */
export function linuxReleaseConfig(environment, platform) {
  const enabled = environment.DSH_DESKTOP_LINUX_RELEASE
  if (enabled === undefined || enabled === '0') return undefined
  if (enabled !== '1') throw new Error('Linux release: DSH_DESKTOP_LINUX_RELEASE must be 0 or 1')
  if (platform !== 'linux') throw new Error('Linux release: only Linux installers can use this release feed')
  return { provider: 'github', owner: 'Trrrrw', repo: 'deepseek-harness', channel: 'nightly', releaseType: 'release' }
}
