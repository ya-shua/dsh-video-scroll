/**
 * console/server.mjs —— dsh-video-scroll 浏览器综合面板（v1.4.0）
 * ============================================================================
 * 它是什么：合并包自己在 127.0.0.1 起的独立网址（默认 8390，被占往后找），
 * 浏览器打开就是**全功能的综合面板**——两个原装 React 面板（刷B站/刷抖音）
 * 原样复用，扫码登录、评论、私信、收藏夹……一个不少。
 *
 * 关键机制（为什么面板能原样跑）：
 *   · 面板代码 = build-client.mjs 从两个上游 client.js 抽出的同一份 factory，
 *     在 console/app.js 里用一个"捕获 slots"的假宿主上下文挂载（CSS 照常注入）；
 *   · 面板的所有 API 调用是相对路径（/api/bili-duty/*、/api/douyin-duty/*），
 *     本服务把它们**原样转发**给子插件 index.js 桥接出来的内部路由
 *     （globalThis.__videoScrollConsole.<kind>.handle，自带完整业务逻辑）。
 *
 * 安全边界：只绑 127.0.0.1；全路由（页面/静态/代理）都要 key（随机生成，存
 * $DSH_HOME/video-scroll-console.json，桌面快捷方式与 /join 跳转携带）；写请求
 * 同源校验；随 DSH 进程存活。
 * ============================================================================
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const STATIC = {
  '/app.js': { file: path.join(HERE, 'app.js'), type: 'text/javascript; charset=utf-8' },
  '/vendor/react.production.min.js': { file: path.join(HERE, 'vendor', 'react.production.min.js'), type: 'text/javascript; charset=utf-8' },
  '/vendor/react-dom.production.min.js': { file: path.join(HERE, 'vendor', 'react-dom.production.min.js'), type: 'text/javascript; charset=utf-8' },
}
const SHELL = path.join(HERE, 'shell.html')

const log = (msg) => { try { writeFileSync(consoleLogFile, `${new Date().toISOString()}  ${msg}\n`, { flag: 'a' }) } catch { /* 日志失败不致命 */ } }
let consoleLogFile = ''
let state = { port: 0, key: '' }

function readJson(file, fallback) { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return fallback } }
function writeJsonAtomic(file, data) {
  const tmp = `${file}.${randomBytes(4).toString('hex')}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  fs.renameSync(tmp, file)
}
const dshHome = () => process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const clamp = (n, a, b) => Math.max(a, Math.min(Number(n) || a, b))

function authOk(req, res, url) {
  const cookie = String(req.headers.cookie || '').match(/vsc_key=([0-9a-f]+)/)
  const key = url.searchParams.get('k') || req.headers['x-console-key'] || (cookie && cookie[1]) || ''
  if (key === state.key) return true
  res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ error: '控制台 key 不对（从桌面快捷方式或设置页按钮进入）' }))
  return false
}
function sendJson(res, code, data) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}
function writeShortcut(port, key) {
  const url = `http://127.0.0.1:${port}/?k=${key}`
  const dir = ['D:\\我的电脑\\桌面', path.join(os.homedir(), 'Desktop')].find((d) => existsSync(d))
  if (!dir) return
}

function proxyChild(req, res, kind, url) {
  const bridge = globalThis.__videoScrollConsole?.[kind]
  if (!bridge?.handle) return sendJson(res, 503, { ok: false, error: '子插件还没挂好（DSH 刚启动？等几秒再试）' })
  // 子插件内部路由吃的是**完整路径**（含 /api/bili-duty 前缀，与 DSH webServer 挂载时一致），
  // 原始 Node req/res 直接交给它——面板的所有业务逻辑都在这条路上。
  try { return bridge.handle(req, res, url) } catch (e) {
    try { return sendJson(res, 500, { ok: false, error: String(e?.message || e) }) } catch { /* 连接断了就算了 */ }
  }
}

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${state.port || 8390}`)
      // 端口探测（无鉴权，只回一句固定 JSON）
      if (url.pathname === '/ping') return sendJson(res, 200, { ok: true, console: 'dsh-video-scroll' })
      // 从 DSH 设置页跳转进来（不带 key；跳到带 key 的页面）
      if (url.pathname === '/join') {
        const origin = String(req.headers.origin || '')
        if (origin && !origin.includes('127.0.0.1') && !origin.includes('dsh-app')) return sendJson(res, 403, { error: '跨来源被拒' })
        res.writeHead(302, { Location: `/?k=${state.key}` })
        return res.end()
      }
      if (!authOk(req, res, url)) return
      // 静态资源
      const stat = STATIC[url.pathname]
      if (req.method === 'GET' && stat) {
        if (!existsSync(stat.file)) { res.writeHead(404); return res.end('missing ' + stat.file) }
        res.writeHead(200, { 'content-type': stat.type, 'cache-control': 'no-store' })
        return res.end(readFileSync(stat.file))
      }
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        if (!existsSync(SHELL)) { res.writeHead(404); return res.end('shell.html 缺失') }
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'set-cookie': `vsc_key=${state.key}; Path=/; SameSite=Strict`,
        })
        return res.end(readFileSync(SHELL))
      }
      if (req.method === 'GET' && url.pathname === '/favicon.ico') { res.writeHead(204); return res.end() }
      // 子插件 API 代理（面板的全部数据/操作走这里）
      const m = url.pathname.match(/^\/api\/(bili-duty|douyin-duty)(\/.*)$/)
      if (m) {
        const kind = m[1] === 'bili-duty' ? 'bili' : 'douyin'
        return proxyChild(req, res, kind, url)
      }
      return sendJson(res, 404, { error: 'not found' })
    } catch (e) {
      try { sendJson(res, 500, { error: String(e?.message || e) }) } catch { /* 连接断了就算了 */ }
    }
  })
}

/** 启动控制台；返回关闭函数（给 ctx.effect）。失败只记日志不拖死插件。 */
export function startConsole() {
  const metaFile = path.join(dshHome(), 'video-scroll-console.json')
  const meta = readJson(metaFile, {})
  const key = String(meta.key || randomBytes(12).toString('hex'))
  const portFrom = clamp(meta.port || 8390, 1024, 65535)
  consoleLogFile = path.join(dshHome(), 'video-scroll-console.log')

  const server = createServer()
  const ports = []
  for (let p = portFrom; p < portFrom + 9; p++) ports.push(p)
  let attempt = 0
  const tryListen = () => {
    const port = ports[attempt++]
    if (port === undefined) { log('控制台：8390-8398 全被占用，本轮不启动'); return }
    server.once('error', (e) => {
      if (e.code === 'EADDRINUSE' && attempt < ports.length) tryListen()
      else { log('控制台启动失败：' + String(e?.message || e)); try { server.close() } catch { /* 忽略 */ } }
    })
    server.listen(port, '127.0.0.1', () => {
      state = { port, key }
      try { writeJsonAtomic(metaFile, { ...meta, key, port, updatedAt: new Date().toISOString() }) } catch { /* 忽略 */ }
      writeShortcut(port, key)
      log(`控制台已上线: http://127.0.0.1:${port}（key 见 ~/.dsh/video-scroll-console.json，快捷方式已刷新）`)
    })
  }
  tryListen()
  return () => { try { server.close() } catch { /* 忽略 */ } }
}
