/**
 * web/server.mjs —— snow-video-kit 工作台（独立网址，全新设计）
 * 只听 127.0.0.1:8412；2026-11-07 起无登录（用户要求删掉登录密码）——本机直接访问，
 * 登录页/会话校验已移除；?token= 入口保留只为种 cookie（兼容老链接），MCP /mcp 仍走令牌。
 */
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadConfig, saveConfigPatch, kitLog, recentLogs, STATE_DIR, resolveBili, resolveDouyin, dshHome } from '../config.js'
import * as videomem from '../videomem.mjs'
import * as usage from '../usage.mjs'
import { snowStatus } from '../snow.mjs'
import { getBrainKey, setBrainKey, brainConfigured, brainTest } from '../brain.mjs'
import * as biliEngine from '../bili.mjs'
import * as douyinEngine from '../douyin.mjs'
import { roundState, kickRoundDetached, latestReport, roundsToday } from '../rounds.mjs'
import { TOOLS } from '../tools.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const UI = path.join(HERE, 'ui.html')
const TOKEN_FILE = path.join(STATE_DIR, 'console-token')

function ensureToken() {
  try { return readFileSync(TOKEN_FILE, 'utf8').trim() } catch {
    const t = randomBytes(12).toString('hex')
    fs.mkdirSync(STATE_DIR, { recursive: true })
    fs.writeFileSync(TOKEN_FILE, t, 'utf8')
    return t
  }
}
let TOKEN = ensureToken()

// 会话 = 工作台令牌本身（cookie/头/查询任一携带即可）——重启不失效，页面不会因服务重启而全灭
// 2026-11-07：登录密码已删（用户要求）——服务只听 127.0.0.1，本机直接访问，不再有登录页/会话门槛。
// cookie/令牌仍被 ?token= 入口正常种下（兼容海螺控制台直链与 x-console-token 头的老用法）。
const maskKey = (k) => (k ? k.slice(0, 6) + '…' + k.slice(-4) + `（${k.length}位）` : '')

function json(res, code, data) { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)) }

function statusSnapshot() {
  const cfg = loadConfig()
  const rb = resolveBili(cfg), rd = resolveDouyin(cfg)
  // 总览增强数据：14 天逐日挑选（跨平台）+ 今日花费 + 记忆总量（全部尽力而为，失败不炸）
  let series = []
  let usageToday = null
  let memoryTotal = null
  try {
    videomem.configureMemory(cfg.memory?.dbPath)
    const db = videomem.open()
    const since = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10)
    const rows = db.prepare("SELECT round_date AS day, platform, COUNT(*) AS n FROM videos WHERE round_date >= ? GROUP BY round_date, platform ORDER BY day").all(since)
    const days = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
      days.push({ day: d, bili: 0, douyin: 0 })
    }
    for (const r of rows) {
      const slot = days.find((x) => x.day === r.day)
      if (slot) slot[r.platform] = (slot[r.platform] || 0) + r.n
    }
    series = days
    memoryTotal = videomem.stats().total
  } catch { /* 总览增强数据失败不致命 */ }
  try {
    const u = usage.summary()
    usageToday = { calls: u.today.calls, tokens: u.today.t, cost: Number(u.today.cost.toFixed(4)) }
  } catch { /* 花费统计失败不致命 */ }
  return {
    now: Date.now(),
    qq: { online: snowStatus().online, selfId: snowStatus().selfId, nick: snowStatus().nick, error: snowStatus().error, lastCheck: snowStatus().lastCheck },
    brain: { baseUrl: cfg.brain.baseUrl, model: cfg.brain.model, enabled: cfg.brain.enabled, configured: brainConfigured(cfg), keyMasked: maskKey(getBrainKey()) },
    bili: biliEngine.biliStatus(cfg, rb),
    douyin: douyinEngine.douyinStatus(cfg, rd),
    rounds: { bili: roundState('bili'), douyin: roundState('douyin') },
    agent: { ...(cfg.agent || {}), roundsToday: roundsToday() },
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
    series, usageToday, memoryTotal,
  }
}

// .url 快捷方式自动生成已按用户要求移除（桌面唯一入口 = 刷视频面板一键启动.vbs）
function writeShortcut(port, token) {
  // 桌面快捷方式（放系统桌面；找不到就跳过）
  try {
    const desk = ['D:\\我的电脑\\桌面', path.join(os.homedir(), 'Desktop')].find((d) => existsSync(d))
    if (desk) fs.writeFileSync(path.join(desk, '刷视频工作台.url'), `[InternetShortcut]\nURL=http://127.0.0.1:${port}/?token=${token}\n`, 'utf8')
  } catch { /* 忽略 */ }
}

export function startWeb() {
  const cfg = loadConfig()
  const port = cfg.web.port || 8412
  // 内嵌综合面板的静态资产来源（dsh-video-scroll 的 console 目录）与其 8390 服务
  const SCROLL_CONSOLE = 'D:\\我的电脑\\桌面\\插件\\刷视频插件\\dsh-video-scroll\\console'
  const STATIC_MAP = {
    '/app.js': { file: path.join(SCROLL_CONSOLE, 'app.js'), type: 'text/javascript; charset=utf-8' },
    '/vendor/react.production.min.js': { file: path.join(SCROLL_CONSOLE, 'vendor', 'react.production.min.js'), type: 'text/javascript; charset=utf-8' },
    '/vendor/react-dom.production.min.js': { file: path.join(SCROLL_CONSOLE, 'vendor', 'react-dom.production.min.js'), type: 'text/javascript; charset=utf-8' },
  }
  const scrollKey = () => { try { return JSON.parse(readFileSync(path.join(dshHome(), 'video-scroll-console.json'), 'utf8')).key || '' } catch { return '' } }
  // 内嵌面板的 API 代理：/api/bili-duty|douyin-duty/* → 8390（DSH 插件进程，全功能）
  // 例外：*/run 拦下来走本包引擎（key 大脑），保证值班轮永远脱离 DSH
  function proxyToScroll(req, res, url) {
    const kind = url.pathname.startsWith('/api/bili-duty') ? 'bili' : 'douyin'
    if (url.pathname.endsWith('/run')) {
      const r = kickRoundDetached(kind, '综合面板')
      return json(res, 200, { ok: Boolean(r.ok), started: Boolean(r.ok), detail: r.detail || r.reason || '', error: r.ok ? undefined : r.reason })
    }
    const key = scrollKey()
    if (!key) return json(res, 503, { ok: false, error: '综合面板依赖 DSH：当前 DSH 未运行（或 key 丢失）。值班轮请用「总览」页。' })
    const target = `http://127.0.0.1:8390${url.pathname}${url.search}`
    const up = { ...req.headers, host: '127.0.0.1:8390', 'x-console-key': key }
    delete up.cookie; delete up.referer; delete up.origin
    const preq = http.request(target, { method: req.method, headers: up }, (pres) => {
      res.writeHead(pres.statusCode || 502, pres.headers)
      pres.pipe(res)
    })
    preq.on('error', () => {
      try { json(res, 503, { ok: false, error: 'DSH 未运行：完整面板功能（扫码/评论/私信）需要 DSH 在跑；值班轮请用「总览」页。' }) } catch { /* 忽略 */ }
    })
    req.pipe(preq)
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${port}`)
      // ── QQ 智能体接入：无状态 HTTP MCP（POST /mcp；令牌 = 工作台令牌）──
      if (url.pathname === '/mcp' && req.method === 'POST') {
        const tok = url.searchParams.get('token') || req.headers['x-console-token'] || ''
        if (tok !== TOKEN) return json(res, 403, { error: '令牌不对（用工作台令牌：?token= 或 x-console-token 头）' })
        const body = await readBody(req)
        const { name, arguments: args } = body.params || {}
        if (body.method === 'initialize') {
          return json(res, 200, { jsonrpc: '2.0', id: body.id ?? null, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'snow-video-kit', version: '0.3.0' } } })
        }
        if (body.method === 'notifications/initialized' || body.method === 'notifications/cancelled') {
          res.writeHead(202); return res.end()
        }
        if (body.method === 'tools/list') {
          const { TOOLS } = await import('../tools.mjs')
          return json(res, 200, { jsonrpc: '2.0', id: body.id ?? null, result: { tools: TOOLS } })
        }
        if (body.method === 'tools/call') {
          const { callTool } = await import('../tools.mjs')
          try {
            const text = await callTool(name, args || {})
            return json(res, 200, { jsonrpc: '2.0', id: body.id ?? null, result: { content: [{ type: 'text', text: String(text) }], isError: false } })
          } catch (e) {
            return json(res, 200, { jsonrpc: '2.0', id: body.id ?? null, result: { content: [{ type: 'text', text: '工具执行出错：' + String(e?.message || e) }], isError: true } })
          }
        }
        if (body.method === 'ping') return json(res, 200, { jsonrpc: '2.0', id: body.id ?? null, result: {} })
        return json(res, 200, { jsonrpc: '2.0', id: body.id ?? null, error: { code: -32601, message: 'method not found: ' + body.method } })
      }
      // ?token= 兼容入口（海螺控制台链接带令牌）：种个 cookie 即放行；2026-11-07 起登录密码已删，
      // 服务只听 127.0.0.1，本机访问一律直接进（不再有登录页/令牌校验门槛）。
      if (url.searchParams.get('token')) {
        res.setHeader('set-cookie', `vsk_sess=${TOKEN}; Path=/; SameSite=Strict; Max-Age=31536000`)
      }
      // 页面
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        return res.end(readFileSync(UI))
      }
      // API
      if (url.pathname === '/api/status' && req.method === 'GET') return json(res, 200, statusSnapshot())
      if (url.pathname === '/api/logs' && req.method === 'GET') return json(res, 200, { lines: recentLogs(80) })
      if (url.pathname === '/api/tools' && req.method === 'GET') return json(res, 200, { tools: TOOLS })
      if (url.pathname === '/api/report' && req.method === 'GET') {
        const kind = url.searchParams.get('kind') === 'douyin' ? 'douyin' : 'bili'
        return json(res, 200, latestReport(kind))
      }
      if (url.pathname === '/api/run' && req.method === 'POST') {
        const body = await readBody(req)
        const kind = body.kind === 'douyin' ? 'douyin' : 'bili'
        const r = kickRoundDetached(kind, '工作台手动')
        return json(res, 200, r)
      }
      if (url.pathname === '/api/brain' && req.method === 'GET') {
        const s = statusSnapshot(); return json(res, 200, { brain: { ...s.brain, keySet: Boolean(getBrainKey()) } })
      }
      if (url.pathname === '/api/brain' && req.method === 'POST') {
        const body = await readBody(req)
        const patch = {}
        if (typeof body.baseUrl === 'string' && body.baseUrl.trim()) patch.brain = { ...(patch.brain || {}), baseUrl: body.baseUrl.trim() }
        if (typeof body.model === 'string' && body.model.trim()) patch.brain = { ...(patch.brain || {}), model: body.model.trim() }
        if (typeof body.enabled === 'boolean') patch.brain = { ...(patch.brain || {}), enabled: body.enabled }
        if (patch.brain) saveConfigPatch(patch)
        if (typeof body.key === 'string' && body.key.trim()) setBrainKey(body.key.trim())
        kitLog('大脑配置已更新（工作台）')
        const s = statusSnapshot(); return json(res, 200, { ok: true, brain: { ...s.brain, keySet: Boolean(getBrainKey()) } })
      }
      if (url.pathname === '/api/brain/test' && req.method === 'POST') {
        try { return json(res, 200, await brainTest(loadConfig())) } catch (e) { return json(res, 200, { ok: false, error: String(e?.message || e) }) }
      }
      if (url.pathname === '/api/memory' && req.method === 'GET') {
        const vm = await import('../videomem.mjs')
        vm.configureMemory(cfg.memory?.dbPath)
        return json(res, 200, {
          stats: vm.stats(),
          recent: vm.recent({ platform: url.searchParams.get('platform') || '', q: url.searchParams.get('q') || '', days: Number(url.searchParams.get('days')) || 30, limit: Number(url.searchParams.get('limit')) || 100 }),
        })
      }
      if (url.pathname === '/api/memory/query' && req.method === 'POST') {
        const vm = await import('../videomem.mjs')
        vm.configureMemory(cfg.memory?.dbPath)
        const body = await readBody(req)
        try { return json(res, 200, { ok: true, rows: vm.queryReadOnly(String(body.sql || '')) }) } catch (e) { return json(res, 400, { ok: false, error: String(e?.message || e) }) }
      }
      if (url.pathname === '/api/usage' && req.method === 'GET') {
        const { summary } = await import('../usage.mjs')
        return json(res, 200, summary())
      }
      if (url.pathname === '/api/pricing' && req.method === 'POST') {
        const body = await readBody(req)
        const models = {}
        for (const [model, p] of Object.entries(body.models || {})) {
          if (typeof model === 'string' && model.trim()) models[model.trim()] = { input: Number(p.input) || 0, output: Number(p.output) || 0 }
        }
        saveConfigPatch({ pricing: { models, default: { input: Number(body.default?.input) || 0, output: Number(body.default?.output) || 0 } } })
        kitLog('价格表已更新（工作台）')
        return json(res, 200, { ok: true })
      }
      // ── 服务台能力（并入工作台）：探活 / 大肥鱼统计 / 白名单日志尾巴 ──
      if (url.pathname === '/api/services' && req.method === 'GET') {
        const { probeAll } = await import('../services.mjs')
        return json(res, 200, await probeAll())
      }
      if (url.pathname === '/api/bot' && req.method === 'GET') {
        const { botStats } = await import('../services.mjs')
        return json(res, 200, botStats())
      }
      if (url.pathname === '/api/log' && req.method === 'GET') {
        const { tailLog } = await import('../services.mjs')
        return json(res, 200, tailLog(url.searchParams.get('id') || 'kit', Number(url.searchParams.get('lines')) || 40))
      }
      if (url.pathname === '/api/agent' && req.method === 'GET') {
        const c = loadConfig()
        return json(res, 200, { agent: { ...(c.agent || {}), roundsToday: roundsToday() } })
      }
      if (url.pathname === '/api/agent' && req.method === 'POST') {
        const body = await readBody(req)
        saveConfigPatch({ agent: { freeRun: Boolean(body.freeRun), maxRoundsPerDay: Math.max(0, Number(body.maxRoundsPerDay) || 0), maxCostPerDay: Math.max(0, Number(body.maxCostPerDay) || 0) } })
        kitLog(`她想刷就刷：freeRun=${Boolean(body.freeRun)} 轮/日=${body.maxRoundsPerDay || 0} 花费/日=${body.maxCostPerDay || 0}`)
        return json(res, 200, { ok: true })
      }
      // ── 检查更新 / 一键更新（git 仓库：pull --ff-only → 自动重启服务）──
      if (url.pathname === '/api/update/check' && req.method === 'POST') {
        const { checkAndRecord } = await import('../updater.mjs')
        return json(res, 200, checkAndRecord())
      }
      if (url.pathname === '/api/update/run' && req.method === 'POST') {
        const { runUpdate } = await import('../updater.mjs')
        return json(res, 200, runUpdate())
      }
      if (url.pathname === '/api/update/status' && req.method === 'GET') {
        const { currentVersion, gitHead, updateState } = await import('../updater.mjs')
        return json(res, 200, { version: currentVersion(), head: gitHead(), ...updateState() })
      }
      if (url.pathname === '/api/quit' && req.method === 'POST') {
        json(res, 200, { ok: true }); kitLog('工作台收到退出指令')
        setTimeout(() => process.exit(0), 200); return
      }
      // ── 内嵌综合面板：静态资产 + API 代理（见 startWeb 顶部的 SCROLL_CONSOLE/proxyToScroll）──
      if (req.method === 'GET' && url.pathname === '/panel.html') {
        const f = path.join(SCROLL_CONSOLE, 'shell.html')
        if (!existsSync(f)) return json(res, 404, { error: 'shell.html 缺失（dsh-video-scroll 目录被移动？）' })
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        return res.end(readFileSync(f))
      }
      if (req.method === 'GET' && STATIC_MAP[url.pathname]) {
        const s = STATIC_MAP[url.pathname]
        if (!existsSync(s.file)) return json(res, 404, { error: '缺失 ' + s.file })
        res.writeHead(200, { 'content-type': s.type, 'cache-control': 'no-store' })
        return res.end(readFileSync(s.file))
      }
      if ((url.pathname.startsWith('/api/bili-duty/') || url.pathname.startsWith('/api/douyin-duty/'))) {
        return proxyToScroll(req, res, url)
      }
      return json(res, 404, { error: 'not found' })
    } catch (e) {
      try { json(res, 500, { error: String(e?.message || e) }) } catch { /* 忽略 */ }
    }
  })
  server.on('error', (e) => kitLog('工作台端口失败：' + String(e?.message || e)))
  server.listen(port, '127.0.0.1', () => {
    kitLog(`工作台已上线: http://127.0.0.1:${port}（令牌见 state/console-token，桌面快捷方式已刷新）`)
    // writeShortcut 已停用（桌面只留一键启动 VBS）；如需恢复把下一行解注释
    // writeShortcut(port, TOKEN)
  })
  return () => server.close()
}

function readBody(req) {
  return new Promise((resolve) => {
    let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { resolve(JSON.parse(d || '{}')) } catch { resolve({}) } })
  })
}

