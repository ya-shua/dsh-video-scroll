/**
 * dsh-video-scroll —— 合并包自检
 * ============================================================================
 * 用法：node selfcheck.mjs   （在本目录下运行；用 DSH 自带 Node 也行）
 *
 * 检查项：
 *   1. package.json 契约（exports 指到的文件都存在；dsh.bundle.patch / dsh.client 声明齐全）
 *   2. patch 是单入口：id video-scroll → name dsh-video-scroll（⚠️ 条目名绝不能带 `/` ——
 *      DSH 的 client-modules 扫描（exactPackageSpecifier）会静默丢掉带斜杠的条目，
 *      v1.0.0 的设置页面板就是这么消失的）
 *   3. 根模块能加载、且 apply 会把 bili/douyin 两个子插件 ctx.plugin 挂上
 *   4. client.js 工厂在桩环境里真跑：注册出 刷B站 / 刷抖音 两个 settings.section
 *   5. 全部 js/mjs 过 node --check；Python 脚本 py_compile（有 python 才查）
 * 退出码 0 = 全过。
 * ============================================================================
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgDir = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
let failed = 0
const ok = (msg) => console.log(`  ✓ ${msg}`)
const bad = (msg) => { console.error(`  ✗ ${msg}`); failed += 1 }

console.log('1) package.json 契约')
for (const [key, rel] of Object.entries(pkg.exports ?? {})) {
  if (key === './package.json') continue
  const p = join(pkgDir, rel)
  existsSync(p) ? ok(`exports${key} → ${rel}`) : bad(`exports${key} → ${rel} 不存在`)
}
pkg.dsh?.bundle?.patch ? ok('dsh.bundle.patch 已声明') : bad('缺 dsh.bundle.patch')
pkg.dsh?.client?.platform === 'web' ? ok('dsh.client.platform=web') : bad('dsh.client.platform 不是 web')

console.log('2) patch 单入口（条目名不能带 /）')
const patch = readFileSync(join(pkgDir, 'cordis.patch.yml'), 'utf8')
patch.includes('id: video-scroll') && patch.includes('name: dsh-video-scroll')
  ? ok('patch 声明 video-scroll → dsh-video-scroll')
  : bad('patch 缺 video-scroll → dsh-video-scroll')
if (/name:\s*dsh-video-scroll\//.test(patch)) bad('patch 里出现了带 / 的条目名（会让设置页面板消失）')
else ok('没有带 / 的条目名')
for (const [sub, expectedId] of [['bili', 'bili-scroll'], ['douyin', 'douyin-scroll']]) {
  const mod = await import(`./${sub}/index.js`)
  mod.name === expectedId
    ? ok(`${sub} 子插件导出 name=${mod.name}（子 fiber 名）`)
    : bad(`${sub} 导出 name=${mod.name}，应为 ${expectedId}`)
  // ⭐ 2026-11-07 跟进上游 0.7.3：webServer/llm 允许放 optional（headless 里不再卡 pending）
  const need = ['tools', 'settings']
  const webServerOk = mod.inject?.includes('webServer') || mod.optional?.includes('webServer')
  need.every((n) => mod.inject?.includes(n)) && webServerOk
    ? ok(`${sub} inject 完整（webServer 在 ${mod.inject?.includes('webServer') ? 'inject' : 'optional'}）`)
    : bad(`${sub} inject 异常: inject=${JSON.stringify(mod.inject)} optional=${JSON.stringify(mod.optional)}`)
}

console.log('3) 根模块挂载两个子插件')
{
  const root = await import('./index.js')
  root.name === 'video-scroll' ? ok('根模块 name=video-scroll') : bad(`根模块 name=${root.name}`)
  const mounted = []
  const fakeCtx = { plugin: (component, config) => { mounted.push([component.name, config]) }, effect: () => () => {} }
  root.apply(fakeCtx, {})
  const names = mounted.map((m) => m[0])
  names.includes('bili-scroll') && names.includes('douyin-scroll')
    ? ok(`ctx.plugin 挂载了 ${names.join(' + ')}`)
    : bad(`挂载异常: ${names.join(', ') || '什么都没挂'}`)
}

console.log('4) client.js 统一入口（v1.3.0）')
{
  const src = readFileSync(join(pkgDir, 'client.js'), 'utf8')
  const loads = []
  const fakeReact = {
    createElement: (...a) => ({ tag: a[0], props: a[1] }),
    Component: class Component {},
  }
  globalThis.window = {
    __ModuleLoader__: { load: (spec) => loads.push(spec) },
    // ⭐ 2026-11-07：bili 2.5.0 面板在挂载时会用 window.addEventListener（焦点刷新），桩里补上
    addEventListener() {}, removeEventListener() {},
  }
  globalThis.self = globalThis.window
  globalThis.document = {
    createElement: () => ({ setAttribute() {}, style: {} }),
    head: { appendChild() {} },
  }
  new Function('window', 'self', 'document', src)(globalThis.window, globalThis.window, globalThis.document)
  loads.length === 1 && loads[0].id === 'dsh-video-scroll'
    ? ok("ModuleLoader id = dsh-video-scroll")
    : bad(`load 调用异常: ${loads.length} 次 / id=${loads[0]?.id}`)
  const registrations = []
  const slots = {
    inject: (slotName, reg) => { registrations.push(['inject', slotName]); try { reg?.() } catch { /* 惰性注册回调里可能要真渲染，桩里允许失败 */ } },
    register: (opts) => registrations.push(['register', opts.name, opts.id, opts.label]),
  }
  const ctx = new Proxy({ get: (n) => (n === 'slots' ? slots : undefined), effect: () => {} }, {
    get(t, k) { if (k === 'get') return (n) => (n === 'slots' ? slots : undefined); const v = t[k]; return typeof v === 'function' ? v.bind(t) : v },
  })
  const part = loads[0].factory((name) => { if (name === 'react') return fakeReact; throw new Error('unexpected require ' + name) })
  part.apply(ctx)
  const registers = registrations.filter((r) => r[0] === 'register')
  const unified = registers.find((r) => r[2] === 'video-scroll' && r[3] === '刷视频插件')
  unified ? ok(`设置页只注册统一入口「刷视频插件」（id video-scroll）`) : bad(`统一入口未注册: ${JSON.stringify(registers)}`)
  const leaked = registers.filter((r) => r[2] === 'bili-scroll' || r[2] === 'douyin-scroll')
  leaked.length === 0 ? ok('旧的「刷B站」「刷抖音」独立设置页已隐藏（不再单独注册）') : bad(`旧面板泄漏: ${leaked.map((l) => l[2]).join(', ')}`)
  const conv = registrations.some((r) => r[0] === 'inject' && r[1] === 'conversation.view')
  conv ? ok('bili 会话页签（conversation.view）原样放行') : ok('（无会话页签注册）')
  src.includes('在浏览器打开综合面板') && src.includes('/join')
    ? ok('落地页带「浏览器打开综合面板」跳转按钮')
    : bad('落地页缺浏览器跳转按钮')
  delete globalThis.window; delete globalThis.self; delete globalThis.document
}

console.log('5) 浏览器综合面板（console/）')
{
  const { startConsole } = await import('./console/server.mjs')
  typeof startConsole === 'function' ? ok('console/server.mjs 导出 startConsole') : bad('startConsole 缺失')
  for (const f of ['console/shell.html', 'console/app.js', 'console/vendor/react.production.min.js', 'console/vendor/react-dom.production.min.js']) {
    existsSync(join(pkgDir, f)) ? ok(f) : bad(`缺文件: ${f}`)
  }
  const appJs = readFileSync(join(pkgDir, 'console', 'app.js'), 'utf8')
  appJs.includes('settings.section') && appJs.includes('createRoot') && appJs.includes('bili') && appJs.includes('douyin')
    ? ok('app.js 含两个面板的挂载与渲染')
    : bad('app.js 内容不完整')
  for (const sub of ['bili', 'douyin']) {
    const t = readFileSync(join(pkgDir, sub, 'index.js'), 'utf8')
    t.includes('__videoScrollConsole') && t.includes('handle,')
      ? ok(`${sub} 桥接钩子带 handle（API 代理就绪）`)
      : bad(`${sub} 桥接钩子缺 handle`)
  }
}

console.log('6) node --check 全部 js/mjs')
const jsFiles = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'chrome-profile') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p)
    else if (/\.(js|mjs|cjs)$/.test(name)) jsFiles.push(p)
  }
}
walk(pkgDir)
let syntaxBad = 0
for (const f of jsFiles) {
  const r = spawnSync(process.execPath, ['--check', f], { stdio: 'pipe' })
  if (r.status !== 0) { syntaxBad += 1; bad(`--check 失败: ${f}\n${r.stderr}`) }
}
syntaxBad === 0 ? ok(`${jsFiles.length} 个 js/mjs 全部通过`) : null

console.log('7) Python 脚本编译')
const pyFiles = []
for (const sub of ['bili', 'douyin']) walkPy(join(pkgDir, sub))
function walkPy(dir) {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { if (name !== '.venv' && name !== '.venv-asr' && name !== '__pycache__') walkPy(p) }
    else if (name.endsWith('.py')) pyFiles.push(p)
  }
}
const py = spawnSync('python', ['--version'], { stdio: 'pipe' })
if (py.status !== 0) {
  console.log('  - 机器上没有 python，跳过（插件运行时会自己装 uv/python）')
} else {
  let pyBad = 0
  for (const f of pyFiles) {
    const r = spawnSync('python', ['-m', 'py_compile', f], { stdio: 'pipe' })
    if (r.status !== 0) { pyBad += 1; bad(`py_compile 失败: ${f}`) }
  }
  pyBad === 0 ? ok(`${pyFiles.length} 个 .py 全部通过`) : null
}

console.log(failed === 0 ? '\nselfcheck 全部通过 ✓' : `\nselfcheck 有 ${failed} 项失败 ✗`)
process.exit(failed === 0 ? 0 : 1)
