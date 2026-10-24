/** AppImage execution takes priority over package-type files in reused packaging trees. */
import { afterEach, expect, it, vi } from 'vitest'

const selected = vi.hoisted(() => ({ appImage: 0, automatic: 0 }))
vi.mock('electron', () => ({ app: { isPackaged: false } }))
vi.mock('electron-updater', () => ({ default: {
  get autoUpdater() { selected.automatic += 1; return {} },
  AppImageUpdater: function () { selected.appImage += 1 },
} }))

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); selected.appImage = selected.automatic = 0 })

it.each([
  ['linux', '/private/application.AppImage', 1, 0],
  ['linux', undefined, 0, 1],
  ['win32', '/private/application.AppImage', 0, 1],
] as const)('selects the updater for %s with APPIMAGE=%s', async (platform, appImage, explicit, automatic) => {
  vi.resetModules()
  vi.spyOn(process, 'platform', 'get').mockReturnValue(platform)
  vi.stubEnv('APPIMAGE', appImage)
  await import('../src/update-coordinator.ts')
  expect(selected).toEqual({ appImage: explicit, automatic })
})
