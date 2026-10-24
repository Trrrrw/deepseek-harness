/** Linux releases bind a source version to both installers and their update checksums. */
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dump } from 'js-yaml'
import { expect, it, onTestFinished } from 'vitest'
import { linuxReleaseConfig } from '../scripts/linux-release-config.mjs'
import { linuxReleaseVersion, verifyLinuxReleaseArtifacts } from '../scripts/linux-release.ts'

const version = '0.2.1-rc.3'

it('selects the fork GitHub feed only for an explicit Linux release', () => {
  expect(linuxReleaseConfig({}, 'linux')).toBeUndefined()
  expect(linuxReleaseConfig({ DSH_DESKTOP_LINUX_RELEASE: '0' }, 'linux')).toBeUndefined()
  expect(linuxReleaseConfig({ DSH_DESKTOP_LINUX_RELEASE: '1' }, 'linux')).toEqual({
    provider: 'github', owner: 'Trrrrw', repo: 'deepseek-harness', channel: 'nightly', releaseType: 'release',
  })
  expect(() => linuxReleaseConfig({ DSH_DESKTOP_LINUX_RELEASE: 'yes' }, 'linux')).toThrow(/0 or 1/u)
  expect(() => linuxReleaseConfig({ DSH_DESKTOP_LINUX_RELEASE: '1' }, 'darwin')).toThrow(/only Linux/u)
})

it('accepts a matching version tag or an explicit master release', () => {
  expect(linuxReleaseVersion({ event: 'push', refType: 'tag', refName: `v${version}` }, version)).toBe(version)
  expect(linuxReleaseVersion({ event: 'workflow_dispatch', refType: 'branch', refName: 'master' }, version)).toBe(version)
  expect(linuxReleaseVersion({ event: 'workflow_dispatch', refType: 'branch', refName: 'master',
    version: `${version}.20261024.1` }, version)).toBe(`${version}.20261024.1`)
  expect(() => linuxReleaseVersion({ event: 'push', refType: 'tag', refName: 'v9.0.0' }, version)).toThrow(/extend/u)
  expect(() => linuxReleaseVersion({ event: 'workflow_dispatch', refType: 'branch', refName: 'feature/test' }, version))
    .toThrow(/master/u)
  expect(() => linuxReleaseVersion({ event: 'pull_request', refType: 'branch', refName: 'master' }, version)).toThrow(/master/u)
})

async function artifacts() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-linux-release-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  const files = await Promise.all(['AppImage', 'rpm'].map(async (extension) => {
    const url = `deepseek-harness-${version}-linux-x86_64-unsigned.${extension}`
    const bytes = Buffer.from(`inert ${extension} installer`)
    await writeFile(join(root, url), bytes)
    return { url, size: bytes.length, sha512: createHash('sha512').update(bytes).digest('base64') }
  }))
  const metadata = { version, files }
  const save = () => writeFile(join(root, 'nightly-linux.yml'), dump(metadata))
  await save()
  return { root, files, metadata, save }
}

it('returns only the two Linux installers and checksum metadata for upload', async () => {
  const f = await artifacts()
  const names = await verifyLinuxReleaseArtifacts(f.root, version)
  expect(names).toEqual([...f.files.map(file => file.url), 'nightly-linux.yml', 'SHA256SUMS'])
  const sums = await readFile(join(f.root, 'SHA256SUMS'), 'utf8')
  for (const name of names.slice(0, -1)) {
    const digest = createHash('sha256').update(await readFile(join(f.root, name))).digest('hex')
    expect(sums).toContain(`${digest}  ${name}\n`)
  }
})

it.each(['bytes', 'size', 'version', 'duplicate', 'foreign', 'missing'])(
  'refuses release assets with invalid %s', async (fault) => {
    const f = await artifacts()
    if (fault === 'bytes') await writeFile(join(f.root, f.files[0]!.url), Buffer.alloc(f.files[0]!.size, 0))
    if (fault === 'size') f.files[0]!.size += 1
    if (fault === 'version') f.metadata.version = '9.0.0'
    if (fault === 'duplicate') f.files[1]!.url = f.files[0]!.url
    if (fault === 'foreign') f.files[1]!.url = 'installer.exe'
    if (fault === 'missing') f.files.pop()
    await f.save()
    await expect(verifyLinuxReleaseArtifacts(f.root, version)).rejects.toThrow(/Linux release/u)
    await expect(readFile(join(f.root, 'SHA256SUMS'))).rejects.toMatchObject({ code: 'ENOENT' })
  },
)
