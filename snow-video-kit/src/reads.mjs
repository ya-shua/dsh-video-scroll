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
  const c = await readerPage(chapterUrl, { settleMs: 1800 })
  const raw = await c.ev(`(function(){
    var t = (document.querySelector('h1') || {}).textContent || '';
    var ps = [];
    document.querySelectorAll('.muye-reader-content p, .muye-reader-content').forEach(function(el){
      var s = (el.textContent || '').trim();
      if (s) ps.push(s.slice(0, 300));
    });
    return JSON.stringify({ title: t.trim().slice(0, 60), paras: ps.slice(0, 24) });
  })()`)
  const j = JSON.parse(raw)
  const text = (j.paras || []).join('\n').slice(0, 6000)
  return { title: j.title || '', text }
}

/* ────────────── 阅读值班轮（工具循环：她自己翻） ────────────── */

let READ_CTX = null
function readExec({ name, args }) {
  const kind = String(args?.kind || '')
  try {
    if (name === 'read_tieba_thread') return tiebaRead(String(args.url || '')).then((r) =>
      JSON.stringify(r).slice(0, 5000))
    if (name === 'read_chapter') return novelRead(String(args.url || '')).then((r) =>
      ('【' + (r.title || '章节') + '】\n' + r.text).slice(0, 5000) || '（章节内容没读到）')
    if (name === 'read_toc') return novelToc(String(args.url || '')).then((r) => JSON.stringify(r).slice(0, 3000))
    return '未知工具 ' + name
  } catch (e) { return '读取失败：' + String(e?.message || e).slice(0, 160) }
}

/** 阅读轮：kind = 'tieba' | 'novel'；开关没开直接拒 */
export async function runReads(cfg, kind, { reason = 'manual' } = {}) {
  const r = cfg.reads || {}
  if (kind === 'tieba' && !r.tiebaEnabled) return { ok: false, reason: '「看贴吧」开关没开（📖 页设置里开）' }
  if (kind === 'novel' && !r.novelEnabled) return { ok: false, reason: '「看小说」开关没开（📖 页设置里开）' }

  READ_CTX = { cfg, home: path.join(process.cwd()), tools: {} }
  const books = Array.isArray(r.novels) ? r.novels.filter((b) => b && b.name && b.url) : []
  const forums = Array.isArray(r.tiebaForums) ? r.tiebaForums.map(String).filter(Boolean) : []
  if (kind === 'tieba' && !forums.length) return { ok: false, reason: '还没填关注的吧（📖 页设置里加）' }
  if (kind === 'novel' && !books.length) return { ok: false, reason: '还没有追更书单（📖 页设置里加：书名+目录页链接）' }

  const perRound = kind === 'tieba' ? Math.max(1, Number(r.tiebaPerRound) || 3) : 1
  const system = [
    '─── 看的方式（2026-11-07 新值班线）───',
    kind === 'tieba'
      ? '下面是关注的贴吧吧里的候选帖。工具 `read_tieba_thread(url)` 会真实打开帖子让你读到正文和回复。'
        + `每条要推给主人的帖子，必须先亲自读过；把帖子里的真实内容/槽点写进推荐理由。本轮最多推 ${perRound} 条。`
        + '只允许推候选列表里的帖子。'
      : '下面是追更书单的目录页信息。工具 `read_chapter(url)` 会真实打开章节让你读到正文。'
        + '读最新章节，写「追更感想」：这一章发生了什么、你作为读者真实的感受（人设口吻）。一本书一段即可。',
    '输出格式：直接输出 Markdown，每条以 `### <标题或书名>` 开始，后接正文。最后不要总结陈词。',
  ].join('\n\n')

  // 候选：贴吧=各吧第一页帖子；小说=每本书的目录
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
    for (const b of books.slice(0, 3)) {
      try { const toc = await novelToc(b.url); candidates.push({ name: b.name, url: b.url, ...toc }) } catch (e) { candidates.push({ name: b.name, error: String(e).slice(0, 80) }) }
    }
  }

  const tools = [
    { type: 'function', function: { name: 'read_tieba_thread', description: '真实打开一个贴吧帖子，读到主楼和回复原文。', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'], additionalProperties: false } } },
    { type: 'function', function: { name: 'read_chapter', description: '真实打开小说章节，读到正文。', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'], additionalProperties: false } } },
    { type: 'function', function: { name: 'read_toc', description: '读小说目录页（书名+章节列表）。', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'], additionalProperties: false } } },
  ]

  const user = '【本轮候选】\n' + JSON.stringify(candidates).slice(0, 20000) + `\n\n（原因：${reason}）按上面的规矩亲自读、然后输出。`
  const { final } = await chatWithTools(cfg, [{ role: 'system', content: system }, { role: 'user', content: user }], tools, readExec, { maxRounds: 18, kind: kind === 'tieba' ? 'tieba-round' : 'novel-round' })
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
    detached: true, stdio: 'ignore',
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
