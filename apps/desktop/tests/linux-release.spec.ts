/** Linux releases bind a source version to both installers and their update checksums. */
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dump } from 'js-yaml'
import { expect, it, onTestFinished } from 'vitest'
import { linuxReleaseConfig, resolveLinuxReleaseBuildVersion } from '../scripts/linux-release-config.mjs'
import { linuxReleaseVersion, verifyLinuxReleaseArtifacts, verifyLinuxReleaseSource } from '../scripts/linux-release.ts'

const version = '0.2.1-rc.3-linux.1'
const productVersion = '0.2.1-rc.3'

it('selects the fork GitHub feed only for an explicit Linux release', () => {
  expect(linuxReleaseConfig({}, 'linux')).toBeUndefined()
  expect(linuxReleaseConfig({ DSH_DESKTOP_LINUX_RELEASE: '0' }, 'linux')).toBeUndefined()
  expect(linuxReleaseConfig({ DSH_DESKTOP_LINUX_RELEASE: '1' }, 'linux')).toEqual({
    provider: 'github', owner: 'Trrrrw', repo: 'deepseek-harness', channel: 'nightly', releaseType: 'release',
  })
  expect(() => linuxReleaseConfig({ DSH_DESKTOP_LINUX_RELEASE: 'yes' }, 'linux')).toThrow(/0 or 1/u)
  expect(() => linuxReleaseConfig({ DSH_DESKTOP_LINUX_RELEASE: '1' }, 'darwin')).toThrow(/only Linux/u)
})

it('pairs the upstream version with this fork\'s packaging revision', () => {
  expect(linuxReleaseVersion({ event: 'push', refType: 'tag', refName: `v${version}` }, productVersion)).toBe(version)
  expect(linuxReleaseVersion({ event: 'workflow_dispatch', refType: 'branch', refName: 'master',
    version: '0.2.1-rc.3-linux.12' }, productVersion)).toBe('0.2.1-rc.3-linux.12')
  expect(resolveLinuxReleaseBuildVersion({}, productVersion)).toBe(productVersion)
  expect(resolveLinuxReleaseBuildVersion({ DSH_DESKTOP_BUILD_VERSION: version }, productVersion)).toBe(version)
  for (const rejected of [productVersion, '0.2.1-rc.3-linux.0', '0.2.1-rc.3-linux.x', '0.2.1-linux.1', '9.0.0-linux.1']) {
    expect(() => linuxReleaseVersion({ event: 'push', refType: 'tag', refName: `v${rejected}` }, productVersion))
      .toThrow(/Linux release/u)
  }
  expect(() => linuxReleaseVersion({ event: 'workflow_dispatch', refType: 'branch', refName: 'master' }, productVersion))
    .toThrow(/dispatch from master/u)
  expect(() => linuxReleaseVersion({ event: 'workflow_dispatch', refType: 'branch', refName: 'feature/test' }, productVersion))
    .toThrow(/dispatch from master/u)
  expect(() => linuxReleaseVersion({ event: 'pull_request', refType: 'branch', refName: 'master' }, productVersion))
    .toThrow(/dispatch from master/u)
})

async function artifacts() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-linux-release-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  const files = await Promise.all(['AppImage', 'rpm'].map(async (extension) => {
    const url = `deepseek-harness-${version}-linux-x86_64.${extension}`
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

async function repository(): Promise<{ root: string; git: (...args: string[]) => string }> {
  const { execFileSync } = await import('node:child_process')
  const root = await mkdtemp(join(tmpdir(), 'dsh-linux-source-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  git('init', '--quiet')
  git('config', 'user.email', 'linux-release@example.com')
  git('config', 'user.name', 'Linux release')
  await writeFile(join(root, 'package.json'), '{}\n')
  git('add', 'package.json')
  git('commit', '--quiet', '-m', 'baseline')
  return { root, git }
}

it('accepts the next packaging revision of a source tree that contains the upstream tag', async () => {
  const { root, git } = await repository()
  git('tag', `dsh-v${productVersion}`)
  git('tag', 'v0.2.1-rc.3-linux.1')
  expect(verifyLinuxReleaseSource('0.2.1-rc.3-linux.2', productVersion, root)).toBe(git('rev-parse', 'HEAD'))
})

it('refuses a revision that was already released for this upstream version', async () => {
  const { root, git } = await repository()
  git('tag', `dsh-v${productVersion}`)
  git('tag', 'v0.2.1-rc.3-linux.2')
  await writeFile(join(root, 'change.txt'), 'next build\n')
  git('add', 'change.txt')
  git('commit', '--quiet', '-m', 'next build')
  expect(() => verifyLinuxReleaseSource(version, productVersion, root)).toThrow(/was not published after v0\.2\.1-rc\.3-linux\.2/u)
})

it('accepts the revision whose tag points at the commit being published', async () => {
  const { root, git } = await repository()
  git('tag', `dsh-v${productVersion}`)
  git('tag', 'v0.2.1-rc.3-linux.1')
  expect(verifyLinuxReleaseSource(version, productVersion, root)).toBe(git('rev-parse', 'HEAD'))
})

it('refuses to publish without the upstream release tag in the repository', async () => {
  const { root } = await repository()
  expect(() => verifyLinuxReleaseSource(version, productVersion, root)).toThrow(/upstream tag dsh-v0\.2\.1-rc\.3 is missing/u)
})

it('refuses a source tree that does not contain the upstream release tag', async () => {
  const { root, git } = await repository()
  git('tag', `dsh-v${productVersion}`)
  git('checkout', '--quiet', '--orphan', 'linux-only')
  git('rm', '--quiet', '-r', '--cached', '.')
  await writeFile(join(root, 'linux.txt'), 'adaptation\n')
  git('add', 'linux.txt')
  git('commit', '--quiet', '-m', 'linux adaptation')
  expect(() => verifyLinuxReleaseSource(version, productVersion, root)).toThrow(/does not contain upstream tag/u)
})
