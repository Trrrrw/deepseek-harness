/** Validate the assembled application, including native Office conversion outside ASAR. */
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { desktopArtifactOutput, desktopTargetPlatform, resolveDesktopBuildTarget, resolveDesktopTargetBuildPaths } from './desktop-build-paths.mjs'
import { readDesktopRuntime, verifyDesktopRuntime } from '../src/runtime-tree.ts'
import { verifyWindowsCode } from './windows-runtime-signature.mjs'
import { smokePreparedRuntime } from './smoke-prepared-runtime.ts'
import { resolveDesktopPackageTarget } from './package-target.ts'

const paths = resolveDesktopTargetBuildPaths()
const { values } = parseArgs({ options: { unsigned: { type: 'boolean', default: false }, 'skip-notarization': { type: 'boolean', default: false } }, allowPositionals: false })
const target = resolveDesktopBuildTarget()
const windows = target === 'win-x64'
const artifacts = desktopArtifactOutput(paths, { unsigned: values.unsigned, skipNotarization: values['skip-notarization'] },
  desktopTargetPlatform(target).platform).directory
const linux = target === 'linux-x64'
const application = windows ? join(artifacts, 'win-unpacked')
  : linux ? join(artifacts, 'linux-unpacked')
    : join(artifacts, target === 'mac-arm64' ? 'mac-arm64' : 'mac', 'DeepSeek Harness.app', 'Contents')
const resources = join(application, windows || linux ? 'resources' : 'Resources')
const executable = windows ? join(application, 'DeepSeek Harness.exe')
  : linux ? join(resources, 'runtime', 'primary-runtime', 'dependencies', 'node', 'bin', 'node') : join(application, 'MacOS', 'DeepSeek Harness')
const runtimeRoot = join(resources, linux ? 'app.asar.unpacked' : 'app.asar', 'dsh')
const descriptorRoot = linux ? runtimeRoot : paths.dsh
const descriptor = await verifyDesktopRuntime(descriptorRoot, readDesktopRuntime(descriptorRoot).release.version,
  resolveDesktopPackageTarget(target))
if (windows && !values.unsigned) await verifyWindowsCode(application)
await smokePreparedRuntime(runtimeRoot, executable, join(resources, 'runtime'), descriptor)
