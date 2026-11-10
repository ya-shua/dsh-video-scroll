/**
 * tools.mjs —— 「她」可调用的工具定义与执行器
 * kit-mcp.mjs（stdio，给 DSH 大脑挂载）与 web 工作台共用这一份。
 * ⭐ 2026-11-11：新增 novel_*（看小说，番茄源）——ring-adapter / kit-mcp 自动带上。
 */
import { loadConfig, resolveBili, resolveDouyin } from './config.js'
import { snowStatus } from './snow.mjs'
import * as bili from './bili.mjs'
import * as douyin from './douyin.mjs'
import * as reads from './reads.mjs'
import { roundState, kickRoundDetached, latestReport } from './rounds.mjs'

export const TOOLS = [
  {
    name: 'video_status',
    description: '查看刷B站/刷抖音两个值班任务的实时状态（QQ是否在线、凭证、今日进度、最近一条日志）。无需参数。',
    inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'video_latest_report',
    description: '读取刷B站或刷抖音最新一天的值班日报全文。参数 kind: "bili" 或 "douyin"。',
    inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['bili', 'douyin'] } }, required: ['kind'], additionalProperties: false },
  },
  {
    name: 'video_run_round',
    description: '让她启动一轮值班刷视频（异步：立即返回开始确认，用 video_status 查进度）。参数 kind: "bili" 或 "douyin"，可选 reason 说明缘由。',
    inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['bili', 'douyin'] }, reason: { type: 'string' } }, required: ['kind'], additionalProperties: false },
  },
  {
    name: 'video_bili_hot',
    description: '获取B站当前热门视频榜单（快速、只读，返回紧凑列表）。无需参数。',
    inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'video_bili_search',
    description: '在B站搜索视频，返回标题/UP主/BV号等紧凑列表。参数 keyword 必填，page 可选（默认1）。',
    inputSchema: { type: 'object', properties: { keyword: { type: 'string' }, page: { type: 'number' } }, required: ['keyword'], additionalProperties: false },
  },
  {
    name: 'video_memory',
    description: '查询跨平台记忆库（B站+抖音互通）：最近推过什么、按关键词搜记忆、跨平台查重。参数 action: "recent"(默认)|"search"，可选 platform("bili"/"douyin")、q(关键词)、days(天数,默认7)、limit(默认20)。',
    inputSchema: {
      type: 'object',
      properties: { action: { type: 'string', enum: ['recent', 'search'] }, platform: { type: 'string', enum: ['bili', 'douyin'] }, q: { type: 'string' }, days: { type: 'number' }, limit: { type: 'number' } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'novel_updates',
    description: '看追更书单的最新章节（每本书最新一话的标题+链接）。书单在「📖 阅读」页配置；书单为空时提示先去加书。无需参数。',
    inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'novel_read',
    description: '读小说章节正文（番茄小说，免费章节可全文；付费章只有试读片段，会如实说明）。默认读最新一章。可用于追更、回应主人「看看XX更新没」。',
    inputSchema: {
      type: 'object',
      properties: {
        book: { type: 'string', description: '书名（书单里的，支持包含匹配；留空=第一本）' },
        chapter: { type: 'string', description: "'latest'（默认）或数字：从最新往回第几章" },
      },
      required: [],
      additionalProperties: false,
    },
  },
]

export async function callTool(name, args = {}) {
  const cfg = loadConfig()
  const resolveB = resolveBili(cfg), resolveD = resolveDouyin(cfg)
  switch (name) {
    case 'video_status': {
      const b = bili.biliStatus(cfg, resolveB), d = douyin.douyinStatus(cfg, resolveD)
      const slim = (x) => ({ 凭证: x.credOk ? '已登录' : '未登录', 环境: x.venvOk ? '就绪' : '缺失', 今日: `${x.todayCount}/${x.perDay}`, 最近日志: x.lastLog?.slice(-1)[0] || '' })
      return JSON.stringify({
        qq: { 在线: snowStatus().online, selfId: snowStatus().selfId || '' },
        bili: slim(b), douyin: slim(d),
        rounds: { bili: roundState('bili').status || 'idle', douyin: roundState('douyin').status || 'idle' },
      }, null, 1)
    }
    case 'video_latest_report': {
      const r = latestReport(args.kind)
      return r.ok ? (r.file ? `【${args.kind} 最新日报 ${r.file}】` + '\n' + r.content.slice(0, 12000) : `${args.kind} 今天还没有日报`) : ('读取失败：' + r.error)
    }
    case 'video_run_round': {
      // 她发起 = byAgent：两个平台都走异步派发立即返回（不再同步等抖音整轮跑完导致 MCP 超时），
      // 自由模式开着时随时放行（无时间窗），受每日轮数/花费限额约束
      return JSON.stringify(kickRoundDetached(args.kind, args.reason || '她发起', { byAgent: true }))
    }
    case 'video_bili_hot':
      return (await bili.biliQuick(cfg, resolveB, 'bili_hot_videos', {})).slice(0, 6000)
    case 'video_bili_search':
      return (await bili.biliQuick(cfg, resolveB, 'bili_search', { keyword: String(args.keyword || ''), page: args.page || 1 })).slice(0, 6000)
    case 'video_memory': {
      const vm = await import('./videomem.mjs')
      vm.configureMemory(cfg.memory?.dbPath)
      if ((args.action || 'recent') === 'search') {
        const rows = vm.crossSeen({ titleLike: String(args.q || ''), days: args.days || 14, limit: args.limit || 20 })
        return rows.length ? rows.map((r) => `[${r.platform}] ${r.title || r.vid} @${r.picked_at.slice(0, 10)}`).join('\n') : '没有匹配的记忆'
      }
      const rows = vm.recent({ platform: args.platform || '', q: args.q || '', days: args.days || 7, limit: args.limit || 20 })
      return rows.length
        ? rows.map((r) => `[${r.platform}] ${r.vid} ${r.title || ''}${r.grade ? '（' + r.grade + '）' : ''} @${r.picked_at.slice(0, 10)}`).join('\n')
        : '记忆库最近没有记录'
    }
    case 'novel_updates': {
      const books = (cfg.reads?.novels || []).filter((b) => b && b.name && b.url)
      if (!books.length) return '追更书单是空的 —— 工作台「📖 阅读」页加书（书名 + 番茄目录页链接）'
      const lines = []
      for (const b of books.slice(0, 5)) {
        try {
          const toc = await reads.novelToc(b.url)
          const chs = toc.chapters || []
          const last = chs[chs.length - 1]
          lines.push(`《${b.name}》${toc.name ? `（${toc.name}）` : ''} 最新${last ? `：${last.title}` : '：没读到章节'}${chs.length ? ` · 目录 ${chs.length} 项` : ''}`)
        } catch (e) { lines.push(`《${b.name}》读取失败：${String(e).slice(0, 80)}`) }
      }
      return lines.join('\n')
    }
    case 'novel_read': {
      const books = (cfg.reads?.novels || []).filter((b) => b && b.name && b.url)
      if (!books.length) return '追更书单是空的 —— 工作台「📖 阅读」页加书（书名 + 番茄目录页链接）'
      const name = String(args.book || '').trim()
      const book = name ? books.find((b) => b.name.includes(name)) : books[0]
      if (!book) return '书单里没有这本书（现有：' + books.map((b) => b.name).join('、') + '）'
      const toc = await reads.novelToc(book.url)
      const chs = toc.chapters || []
      if (!chs.length) return `《${book.name}》目录没读到章节（可能要番茄登录，或链接不对）`
      let ch
      if (args.chapter === undefined || args.chapter === '' || args.chapter === 'latest') ch = chs[chs.length - 1]
      else {
        const back = Math.max(1, Math.abs(Number(args.chapter) || 1))
        ch = chs[Math.max(0, chs.length - back)] || chs[0]
      }
      const r = await reads.novelRead(ch.url)
      const text = (r.text || '').trim()
      if (!text) return `《${book.name}》${r.title || ch.title || ''}：正文没读到（付费章节只给试读片段，或需要番茄登录）`
      const cap = 4500
      const more = text.length > cap ? `\n\n…（正文共 ${text.length} 字，已截断；需要后半段再说一声）` : ''
      return `《${book.name}》${r.title || ch.title || ''}\n\n${text.slice(0, cap)}${more}`
    }
    default: return '未知工具 ' + name
  }
}
