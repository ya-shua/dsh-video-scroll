/**
 * videomem.mjs —— 跨平台视频记忆库接口（抖音、B站互通）
 * ============================================================================
 * 一个可接入任意 SQLite 数据库文件的统一记忆层：
 *   · 默认库：snow-video-kit/data/video-memory.db（node:sqlite 内置，零依赖，WAL）
 *   · 路径可配：config.json → memory.dbPath（指到哪就接到哪，比如挂到记忆库目录）
 *   · 两边引擎写同一张表：B站(BV号) 与 抖音(19位ID) 互相可见 → 跨平台查重/口味记忆
 *   · 「她」与工作台都走同一组 API（remember / recent / search / stats）
 *
 * 表结构：
 *   videos        挑过的视频（platform/vid/title/author/grade/reason/summary/stats）
 *   interactions  发出去的互动（评论/私信/回复）
 *   events        通用事件流（值班轮开始/结束、错误等）
 * ============================================================================
 */
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import fs from 'node:fs'
import { KIT_DIR, kitLog } from './config.js'

const DEFAULT_DB = path.join(KIT_DIR, 'data', 'video-memory.db')
let _db = null
let _dbPath = ''
let _configured = ''

/** 从配置注入数据库路径（config.json → memory.dbPath；空 = 包内默认） */
export function configureMemory(dbPath) { _configured = dbPath || '' }

export function open(dbPath = '') {
  const p = dbPath || _configured || DEFAULT_DB
  if (_db && _dbPath === p) return _db
  fs.mkdirSync(path.dirname(p), { recursive: true })
  _db = new DatabaseSync(p)
  _db.exec('PRAGMA journal_mode = WAL;')
  _db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      vid TEXT NOT NULL,
      title TEXT DEFAULT '',
      author TEXT DEFAULT '',
      url TEXT DEFAULT '',
      grade TEXT DEFAULT '',
      reason TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      stats_json TEXT DEFAULT '{}',
      picked_at TEXT NOT NULL,
      round_date TEXT NOT NULL,
      UNIQUE(platform, vid)
    );
    CREATE INDEX IF NOT EXISTS idx_videos_title ON videos(title);
    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      vid TEXT DEFAULT '',
      kind TEXT NOT NULL,
      text TEXT DEFAULT '',
      result TEXT DEFAULT '',
      at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT DEFAULT '',
      type TEXT NOT NULL,
      payload TEXT DEFAULT '',
      at TEXT NOT NULL
    );
  `)
  if (_dbPath !== p) kitLog('记忆库已接入: ' + p)
  _dbPath = p
  return _db
}

export function event(platform, type, payload = '') {
  try {
    const db = open()
    db.prepare('INSERT INTO events (platform, type, payload, at) VALUES (?, ?, ?, ?)')
      .run(platform || '', type, typeof payload === 'string' ? payload : JSON.stringify(payload), new Date().toISOString())
  } catch (e) { kitLog('记忆库 event 写入失败: ' + String(e?.message || e)) }
}

/** 记住一条挑过的视频（重复写同平台同 vid 会更新而不是重复） */
export function rememberVideo(platform, v, roundDate) {
  const db = open()
  db.prepare(`
    INSERT INTO videos (platform, vid, title, author, url, grade, reason, summary, stats_json, picked_at, round_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(platform, vid) DO UPDATE SET
      title=excluded.title, author=excluded.author, url=excluded.url, grade=excluded.grade,
      reason=excluded.reason, summary=excluded.summary, stats_json=excluded.stats_json,
      picked_at=excluded.picked_at, round_date=excluded.round_date
  `).run(
    platform, String(v.vid || ''), v.title || '', v.author || '', v.url || '',
    v.grade || '', v.reason || '', v.summary || '',
    typeof v.stats === 'string' ? v.stats : JSON.stringify(v.stats || {}),
    v.pickedAt || new Date().toISOString(), roundDate || v.roundDate || new Date().toISOString().slice(0, 10),
  )
}

/** 互动记录（评论/私信/回复） */
export function rememberInteraction(platform, { vid = '', kind = 'comment', text = '', result = '' }) {
  const db = open()
  db.prepare('INSERT INTO interactions (platform, vid, kind, text, result, at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(platform, vid, kind, text, result, new Date().toISOString())
}

/** 跨平台查重：这个视频（按 vid 或标题关键词）在任一平台是否已被推过 */
export function crossSeen({ vid = '', titleLike = '', days = 14, limit = 20 } = {}) {
  const db = open()
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const rows = []
  if (vid) rows.push(...db.prepare('SELECT platform, vid, title, picked_at FROM videos WHERE vid = ? AND picked_at >= ? ORDER BY picked_at DESC').all(vid, since))
  if (titleLike) rows.push(...db.prepare("SELECT platform, vid, title, picked_at FROM videos WHERE title LIKE ? AND picked_at >= ? ORDER BY picked_at DESC LIMIT ?").all(`%${titleLike}%`, since, limit))
  return rows
}

/** 最近记忆（可按平台过滤、按关键词搜索）——给提示词/面板/她共用 */
export function recent({ platform = '', q = '', days = 7, limit = 20 } = {}) {
  const db = open()
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const where = ['picked_at >= ?']
  const args = [since]
  if (platform) { where.push('platform = ?'); args.push(platform) }
  if (q) { where.push('(title LIKE ? OR reason LIKE ? OR summary LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  const rows = db.prepare(`SELECT platform, vid, title, author, grade, reason, summary, picked_at, round_date FROM videos WHERE ${where.join(' AND ')} ORDER BY picked_at DESC LIMIT ?`).all(...args, limit)
  return rows
}

export function stats() {
  const db = open()
  const per = db.prepare("SELECT platform, COUNT(*) AS n, MAX(picked_at) AS last FROM videos GROUP BY platform").all()
  const out = { total: 0 }
  for (const r of per) { out[r.platform] = { count: r.n, last: r.last }; out.total += r.n }
  out.dbPath = _dbPath
  return out
}

/** 给值班轮的记忆块（跨平台）：最近推过什么，提醒大脑别重复口味 */
export function memoryBlockForPrompt({ platform, days = 3, limit = 12 } = {}) {
  const rows = recent({ days, limit })
  if (!rows.length) return ''
  const mine = rows.filter((r) => !platform || r.platform !== platform || true) // 全平台互相参考
  const lines = mine.slice(0, limit).map((r) => `- [${r.platform}] ${r.title || r.vid}${r.grade ? '（' + r.grade + '）' : ''} @${r.picked_at.slice(0, 10)}`)
  return '─── 记忆库：最近 ' + days + ' 天两个平台已经推过的（避免重复选题与重复话术）───\n' + lines.join('\n')
}

/** 从日报 Markdown 解析并回填（B站/抖音格式都吃） */
export function ingestReport(platform, markdown, roundDate) {
  const db = open()
  const sections = markdown.split(/\n(?=#{2,3}[ \t]*\S)/)
  let n = 0
  for (const sec of sections) {
    const idm = sec.match(/^#{2,3}[ \t]*(BV[0-9A-Za-z]+|\d{15,25})/m)
    if (!idm) continue
    const vid = idm[1]
    const title = (sec.match(/[《【]([^》】]+)[》】]/) || sec.match(/^#{2,3}[ \t]*(?:BV[0-9A-Za-z]+|\d{15,25})[ \t]*(.*)$/m) || [])[1] || ''
    const author = (sec.match(/@([^\s·,，]+)/) || [])[1] || ''
    const url = (sec.match(/https?:\/\/\S+/) || [])[1] || ''
    const grade = (sec.match(/档位[：:]\s*(值得看|可以看|不值当)/) || [])[1] || ''
    const reason = (sec.match(/为什么值得[：:]\s*([\s\S]*?)(?=\n\s*\*\*|\n#{2,3}|$)/) || [])[1]?.trim() || ''
    const summary = (sec.match(/一句话[：:]\s*([\s\S]*?)(?=\n#{2,3}|$)/) || [])[1]?.trim() || ''
    if (vid) { rememberVideo(platform, { vid, title, author, url, grade, reason, summary, pickedAt: new Date().toISOString() }, roundDate); n++ }
  }
  return n
}

/** 只读 SQL（给工作台的查询框用；禁止写操作） */
export function queryReadOnly(sql) {
  const db = open()
  if (!/^SELECT|^WITH/i.test(sql.trim())) throw new Error('只允许 SELECT/WITH 查询')
  if (/;\s*\S/.test(sql.trim().replace(/;$/, ''))) throw new Error('只允许单条语句')
  return db.prepare(sql).all()
}
