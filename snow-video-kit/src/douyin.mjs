/**
 * douyin.mjs —— 刷抖音引擎（脱离 DSH）
 * 采集：tools/forward-pick.py（curl_cffi+签名器，纯代码，证据写入 round-evidence.json）
 * 大脑：一次 chat.completions（章程+人设+证据 → 输出 `### <视频ID>` 日报）
 * 落盘：宿主写 out/<日期>.md 与 seen.md（配额在驱动层强制）
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { chat, chatWithTools } from './brain.mjs'
import { kitLog, todayKey } from './config.js'
import * as videomem from './videomem.mjs'

export function douyinStatus(cfg, resolve) {
  const { home, python } = resolve
  const cookie = path.join(home, 'douyin_cookie.txt')
  const today = path.join(home, 'out', `${todayKey()}.md`)
  let todayCount = 0
  try { todayCount = (fs.readFileSync(today, 'utf8').match(/^#{2,3}[ \t]*\d{15,25}/gm) || []).length } catch { /* 还没有 */ }
  const lastLog = (() => { try { return fs.readFileSync(path.join(home, 'duty.log'), 'utf8').trim().split(/\r?\n/).slice(-4) } catch { return [] } })()
  return {
    kind: 'douyin', label: '刷抖音',
    home, credOk: exists(cookie), venvOk: exists(python),
    perDay: cfg.douyin.perDay, todayCount,
    lastLog, lastActivityAgeMin: ageMin(path.join(home, 'duty.log')),
  }
}
function exists(p) { try { fs.accessSync(p); return true } catch { return false } }
function ageMin(p) { try { return (Date.now() - fs.statSync(p).mtimeMs) / 60000 } catch { return null } }

/** 采集证据：forward-pick.py → round-evidence.json */
function buildEvidence(cfg, resolve, limit) {
  const { home, python, toolsDir } = resolve
  const script = path.join(toolsDir, 'forward-pick.py')
  if (!exists(script)) throw new Error(`采集脚本不存在：${script}`)
  const env = { ...process.env, DOUYIN_HOME: home, PYTHONUTF8: '1' }
  try {
    execFileSync(python, [script, '--limit', String(limit)], { cwd: home, env, timeout: 240000, stdio: 'pipe' })
  } catch (e) {
    throw new Error('证据采集失败（forward-pick.py）：' + String(e?.message || e).slice(0, 300))
  }
  const file = path.join(home, 'round-evidence.json')
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { throw new Error('证据文件读取失败：' + file) }
}

/** ⭐ 2026-11-07（用户要求"她自己看"）：她值班时亲自看候选视频的评论区（真实抓取），不再只吃压缩证据包 */
const WATCH_TOOL = {
  type: 'function',
  function: {
    name: 'look_comments',
    description: '亲自看某条抖音视频的评论区（真实抓取热门评论原文+赞数）。写进日报前必须至少看一次；把你亲眼看到的评论氛围写进点评。',
    parameters: {
      type: 'object',
      properties: {
        vid: { type: 'string', description: '视频 ID（15–25 位数字）' },
      },
      required: ['vid'],
      additionalProperties: false,
    },
  },
}
function execWatch({ name, args }) {
  if (name !== 'look_comments') return '未知工具 ' + name
  const vid = String(args?.vid || '').trim()
  if (!/^\d{15,25}$/.test(vid)) return '参数不对：vid 必须是 15–25 位数字的视频 ID'
  // ① 签名 API 路（api-comments.py：/comment/list 接口，按热度）
  const apiScript = path.join(WATCH_TOOLS_DIR, 'api-comments.py')
  if (fs.existsSync(apiScript)) {
    const env = { ...process.env, DOUYIN_HOME: WATCH_HOME, PYTHONUTF8: '1' }
    try {
      const out = execFileSync(WATCH_PYTHON, [apiScript, vid], { cwd: WATCH_HOME, env, timeout: 60000, encoding: 'utf8' })
      const lines = String(out).split(/\r?\n/).filter((l) => /cid=|合计\s/.test(l))
      if (lines.some((l) => /cid=/.test(l))) return `【视频 ${vid} 的评论区 · 真实抓取】\n` + lines.join('\n').slice(0, 6000)
    } catch { /* 签名路失败 → 试 DOM 路 */ }
  }
  // ② DOM 路（comment-read-dom.mjs：共享无头会话里读评论区，按最新）
  const domScript = path.join(WATCH_TOOLS_DIR, 'comment-read-dom.mjs')
  if (WATCH_NODE && fs.existsSync(domScript)) {
    try {
      const out = execFileSync(WATCH_NODE, [domScript, '--aweme', vid], { cwd: WATCH_HOME, env: { ...process.env, DOUYIN_HOME: WATCH_HOME, PYTHONUTF8: '1' }, timeout: 150000, encoding: 'utf8' })
      const j = JSON.parse(String(out).split(/\r?\n/).filter((l) => l.trim().startsWith('{')).pop() || '{}')
      if (j.ok && (j.items || []).length) {
        const rows = j.items.map((x) => `- ${x.nick || '(匿名)'}：${String(x.text || '').replace(/\n/g, ' ').slice(0, 100)}${x.mine ? ' （我发的）' : ''}`)
        return `【视频 ${vid} 的评论区 · 页面实读】\n` + rows.slice(0, 20).join('\n').slice(0, 6000)
      }
    } catch { /* DOM 路也失败 → 如实报告 */ }
  }
  return `【视频 ${vid}】两条通道都没看成评论区（签名/会话状态原因）。如实处理：这条按"评论区没看成"写进日报，别编评论内容。`
}
// 看评论区时的运行上下文（runRound 里赋值）
let WATCH_TOOLS_DIR = '', WATCH_HOME = '', WATCH_PYTHON = '', WATCH_NODE = ''

/** 值班轮：她自己看（工具循环：真实看评论区）→ 日报落盘 */
export async function runRound(cfg, resolve, { reason = 'manual' } = {}) {
  const st = douyinStatus(cfg, resolve)
  if (!st.venvOk) throw new Error('抖音 Python 环境不存在')
  if (!st.credOk) throw new Error('抖音 Cookie 缺失（douyin_cookie.txt）')
  if (st.todayCount >= cfg.douyin.perDay) return { ok: false, reason: `今日额度已满（${st.todayCount}/${cfg.douyin.perDay}）` }

  const { home } = resolve
  WATCH_TOOLS_DIR = resolve.toolsDir; WATCH_HOME = home; WATCH_PYTHON = resolve.python
  WATCH_NODE = path.join(cfg.snow?.homeDir || '', 'node.exe')
  const charter = safeRead(path.join(home, 'duty.md'), '(章程缺失)')
  const persona = safeRead(path.join(home, 'persona.md'), safeRead(path.join(home, '..', 'douyin-duty', 'persona.md'), ''))
  const evidence = buildEvidence(cfg, resolve, Math.min(cfg.douyin.evidenceLimit, cfg.douyin.perDay - st.todayCount + 4))
  const items = evidence?.list || evidence?.items || evidence?.candidates || []
  const list = Array.isArray(items) ? items : []
  if (!list.length) return { ok: false, reason: '本轮没有采到候选视频（接口或风控原因），稍后再试' }

  const remain = Math.max(0, cfg.douyin.perDay - st.todayCount)
  videomem.configureMemory(cfg.memory?.dbPath)
  const memBlock = videomem.memoryBlockForPrompt({ platform: 'douyin' })
  const system = [
    charter,
    persona ? '─── 人设 ───\n' + persona : '',
    '─── 本轮动态参数（覆盖章程对应项）───',
    `今天：${todayKey()}。本轮最多挑 ${remain} 条（每天总量 ${cfg.douyin.perDay}，已挑 ${st.todayCount}）。`,
    '只允许从【本轮证据】里挑选；证据之外的vid一律不得出现在日报里。',
    memBlock,
    '─── 看的方式（2026-11-07 新规矩）───',
    '证据只是发现候选的线索，**判断以你亲眼看到的为准**：工具 `look_comments(vid)` 会真实打开那条视频的评论区，把热门评论原文给你。',
    '**每条要写进日报的候选，必须先用 look_comments 看过至少一次**——把你真实看到的评论区氛围、高赞评论写进「为什么值得」和一句话点评（别只复述证据里的标题和简介）。',
    '评论区清一色引流 / 骂战 / 广告 ⇒ 这条的成色打折；有真诚讨论 ⇒ 加分。看不了（风控/超时）就如实写「评论区没看成」，别编。',
    '输出格式：直接输出日报 Markdown，每条以 `### <视频ID>` 标题行开始（标题行只写ID，不要别的字），后接「为什么值得」与一句话点评。最后不要总结陈词。',
  ].filter(Boolean).join('\n\n')

  const user = '【本轮证据 JSON】（候选线索）\n' + JSON.stringify(list).slice(0, 60000) + `\n\n（原因：${reason}）先对要挑的候选逐条 look_comments 看评论区，再按章程输出日报。`
  const { final } = await chatWithTools(cfg, [{ role: 'system', content: system }, { role: 'user', content: user }], [WATCH_TOOL], execWatch, { maxRounds: 20, kind: 'douyin-round' })
  const report = String(final || '').trim()
  if (!/^\s*#{2,3}/m.test(report) && !/###\s*\d{15,25}/.test(report)) throw new Error('大脑输出里没有 ### <视频ID> 标题行，拒收以防污染日报')

  // 落盘：追加到今天的日报 + 更新 seen.md
  const outDir = path.join(home, 'out')
  fs.mkdirSync(outDir, { recursive: true })
  const todayFile = path.join(outDir, `${todayKey()}.md`)
  fs.appendFileSync(todayFile, (exists(todayFile) ? '\n\n' : '') + report, 'utf8')
  const ids = (report.match(/\d{15,25}/g) || [])
  const seenFile = path.join(home, 'seen.md')
  if (ids.length) fs.appendFileSync(seenFile, ids.map((id) => `- ${id}  ${todayKey()}  (kit)`).join('\n') + '\n', 'utf8')

  // ⭐ 2026-11-07（用户要求、默认关）：互动开关——对挑中的视频点赞 / 收藏（真实页面点击，后台派发）
  if (cfg.douyin.interactLike || cfg.douyin.interactFav) {
    const node = path.join(cfg.snow?.homeDir || '', 'node.exe')
    const tool = path.join(resolve.toolsDir, 'video-interact.mjs')
    const interactLog = path.join(home, 'interact.log')
    if (fs.existsSync(node) && fs.existsSync(tool) && ids.length) {
      for (const id of ids) {
        try {
          fs.appendFileSync(interactLog, `\n[${todayKey()} ${new Date().toTimeString().slice(0, 8)}] interact ${id} like=${cfg.douyin.interactLike ? 1 : 0} fav=${cfg.douyin.interactFav ? 1 : 0}\n`)
          const lh = fs.openSync(interactLog, 'a')
          const p = spawn(WATCH_NODE, [tool, '--aweme', id, '--like', cfg.douyin.interactLike ? '1' : '0', '--fav', cfg.douyin.interactFav ? '1' : '0'], { cwd: home, env: { ...process.env, DOUYIN_HOME: home, PYTHONUTF8: '1' }, detached: true, stdio: ['ignore', lh, lh], windowsHide: true })
          p.unref(); fs.closeSync(lh)
        } catch (e) { kitLog('互动派发失败：' + String(e?.message || e)) }
      }
      kitLog(`互动已派发：${ids.length} 条（点赞 ${cfg.douyin.interactLike ? '开' : '关'} / 收藏 ${cfg.douyin.interactFav ? '开' : '关'}）→ ${interactLog}`)
    }
  }

  const after = douyinStatus(cfg, resolve)
  try {
    const n = videomem.ingestReport('douyin', report, todayKey())
    videomem.event('douyin', 'round_done', { reason, todayCount: after.todayCount, ingested: n })
    kitLog(`抖音记忆入库：${n} 条`)
  } catch (e) { kitLog('抖音记忆入库失败: ' + String(e?.message || e)) }
  kitLog(`抖音轮结束：${reason} → 今日 ${after.todayCount}/${after.perDay}`)
  return { ok: true, summary: report.slice(0, 1500), picked: ids.length, todayCount: after.todayCount, perDay: after.perDay }
}
function safeRead(p, fb) { try { return fs.readFileSync(p, 'utf8') } catch { return fb } }
