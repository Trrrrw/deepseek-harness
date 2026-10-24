/** This fork's publication workflows expose only verified Linux installers. */
import { readFileSync } from 'node:fs'
import { load } from 'js-yaml'
import { expect, it } from 'vitest'

interface Workflow {
  permissions: { contents: string }
  jobs: Record<string, { if?: string; needs?: string; permissions?: { contents?: string }; steps?: unknown[] }>
}

const upstream = ['windows-package', 'macos-package', 'desktop-publish', 'release-publish', 'release-vendor-publish',
  'python-release', 'node-addon-system-release', 'publish-ssh-helper']

it.each(upstream)('disables every %s job in the Linux-only fork', (name) => {
  const workflow = load(readFileSync(new URL(`../../../.github/workflows/${name}.yml`, import.meta.url), 'utf8')) as Workflow
  for (const job of Object.values(workflow.jobs)) {
    expect(job.if).toMatch(/^github\.repository != 'Trrrrw\/deepseek-harness'(?:$| && \()/u)
  }
})

it('publishes Linux assets only after a read-only build and checksum transfer', () => {
  const source = readFileSync(new URL('../../../.github/workflows/linux-release.yml', import.meta.url), 'utf8')
  const workflow = load(source) as Workflow
  expect(workflow.permissions.contents).toBe('read')
  expect(workflow.jobs.build?.if).toBe("github.repository == 'Trrrrw/deepseek-harness'")
  expect(workflow.jobs.publish).toMatchObject({ needs: 'build', permissions: { contents: 'write' } })
  expect(source).toContain('sha256sum --check SHA256SUMS')
  expect(source).toContain('+refs/tags/dsh-v*:refs/tags/dsh-v*')
  expect(source).toContain('release/*.AppImage release/*.rpm release/nightly-linux.yml release/SHA256SUMS')
  expect(source).toContain('--draft=false --prerelease=false --latest')
  expect(source).toContain('gh release delete "$RELEASE_TAG" --yes --cleanup-tag=false')
  expect(source).toContain('is already published')
  expect(source).not.toMatch(/--clobber|\.exe|\.dmg|npm publish|pypi/u)
})
