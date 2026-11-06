/**
 * bili.mjs —— 刷B站引擎（脱离 DSH）
 * 机器：spawn ~/.dsh/bili-duty 的 mcp_server.py（stdio MCP，BILI_MCP_TOOLS 白名单）
 * 大脑：chatWithTools —— 模型自主 荐视频→读字幕/评论→写报告（duty_report_append 窄口落盘）
 * 章程：duty.md（家里现成的值班章程）+ 动态段（日期/配额/排除词/关键词）
 */
import fs from 'node:fs'
import path from 'node:path'
import { McpStdio } from './mcpclient.mjs'
import { chatWithTools } from './brain.mjs'
import { kitLog, todayKey } from './config.js'
import * as videomem from './videomem.mjs'

export function biliStatus(cfg, resolve) {
  const { home, python, mcpServer } = resolve
  const cred = path.join(home, 'bili_credential.json')
  const outDir = path.join(home, 'out')
  const today = path.join(outDir, `${todayKey()}.md`)
  let todayCount = 0
  try { todayCount = (fs.readFileSync(today, 'utf8').match(/^#{2,3}[ \t]*BV/gm) || []).length } catch { /* 还没有 */ }
  const lastLog = (() => { try { return fs.readFileSync(path.join(home, 'duty.log'), 'utf8').trim().split(/\r?\n/).slice(-4) } catch { return [] } })()
  return {
    kind: 'bili', label: '刷B站',
    home, credOk: exists(cred), venvOk: exists(python), mcpServerOk: exists(mcpServer),
    perDay: cfg.bili.perDay, todayCount,
    lastLog, lastActivityAgeMin: ageMin(path.join(home, 'duty.log')),
  }
}
function exists(p) { try { fs.accessSync(p); return true } catch { return false } }
function ageMin(p) { try { return (Date.now() - fs.statSync(p).mtimeMs) / 60000 } catch { return null } }

let engine = null
function ensureEngine(cfg, resolve) {
  const { home, python, mcpServer } = resolve
  if (!exists(python)) throw new Error(`B站 Python 不存在：${python}（家目录被动过？）`)
  if (!exists(mcpServer)) throw new Error(`MCP server 不存在：${mcpServer}`)
  if (!engine || engine.home !== home) {
    if (engine) engine.mcp.stop()
    const mcp = new McpStdio({
      command: python, args: [mcpServer], cwd: home, name: 'bili',
      env: { BILI_DUTY_HOME: home, BILI_MCP_TOOLS: cfg.bili.tools, PYTHONUTF8: '1' },
    })
    engine = { mcp, home }
    kitLog('B站 MCP 引擎已创建')
  }
  return engine.mcp
}

/** 给「她」的快捷工具：热榜/搜索（轻量、同步返回文本） */
export async function biliQuick(cfg, resolve, tool, args) {
  const mcp = ensureEngine(cfg, resolve)
  const r = await mcp.call(tool, args, 60000)
  if (r.isError) throw new Error(r.text.slice(0, 300))
  return r.text
}

/** 值班轮：大脑 + 工具循环（quota 在驱动层强制） */
export async function runRound(cfg, resolve, { reason = 'manual' } = {}) {
  const st = biliStatus(cfg, resolve)
  if (!st.venvOk) throw new Error('B站 Python 环境不存在')
  if (!st.credOk) throw new Error('B站未登录：先在综合面板/DSH 面板扫码（bili_credential.json 缺失）')
  if (st.todayCount >= cfg.bili.perDay) return { ok: false, reason: `今日额度已满（${st.todayCount}/${cfg.bili.perDay}）` }

  const mcp = ensureEngine(cfg, resolve)
  videomem.configureMemory(cfg.memory?.dbPath)
  const charter = safeRead(path.join(st.home, 'duty.md'), '(章程缺失)')
  const bcfg = (() => { try { return JSON.parse(fs.readFileSync(path.join(st.home, 'config.json'), 'utf8')) } catch { return {} } })()
  const kw = (bcfg.keywords || []).join('、') || '（未填，按章程默认口味）'
  const exclude = (bcfg.excludeWords || []).join('、') || '（无）'
  const remain = Math.max(0, cfg.bili.perDay - st.todayCount)
  const memBlock = videomem.memoryBlockForPrompt({ platform: 'bili' })

  const system = [
    charter,
    '─── 本轮动态参数（覆盖章程中的对应项）───',
    `今天：${todayKey()}。本轮最多再挑 ${remain} 条（每天总量 ${cfg.bili.perDay}，已挑 ${st.todayCount}）。`,
    `关注关键词：${kw}`,
    `排除词：${exclude}`,
    memBlock,
    '报告与判重一律通过 duty_report_append / duty_seen_append / duty_digest_append 三个固定路径工具落盘，不要自己发明路径。',
    '本轮由 snow-video-kit 驱动（非 DSH）：所有能力都来自挂载的工具；完成后用一段话总结本轮（挑了什么、为什么）。',
  ].filter(Boolean).join('\n')

  const tools = await mcp.openaiTools()
  const result = await chatWithTools(cfg,
    [{ role: 'system', content: system }, { role: 'user', content: `开始本轮值班（原因：${reason}）。按章程执行。` }],
    tools,
    async ({ name, args }) => {
      const r = await mcp.call(name, args, 240000)
      if (r.isError) throw new Error(r.text.slice(0, 500))
      return r.text
    },
    { kind: 'bili-round' },
  )

  // 轮后复核：数一下今天的报告 + 写入跨平台记忆库
  const after = biliStatus(cfg, resolve)
  try {
    const todayFile = path.join(st.home, 'out', `${todayKey()}.md`)
    if (exists(todayFile)) {
      const n = videomem.ingestReport('bili', fs.readFileSync(todayFile, 'utf8'), todayKey())
      videomem.event('bili', 'round_done', { reason, todayCount: after.todayCount, ingested: n })
      kitLog(`B站记忆入库：${n} 条`)
    }
  } catch (e) { kitLog('B站记忆入库失败: ' + String(e?.message || e)) }
  kitLog(`B站轮结束：${reason} → 今日 ${after.todayCount}/${after.perDay}`)
  return { ok: true, summary: String(result.final || '').slice(0, 2000), rounds: result.rounds, todayCount: after.todayCount, perDay: after.perDay, tools: result.trace }
}
function safeRead(p, fb) { try { return fs.readFileSync(p, 'utf8') } catch { return fb } }
