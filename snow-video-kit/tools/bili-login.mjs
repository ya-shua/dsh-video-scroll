#!/usr/bin/env node
/**
 * tools/bili-login.mjs —— 补 B站凭证（扫码登录，独立于 DSH）
 * ============================================================================
 * 干什么：spawn ~/.dsh/bili-duty/mcp_server.py → bili_login 出二维码 →
 *         复制到 state/bili-qrcode.png（给 present 用）→ 轮询 bili_login_check
 *         直到扫码成功（MCP 自己会把 sessdata/bili_jct/buvid3/dedeuserid 写进
 *         bili_credential.json）。
 *
 * 用法：node tools/bili-login.mjs
 * 输出标记：QR_READY / CHECK n status / LOGIN_OK / LOGIN_FAILED
 * 二维码 180 秒有效，过期就重跑。
 */
import fs from 'node:fs'
import path from 'node:path'
import { McpStdio } from '../src/mcpclient.mjs'
import { loadConfig, resolveBili, KIT_DIR } from '../src/config.js'

const cfg = loadConfig()
const resolve = resolveBili(cfg)
const OUT = path.join(KIT_DIR, 'state', 'bili-qrcode.png')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const mcp = new McpStdio({
  command: resolve.python,
  args: [resolve.mcpServer],
  cwd: resolve.home,
  name: 'bili-login',
  env: { BILI_DUTY_HOME: resolve.home, PYTHONUTF8: '1' },
})
mcp.start()

let info = {}
try {
  const r = await mcp.call('bili_login', {}, 120000)
  try { info = JSON.parse(r.text) } catch { info = { raw: r.text } }
} catch (e) {
  console.log('LOGIN_FAILED 调 bili_login 出错：' + String(e?.message || e).slice(0, 300))
  try { mcp.stop() } catch { /* 忽略 */ }
  process.exit(1)
}

if (info.status === 'already_logged_in') {
  console.log('LOGIN_OK 已经登录过了（凭证文件在）')
  try { mcp.stop() } catch { /* 忽略 */ }
  process.exit(0)
}
if (info.status !== 'qrcode_ready') {
  console.log('LOGIN_FAILED 没拿到二维码：' + JSON.stringify(info).slice(0, 300))
  try { mcp.stop() } catch { /* 忽略 */ }
  process.exit(1)
}

const src = info.qrcode_file || path.join(resolve.home, 'qrcode_login.png')
try { fs.copyFileSync(src, OUT); console.log('QR_READY ' + OUT) } catch (e) {
  console.log('QR_READY（复制失败，原图在 ' + src + '）')
}
if (info.qrcode_url) console.log('QR_URL ' + info.qrcode_url)

let done = false
for (let i = 1; i <= 58; i++) {
  await sleep(3000)
  let s = {}
  try {
    const c = await mcp.call('bili_login_check', {}, 60000)
    try { s = JSON.parse(c.text) } catch { s = { raw: String(c.text).slice(0, 200) } }
  } catch (e) {
    console.log(`CHECK ${i} err ${String(e?.message || e).slice(0, 100)}`)
    continue
  }
  const st = s.status || '?'
  console.log(`CHECK ${i} ${st} ${String(s.message || '').slice(0, 80)}`)
  if (st === 'done' || st === 'already_logged_in' || /登录成功/.test(String(s.message || ''))) { done = true; break }
  if (st === 'timeout') break
}

try { mcp.stop() } catch { /* 忽略 */ }
console.log(done ? 'LOGIN_OK' : 'LOGIN_FAILED 超时或没扫（重跑本脚本出新的二维码）')
process.exit(done ? 0 : 1)