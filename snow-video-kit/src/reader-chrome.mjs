/**
 * reader-chrome.mjs —— 「看小说 / 看贴吧」专用浏览器底座（⭐ 2026-11-07）
 * ============================================================================
 * 从 dsh-video-scroll/douyin/lib/chrome.mjs（MIT，同仓库）移植的核心，
 * 改动三点：① 独立 profile（snow-video-kit/data/reader-profile——贴吧登录态存这里，
 * 不和抖音值班会话抢 user-data-dir）；② 独立端口段 9434–9473；
 * ③ 运行时状态写 data/reader-runtime.json。另加 visibleLogin（可见窗口登录一次）。
 *
 * 规矩沿袭：任何脚本都不许自己 new WebSocket 或写死 chrome.exe。
 * ============================================================================
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const KIT_DIR = join(HERE, '..')
const PROFILE = join(KIT_DIR, 'data', 'reader-profile')
const RUNTIME = join(KIT_DIR, 'data', 'reader-runtime.json')

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const readRuntime = () => { try { return JSON.parse(readFileSync(RUNTIME, 'utf8')) || {} } catch { return {} } }
const writeRuntime = (patch) => { try { mkdirSync(join(KIT_DIR, 'data'), { recursive: true }); writeFileSync(RUNTIME, JSON.stringify({ ...readRuntime(), ...patch }, null, 1)) } catch { /* 忽略 */ } }

/* ── ① 找浏览器：READER_BROWSER → Chrome → Edge → Chromium ── */
const CANDIDATES = () => {
  const out = []
  const env = String(process.env.READER_BROWSER || '').trim()
  if (env) out.push(env)
  if (process.platform === 'win32') {
    for (const r of [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA, 'C:\\Program Files', 'C:\\Program Files (x86)', 'D:\\Program Files'].filter(Boolean)) {
      out.push(join(r, 'Google', 'Chrome', 'Application', 'chrome.exe'))
      out.push(join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe'))
      out.push(join(r, 'Chromium', 'Application', 'chrome.exe'))
    }
  } else if (process.platform === 'darwin') {
    out.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge')
  } else {
    out.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/microsoft-edge', '/usr/bin/chromium')
  }
  return out
}
export function findBrowser() {
  for (const p of CANDIDATES()) { try { if (p && existsSync(p)) return p } catch { /* 继续 */ } }
  return ''
}

/* ── ② 端口：记住的 → 活着的 → 空闲的（9434–9473）── */
const portFree = (port) => new Promise((res) => { const s = createServer(); s.once('error', () => res(false)); s.once('listening', () => s.close(() => res(true))); s.listen(port, '127.0.0.1') })
const cdpAlive = async (port) => { try { return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok } catch { return false } }
async function pickPort() {
  const remembered = Number(readRuntime().cdpPort || 0)
  if (remembered && await cdpAlive(remembered)) return remembered
  for (let p = 9434; p < 9434 + 40; p++) if (await cdpAlive(p)) { writeRuntime({ cdpPort: p }); return p }
  for (let p = 9434; p < 9434 + 40; p++) if (await portFree(p)) return p
  throw new Error('9434–9473 全被占用，找不到空闲调试端口')
}

/* ── ③ 起无头浏览器（已起就复用）── */
async function ensureChrome({ url = 'https://tieba.baidu.com/' } = {}) {
  const port = await pickPort()
  if (await cdpAlive(port)) { writeRuntime({ cdpPort: port }); return { port, status: 'reused' } }
  const browser = findBrowser()
  if (!browser) throw new Error('找不到可用的浏览器（Chrome / Edge / Chromium）——装一个，或把路径写进环境变量 READER_BROWSER')
  mkdirSync(PROFILE, { recursive: true })
  const p = spawn(browser, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${PROFILE}`, '--window-size=1440,900', '--lang=zh-CN', '--no-first-run', '--no-default-browser-check', url], { stdio: 'ignore', windowsHide: true })
  p.unref?.()
  for (let i = 0; i < 40; i++) { await sleep(500); if (await cdpAlive(port)) { writeRuntime({ cdpPort: port, browser }); return { port, status: 'launched' } } }
  throw new Error('浏览器起来了但 CDP 连不上（60 秒）——查残留进程：Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*reader-profile*" }')
}

/* ── ④ CDP 小客户端 ── */
async function connectPage(port, { targetId } = {}) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const page = targetId ? list.find((t) => t.id === targetId) : list.find((t) => t.type === 'page')
  if (!page) throw new Error('没有可用的 page target（浏览器起来了吗？）')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let id = 0
  const pend = new Map()
  const listeners = new Map()
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', () => rej(new Error('连不上 CDP WebSocket')), { once: true }) })
  ws.addEventListener('message', (e) => {
    let m; try { m = JSON.parse(e.data) } catch { return }
    if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result) }
    for (const fn of listeners.get(m.method) || []) Promise.resolve(fn(m.params)).catch(() => {})
  })
  const send = (method, params = {}) => new Promise((res, rej) => { const mid = ++id; pend.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method, params })) })
  await send('Page.enable')
  await send('Runtime.enable')

  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error('页面里抛错: ' + String(r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 400))
    return r.result?.value
  }

  return { send, ev, close: () => { try { ws.close() } catch { /* 已经关了 */ } } }
}

/** 打开独立页面并导航到 url，等就绪；返回 { send, ev, close } */
export async function readerPage(url, { settleMs = 1500 } = {}) {
  const { port } = await ensureChrome({ url })
  const c = await connectPage(port)
  await c.send('Page.navigate', { url })
  await sleep(settleMs)
  return c
}

/** ⭐ 一次性登录：开一个**可见**的浏览器窗口（同一个 profile），使用者手动登录
 *     贴吧 / 番茄；cookies 会存在 reader-profile 里，之后无头读取直接可用。 */
export function visibleLogin(url = 'https://tieba.baidu.com/') {
  const browser = findBrowser()
  if (!browser) throw new Error('找不到可用的浏览器（Chrome / Edge / Chromium）')
  mkdirSync(PROFILE, { recursive: true })
  const p = spawn(browser, [`--user-data-dir=${PROFILE}`, '--window-size=1200,860', '--no-first-run', '--no-default-browser-check', url], { stdio: 'ignore', windowsHide: false, detached: true })
  p.unref?.()
  return { pid: p.pid, profile: PROFILE }
}
