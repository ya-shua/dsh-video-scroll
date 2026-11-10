/**
 * reads.mjs —— 「📖 看小说 / 💬 看贴吧」阅读值班线（⭐ 2026-11-07 新增，默认关）
 * ============================================================================
 * 哲学和刷视频那条线一致：证据只是候选线索，判断以她亲眼读到为准 ——
 *   贴吧：collectThreads(吧) 给候选 → 她逐条 readThread 亲眼看帖子正文和回复 → 挑值得聊的推
 *   小说：书单（追更）→ readToc 看更新 → readChapter 读正文 → 写追更感想
 * 产出：日报落盘 home/reads/<day>.md + 记忆库入库（platform=tieba/novel）。
 * 开关：config.reads = { tiebaEnabled, tiebaForums, tiebaPerRound, novelEnabled, novels:[{name,url}] }，默认全关。
 * ============================================================================
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { kitLog, todayKey, stateRead, stateWrite, KIT_DIR } from './config.js'
import * as videomem from './videomem.mjs'
import { chatWithTools } from './brain.mjs'
import { readerPage, visibleLogin } from './reader-chrome.mjs'

const exists = (p) => { try { return fs.existsSync(p) } catch { return false } }
const safeRead = (p, fb) => { try { return fs.readFileSync(p, 'utf8') } catch { return fb } }

/* ────────────── 贴吧（DOM 读取，真浏览器过风控） ────────────── */

/** 吧页 → 帖子候选列表（未登录会有登录墙 → {loginWall:true}） */
export async function tiebaCollect(forum) {
  const kw = encodeURIComponent(String(forum || '').trim())
  const c = await readerPage(`https://tieba.baidu.com/f?kw=${kw}&ie=utf-8`, { settleMs: 2200 })
  const raw = await c.ev(`(function(){
    var th = document.querySelectorAll('li.j_thread_list');
    var out = [];
    th.forEach(function(li){
      var a = li.querySelector('a.j_th_tit, [data-field] a');
      if (!a) return;
      var replies = li.querySelector('.threadlist_rep_num');
      var tid = (li.getAttribute('data-field') || '').replace(/.*"id":(\\d+).*/, '$1') || (a.href.match(/\\/p\\/(\\d+)/) || [,''])[1];
      out.push({ tid: tid, title: (a.textContent || '').trim().slice(0, 60), url: a.href, replies: replies ? Number(replies.textContent) || 0 : 0 });
    });
    var wall = th.length === 0 && /\\u767b\\u5f55/.test((document.body.textContent || '').slice(0, 2500));
    return JSON.stringify({ loginWall: wall && out.length === 0, threads: out.slice(0, 15) });
  })()`)
  try { const j = JSON.parse(raw); return j.loginWall ? { loginWall: true, threads: [] } : (j.threads || []) } catch { return [] }
}

/** 帖子 → 主楼 + 回复楼层（她亲眼读） */
export async function tiebaRead(threadUrl) {
  const c = await readerPage(threadUrl, { settleMs: 2200 })
  const raw = await c.ev(`(function(){
    var title = (document.querySelector('.core_title_txt') || document.querySelector('h1') || {}).textContent || '';
    var floors = [];
    document.querySelectorAll('.l_post').forEach(function(p, i){
      if (i > 24) return;
      var author = (p.querySelector('.d_name .p_author_name') || {}).textContent || '';
      var body = (p.querySelector('.d_post_content') || {}).textContent || '';
      floors.push({ author: author.trim().slice(0, 20), text: body.replace(/\\s+/g, ' ').trim().slice(0, 200) });
    });
    return JSON.stringify({ title: title.trim().slice(0, 80), floors: floors.slice(0, 18) });
  })()`)
  try { return JSON.parse(raw) } catch { return { title: '', floors: [] } }
}

/* ────────────── 小说（番茄小说 web，公开章节） ────────────── */

/** 书页 → 书名 + 章节列表（最近更新在前需要看排序；这里原样给全量列表的尾部） */
export async function novelToc(bookUrl) {
  const c = await readerPage(bookUrl, { settleMs: 1800 })
  const raw = await c.ev(`(function(){
    var name = (document.querySelector('.page-heading-title, h1') || {}).textContent || '';
    var chapters = [];
    document.querySelectorAll('.chapter-item a, .chapter a, [class*="chapter"] a[href*="/reader"]').forEach(function(a){
      chapters.push({ title: (a.textContent || '').trim().slice(0, 40), url: a.href });
    });
    return JSON.stringify({ name: name.trim().slice(0, 40), chapters: chapters.slice(-12) });
  })()`)
  try { return JSON.parse(raw) } catch { return { name: '', chapters: [] } }
}

/** 章节页 → 正文文本（番茄把正文放在 muye-reader-content 容器里） */
export async function novelRead(chapterUrl) {
  const c = await readerPage(chapterUrl, { settleMs: 1500 })
  // ⭐ 番茄正文是前端渲染的：轮询到正文长度稳定（两次采样不再增长）才取，防"半页就抓"
  const raw = await c.ev(`(async function(){
    var title = '';
    for (var s of ['.muye-reader-title', 'h1.title', 'h1', '.page-title']) {
      var el = document.querySelector(s);
      if (el && (el.textContent || '').trim()) { title = el.textContent.trim(); break; }
    }
    var container = document.querySelector('.muye-reader-content');
    var last = -1, stable = 0;
    for (var i = 0; i < 16; i++) {
      container = container || document.querySelector('.muye-reader-content');
      var len = container ? (container.innerText || '').length : 0;
      if (len > 0 && len === last) { stable++; if (stable >= 2) break; } else stable = 0;
      last = len;
      await new Promise(function(r){ setTimeout(r, 500); });
    }
    var text = container ? (container.innerText || '').replace(/\\n{3,}/g, '\\n\\n').trim() : '';
    return JSON.stringify({ title: title.slice(0, 60), len: text.length, text: text.slice(0, 8000) });
  })()`)
  const j = JSON.parse(raw)
  return { title: j.title || '', text: j.text || '', chars: j.len || 0 }
}

/* ────────────── 阅读值班轮（工具循环：她自己翻） ────────────── */

/* ────────────── 书架（她的阅读进度，持久化在 data/reader-bookshelf.json） ──────────────
 * 👩‍👦 家长模型（2026-11-11）：把她当真人读者——
 *   · 每本书记「读到第几章」，下次接着读（书签），绝不重复读
 *   · 家长约束：一次最多读几章 / 一天最多几章 / 熄灯时段不许看（config.reads.novel，默认即保护值）
 *   · 付费章不绕：只读到试读片段时如实说，进度停在那一章
 *   · 主人随时可在 📖 页书架看到她在读什么、读到哪
 */
const SHELF_FILE = path.join(KIT_DIR, 'data', 'reader-bookshelf.json')
const shelfLoad = () => { try { return JSON.parse(fs.readFileSync(SHELF_FILE, 'utf8')) || {} } catch { return {} } }
const shelfSave = (shelf) => { fs.mkdirSync(path.join(KIT_DIR, 'data'), { recursive: true }); fs.writeFileSync(SHELF_FILE, JSON.stringify(shelf, null, 1), 'utf8') }

const toMin = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : null }
function inCurfew(nl) {
  const a = toMin(nl?.curfewStart), b = toMin(nl?.curfewEnd)
  if (a === null || b === null || a === b) return false
  const now = new Date(); const cur = now.getHours() * 60 + now.getMinutes()
  return a > b ? (cur >= a || cur < b) : (cur >= a && cur < b)
}
function dayCounter() {
  const today = todayKey()
  const d = stateRead('reader-day.json', {})
  return d.day === today ? { day: today, count: Number(d.count) || 0 } : { day: today, count: 0 }
}
function bumpDayCounter() {
  const d = dayCounter(); stateWrite('reader-day.json', { day: d.day, count: d.count + 1 }); return d.count + 1
}

/** 书架视图（含实时追更状态）——给工具和工作台用 */
export async function novelShelf(cfg) {
  const r = cfg.reads || {}
  const books = Array.isArray(r.novels) ? r.novels.filter((b) => b && b.name && b.url) : []
  const shelf = shelfLoad()
  const out = []
  for (const b of books.slice(0, 5)) {
    const s = shelf[b.name] || {}
    let total = 0, latestTitle = '', hasNew = false
    try {
      const toc = await novelToc(b.url); const chs = toc.chapters || []
      total = chs.length; latestTitle = (chs[chs.length - 1] || {}).title || ''
      hasNew = !!latestTitle && latestTitle !== s.lastChapterTitle
    } catch { /* 拉不到就只报书架 */ }
    out.push({
      name: b.name, 读到: s.lastChapterTitle || '还没开始读',
      进度: s.lastIdx !== undefined && total ? `第 ${s.lastIdx + 1}/${total} 章` : '—',
      最新: latestTitle, 有新章: hasNew,
      最后阅读: s.lastReadAt || '还没读过',
    })
  }
  return out
}

/**
 * 她读一本书的一章（书签续读 + 家长约束）。
 * mode: 'next'（接着读，默认）| 'latest'（直接看最新）| 'prev'（重读上一章）| 数字（从最新往回第 N 章）
 * 返回 { ok, text, progress, note } —— text 已含书名/进度/下一章提示，工具直接用。
 */
export async function novelReadBook(cfg, { name = '', mode = 'next' } = {}) {
  const r = cfg.reads || {}
  const nl = r.novel || {}
  const books = Array.isArray(r.novels) ? r.novels.filter((b) => b && b.name && b.url) : []
  if (!books.length) return { ok: false, text: '追更书单是空的 —— 工作台「📖 阅读」页加书（书名 + 番茄目录页链接）' }
  const book = name ? books.find((b) => b.name.includes(name)) : books[0]
  if (!book) return { ok: false, text: '书单里没有这本书（现有：' + books.map((b) => b.name).join('、') + '）' }
  if (inCurfew(nl)) return { ok: false, text: `熄灯时间到了（${nl.curfewStart}–${nl.curfewEnd} 不看小说）—— 明天白天接着读，作息要紧。` }
  const d = dayCounter(); const dailyMax = Number(nl.chaptersPerDay) || 6
  if (d.count >= dailyMax) return { ok: false, text: `今天已经读了 ${d.count} 章（家里定的上限 ${dailyMax} 章）—— 明天接着读，别熬夜。` }

  const toc = await novelToc(book.url); const chs = toc.chapters || []
  if (!chs.length) return { ok: false, text: '目录没读到章节（番茄可能要登录，或链接不对）' }
  const shelf = shelfLoad(); const b = shelf[book.name] || {}
  let idx
  if (mode === 'latest') idx = chs.length - 1
  else if (mode === 'prev') idx = Math.max(0, (b.lastIdx === undefined ? chs.length - 1 : b.lastIdx) - 1)
  else if (/^\d+$/.test(String(mode).trim())) idx = Math.max(0, chs.length - Math.max(1, Number(mode)))
  else idx = Math.min((b.lastIdx === undefined ? -1 : b.lastIdx) + 1, chs.length - 1)   // next：接着读
  const ch = chs[idx]
  const r2 = await novelRead(ch.url)
  const readOk = (r2.text || '').length > 200
  if (readOk) {
    b.lastIdx = idx; b.lastChapterUrl = ch.url; b.lastChapterTitle = r2.title || ch.title
    b.lastReadAt = new Date().toISOString().replace('T', ' ').slice(0, 16); b.total = chs.length
    shelf[book.name] = b; shelfSave(shelf); bumpDayCounter()
    const nextCh = chs[idx + 1]
    return {
      ok: true,
      text: `《${book.name}》${r2.title || ch.title}\n（进度：第 ${idx + 1}/${chs.length} 章 · 今日第 ${d.count + 1}/${dailyMax} 章${nextCh ? ' · 下一章：' + nextCh.title : ' · 已读到最新'})`,
      body: (r2.text || '').slice(0, 4500), nextHint: nextCh ? '说「接着读」就能继续' : '已追平',
    }
  }
  const trial = (r2.chars || 0) > 0
  return { ok: false, text: `《${book.name}》${r2.title || ch.title}：${trial ? '本章是付费内容，网页只给试读片段 —— 不绕付费，进度停在 第' + (idx + 1) + ' 章' : '正文没读到（番茄要登录或网络原因）'}` }
}

let READ_CTX = null
function readExec({ name, args }) {
  const kind = String(args?.kind || '')
  try {
    if (name === 'read_tieba_thread') return tiebaRead(String(args.url || '')).then((r) =>
      JSON.stringify(r).slice(0, 5000))
    if (name === 'read_chapter') {
      // ⭐ 工具循环里读新章：读完更新书架 + 计每日量（家长约束在候选阶段已钳）
      const meta = READ_CTX?.chMap?.[String(args.url || '')]
      return novelRead(String(args.url || '')).then((r) => {
        if (meta && (r.text || '').length > 200) {
          const shelf = shelfLoad(); const b = shelf[meta.book] || {}
          b.lastIdx = meta.idx; b.lastChapterUrl = meta.url; b.lastChapterTitle = r.title || meta.title || ''
          b.lastReadAt = new Date().toISOString().replace('T', ' ').slice(0, 16); b.total = meta.total
          shelf[meta.book] = b; shelfSave(shelf); bumpDayCounter()
        }
        return ('【' + (r.title || '章节') + '】\n' + r.text).slice(0, 5000) || '（章节内容没读到）'
      })
    }
    if (name === 'read_toc') return novelToc(String(args.url || '')).then((r) => JSON.stringify(r).slice(0, 3000))
    return '未知工具 ' + name
  } catch (e) { return '读取失败：' + String(e?.message || e).slice(0, 160) }
}

/** 阅读轮：kind = 'tieba' | 'novel'；开关没开直接拒 */
export async function runReads(cfg, kind, { reason = 'manual' } = {}) {
  const r = cfg.reads || {}
  if (kind === 'tieba' && !r.tiebaEnabled) return { ok: false, reason: '「看贴吧」开关没开（📖 页设置里开）' }
  if (kind === 'novel' && !r.novelEnabled) return { ok: false, reason: '「看小说」开关没开（📖 页设置里开）' }
  const nl = r.novel || {}

  const books = Array.isArray(r.novels) ? r.novels.filter((b) => b && b.name && b.url) : []
  const forums = Array.isArray(r.tiebaForums) ? r.tiebaForums.map(String).filter(Boolean) : []
  if (kind === 'tieba' && !forums.length) return { ok: false, reason: '还没填关注的吧（📖 页设置里加）' }
  if (kind === 'novel' && !books.length) return { ok: false, reason: '还没有追更书单（📖 页设置里加：书名+目录页链接）' }

  // 👩‍👦 家长约束：熄灯时段 + 每日上限（看小说轮也受管）
  if (kind === 'novel' && inCurfew(nl)) return { ok: false, reason: `熄灯时段（${nl.curfewStart}–${nl.curfewEnd}）—— 小说明天再看，作息要紧` }
  const d0 = dayCounter(); const dailyMax = Number(nl.chaptersPerDay) || 6
  if (kind === 'novel' && d0.count >= dailyMax) return { ok: false, reason: `今天已经读了 ${d0.count} 章（家里定的上限 ${dailyMax} 章）—— 明天继续` }

  const perRound = kind === 'tieba' ? Math.max(1, Number(r.tiebaPerRound) || 3) : 1
  const sessionMax = Math.min(Number(nl.chaptersPerSession) || 3, dailyMax - d0.count)
  const system = [
    '─── 看的方式（2026-11-07 新值班线）───',
    kind === 'tieba'
      ? '下面是关注的贴吧吧里的候选帖。工具 `read_tieba_thread(url)` 会真实打开帖子让你读到正文和回复。'
        + `每条要推给主人的帖子，必须先亲自读过；把帖子里的真实内容/槽点写进推荐理由。本轮最多推 ${perRound} 条。`
        + '只允许推候选列表里的帖子。'
      : '下面是追更书单的**新章节清单**（书架里她还没读过的部分，已经按家长定的量截好）。'
        + '工具 `read_chapter(url)` 会真实打开章节让你读到正文 —— **一次读一章，按顺序**，读完一条再下一条；'
        + '读满清单里的章节后就写「追更感想」（每本书一段：这几章发生了什么、你作为读者真实的感受）。'
        + '书已经追平的（没有新章）就不必读。别贪多，读满为止。',
    '输出格式：直接输出 Markdown，每条以 `### <标题或书名>` 开始，后接正文。最后不要总结陈词。',
  ].join('\n\n')

  // 候选：贴吧=各吧第一页帖子；小说=书架进度 → 她没读过的新章（家长约束内）
  READ_CTX = { cfg, chMap: {} }
  const candidates = []
  if (kind === 'tieba') {
    let loginWall = false
    for (const forum of forums.slice(0, 4)) {
      try {
        const th = await tiebaCollect(forum)
        if (th && th.loginWall) { loginWall = true; continue }
        candidates.push({ forum, threads: th })
      } catch (e) { candidates.push({ forum, error: String(e).slice(0, 80) }) }
    }
    if (loginWall && !candidates.some((c) => (c.threads || []).length)) {
      return { ok: false, reason: '贴吧需要登录 —— 去 📖 页点「贴吧登录」，登录一次 cookies 就会记住' }
    }
  } else {
    const shelf = shelfLoad()
    for (const b of books.slice(0, 3)) {
      try {
        const toc = await novelToc(b.url); const chs = toc.chapters || []
        const s = shelf[b.name] || {}
        const lastIdx = s.lastIdx === undefined ? -1 : s.lastIdx
        const fresh = chs.slice(lastIdx + 1)                       // 她没读过的
        const allow = Math.min(fresh.length, sessionMax)
        candidates.push({
          name: b.name, bookName: b.name, url: b.url, book: toc.name || b.name,
          readUpTo: lastIdx + 1, total: chs.length,
          newChapters: fresh.slice(0, Math.max(0, allow)).map((c2, i) => ({
            no: lastIdx + 2 + i, title: c2.title, url: c2.url,
          })),
          caughtUp: fresh.length === 0,
          morePending: fresh.length > allow ? fresh.length - allow : 0,
        })
        // 登记 url → 书架更新元数据（read_chapter 读完自动记进度）
        for (const [i, c2] of fresh.slice(0, Math.max(0, allow)).entries()) {
          READ_CTX.chMap[c2.url] = { book: b.name, idx: lastIdx + 1 + i, url: c2.url, title: c2.title, total: chs.length }
        }
      } catch (e) { candidates.push({ name: b.name, error: String(e).slice(0, 80) }) }
    }
  }

  const tools = [
    { type: 'function', function: { name: 'read_tieba_thread', description: '真实打开一个贴吧帖子，读到主楼和回复原文。', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'], additionalProperties: false } } },
    { type: 'function', function: { name: 'read_chapter', description: '真实打开小说章节，读到正文。一次一章，按清单顺序。', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'], additionalProperties: false } } },
    { type: 'function', function: { name: 'read_toc', description: '读小说目录页（书名+章节列表）。', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'], additionalProperties: false } } },
  ]

  const user = '【本轮候选】\n' + JSON.stringify(candidates).slice(0, 20000) + `\n\n（原因：${reason}）按上面的规矩亲自读、然后输出。`
  const { final } = await chatWithTools(cfg, [{ role: 'system', content: system }, { role: 'user', content: user }], tools, readExec, { maxRounds: 24, kind: kind === 'tieba' ? 'tieba-round' : 'novel-round' })
  const report = String(final || '').trim()
  if (!report) throw new Error('她这轮没输出内容')

  // 落盘 + 记忆入库
  const readsDir = path.join(cfgHome(), 'reads')
  fs.mkdirSync(readsDir, { recursive: true })
  const file = path.join(readsDir, `${todayKey()}-${kind}.md`)
  fs.appendFileSync(file, (exists(file) ? '\n\n' : '') + report, 'utf8')
  try {
    const n = videomem.ingestReport(kind, report, todayKey())
    videomem.event(kind, 'reads_done', { reason, ingested: n })
    kitLog(`阅读轮（${kind}）记忆入库：${n} 条`)
  } catch (e) { kitLog('阅读记忆入库失败：' + String(e?.message || e)) }
  kitLog(`阅读轮结束：${kind}（${reason}）`)
  return { ok: true, report: report.slice(0, 1500), file: path.basename(file) }
}

function cfgHome() {
  // 日报/阅读记录放 kit 的 data 下（记忆库同区）
  return path.join(process.cwd(), 'data')
}

/* ────────────── 状态 + 异步派发（与值班轮同一套规矩） ────────────── */

const READS_TTL = 2 * 60 * 60 * 1000 // 2 小时内 running 视为仍在跑

export function readsState(kind) {
  const s = stateRead(`reads-${kind}.json`, {})
  if (s.status === 'running' && Date.now() - (s.startedAt || 0) > READS_TTL) s.status = 'stale'
  return s
}

export function readsRunning(kind) {
  return readsState(kind).status === 'running'
}

/** 异步派发一轮阅读（独立进程 reads-runner.mjs），立即返回 */
export function kickReadsDetached(kind, reason = '工作台手动') {
  if (kind !== 'tieba' && kind !== 'novel') return { ok: false, reason: '未知阅读类型' }
  if (readsRunning(kind)) return { ok: false, reason: '上一轮还在跑' }
  const runner = path.join(KIT_DIR, 'src', 'reads-runner.mjs')
  stateWrite(`reads-${kind}.json`, { status: 'queued', queuedAt: Date.now(), reason })
  const child = spawn(process.execPath, [runner, '--kind', kind, '--reason', reason], {
    detached: true, stdio: 'ignore', windowsHide: true,
    env: { ...process.env, KIT_DIR },
  })
  child.unref()
  kitLog(`阅读轮已派发（独立进程）：${kind}`)
  return { ok: true, started: true, detail: `${kind === 'novel' ? '看小说' : '看贴吧'}已在后台开始，稍后刷新看结果` }
}

/** 开可见窗口登录（贴吧/番茄），cookies 存 reader-profile，登录一次即可 */
export function startReaderLogin(kind) {
  const url = kind === 'novel' ? 'https://fanqienovel.com/' : 'https://tieba.baidu.com/'
  return visibleLogin(url)
}
