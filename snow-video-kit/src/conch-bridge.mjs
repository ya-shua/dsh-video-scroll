/**
 * conch-bridge.mjs —— 把「她」带进刷视频值班轮
 * ============================================================================
 * 三样东西，全部**只读**、全部**有超时**、全部**可降级**：
 *
 *   ① 人设   HTTP  GET 海螺 7801 /api/roles/{当前人格}
 *                  人格名从海螺自己的 config.json 读（panel 的 persona 字段）
 *                  30 分钟缓存；海螺挂了就用缓存，再退 douyin-duty/persona.md
 *   ② 语气   HTTP  GET 海螺 7801 /api/messages       取她真实说过的几句话当样本
 *   ③ 记忆   stdio 环形的心 mcp/server.mjs           ring_recall / ring_overview
 *
 * 设计铁律：
 *   · 任何一环失败都**只丢那一块**，绝不抛错拖垮值班轮
 *   · 不写海螺、不写环形的心（记忆写入仍走 ring-ingest.mjs 那条独立的路）
 *   · 人设按「节」抽（称呼/档案/打字/对话风格/语气/铁律），不硬截断
 * ============================================================================
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { kitLog, stateRead, stateWrite } from './config.js'
import { McpStdio } from './mcpclient.mjs'

const KIT_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const CACHE_NAME = 'conch-bridge-cache.json'
const PERSONA_TTL = 30 * 60 * 1000
const DEFAULT_CONCH_DIR = 'D:\\AI\\云端大肥鱼\\海螺'

const conchDir = (cfg) => cfg.conch?.homeDir || DEFAULT_CONCH_DIR
const conchBase = (cfg) => String(cfg.conch?.url || 'http://127.0.0.1:7801').replace(/\/+$/, '')

async function conchGet(cfg, p, timeoutMs = 2500) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const headers = {}
    if (cfg.conch?.token) headers['x-console-token'] = String(cfg.conch.token)
    const r = await fetch(conchBase(cfg) + p, { signal: ctrl.signal, headers })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return await r.json()
  } finally { clearTimeout(timer) }
}

/** 当前人格名：读海螺 config.json（本机同盘，最稳），读不到退回配置 */
export function conchPersonaName(cfg) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(conchDir(cfg), 'config.json'), 'utf8'))
    if (j?.persona) return String(j.persona)
  } catch { /* 用配置兜底 */ }
  return String(cfg.conch?.persona || 'default')
}

/** 按小节挑「说话用得上的部分」；挑不到就取前 maxChars 字 */
export function summarizePersona(text, maxChars = 4200) {
  const s = String(text || '').trim()
  if (!s) return ''
  if (s.length <= maxChars) return s
  const lines = s.split(/\r?\n/)
  const sections = []
  let cur = { title: '', lines: [] }
  for (const line of lines) {
    if (/^═{3,}.*═{3,}\s*$/.test(line.trim()) && line.includes('═══')) {
      if (cur.title || cur.lines.length) sections.push(cur)
      cur = { title: line.trim(), lines: [line] }
    } else cur.lines.push(line)
  }
  if (cur.title || cur.lines.length) sections.push(cur)
  const KEEP = ['第零条', '档案', '家庭', '打字', '对话风格', '语气', '铁律', '称呼']
  const picked = sections.filter((x) => KEEP.some((k) => x.title.includes(k)))
  const body = (picked.length ? picked : sections).map((x) => x.lines.join('\n')).join('\n\n').trim()
  return body.length <= maxChars ? body : body.slice(0, maxChars) + '\n…（其余省略）'
}

/** 人设：海螺 → 缓存 → 本地文件 → 上次缓存 → 空 */
export async function loadPersona(cfg) {
  const name = conchPersonaName(cfg)
  const cache = stateRead(CACHE_NAME, {})
  const cached = cache.persona
  if (cached && cached.name === name && Date.now() - (cached.fetchedAt || 0) < PERSONA_TTL) {
    return { name, text: cached.text, source: 'cache' }
  }
  try {
    const j = await conchGet(cfg, '/api/roles/' + encodeURIComponent(name))
    if (j?.ok && j.content) {
      const text = String(j.content)
      stateWrite(CACHE_NAME, { ...cache, persona: { name, text, fetchedAt: Date.now() } })
      return { name, text, source: 'conch' }
    }
  } catch (e) { kitLog('桥接：读海螺人设失败 → ' + e.message) }

  const fallbacks = [
    cfg.conch?.personaFallback,
    path.join(os.homedir(), '.dsh', 'douyin-duty', 'persona.md'),
  ].filter(Boolean)
  for (const f of fallbacks) {
    try {
      const t = fs.readFileSync(f, 'utf8')
      if (t.trim()) return { name, text: t, source: 'file' }
    } catch { /* 下一个 */ }
  }
  if (cached?.text) return { name, text: cached.text, source: 'stale-cache' }
  return { name, text: '', source: 'none' }
}

/** 语气样本：她在 owner 私聊里说过的原话（最近的 3 句左右） */
export async function loadToneSamples(cfg, n = 3) {
  try {
    const [convs, settings] = await Promise.all([
      conchGet(cfg, '/api/messages/convs'),
      conchGet(cfg, '/api/settings').catch(() => null),
    ])
    const owner = String(settings?.owner_qq || '')
    const list = convs?.convs || []
    const conv = list.find((c) => owner && c.conv_id === 'private:' + owner)?.conv_id || list[0]?.conv_id
    if (!conv) return []
    const j = await conchGet(cfg, `/api/messages?conv=${encodeURIComponent(conv)}&limit=60`)
    const rows = j?.messages || []
    const outs = rows
      .filter((m) => m.direction === 'out')
      .map((m) => String(m.text || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t.length >= 6 && t.length <= 120
        && !/^\[表情/.test(t)
        && !/[✓✔]\s*已发到|已发送到|已发到「/.test(t))
    return [...new Set(outs)].slice(0, Math.max(0, n))
  } catch (e) {
    kitLog('桥接：语气样本读取失败 → ' + e.message)
    return []
  }
}

/* ── 记忆：环形的心（stdio MCP，进程内复用） ───────────────────── */

let ring = null

export function ringServerPath(cfg) {
  if (cfg.ring?.mcpServer) return cfg.ring.mcpServer
  // kit 在 桌面\插件\刷视频插件\snow-video-kit，环形的心 在 桌面\插件\环形的心 —— 上跳两级
  return path.join(path.dirname(path.dirname(KIT_DIR)), '环形的心', 'mcp', 'server.mjs')
}

async function ringClient(cfg) {
  const p = ringServerPath(cfg)
  if (!fs.existsSync(p)) return null
  if (!ring) {
    const env = { PYTHONUTF8: '1' }
    if (cfg.ring?.dbPath) env.RING_DB = cfg.ring.dbPath
    ring = new McpStdio({
      command: process.execPath, args: [p],
      cwd: path.dirname(path.dirname(p)), name: 'ring', env,
    })
  }
  await ring.ensureReady(15000)
  return ring
}

export function stopRing() {
  try { ring?.stop?.() } catch { /* 忽略 */ }
  ring = null
}

/** 记忆片段：按由头想起 + 记忆库概况；合计限 1600 字 */
export async function loadMemory(cfg, { cues = [] } = {}) {
  let c
  try { c = await ringClient(cfg) } catch (e) {
    kitLog('桥接：环形的心起不来 → ' + e.message)
    return ''
  }
  if (!c) return ''
  const parts = []
  const cueList = (cues.length ? cues : (cfg.conch?.memoryTopics || [])).slice(0, 6)
  if (cueList.length) {
    try {
      const r = await c.call('ring_recall', { cues: cueList, limit: 5 }, 20000)
      if (!r.isError && r.text.trim()) parts.push('（想起来的事）\n' + r.text.trim())
    } catch (e) { kitLog('桥接：ring_recall 失败 → ' + e.message) }
  }
  try {
    const r2 = await c.call('ring_overview', {}, 20000)
    if (!r2.isError && r2.text.trim()) parts.push('（记忆库概况）\n' + r2.text.trim())
  } catch (e) { kitLog('桥接：ring_overview 失败 → ' + e.message) }
  return parts.join('\n\n').slice(0, 1600)
}

/**
 * 一轮要用到的全部上下文。
 * @param {object} cfg
 * @param {object} opts { cues?: string[] }  由头（默认用 cfg.conch.memoryTopics）
 */
export async function buildContext(cfg, { cues = [] } = {}) {
  if (cfg.conch?.enabled === false) return { enabled: false, personaText: '', tone: [], memory: '' }
  const out = { enabled: true, persona: null, personaText: '', tone: [], memory: '', errors: [] }
  try {
    const p = await loadPersona(cfg)
    out.persona = { name: p.name, source: p.source }
    out.personaText = summarizePersona(p.text, cfg.conch?.personaMaxChars || 4200)
    if (p.source === 'none') out.errors.push('人设没读到')
  } catch (e) { out.errors.push('人设：' + e.message) }
  try { if ((cfg.conch?.toneSamples ?? 0) > 0) out.tone = await loadToneSamples(cfg, cfg.conch.toneSamples) } catch (e) { out.errors.push('语气：' + e.message) }
  try { out.memory = await loadMemory(cfg, { cues }) } catch (e) { out.errors.push('记忆：' + e.message) }
  if (out.errors.length) kitLog('桥接（降级）：' + out.errors.join('；'))
  return out
}

/** 把上下文拼成提示词块（没东西就返回空串，调用方直接 filter(Boolean)） */
export function bridgePromptBlock(b, { kind = '' } = {}) {
  if (!b || b.enabled === false) return ''
  const parts = []
  if (b.personaText) parts.push('─── 你是谁（这一轮你就是她，不是扮演她）───\n' + b.personaText)
  if (b.memory) parts.push('─── 你记得的、跟这次有关的事 ───\n' + b.memory)
  if (b.tone?.length) parts.push('─── 你以前说过的话（只是提醒你自己的说话习惯，别照抄、别硬套）───\n' + b.tone.map((t) => '· ' + t).join('\n'))
  if (parts.length) {
    parts.push(
      '这些视频是**你自己在看**。写不写、写几条、写多长，你自己定——觉得有东西就写你自己的话，'
      + '觉得没意思就略过，不用凑数，也不用为了"像谁"去演语气。\n'
      + '唯一硬要求是格式：每条以 `### <ID>` 开头，后面跟 `**档位**：…` 那一行（程序靠它数配额、筛清单）。\n'
      + '如果你看完觉得这轮没什么值得记的，就只输出一行 `（这轮没写）`——那也算你的决定，我不会塞东西凑数。',
    )
  }
  return parts.join('\n\n')
}