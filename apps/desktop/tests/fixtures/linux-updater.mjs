/** Actual Electron networking and Linux updater downloads; installation is recorded, never executed. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import updaterModule from 'electron-updater'
import { dump } from 'js-yaml'
import { DesktopUpdateCoordinator } from '../../lib/types/update-coordinator.js'
import { DesktopUpdateHttpExecutor } from '../../lib/types/update-http-executor.js'

const root = process.env.DSH_LINUX_UPDATER_ROOT
if (!root) throw new Error('Linux updater qualification requires a private root')
app.setPath('userData', join(root, 'electron'))
app.on('window-all-closed', () => {})

async function main() {
  await app.whenReady()
  const payloads = { AppImage: Buffer.from('inert AppImage fixture bytes'), rpm: Buffer.from('inert RPM fixture bytes') }
  const requests = []
  let corrupt = false
  let version = '1.0.0-rc.2'
  const repository = '/Trrrrw/deepseek-harness'
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname
    requests.push(path)
    response.setHeader('Cache-Control', 'no-store')
    if (path === `${repository}/releases.atom`) {
      response.end(`<feed><entry><title>Preview</title><link href="http://localhost${repository}/releases/tag/v9.0.0-beta.1"/></entry><entry><title>Linux</title><link href="http://localhost${repository}/releases/tag/v${version}"/></entry></feed>`)
    } else if (path === `/api/v3/repos${repository}/releases/latest`) {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ tag_name: `v${version}` }))
    } else if (path === `${repository}/releases/download/v${version}/nightly-linux.yml`) {
      response.end(dump({ version, files: Object.entries(payloads).map(([extension, bytes]) => ({
        url: `payload.${extension}`, size: bytes.length, sha512: createHash('sha512').update(bytes).digest('base64'),
      })), releaseDate: '2026-10-24T00:00:00.000Z' }))
    } else {
      const extension = path.endsWith('.AppImage') ? 'AppImage' : path.endsWith('.rpm') ? 'rpm' : undefined
      if (extension === undefined) { response.writeHead(404).end(); return }
      response.end(corrupt ? Buffer.alloc(payloads[extension].length, 0) : payloads[extension])
    }
  })
  await new Promise((accept, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', accept)
  })
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const results = []
  try {
    for (const [extension, Updater] of [['AppImage', updaterModule.AppImageUpdater], ['rpm', updaterModule.RpmUpdater]]) {
      const directory = join(root, extension)
      await mkdir(directory)
      const config = join(directory, 'app-update.yml')
      await writeFile(config, 'updaterCacheDirName: cache\n')
      if (extension === 'AppImage') process.env.APPIMAGE = join(directory, 'current.AppImage')
      else delete process.env.APPIMAGE
      const forbidden = () => { throw new Error('Qualification must not quit, relaunch or install software') }
      const updater = new Updater(undefined, {
        version: '1.0.0-rc.1', name: `linux-updater-${extension}`, isPackaged: true,
        appUpdateConfigPath: config, userDataPath: directory, baseCachePath: directory,
        whenReady: async () => {}, quit: forbidden, relaunch: forbidden, onQuit: forbidden,
      })
      updater.logger = null
      updater.httpExecutor = new DesktopUpdateHttpExecutor(5000)
      updater.disableDifferentialDownload = true
      updater.setFeedURL({ provider: 'github', host: `127.0.0.1:${address.port}`, protocol: 'http',
        owner: 'Trrrrw', repo: 'deepseek-harness', channel: 'nightly' })
      const installations = []
      updater.quitAndInstall = (...args) => { installations.push(args) }
      let permitInstall = false
      const coordinator = new DesktopUpdateCoordinator(state => state, async () => permitInstall,
        updater, () => true, () => '1.0.0-rc.1', undefined, 'nightly', false)
      try {
        requests.length = 0
        const available = await coordinator.check(true)
        assert.deepEqual(available, { phase: 'available', version: '1.0.0-rc.2' })
        assert.equal(requests.some(path => path.endsWith('.AppImage') || path.endsWith('.rpm')), false)
        assert.ok(requests.includes(`/api/v3/repos${repository}/releases/latest`))
        version = '1.0.0'
        assert.equal((await coordinator.check(true)).version, '1.0.0')
        version = '1.0.0-rc.2'
        assert.equal((await coordinator.check(true)).version, available.version)
        corrupt = true
        assert.equal((await coordinator.download(available.version)).phase, 'error')
        assert.equal(updater.installerPath, null)
        assert.equal(installations.length, 0)
        corrupt = false
        assert.equal((await coordinator.download(available.version)).phase, 'ready')
        assert.deepEqual(await readFile(updater.installerPath), payloads[extension])
        assert.equal((await coordinator.install(available.version)).phase, 'ready')
        assert.equal(installations.length, 0)
        permitInstall = true
        assert.equal((await coordinator.install(available.version)).phase, 'installing')
        assert.deepEqual(installations, [[true, true]])
        results.push({ format: extension, publishedReleaseSelection: true, stableTransition: true, noAutomaticDownload: true,
          checksumFailureRejected: true, retry: true, separateInstallConfirmation: true, installerExecuted: false })
      } finally { coordinator.dispose() }
    }
    await writeFile(join(root, 'result.json'), JSON.stringify({ results, screenshots: false }, null, 2) + '\n')
  } finally {
    delete process.env.APPIMAGE
    server.closeAllConnections()
    await new Promise((accept, reject) => { server.close(error => error ? reject(error) : accept()) })
  }
}

main().then(() => { app.quit() }, (error) => { console.error(error); process.exitCode = 1; app.quit() })
