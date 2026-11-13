/**
 * bili.mjs —— 刷B站引擎（脱离 DSH）
 * 机器：spawn ~/.dsh/bili-duty 的 mcp_server.py（stdio MCP，BILI_MCP_TOOLS 白名单）
 * 大脑：chatWithTools —— 模型自主 荐视频→读字幕/评论→写报告（duty_report_append 窄口落盘）
 * 章程：duty.md（家里现成的值班章程）+ 动态段（日期/配额/排除词/关键词）
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { McpStdio } from './mcpclient.mjs'
import { chatWithTools } from './brain.mjs'
import { kitLog, todayKey } from './config.js'
import * as videomem from './videomem.mjs'
import { buildContext, bridgePromptBlock, stopRing } from './conch-bridge.mjs'
import { describeFrames, transcribeBuffer, mediaLevel, deepQuota } from './eyes.mjs'

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

/** 深模式专用工具：抽几帧喂视觉模型 + 读字幕（= 看画面 + 听声音） */
const DEEP_TOOL = {
  type: 'function',
  function: {
    name: 'look_deep',
    description:
      '仔细看一条B站视频：抽几帧画面让视觉模型讲给你听（谁/在哪/在做什么/画面里的字），'
      + '声音这块有字幕就读字幕，没字幕会把音轨拉下来转成文字（相当于真听）。只在深模式可用，每轮有额度。'
      + '演示类、没字幕、或你要在日报里断言画面时用它。',
    parameters: {
      type: 'object',
      properties: {
        bvid: { type: 'string', description: 'BV 开头的 12 位视频号' },
        why: { type: 'string', description: '你为什么想仔细看它（一句话，帮模型聚焦）' },
      },
      required: ['bvid'],
    },
  },
}

/** 只把 B站的声音拉下来（yt-dlp -f bestaudio，不下整条视频）；失败就返回原因 */
async function fetchBiliAudio(cfg, resolve, bvid) {
  const { python, home } = resolve
  const tmpDir = path.join(home, 'tmp')
  fs.mkdirSync(tmpDir, { recursive: true })
  try {
    execFileSync(python, ['-m', 'yt_dlp', '-f', 'bestaudio', '--no-playlist', '--no-warnings',
      '-o', path.join(tmpDir, `asr-${bvid}-%(ext)s`), `https://www.bilibili.com/video/${bvid}`],
    { cwd: home, timeout: 180000, stdio: 'pipe', env: { ...process.env, PYTHONUTF8: '1' }, windowsHide: true })
  } catch (e) {
    return { ok: false, error: ('yt-dlp：' + String(e?.message || e)).slice(0, 120) }
  }
  let f = ''
  try {
    f = fs.readdirSync(tmpDir).filter((n) => n.startsWith(`asr-${bvid}-`)).sort().pop() || ''
  } catch { /* 目录读不了 */ }
  if (!f) return { ok: false, error: 'yt-dlp 没吐出音频文件' }
  const p = path.join(tmpDir, f)
  try {
    const buf = fs.readFileSync(p)
    fs.rmSync(p, { force: true })
    if (buf.length > 25 * 1024 * 1024) return { ok: false, error: '音轨太大（>25MB）' }
    return { ok: true, buffer: buf }
  } catch (e) {
    return { ok: false, error: String(e?.message || e).slice(0, 100) }
  }
}

async function lookDeepBili(cfg, resolve, mcp, args, budget, audioOn) {
  const bvid = String(args?.bvid || '').trim()
  if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) return 'bvid 不对（要 BV 开头的 12 位）'
  if (budget.used >= budget.max) return `本轮深审额度用完了（最多 ${budget.max} 条）——这条按标题/字幕/评论判断。`
  budget.used++
  kitLog(`深审：${bvid}（本轮第 ${budget.used}/${budget.max} 条）`)
  const parts = []
  // ① 画面：B站故事板帧 → 留影视觉模型
  try {
    const num = Math.max(1, Math.min(6, cfg.media?.frames || 3))
    const r = await mcp.call('bili_frames', { bvid, num }, 180000)
    if (r.images?.length) {
      const d = await describeFrames(cfg, { frames: r.images, hint: String(args?.why || '').slice(0, 80), label: '视频', key: 'bili:' + bvid })
      parts.push(d.ok ? `画面（看了 ${d.used} 帧）：${d.desc}` : `画面没看成：${d.error}`)
    } else {
      parts.push('画面没看成（这条没有故事板图）')
    }
  } catch (e) {
    parts.push('画面没看成：' + String(e?.message || e).slice(0, 100))
  }
  // ② 声音：a) 有字幕就读字幕（免费）；b) 没字幕才把音轨拉下来交给留影转文字
  //    ⭐ 2026-11-12 三模式：混合模式不读声音（省时省资源），视觉模式才走完整链路
  let heard = ''
  if (audioOn) {
    try {
      const s = await mcp.call('bili_subtitle', { bvid }, 120000)
      const t = String(s.text || '').replace(/\s+/g, ' ').trim()
      if (!s.isError && t.length > 30 && !/没有字幕|无字幕|字幕获取失败|未找到/.test(t)) {
        heard = '声音（字幕）：' + t.slice(0, 600)
      }
    } catch { /* 走下面这条路 */ }
    if (!heard) {
      kitLog(`深审：${bvid} 没字幕 → 拉音轨走 ASR`)
      const au = await fetchBiliAudio(cfg, resolve, bvid)
      if (!au.ok) {
        heard = `声音：没字幕，音轨也拉不下来（${au.error}）——如实写「没听到」，别猜。`
      } else {
        const tr = await transcribeBuffer(cfg, au.buffer)
        heard = (tr.ok && String(tr.text || '').trim())
          ? '声音（没字幕，音轨转的文字）：' + String(tr.text).replace(/\s+/g, ' ').slice(0, 600)
          : `声音：没字幕，转文字也失败了（${tr.error || '转出来是空的'}）——如实写「没听到」。`
      }
    }
  } else {
    heard = '声音：混合模式不读（按画面和文案判断）'
  }
  parts.push(heard)
  return parts.join('\n')
}

/** 值班轮：大脑 + 工具循环（quota 在驱动层强制） */
export async function runRound(cfg, resolve, { reason = 'manual' } = {}) {
  const st = biliStatus(cfg, resolve)
  if (!st.venvOk) throw new Error('B站 Python 环境不存在')
  if (!st.credOk) throw new Error('B站未登录：补好凭证（bili_credential.json 缺失）')
  if (st.todayCount >= cfg.bili.perDay) return { ok: false, reason: `今日额度已满（${st.todayCount}/${cfg.bili.perDay}）` }

  const mcp = ensureEngine(cfg, resolve)
  videomem.configureMemory(cfg.memory?.dbPath)
  const charter = safeRead(path.join(st.home, 'duty.md'), '(章程缺失)')
  const bcfg = (() => { try { return JSON.parse(fs.readFileSync(path.join(st.home, 'config.json'), 'utf8')) } catch { return {} } })()
  const kw = (bcfg.keywords || []).join('、') || '（未填，按章程默认口味）'
  const exclude = (bcfg.excludeWords || []).join('、') || '（无）'
  const remain = Math.max(0, cfg.bili.perDay - st.todayCount)
  const memBlock = videomem.memoryBlockForPrompt({ platform: 'bili' })

  // 桥接海螺：她是谁 / 她记得什么 / 她平时怎么说话（失败只降级，不拦本轮）
  const bridge = await buildContext(cfg, { cues: ['刷视频', 'B站', ...((bcfg.keywords || []).slice(0, 3))] })
  const bridgeBlock = bridgePromptBlock(bridge, { kind: 'bili' })

  // ⭐ 2026-11-12 三模式：text=只看文本 / hybrid=文本+画面帧 / visual=全套（画面+声音）
  const level = mediaLevel(cfg)
  const deep = level >= 1 && deepQuota(cfg, 'bili') > 0
  const audioOn = level >= 2
  const deepBudget = { used: 0, max: deepQuota(cfg, 'bili') }

  const system = [
    charter,
    bridgeBlock,
    '─── 本轮动态参数（覆盖章程中的对应项）───',
    `今天：${todayKey()}。本轮最多再记 ${remain} 条（每天总量 ${cfg.bili.perDay}，已记 ${st.todayCount}）——**也可以一条都不记**，没有值得的就是没有。`,
    `关注关键词：${kw}`,
    `排除词：${exclude}`,
    memBlock,
    deep
      ? `─── 看/听（${audioOn ? '视觉模式：画面+声音全开' : '混合模式：只看画面，不听声音'}；本轮最多仔细看 ${deepBudget.max} 条）───\n`
        + '对**演示类、没字幕、或你打算断言画面**的视频，先调 `look_deep(bvid)`：它抽几帧画面让视觉模型讲给你听；'
        + (audioOn
          ? '声音这块有字幕就读字幕，**没字幕它会把音轨拉下来转成文字**（等于真听到）。'
          : '**混合模式不读声音**——没字幕就按画面和文案判断，别编音频内容。')
        + '把看到的写进「为什么值得」，比复述标题有说服力。额度用完就按标题/字幕/评论判断。'
      : '─── 看/听（当前是文本总结模式）───\n本轮只看文案、字幕、评论；**不许在日报里断言画面里有什么**（没看就说没看）。',
    '报告与判重一律通过 duty_report_append / duty_seen_append / duty_digest_append 三个固定路径工具落盘，不要自己发明路径。',
    '本轮由本工作台驱动：所有能力都来自挂载的工具；完成后用一段话总结本轮（挑了什么、为什么）。',
  ].filter(Boolean).join('\n')

  const tools = await mcp.openaiTools()
  if (deep) tools.push(DEEP_TOOL)
  let result
  try {
    result = await chatWithTools(cfg,
      [{ role: 'system', content: system }, { role: 'user', content: `开始本轮值班（原因：${reason}）。按章程执行。` }],
      tools,
      async ({ name, args }) => {
        if (name === 'look_deep') return await lookDeepBili(cfg, resolve, mcp, args, deepBudget, audioOn)
        const r = await mcp.call(name, args, 240000)
        if (r.isError) throw new Error(r.text.slice(0, 500))
        return r.text
      },
      { kind: 'bili-round' },
    )
  } finally {
    stopRing() // 记忆进程用完就收，别留孤儿
  }

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
  if (after.todayCount === st.todayCount) kitLog('B站轮结束：她这轮没写（日报里没加东西——这是她的判断，不是故障）')
  kitLog(`B站轮结束：${reason} → 今日 ${after.todayCount}/${after.perDay}`)
  return { ok: true, summary: String(result.final || '').slice(0, 2000), rounds: result.rounds, todayCount: after.todayCount, perDay: after.perDay, tools: result.trace }
}
function safeRead(p, fb) { try { return fs.readFileSync(p, 'utf8') } catch { return fb } }
