/** Validate Linux release versions and the installer bytes referenced by update metadata. */

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { appendFile, lstat, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { load } from 'js-yaml'
import { valid } from 'semver'
import { validateDesktopBuildVersion } from './desktop-build-version.mjs'

/** Source selection provided by the Linux release workflow. */
export interface LinuxReleaseRequest {
  readonly event: string
  readonly refType: string
  readonly refName: string
  readonly version?: string
}

/**
 * Resolve a v-prefixed release tag against the checked-out product version.
 * @param request - GitHub event, source ref and optional manual build version.
 * @param productVersion - Version shared by the checked-out workspaces.
 * @returns Validated application version, without the tag prefix.
 * @throws When the event, source or version cannot publish this source tree.
 */
export function linuxReleaseVersion(request: LinuxReleaseRequest, productVersion: string): string {
  if (request.event === 'push' && request.refType === 'tag' && request.refName.startsWith('v')) {
    return validateDesktopBuildVersion(request.refName.slice(1), productVersion)
  }
  if (request.event === 'workflow_dispatch' && request.refType === 'branch' && request.refName === 'master') {
    return validateDesktopBuildVersion(request.version?.trim() || productVersion, productVersion)
  }
  throw new Error('Linux release: use a v-prefixed version tag or dispatch from master')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function fileDigest(path: string, algorithm: string, encoding: 'base64' | 'hex'): Promise<string> {
  const hash = createHash(algorithm)
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest(encoding)
}

/**
 * Verify both Linux installers against the exact sizes and SHA-512 digests in their feed.
 * @param directory - Artifact directory produced by electron-builder.
 * @param version - Validated version expected in the feed and installer filenames.
 * @returns Explicit upload filenames, including the update feed and generated SHA256SUMS.
 * @throws On missing, malformed or mismatched metadata; no upload list is returned on failure.
 */
export async function verifyLinuxReleaseArtifacts(directory: string, version: string): Promise<readonly string[]> {
  if (valid(version) !== version || version.includes('+')) throw new Error('Linux release: invalid artifact version')
  const metadataName = 'nightly-linux.yml'
  const metadata: unknown = load(await readFile(join(directory, metadataName), 'utf8'))
  if (!isRecord(metadata) || metadata.version !== version || !Array.isArray(metadata.files)) {
    throw new Error('Linux release: update metadata must declare the selected version and installer files')
  }
  const expected = new Set(['AppImage', 'rpm'].map(extension => `deepseek-harness-${version}-linux-x86_64-unsigned.${extension}`))
  if (metadata.files.length !== expected.size) throw new Error('Linux release: metadata must contain exactly AppImage and RPM')
  const assets: string[] = []
  for (const value of metadata.files) {
    const file: unknown = value
    if (!isRecord(file) || typeof file.url !== 'string' || !expected.delete(file.url)
      || typeof file.sha512 !== 'string' || typeof file.size !== 'number' || !Number.isSafeInteger(file.size) || file.size < 1) {
      throw new Error('Linux release: invalid or duplicate installer metadata')
    }
    const path = join(directory, file.url)
    const stat = await lstat(path)
    if (!stat.isFile() || stat.size !== file.size || await fileDigest(path, 'sha512', 'base64') !== file.sha512) {
      throw new Error(`Linux release: installer size or SHA-512 mismatch: ${file.url}`)
    }
    assets.push(file.url)
  }
  assets.sort()
  assets.push(metadataName)
  const checksums = await Promise.all(assets.map(async name => `${await fileDigest(join(directory, name), 'sha256', 'hex')}  ${name}`))
  await writeFile(join(directory, 'SHA256SUMS'), checksums.join('\n') + '\n')
  return [...assets, 'SHA256SUMS']
}

async function main(): Promise<void> {
  if (process.env.GITHUB_REPOSITORY !== 'Trrrrw/deepseek-harness') throw new Error('Linux release: unexpected repository')
  if (process.argv[2] === 'prepare') {
    const manifest: unknown = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8'))
    if (!isRecord(manifest) || typeof manifest.version !== 'string') throw new Error('Linux release: missing product version')
    const version = linuxReleaseVersion({ event: process.env.GITHUB_EVENT_NAME ?? '', refType: process.env.GITHUB_REF_TYPE ?? '',
      refName: process.env.GITHUB_REF_NAME ?? '',
      ...process.env.LINUX_RELEASE_VERSION === undefined ? {} : { version: process.env.LINUX_RELEASE_VERSION } }, manifest.version)
    const tag = `v${version}`
    const checkedOut = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    const existing = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/tags/${tag}`])
    if (existing.error !== undefined) throw existing.error
    if (existing.status === 0) {
      const commit = execFileSync('git', ['rev-parse', `${tag}^{commit}`], { encoding: 'utf8' }).trim()
      if (commit !== checkedOut) throw new Error('Linux release: the version tag identifies another commit')
    } else if (existing.status !== 1) throw new Error('Linux release: cannot inspect the version tag')
    if (process.env.GITHUB_OUTPUT === undefined) throw new Error('Linux release: missing workflow output file')
    await appendFile(process.env.GITHUB_OUTPUT, `version=${version}\ntag=${tag}\ncommit=${checkedOut}\n`)
    console.log(`Linux release: ${tag}`)
  } else if (process.argv[2] === 'verify') {
    const directory = process.env.LINUX_RELEASE_DIRECTORY
    const version = process.env.LINUX_RELEASE_VERSION
    if (!directory || !version) throw new Error('Linux release: missing artifact directory or version')
    const assets = await verifyLinuxReleaseArtifacts(directory, version)
    console.log(`Linux release: verified ${assets.join(', ')}`)
  } else throw new Error('Linux release: expected prepare or verify')
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === import.meta.filename) await main()
