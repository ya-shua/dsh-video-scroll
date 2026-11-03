/**
 * mcpclient.mjs —— 极简 stdio MCP 客户端（零依赖）
 * 负责拉起 mcp_server.py / douyin tools/mcp-server.mjs 并做
 * initialize → tools/list → tools/call。协议：stdin/stdout 按行分隔 JSON-RPC。
 */
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'

export class McpStdio {
  constructor({ command, args = [], env = {}, cwd, name = 'kit-mcp' }) {
    this.name = name
    this.command = command
    this.args = args
    this.env = env
    this.cwd = cwd
    this.child = null
    this.buf = ''
    this.waiters = []      // { id, resolve, reject, timer }
    this.ready = false
    this.tools = []
    this.exited = false
  }

  start() {
    if (this.child) return
    this.child = spawn(this.command, this.args, {
      cwd: this.cwd, env: { ...process.env, ...this.env }, stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.child.stdout.setEncoding('utf8')
    this.child.stdout.on('data', (c) => this._onData(c))
    this.child.stderr.setEncoding('utf8')
    this.child.stderr.on('data', () => { /* MCP server 的日志走 stderr，忽略 */ })
    this.child.on('exit', (code) => { this.exited = true; this.ready = false; this._rejectAll(new Error(`${this.name} MCP 进程退出 code=${code}`)) })
  }

  _onData(chunk) {
    this.buf += chunk
    let idx
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, idx).trim()
      this.buf = this.buf.slice(idx + 1)
      if (!line) continue
      let msg
      try { msg = JSON.parse(line) } catch { continue }
      if (msg.id !== undefined) {
        const w = this.waiters.find((x) => x.id === msg.id)
        if (w) { this.waiters = this.waiters.filter((x) => x !== w); clearTimeout(w.timer); w.resolve(msg) }
      }
    }
  }

  _rejectAll(err) {
    for (const w of this.waiters) { clearTimeout(w.timer); w.reject(err) }
    this.waiters = []
  }

  request(method, params, timeoutMs = 60000) {
    if (this.exited || !this.child) return Promise.reject(new Error(`${this.name} MCP 未运行`))
    const id = randomBytes(6).toString('hex')
    const p = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.waiters = this.waiters.filter((x) => x !== w); reject(new Error(`${this.name} MCP ${method} 超时`)) }, timeoutMs)
      const w = { id, resolve, reject, timer }
      this.waiters.push(w)
    })
    this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    return p
  }

  async ensureReady(timeoutMs = 30000) {
    if (this.ready) return
    this.start()
    const init = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'snow-video-kit', version: '0.1.0' },
    }, timeoutMs)
    this.serverInfo = init?.result?.serverInfo || {}
    this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
    this.ready = true
  }

  async listTools() {
    await this.ensureReady()
    const r = await this.request('tools/list', {}, 30000)
    this.tools = r?.result?.tools || []
    return this.tools
  }

  async call(name, args = {}, timeoutMs = 180000) {
    await this.ensureReady()
    const r = await this.request('tools/call', { name, arguments: args }, timeoutMs)
    if (r?.error) throw new Error(`MCP ${name}: ${r.error.message || '未知错误'}`)
    const out = r?.result || {}
    const text = (out.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n')
    return { isError: Boolean(out.isError), text }
  }

  /** OpenAI tools 数组（从 tools/list 转换） */
  async openaiTools() {
    const tools = await this.listTools()
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description || '',
        parameters: t.inputSchema || { type: 'object', properties: {} },
      },
    }))
  }

  stop() {
    try { this.child?.kill() } catch { /* 忽略 */ }
    this.child = null; this.ready = false; this.exited = true
  }
}
