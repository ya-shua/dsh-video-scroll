/**
 * ring-ingest.mjs —— 刷视频 → 环形的心 · 产出留痕
 *
 * 值班轮跑完，把当天挑过的视频摘要投进她的记忆：
 *   走环形的心官方插件接口（MCP over stdio，mcp/server.mjs 的 ring_ingest——
 *   留影铺的那条路），闲聊圈自动入库、skipVault、speaker=user。
 *   这是系统留痕，不是她的表态，也不吃她自己话的 3 倍权重。
 *
 * spawn 一次说完就退；任何失败只打 kitLog，绝不影响值班轮本身。
 * RING_INGEST_OFF=1 可整体关闭。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { kitLog } from './config.js'
import * as videomem from './videomem.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))

const RING_ROOT_CANDIDATES = [
  process.env.RING_ROOT,
  path.join(HERE, '..', '..', '环形的心'),
  'D:/我的电脑/桌面/插件/环形的心',
  'D:/我的电脑/桌面/环形的心',
  process.env.USERPROFILE && path.join(process.env.USERPROFILE, '环形的心'),
].filter(Boolean).map((p) => String(p).replace(/\\/g, '/').replace(/\/+$/, ''))

function ringServer() {
  for (const p of RING_ROOT_CANDIDATES) {
    const s = path.join(p, 'mcp', 'server.mjs')
    if (existsSync(s)) return s
  }
  return null
}

/** 一次性 MCP 调用：spawn → initialize → tools/call → 拿结果 → 退 */
function callRing(tool, args, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const server = ringServer()
    if (!server) return reject(new Error('找不到环形的心（mcp/server.mjs），设 RING_ROOT 指过去'))
    const proc = spawn(process.execPath, [server], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true })
    let buf = ''
    let done = false
    const finish = (fn, v) => {
      if (done) return
      done = true
      clearTimeout(timer)
      try { proc.kill() } catch { }
      fn(v)
    }
    const timer = setTimeout(() => finish(reject, new Error(tool + ' 超时')), timeoutMs)
    proc.stdout.on('data', (c) => {
      buf += c
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        if (!line) continue
        try {
          const m = JSON.parse(line)
          if (m.id === 2) {
            if (m.error) return finish(reject, new Error(m.error.message || 'ring_ingest 失败'))
            return finish(resolve, m.result?.content?.[0]?.text ?? '')
          }
        } catch { /* 半行忽略 */ }
      }
    })
    proc.on('error', (e) => finish(reject, e))
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'snow-video-kit', version: '0.3.0' } } }) + '\n')
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: tool, arguments: args } }) + '\n')
    proc.stdin.end()
  })
}

/**
 * 值班轮结束后的环心留痕：读 videomem 里今天的挑选，摘一条进她的闲聊圈。
 * @param {string} kind 'bili' | 'douyin'
 * @param {object} [opts] { days?: number（回看几天，默认 1=今天） }
 */
export async function ingestRoundSummary(kind, { days = 1 } = {}) {
  try {
    if (process.env.RING_INGEST_OFF === '1') return { ok: false, skipped: true, reason: 'RING_INGEST_OFF' }
    const platform = kind === 'bili' ? 'bili' : 'douyin'
    const name = kind === 'bili' ? 'B站' : '抖音'
    const picked = videomem.recent({ platform, days, limit: 6 })
    if (!picked.length) return { ok: false, skipped: true, reason: `${days} 天内没有挑选记录` }

    const date = new Date().toISOString().slice(0, 10)
    const lines = picked.map((p) => {
      const t = p.title || p.vid || '?'
      const g = p.grade ? `（${p.grade}）` : ''
      const s = p.summary ? `：${String(p.summary).slice(0, 42)}` : ''
      return `《${t}》${g}${s}`
    })
    let body = ''
    for (const l of lines) {
      if (body.length + l.length > 420) break
      body += (body ? '；' : '') + l
    }
    const content = `刷视频日报（${name} ${date}，挑了 ${picked.length} 条）：${body}`

    const text = await callRing('ring_ingest', {
      content,
      points: ['刷视频', name, date],
      source: 'private',
      speaker: 'user',
    })
    kitLog(`[ring-ingest] 已留痕进环心：${String(text).slice(0, 80)}`)
    return { ok: true, text }
  } catch (e) {
    kitLog(`[ring-ingest] 留痕失败（不影响值班轮）：${String(e?.message || e)}`)
    return { ok: false, error: String(e?.message || e) }
  }
}
