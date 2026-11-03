/**
 * rounds.mjs —— 值班轮编排：并发闸 + 进度状态（state/round-<kind>.json）
 * 网页/MCP/计划任务都走同一个入口，谁跑都一样。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { loadConfig, resolveBili, resolveDouyin, stateWrite, stateRead, kitLog, KIT_DIR } from './config.js'
import { requireOnline } from './snow.mjs'
import * as bili from './bili.mjs'
import * as douyin from './douyin.mjs'

const RUNNER = path.join(KIT_DIR, 'src', 'round-runner.mjs')

const RUNNING_TTL = 2 * 60 * 60 * 1000 // 2 小时内的 running 视为仍在跑

export function roundState(kind) {
  const s = stateRead(`round-${kind}.json`, {})
  if (s.status === 'running' && Date.now() - (s.startedAt || 0) > RUNNING_TTL) s.status = 'stale'
  return s
}

export function roundRunning(kind) {
  const s = roundState(kind)
  return s.status === 'running'
}

export async function runRound(kind, { reason = 'manual' } = {}) {
  if (kind !== 'bili' && kind !== 'douyin') throw new Error('未知任务类型: ' + kind)
  if (roundRunning(kind)) return { ok: false, reason: '上一轮还在跑（' + new Date(roundState(kind).startedAt).toLocaleTimeString('zh-CN') + ' 开始）' }
  const cfg = loadConfig()
  requireOnline() // QQ 连接成功才放行值班轮
  const startedAt = Date.now()
  stateWrite(`round-${kind}.json`, { status: 'running', startedAt, reason })
  kitLog(`值班轮开始：${kind}（${reason}）`)
  try {
    const resolve = kind === 'bili' ? resolveBili(cfg) : resolveDouyin(cfg)
    const engine = kind === 'bili' ? bili : douyin
    const r = await engine.runRound(cfg, resolve, { reason })
    stateWrite(`round-${kind}.json`, { status: r.ok ? 'done' : 'skipped', startedAt, endedAt: Date.now(), reason, ...r })
    return r
  } catch (e) {
    const msg = String(e?.message || e)
    kitLog(`值班轮失败：${kind} → ${msg}`)
    stateWrite(`round-${kind}.json`, { status: 'error', startedAt, endedAt: Date.now(), reason, error: msg })
    return { ok: false, error: msg }
  }
}

/** 给「她」的异步启动：派生独立进程跑（round-runner.mjs），立即返回（调用方退出也不影响） */
export function kickRoundDetached(kind, reason = '她发起') {
  if (roundRunning(kind)) return { ok: false, reason: '上一轮还在跑' }
  if (kind !== 'bili' && kind !== 'douyin') return { ok: false, reason: '未知任务类型' }
  stateWrite(`round-${kind}.json`, { status: 'queued', queuedAt: Date.now(), reason })
  const child = spawn(process.execPath, [RUNNER, '--kind', kind, '--reason', reason], {
    detached: true, stdio: 'ignore',
    env: { ...process.env, KIT_DIR },
  })
  child.unref()
  kitLog(`值班轮已派发（独立进程）：${kind}`)
  return { ok: true, started: true, detail: `${kind} 值班轮已在后台开始，稍后用 video_status 查进度` }
}

export function latestReport(kind) {
  const cfg = loadConfig()
  const home = kind === 'bili' ? resolveBili(cfg).home : resolveDouyin(cfg).home
  const outDir = path.join(home, 'out')
  try {
    const files = fs.readdirSync(outDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort().reverse()
    if (!files.length) return { ok: true, file: null, content: '', home: outDir }
    const content = fs.readFileSync(path.join(outDir, files[0]), 'utf8')
    return { ok: true, file: files[0], content, home: outDir }
  } catch (e) { return { ok: false, error: String(e?.message || e) } }
}
