/** Linux packages carry a native executable and omit release-only update services. */
import { expect, it } from 'vitest'
import { createElectronBuilderConfig } from '../scripts/electron-builder-config.mjs'
import { loadDesktopPackageEnvironment } from '../scripts/desktop-package-environment.mjs'

it('assembles local Linux packages without macOS or Windows release settings', () => {
  const env = loadDesktopPackageEnvironment('linux', {}, '/absent-checkout', { unsigned: true })
  const config = createElectronBuilderConfig(env, 'linux', 'x64')
  expect(config.linux).toMatchObject({ executableName: 'deepseek-harness', syncDesktopName: true, target: ['AppImage', 'rpm'] })
  expect(config.linux.icon).toMatch(/icon-windows\.png$/u)
  expect(config.asarUnpack).toContain('**/dsh/**/*')
  expect(config.extraMetadata).toHaveProperty('desktopName', 'com.deepseek.harness.desktop')
  expect(config.rpm.packageName).toBe('deepseek-harness')
  expect(config.publish).toBeNull()
  expect(config.extraMetadata).not.toHaveProperty('dshMandatoryUpdatePolicy')
  expect(config.directories.output).toContain('unsigned-artifacts')
  expect(() => loadDesktopPackageEnvironment('linux', {}, '/absent-checkout')).toThrow(/require --unsigned/u)
})

it('embeds the public fork feed in Linux release builds without upstream update policy', () => {
  const env = loadDesktopPackageEnvironment('linux', { DSH_DESKTOP_LINUX_RELEASE: '1' }, '/absent-checkout', { unsigned: true })
  const config = createElectronBuilderConfig(env, 'linux', 'x64')
  expect(config.publish).toEqual([{ provider: 'github', owner: 'Trrrrw', repo: 'deepseek-harness',
    channel: 'nightly', releaseType: 'release' }])
  expect(config.extraMetadata).not.toHaveProperty('dshMandatoryUpdatePolicy')
})
