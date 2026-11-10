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
import { loadConfig, saveConfigPatch, kitLog, recentLogs, STATE_DIR, resolveBili, resolveDouyin, dshHome, KIT_DIR } from '../config.js'
import { KIT_VERSION } from '../version.mjs'
import * as videomem from '../videomem.mjs'
import * as usage from '../usage.mjs'
import { snowStatus } from '../snow.mjs'
import { getBrainKey, setBrainKey, brainConfigured, brainTest, listModels } from '../brain.mjs'
import * as biliEngine from '../bili.mjs'
import * as douyinEngine from '../douyin.mjs'
import { roundState, kickRoundDetached, latestReport, roundsToday } from '../rounds.mjs'
import { readsState, kickReadsDetached, startReaderLogin, novelShelf } from '../reads.mjs'
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

// ── 对接契约用的两样东西：进程启动时刻 + 插件根 metadata.json（只读，无隐私）──
const STARTED_AT = Date.now()

function pluginMetadata() {
  // 先找包内（snow-video-kit/metadata.json，拆出去单独用时），再找上一层（海螺插件目录布局）
  for (const p of [path.join(KIT_DIR, 'metadata.json'), path.join(KIT_DIR, '..', 'metadata.json')]) {
    try { return JSON.parse(readFileSync(p, 'utf8')) } catch { /* 试下一个 */ }
  }
  return {}
}

// 本地时区的 ISO 8601（与 meme-library 的 started_at 同一种写法，方便宿主统一解析）
function isoLocal(ms) {
  const d = new Date(ms)
  const off = -d.getTimezoneOffset()
  const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${off >= 0 ? '+' : '-'}${pad(off / 60)}:${pad(off % 60)}`
}

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
    media: cfg.media || {},
    conchBridge: (() => {
      let personaName = ''
      try {
        const home = cfg.conch?.homeDir || 'D:\\AI\\云端大肥鱼\\海螺'
        personaName = String(JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8')).persona || '')
      } catch { /* 读不到就空 */ }
      return { enabled: cfg.conch?.enabled !== false, personaName }
    })(),
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
    series, usageToday, memoryTotal,
  }
}

// .url 快捷方式自动生成已按用户要求移除（桌面唯一入口 = 刷视频面板一键启动.vbs）
function writeShortcut(port, token) {
  // 桌面快捷方式（放系统桌面；找不到就跳过）
  try {
    // 桌面路径不写死：本机布局是 <桌面>\插件\<插件名>，所以插件目录的上一级就是桌面；
    // 换了机器就退回 ~/Desktop（找不到就跳过写快捷方式，不影响服务）
    const desk = [path.dirname(path.dirname(KIT_DIR)), path.join(os.homedir(), 'Desktop')].find((d) => existsSync(d))
    if (desk) fs.writeFileSync(path.join(desk, '刷视频工作台.url'), `[InternetShortcut]\nURL=http://127.0.0.1:${port}/?token=${token}\n`, 'utf8')
  } catch { /* 忽略 */ }
}

export function startWeb(opts = {}) {
  const cfg = loadConfig()
  const port = Number(opts.port) || cfg.web.port || 8412   // opts.port 只给自检/换端口用，默认仍读 config.json
  // 内嵌综合面板的静态资产来源（dsh-video-scroll 的 console 目录）与其 8390 服务
  const SCROLL_CONSOLE = path.join(path.dirname(KIT_DIR), 'dsh-video-scroll', 'console')
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
    if (!key) return json(res, 503, { ok: false, error: '平台后台没在运行（或连接已失效）。值班轮请用「总览」页。' })
    const target = `http://127.0.0.1:8390${url.pathname}${url.search}`
    const up = { ...req.headers, host: '127.0.0.1:8390', 'x-console-key': key }
    delete up.cookie; delete up.referer; delete up.origin
    const preq = http.request(target, { method: req.method, headers: up }, (pres) => {
      res.writeHead(pres.statusCode || 502, pres.headers)
      pres.pipe(res)
    })
    preq.on('error', () => {
      try { json(res, 503, { ok: false, error: '平台后台没在运行：完整功能（评论/私信）需要它在跑；值班轮请用「总览」页。' }) } catch { /* 忽略 */ }
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
          return json(res, 200, { jsonrpc: '2.0', id: body.id ?? null, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'snow-video-kit', version: KIT_VERSION } } })
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
      // ── 对接契约（只读、无隐私）：探活 + 清单，供任意宿主判断「接得对不对、版本对不对」──
      if (url.pathname === '/api/health' && req.method === 'GET') {
        return json(res, 200, {
          ok: true,
          id: pluginMetadata().id || '',
          version: KIT_VERSION,
          uptime_s: Math.floor((Date.now() - STARTED_AT) / 1000),
        })
      }
      if (url.pathname === '/api/manifest' && req.method === 'GET') {
        return json(res, 200, {
          ok: true,
          metadata: pluginMetadata(),
          runtime: { port, pid: process.pid, started_at: isoLocal(STARTED_AT) },
        })
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
        // 页面上刚填、还没保存的 key/baseUrl/model 也能先验一遍（验通再保存）
        let body = {}
        try { body = await readBody(req) } catch { body = {} }
        try { return json(res, 200, await brainTest(loadConfig(), body || {})) } catch (e) { return json(res, 200, { ok: false, error: String(e?.message || e) }) }
      }
      if (url.pathname === '/api/brain/models' && req.method === 'POST') {
        // 拉取该大脑可用模型列表，页面上未保存的 baseUrl/key 也能先拉
        let mb = {}
        try { mb = await readBody(req) } catch { mb = {} }
        try { return json(res, 200, await listModels(loadConfig(), mb || {})) } catch (e) { return json(res, 200, { ok: false, error: String(e?.message || e) }) }
      }
      if (url.pathname === '/api/reads' && req.method === 'GET') {
        const c = loadConfig()
        let shelf = []
        try { shelf = await novelShelf(c) } catch { /* 拉不到就空书架 */ }
        return json(res, 200, { reads: c.reads || {}, shelf, tiebaState: readsState('tieba'), novelState: readsState('novel') })
      }
      if (url.pathname === '/api/reads' && req.method === 'POST') {
        const body = await readBody(req)
        const reads = { ...(loadConfig().reads || {}) }
        if (typeof body.tiebaEnabled === 'boolean') reads.tiebaEnabled = body.tiebaEnabled
        if (typeof body.novelEnabled === 'boolean') reads.novelEnabled = body.novelEnabled
        if (Array.isArray(body.tiebaForums)) reads.tiebaForums = body.tiebaForums.map((s) => String(s).trim()).filter(Boolean)
        if (body.tiebaPerRound !== undefined && Number.isFinite(Number(body.tiebaPerRound))) reads.tiebaPerRound = Math.max(1, Math.min(20, Number(body.tiebaPerRound)))
        if (Array.isArray(body.novels)) {
          reads.novels = body.novels
            .map((b) => ({ name: String(b.name || '').trim(), url: String(b.url || '').trim() }))
            .filter((b) => b.name && b.url)
        }
        // ⭐ 2026-11-11：家长约束（她读小说的量与熄灯时段）
        if (!reads.novel || typeof reads.novel !== 'object') reads.novel = {}
        const nv = body.novel || {}
        if (typeof nv.chaptersPerSession !== 'undefined') reads.novel.chaptersPerSession = Math.max(1, Math.min(Number(nv.chaptersPerSession) || 3, 20))
        if (typeof nv.chaptersPerDay !== 'undefined') reads.novel.chaptersPerDay = Math.max(1, Math.min(Number(nv.chaptersPerDay) || 6, 50))
        const tRe = /^([01]?\d|2[0-3]):[0-5]\d$/
        if (typeof nv.curfewStart === 'string' && tRe.test(nv.curfewStart)) reads.novel.curfewStart = nv.curfewStart
        if (typeof nv.curfewEnd === 'string' && tRe.test(nv.curfewEnd)) reads.novel.curfewEnd = nv.curfewEnd
        saveConfigPatch({ reads })
        kitLog('阅读配置已更新（工作台）')
        return json(res, 200, { ok: true, reads })
      }
      if (url.pathname === '/api/reads/run' && req.method === 'POST') {
        const body = await readBody(req)
        const kind = body.kind === 'tieba' ? 'tieba' : 'novel'
        return json(res, 200, kickReadsDetached(kind, '工作台手动'))
      }
      if (url.pathname === '/api/reads/login' && req.method === 'POST') {
        const body = await readBody(req)
        const kind = body.kind === 'novel' ? 'novel' : 'tieba'
        try { return json(res, 200, { ok: true, ...startReaderLogin(kind) }) }
        catch (e) { return json(res, 200, { ok: false, error: String(e?.message || e) }) }
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
      // ── 服务台能力（并入工作台）：探活 / 宠物号统计 / 白名单日志尾巴 ──
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
      // ── 看/听 与 桥接（2026-11-08）──
      if (url.pathname === '/api/media' && req.method === 'GET') {
        const c = loadConfig()
        const { loadPersona, loadToneSamples, conchPersonaName, summarizePersona } = await import('../conch-bridge.mjs')
        let info = { ok: false }
        try {
          const p = await loadPersona(c)
          const tone = await loadToneSamples(c, 3)
          info = {
            ok: Boolean(p.text),
            persona: { name: p.name, source: p.source, chars: p.text.length, preview: summarizePersona(p.text, 420) },
            tone,
          }
        } catch (e) { info = { ok: false, error: String(e?.message || e) } }
        return json(res, 200, {
          media: c.media || {},
          conch: { enabled: c.conch?.enabled !== false, url: c.conch?.url, homeDir: c.conch?.homeDir, personaName: conchPersonaName(c) },
          bridge: info,
        })
      }
      if (url.pathname === '/api/media' && req.method === 'POST') {
        const body = await readBody(req)
        const cur = loadConfig().media || {}
        const mode = body.mode === 'deep' ? 'deep' : 'fast'
        const biliN = Math.max(0, Math.min(5, Number(body.biliDeep) || 0))
        const dyN = Math.max(0, Math.min(5, Number(body.douyinDeep) || 0))
        const frames = Math.max(1, Math.min(6, Number(body.frames) || cur.frames || 3))
        const audio = ['auto', 'always', 'off'].includes(body.audio) ? body.audio : (cur.audio || 'auto')
        const enabled = body.conchEnabled === undefined ? (loadConfig().conch?.enabled !== false) : Boolean(body.conchEnabled)
        saveConfigPatch({
          media: { mode, deepPerRound: { bili: biliN, douyin: dyN }, frames, audio },
          conch: { enabled },
        })
        kitLog(`看/听：mode=${mode} B站${biliN}条/抖音${dyN}条 ${frames}帧 audio=${audio}；桥接=${enabled ? '开' : '关'}`)
        return json(res, 200, { ok: true })
      }
      // ── 海螺桥接完整配置（2026-11-09：之前只能在 config.json 手改，UI 补入口）──
      if (url.pathname === '/api/conch' && req.method === 'GET') {
        const c = loadConfig()
        const { conchPersonaName } = await import('../conch-bridge.mjs')
        return json(res, 200, { conch: c.conch || {}, personaName: conchPersonaName(c) })
      }
      if (url.pathname === '/api/conch' && req.method === 'POST') {
        const body = await readBody(req)
        const topics = Array.isArray(body.memoryTopics)
          ? body.memoryTopics.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 12)
          : []
        saveConfigPatch({
          conch: {
            enabled: body.enabled !== false,
            url: String(body.url || '').trim() || 'http://127.0.0.1:7801',
            token: String(body.token || ''),
            homeDir: String(body.homeDir || '').trim(),
            personaFallback: String(body.personaFallback || '').trim(),
            personaMaxChars: Math.max(800, Math.min(12000, Number(body.personaMaxChars) || 4200)), // privacy-ok 字数上限
            toneSamples: Math.max(0, Math.min(10, Number(body.toneSamples) || 0)),
            memoryTopics: topics,
          },
        })
        kitLog(`海螺桥接：enabled=${body.enabled !== false ? '开' : '关'} url=${body.url} 人格topics=${topics.length}个`)
        return json(res, 200, { ok: true })
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

