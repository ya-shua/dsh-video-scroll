/**
 * services.mjs —— 服务台能力（并入工作台）
 * 服务探活（7 个）+ 大肥鱼记忆只读统计 + 白名单日志尾巴。
 * 全部只读；探活超时 1.2s；日志只读白名单内的文件。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { readFileSync, existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { loadConfig, resolveBili, resolveDouyin, KIT_DIR } from './config.js'

const RING_ROOT = 'D:/我的电脑/桌面/插件/环形的心'
const SHENGLAI_LOG = 'D:/AI/声音工坊/panel.log'

export const SERVICES = [
  { id: 'videokit', name: '刷视频 · 工作台', port: 8412, path: '/', self: true },
  { id: 'videoconsole', name: '刷视频 · 综合面板', port: 8390, path: '/', note: '需 DSH 运行' },
  { id: 'ringmind', name: '环形的心 · 记忆面板', port: 5173, path: '/' },
  { id: 'liuying', name: '留影 · 视觉接入', port: 5188, path: '/' },
  { id: 'shenglai', name: '声来 · 语音工作台', port: 17878, path: '/' },
  { id: 'snowluma', name: 'SnowLuma · WebUI', port: 5099, path: '/' },
]

export const LOGS = [
  { id: 'kit', label: '刷视频 · kit.log', file: path.join(process.env.KIT_DIR || '', 'state', 'kit.log') },
  { id: 'kitweb', label: '刷视频工作台 · web.log', file: path.join(process.env.KIT_DIR || '', 'state', 'web.log') },
  { id: 'voice', label: '声来 · panel.log', file: SHENGLAI_LOG },
]

function probe(port, t = 1200) {
  return new Promise((resolve) => {
    const started = Date.now()
    const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: t }, (r) => {
      r.resume()
      resolve({ up: Boolean(r.statusCode && r.statusCode < 500), ms: Date.now() - started, code: r.statusCode || 0 })
    })
    req.on('timeout', () => { req.destroy(); resolve({ up: false, ms: Date.now() - started, code: 0 }) })
    req.on('error', () => resolve({ up: false, ms: Date.now() - started, code: 0 }))
  })
}

export async function probeAll() {
  const out = []
  for (const s of SERVICES) {
    const p = await probe(s.port)
    out.push({ ...s, up: p.up, ms: p.ms })
  }
  return { at: Date.now(), services: out }
}

/** 大肥鱼（环形的心）+ 跨平台记忆库 只读统计 */
export function botStats() {
  const out = { memory: null, video: null }
  try {
    const loc = JSON.parse(readFileSync(path.join(RING_ROOT, 'data-location.json'), 'utf8'))
    const dbPath = path.resolve(loc.dbPath)
    if (existsSync(dbPath)) {
      const db = new DatabaseSync(dbPath, { readOnly: true })
      const rings = Object.fromEntries(db.prepare('SELECT ring, COUNT(*) AS n FROM memories GROUP BY ring').all().map((r) => [r.ring, r.n]))
      out.memory = {
        dbPath,
        rings,
        points: db.prepare('SELECT COUNT(*) AS n FROM points').get().n,
        pointsAlive: db.prepare('SELECT COUNT(*) AS n FROM points WHERE visible = 1').get().n,
        vault: db.prepare('SELECT COUNT(*) AS n FROM vault').get().n,
        lastMemoryAt: db.prepare('SELECT MAX(created_at) AS t FROM memories').get().t || null,
      }
      db.close()
    }
  } catch (e) { out.memoryError = String(e?.message || e) }
  try {
    const cfg = loadConfig()
    const dbp = cfg.memory?.dbPath || path.join(KIT_DIR, 'data', 'video-memory.db')
    if (existsSync(dbp)) {
      const db = new DatabaseSync(dbp, { readOnly: true })
      out.video = {
        dbPath: dbp,
        total: db.prepare('SELECT COUNT(*) AS n FROM videos').get().n,
        byPlatform: db.prepare('SELECT platform, COUNT(*) AS n FROM videos GROUP BY platform').all(),
        lastPickedAt: db.prepare('SELECT MAX(picked_at) AS t FROM videos').get().t || null,
      }
      db.close()
    }
  } catch (e) { out.videoError = String(e?.message || e) }
  return out
}

/** 日志尾巴（白名单；只读） */
export function tailLog(id, lines = 40) {
  const entry = LOGS.find((l) => l.id === id)
  if (!entry) return { ok: false, error: '未知日志: ' + id }
  try {
    const text = fs.readFileSync(entry.file, 'utf8')
    return { ok: true, label: entry.label, file: entry.file, lines: text.trim().split(/\r?\n/).slice(-lines) }
  } catch (e) { return { ok: true, label: entry.label, lines: ['（日志不存在或暂无内容）'] } }
}

/** 各插件面板的打开地址（工作台「服务」页用） */
export function panelUrls() {
  return {
    videokit: `http://127.0.0.1:8412/`,
    videoconsole: `http://127.0.0.1:8390/join`,
    ringmind: `http://127.0.0.1:5173/`,
    liuying: `http://127.0.0.1:5188/`,
    shenglai: `http://127.0.0.1:17878/`,
    snowluma: `http://127.0.0.1:5099/`,
  }
}
