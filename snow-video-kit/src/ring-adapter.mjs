/**
 * ring-adapter.mjs —— 「环形的心 · 刷视频」统一插件接口（stdio MCP）
 * ============================================================================
 * 环形的心（ringmind）没有插件系统，它的插件接口 = mcp/server.mjs 这层 stdio MCP。
 * 本适配器把两套工具**聚合成一个 MCP 入口**：
 *   · ring_*    —— 原样代理 环形的心/mcp/server.mjs（记忆库逻辑仍在环形的心手里，
 *                  宠物号.db 依旧只由它的代码读写；它更新工具本适配器自动跟上）
 *   · video_*   —— 本包的刷视频工具（状态/日报/跑一轮/热榜/搜索/跨平台记忆）
 *
 * 用途：把这个文件注册进 DSH（或任何 MCP 客户端）作为唯一入口，
 *       「她」的工具列表里就是一套完整的「环形的心 · 刷视频」插件。
 * 降级：环形的心那半边起不来时，video_* 照常工作，ring_* 返回明确错误。
 * ============================================================================
 */
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { McpStdio } from './mcpclient.mjs'
import { loadConfig, resolveBili, resolveDouyin, kitLog } from './config.js'
import { TOOLS as VIDEO_TOOLS, callTool as videoCall } from './tools.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const KIT_DIR = path.dirname(HERE)
const cfg = loadConfig()

/** 环形的心 mcp/server.mjs 的位置（config.json → ring.mcpServer 可覆盖） */
function ringServerPath() {
  if (cfg.ring?.mcpServer) return cfg.ring.mcpServer
  // kit 在 桌面\插件\刷视频插件\snow-video-kit，环形的心 在 桌面\插件\环形的心 —— 上跳两级
  // （2026-11-08 修正：原来只上跳一级，指到一个不存在的路径，ring_* 一直起不来）
  return path.join(path.dirname(path.dirname(KIT_DIR)), '环形的心', 'mcp', 'server.mjs')
}

let ring = null
function ringUp() {
  const p = ringServerPath()
  if (!fs.existsSync(p)) return null
  if (!ring) {
    const env = { PYTHONUTF8: '1' }
    if (cfg.ring?.dbPath) env.RING_DB = cfg.ring.dbPath
    ring = new McpStdio({
      command: process.execPath, args: [p],
      cwd: path.dirname(path.dirname(p)), name: 'ring',
      env,
    })
  }
  try { ring.ensureReady() } catch { /* 稍后再试 */ }
  return ring
}

async function ringToolsSafe() {
  const r = ringUp()
  if (!r) return { tools: [], error: '环形的心 mcp/server.mjs 不存在: ' + ringServerPath() }
  try { return { tools: await r.listTools() } }
  catch (e) { return { tools: [], error: String(e?.message || e) } }
}

async function ringCallSafe(name, args) {
  const r = ringUp()
  if (!r) return { isError: true, text: '环形的心记忆工具不可用（' + ringServerPath() + ' 不存在）' }
  try { return await r.call(name, args, 120000) }
  catch (e) { return { isError: true, text: '记忆工具执行失败：' + String(e?.message || e) } }
}

const RING_PREFIX = 'ring_'
const isRing = (name) => name.startsWith(RING_PREFIX)

// ── 聚合后的工具列表 ─────────────────────────────────────────────────────
async function allTools() {
  const video = VIDEO_TOOLS.map((t) => ({ ...t, _src: 'video' }))
  const { tools, error } = await ringToolsSafe()
  const ring = tools.map((t) => ({ ...t, _src: 'ring' }))
  return [...ring, ...video, ...(error ? [{ name: '_ring_error', description: '环形的心记忆工具暂时不可用：' + error, inputSchema: { type: 'object', properties: {} }, _src: 'meta' }] : [])]
}

async function dispatch(name, args) {
  if (isRing(name)) {
    const r = await ringCallSafe(name, args)
    return { isError: Boolean(r.isError), text: r.text }
  }
  if (name === '_ring_error') return { isError: true, text: '环形的心记忆工具暂时不可用，video_* 工具不受影响' }
  const out = await videoCall(name, args)
  return { isError: false, text: String(out) }
}

// ── stdio JSON-RPC（一行一条） ───────────────────────────────────────────
let buf = ''
function reply(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n') }
function replyErr(id, code, message) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n') }

process.stdin.setEncoding('utf8')
process.stdin.on('data', (c) => {
  buf += c
  let i
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1)
    if (!line) continue
    let msg; try { msg = JSON.parse(line) } catch { continue }
    if (msg.id === undefined) continue
    if (msg.method === 'initialize') {
      reply(msg.id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'ring-video-plugin', version: '0.1.0' } })
    } else if (msg.method === 'notifications/initialized') {
      /* 无需回应 */
    } else if (msg.method === 'tools/list') {
      allTools().then((tools) => reply(msg.id, { tools: tools.map(({ _src, ...t }) => t) }))
        .catch((e) => replyErr(msg.id, -32603, String(e?.message || e)))
    } else if (msg.method === 'tools/call') {
      const { name, arguments: args } = msg.params || {}
      dispatch(name, args || {})
        .then((r) => reply(msg.id, { content: [{ type: 'text', text: String(r.text) }], isError: Boolean(r.isError) }))
        .catch((e) => replyErr(msg.id, -32603, String(e?.message || e)))
    } else if (msg.method === 'ping') {
      reply(msg.id, {})
    } else {
      replyErr(msg.id, -32601, 'method not found: ' + msg.method)
    }
  }
})
process.stdin.on('end', () => { try { ring?.stop?.() } catch { /* 忽略 */ }; process.exit(0) })
kitLog('ring-adapter 已启动（环形的心 · 刷视频 统一插件接口）')
process.on('disconnect', () => process.exit(0))
