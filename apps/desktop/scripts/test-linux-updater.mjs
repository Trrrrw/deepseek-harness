/** Qualify real Linux update transports with private inert payloads and no system installation. */
import { spawn } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveDesktopTargetBuildPaths } from './desktop-build-paths.mjs'

if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('Linux updater qualification requires Linux x64')
const root = await mkdtemp(join(tmpdir(), 'dsh-linux-updater-'))
let timedOut = false
let forceKill
try {
  const environment = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/KEY|SECRET|TOKEN|PASSWORD|^NODE_OPTIONS$|^ELECTRON_RUN_AS_NODE$|^APPIMAGE$/iu.test(name)))
  const child = spawn(join(resolveDesktopTargetBuildPaths().electron, 'electron'),
    [fileURLToPath(new URL('../tests/fixtures/linux-updater.mjs', import.meta.url))], {
      env: { ...environment, DSH_LINUX_UPDATER_ROOT: root }, stdio: 'inherit',
    })
  const timeout = setTimeout(() => {
    timedOut = true
    child.kill('SIGTERM')
    forceKill = setTimeout(() => { child.kill('SIGKILL') }, 5000)
  }, 120_000)
  try {
    const result = await new Promise((accept, reject) => {
      child.once('error', reject)
      child.once('close', (code, signal) => { accept({ code, signal }) })
    })
    if (timedOut) throw new Error('Linux updater qualification exceeded its deadline')
    if (result.signal !== null || result.code !== 0) throw new Error(`Linux updater qualification failed: ${JSON.stringify(result)}`)
    const parent = fileURLToPath(new URL('../.desktop-build/qualification/', import.meta.url))
    await mkdir(parent, { recursive: true })
    const evidence = await mkdtemp(join(parent, 'linux-updater-'))
    await copyFile(join(root, 'result.json'), join(evidence, 'result.json'))
    console.log(`Linux updater evidence: ${evidence}`)
    console.log(await readFile(join(evidence, 'result.json'), 'utf8'))
  } finally { clearTimeout(timeout); clearTimeout(forceKill) }
} finally { await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) }
