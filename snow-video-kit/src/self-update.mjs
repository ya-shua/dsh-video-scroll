/**
 * self-update.mjs —— 独立更新进程（工作台「一键更新」派发）
 * 流程：备份用户资料 → git pull --ff-only → 校验资料完好 → 停掉旧 8412 服务 →
 *       隐藏拉起新版本 → 探活 → 记录结果 → 退出。
 * 用户资料（config.json / state/ / data/）已全部退出 git 跟踪（.gitignore），
 * pull 不可能碰到它们；更新前再整份备份到 backups/update-<时间戳>/，双保险。
 * 独立于旧服务进程（旧进程死了不影响本进程收尾）；进度写 state/update.json。
 */
import { execSync, execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { KIT_DIR, kitLog } from './config.js'
import { scrubSecret } from './updater.mjs'

// 实际 git 路径按候选探测（本机在 D:/Git），都找不到才退回 PATH
const GITBIN = ['C:/Git/cmd/git.exe', 'C:/Program Files/Git/cmd/git.exe', 'D:/Git/cmd/git.exe'].find((p) => fs.existsSync(p)) || 'git'
// 强制 UTF-8 输出，避免更新日志里的中文错误信息乱码
const GIT_ENV = { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' }
const GIT_UTF8 = ['-c', 'core.quotepath=false', '-c', 'i18n.logOutputEncoding=utf8']

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

/** 用户资料清单：config.json + state/ + data/（全部独立于 git） */
const USER_FILES = ['config.json']
const USER_DIRS = ['state', 'data']

function backupUserData() {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
  const dest = path.join(KIT_DIR, 'backups', 'update-' + stamp)
  fs.mkdirSync(dest, { recursive: true })
  for (const f of USER_FILES) {
    const src = path.join(KIT_DIR, f)
    if (fs.existsSync(src)) fs.cpSync(src, path.join(dest, f))
  }
  for (const d of USER_DIRS) {
    const src = path.join(KIT_DIR, d)
    if (fs.existsSync(src)) fs.cpSync(src, path.join(dest, d), { recursive: true, force: true })
  }
  return dest
}

/** 更新后校验：资料必须原位。缺了就从备份捞回来。 */
function verifyUserData(backupDir) {
  const missing = []
  for (const f of USER_FILES) if (!fs.existsSync(path.join(KIT_DIR, f))) missing.push(f)
  for (const d of USER_DIRS) if (!fs.existsSync(path.join(KIT_DIR, d))) missing.push(d + '/')
  if (missing.length && backupDir) {
    for (const m of missing) {
      const src = path.join(backupDir, m)
      if (fs.existsSync(src)) {
        fs.cpSync(src, path.join(KIT_DIR, m), { recursive: true, force: true })
        say('资料校验：发现缺失 ' + m + '，已从备份恢复')
      }
    }
  }
  return missing
}

function killOld() {
  try {
    const out = execSync('netstat -ano | findstr :8412 | findstr LISTENING', { windowsHide: true }).toString()
    const pid = out.trim().split(/\r?\n/)[0].trim().split(/\s+/).pop()
    if (pid) { execSync(`taskkill /F /PID ${pid}`, { windowsHide: true }); say('旧服务进程已停止（PID ' + pid + '）') }
  } catch { /* 没有 8412 监听就算了 */ }
}

function httpUp() {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: 8412, path: '/', timeout: 1500 }, (r) => { r.resume(); resolve(r.statusCode ? r.statusCode < 500 : false) })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })
}

const st0 = JSON.parse(fs.readFileSync(UPD, 'utf8'))

// ── 第 1 步：备份用户资料（备份失败 = 直接放弃更新，绝不动手）──
let backupDir = ''
try {
  backupDir = backupUserData()
  say('用户资料已备份 → ' + path.relative(KIT_DIR, backupDir))
} catch (e) {
  say('备份用户资料失败，放弃本次更新：' + String(e.message || e))
  const st = JSON.parse(fs.readFileSync(UPD, 'utf8'))
  st.kind = 'error'; st.error = '备份用户资料失败，未做任何改动：' + String(e.message || e)
  fs.writeFileSync(UPD, JSON.stringify(st, null, 2), 'utf8')
  process.exit(1)
}

// ── 第 2 步：拉取（fetch + merge --ff-only，失败时工作区原样不动）──
// ⭐ 2026-11-07：私有仓的 fetch 用运行时令牌 URL（token 只在内存，出错文本自动打码）。
//    整合仓库后 KIT_DIR 是父仓库的子目录 —— git 会自动向上找到父仓库，一条更新连插件一起带上。
say('开始拉取更新（git fetch + merge --ff-only）…')
try {
  const { fetchTarget } = await import('./updater.mjs')
  const { url, tok } = fetchTarget()
  const out = execFileSync(GITBIN, [...GIT_UTF8, 'fetch', url || 'origin', 'main'], { cwd: KIT_DIR, timeout: 120000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: GIT_ENV, windowsHide: true })
  execFileSync(GITBIN, [...GIT_UTF8, 'merge', '--ff-only', 'FETCH_HEAD'], { cwd: KIT_DIR, timeout: 60000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: GIT_ENV, windowsHide: true })
  say('fetch + merge 完成')
} catch (e) {
  const reason = scrubSecret(String((e.stdout || '') + (e.stderr || '')).trim().slice(0, 300))
  say('拉取失败（你的资料和原版本都没动）：' + reason)
  const st = JSON.parse(fs.readFileSync(UPD, 'utf8'))
  st.kind = 'error'; st.error = 'git 拉取失败（资料原样未动）：' + reason
  fs.writeFileSync(UPD, JSON.stringify(st, null, 2), 'utf8')
  process.exit(1)
}

// ── 第 3 步：校验用户资料原位 ──
verifyUserData(backupDir)

// ── 第 4 步：重启服务 ──
killOld()
say('等待 1 秒后拉起新版本…')
await new Promise((r) => setTimeout(r, 1200))
spawn(process.execPath, ['src/index.js'], { cwd: KIT_DIR, detached: true, stdio: 'ignore', windowsHide: true }).unref()
let up = false
for (let i = 0; i < 15; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  if (await httpUp()) { up = true; break }
}
const fin = JSON.parse(fs.readFileSync(UPD, 'utf8'))
fin.kind = up ? 'done' : 'started'
fin.finishedAt = new Date().toISOString()
fs.writeFileSync(UPD, JSON.stringify(fin, null, 2), 'utf8')
say(up ? '更新完成，服务已就绪，用户资料完好（刷新浏览器即新版本）' : '更新完成，服务就绪确认超时（可能只是探活太慢）')
process.exit(0)
