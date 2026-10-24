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

/** Packaging revision a fork release appends to the upstream product version. */
const LINUX_REVISION = /^[1-9][0-9]*$/u

/**
 * Read one fork release version, which pairs the upstream product version with a packaging revision.
 * @param {string} version Release version to read, as `app.getVersion()` and the updater see it.
 * @param {string} productVersion Version the manifests declare.
 * @returns {{ revision: number }} Packaging revision of that upstream version.
 * @throws When the version is not `<productVersion>-linux.<revision>`.
 */
export function linuxReleaseVersionParts(version, productVersion) {
  const prefix = `${productVersion}-linux.`
  if (!version.startsWith(prefix)) {
    throw new Error(`Linux release: version ${version} must be ${productVersion}-linux.<revision>`)
  }
  const revision = version.slice(prefix.length)
  if (!LINUX_REVISION.test(revision)) {
    throw new Error(`Linux release: version ${version} needs a positive packaging revision`)
  }
  return { revision: Number(revision) }
}

/**
 * Resolve the build version of one Linux release run.
 * @param {NodeJS.ProcessEnv} environment Packaging environment carrying the release version.
 * @param {string} productVersion Version the manifests declare.
 * @returns {string} Requested fork release version, or the product version for a local build.
 * @throws When the requested version does not extend the product version with a packaging revision.
 */
export function resolveLinuxReleaseBuildVersion(environment, productVersion) {
  const requested = environment.DSH_DESKTOP_BUILD_VERSION?.trim()
  if (requested === undefined || requested === '') return productVersion
  linuxReleaseVersionParts(requested, productVersion)
  return requested
}
