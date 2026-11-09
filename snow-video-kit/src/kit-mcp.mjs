/**
 * kit-mcp.mjs —— 给「她」的 stdio MCP server（零依赖，DSH / 其它 MCP 客户端均可挂载）
 * 挂载：cordis.patch.yml 里
 *   - insert: [{ id: mcp-video-kit, name: '@deepseek-ai/dsh-mcp-client',
 *               config: { serverName: video-kit, transport: stdio,
 *                         command: <node>, args: [<本文件绝对路径>], toolCallTimeoutMs: 120000 }}]
 */
import { kitLog } from './config.js'
import { KIT_VERSION } from './version.mjs'
import { TOOLS, callTool } from './tools.mjs'

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
      reply(msg.id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'snow-video-kit', version: KIT_VERSION } })
    } else if (msg.method === 'notifications/initialized') {
      /* 无需回应 */
    } else if (msg.method === 'tools/list') {
      reply(msg.id, { tools: TOOLS })
    } else if (msg.method === 'tools/call') {
      const { name, arguments: args } = msg.params || {}
      callTool(name, args || {})
        .then((text) => reply(msg.id, { content: [{ type: 'text', text: String(text) }], isError: false }))
        .catch((e) => reply(msg.id, { content: [{ type: 'text', text: '工具执行出错：' + String(e?.message || e) }], isError: true }))
    } else if (msg.method === 'ping') {
      reply(msg.id, {})
    } else {
      replyErr(msg.id, -32601, 'method not found: ' + msg.method)
    }
  }
})
process.stdin.on('end', () => process.exit(0))
kitLog('kit-mcp stdio 已启动（video_* 工具为「她」就绪）')
process.on('disconnect', () => process.exit(0))
