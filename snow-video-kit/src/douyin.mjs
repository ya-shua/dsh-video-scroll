/**
 * douyin.mjs —— 刷抖音引擎（脱离 DSH）
 * 采集：tools/forward-pick.py（curl_cffi+签名器，纯代码，证据写入 round-evidence.json）
 * 大脑：一次 chat.completions（章程+人设+证据 → 输出 `### <视频ID>` 日报）
 * 落盘：宿主写 out/<日期>.md 与 seen.md（配额在驱动层强制）
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { chat } from './brain.mjs'
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

/** 值班轮：证据 → 大脑一次判断 → 日报落盘 */
export async function runRound(cfg, resolve, { reason = 'manual' } = {}) {
  const st = douyinStatus(cfg, resolve)
  if (!st.venvOk) throw new Error('抖音 Python 环境不存在')
  if (!st.credOk) throw new Error('抖音 Cookie 缺失（douyin_cookie.txt）')
  if (st.todayCount >= cfg.douyin.perDay) return { ok: false, reason: `今日额度已满（${st.todayCount}/${cfg.douyin.perDay}）` }

  const { home } = resolve
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
    '输出格式：直接输出日报 Markdown，每条以 `### <视频ID>` 标题行开始（标题行只写ID，不要别的字），后接「为什么值得」与一句话点评。最后不要总结陈词。',
  ].filter(Boolean).join('\n\n')

  const user = '【本轮证据 JSON】\n' + JSON.stringify(list).slice(0, 60000) + `\n\n（原因：${reason}）按章程从证据中挑选并输出日报。`
  const msg = await chat(cfg, [{ role: 'system', content: system }, { role: 'user', content: user }], { maxTokens: 8192, kind: 'douyin-round' })
  const report = String(msg.content || '').trim()
  if (!/^\s*#{2,3}/m.test(report) && !/###\s*\d{15,25}/.test(report)) throw new Error('大脑输出里没有 ### <视频ID> 标题行，拒收以防污染日报')

  // 落盘：追加到今天的日报 + 更新 seen.md
  const outDir = path.join(home, 'out')
  fs.mkdirSync(outDir, { recursive: true })
  const todayFile = path.join(outDir, `${todayKey()}.md`)
  fs.appendFileSync(todayFile, (exists(todayFile) ? '\n\n' : '') + report, 'utf8')
  const ids = (report.match(/\d{15,25}/g) || [])
  const seenFile = path.join(home, 'seen.md')
  if (ids.length) fs.appendFileSync(seenFile, ids.map((id) => `- ${id}  ${todayKey()}  (kit)`).join('\n') + '\n', 'utf8')

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
