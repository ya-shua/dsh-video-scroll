/**
 * tools.mjs —— 「她」可调用的 video_* 工具定义与执行器
 * kit-mcp.mjs（stdio，给 DSH 大脑挂载）与 web 工作台共用这一份。
 */
import { loadConfig, resolveBili, resolveDouyin } from './config.js'
import { snowStatus } from './snow.mjs'
import * as bili from './bili.mjs'
import * as douyin from './douyin.mjs'
import { roundState, kickRoundDetached, runRound, latestReport } from './rounds.mjs'

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
      if (args.kind === 'bili') return JSON.stringify(kickRoundDetached('bili', args.reason || '她发起'))
      return JSON.stringify(await runRound('douyin', { reason: args.reason || '她发起' }))
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
    default: return '未知工具 ' + name
  }
}
