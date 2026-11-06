/**
 * self-update.mjs —— 独立更新进程（工作台「一键更新」派发）
 * 流程：git pull --ff-only → 停掉旧 8412 服务 → 隐藏拉起新版本 → 记录结果 → 退出。
 * 独立于旧服务进程（旧进程死了不影响本进程收尾）；进度写 state/update.json。
 */
import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { KIT_DIR, kitLog } from './config.js'

const UPD = path.join(KIT_DIR, 'state', 'update.json')
const say = (msg) => {
  try {
    const st = JSON.parse(fs.readFileSync(UPD, 'utf8'))
    st.log = [...(st.log || []), msg].slice(-10)
    st.at = new Date().toISOString()
    fs.writeFileSync(UPD, JSON.stringify(st, null, 2), 'utf8')
  } catch { /* 忽略 */ }
  try { kitLog('[self-update] ' + msg) } catch { /* 忽略 */ }
}

function killOld() {
  try {
    const out = execSync('netstat -ano | findstr :8412 | findstr LISTENING').toString()
    const pid = out.trim().split(/\r?\n/)[0].trim().split(/\s+/).pop()
    if (pid) { execSync(`taskkill /F /PID ${pid}`); say('旧服务进程已停止（PID ' + pid + '）') }
  } catch { /* 没有 8412 监听就算了 */ }
}

function startNew() {
  spawn(process.execPath, ['src/index.js'], { cwd: KIT_DIR, detached: true, stdio: 'ignore' }).unref()
  say('新版本服务已拉起')
}

function httpUp() {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: 8412, path: '/', timeout: 1500 }, (r) => { r.resume(); resolve(r.statusCode ? r.statusCode < 500 : false) })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })
}

const st0 = JSON.parse(fs.readFileSync(UPD, 'utf8'))
say('开始拉取更新（git pull --ff-only）…')
try {
  execSync('git pull --ff-only', { cwd: KIT_DIR, timeout: 120000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  say('pull 完成')
} catch (e) {
  say('pull 失败：' + String((e.stdout || '') + (e.stderr || '')).trim().slice(0, 300))
  const st = JSON.parse(fs.readFileSync(UPD, 'utf8'))
  st.kind = 'error'; st.error = 'git pull 失败：' + String((e.stdout || '') + (e.stderr || '')).trim().slice(0, 300)
  fs.writeFileSync(UPD, JSON.stringify(st, null, 2), 'utf8')
  process.exit(1)
}

killOld()
say('等待 1 秒后拉起新版本…')
await new Promise((r) => setTimeout(r, 1200))
spawn(process.execPath, ['src/index.js'], { cwd: KIT_DIR, detached: true, stdio: 'ignore' }).unref()
let up = false
for (let i = 0; i < 15; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  if (await httpUp()) { up = true; break }
}
const fin = JSON.parse(fs.readFileSync(UPD, 'utf8'))
fin.kind = up ? 'done' : 'started'
fin.finishedAt = new Date().toISOString()
fs.writeFileSync(UPD, JSON.stringify(fin, null, 2), 'utf8')
say(up ? '更新完成，服务已就绪（刷新浏览器即新版本）' : '更新完成，服务就绪确认超时（可能只是探活太慢）')
process.exit(0)
