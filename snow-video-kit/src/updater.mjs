/**
 * updater.mjs —— 工作台左下角的「检查更新 / 一键更新」
 * 更新源 = 本目录的 git 仓库（git pull --ff-only 从 origin/main 拉取）。
 * 没配远程时给出明确提示；配置远程后（git remote add origin …）即可一键更新。
 * 更新动作在独立进程里完成（self-update.mjs）：拉取 → 重启服务 → 页面刷新即新版本。
 */
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { stateWrite, stateRead, kitLog, KIT_DIR } from './config.js'

const GIT = 'C:/Program Files/Git/cmd/git.exe'
const git = (args, timeout = 30000) => {
  try {
    return { ok: true, out: execFileSync(fs.existsSync(GIT) ? GIT : 'git', args, { cwd: KIT_DIR, timeout, encoding: 'utf8' }).trim() }
  } catch (e) {
    const out = String(e.stdout || '').trim()
    return { ok: false, out, error: String(e.stderr || e.message || e).trim().slice(0, 300) }
  }
}

export function currentVersion() {
  try { return JSON.parse(fs.readFileSync(path.join(KIT_DIR, 'package.json'), 'utf8')).version || '' } catch { return '' }
}
export function gitHead() {
  const r = git(['log', '-1', '--format=%h %s'], 8000)
  return r.ok ? r.out : ''
}
export function remoteName() {
  const r = git(['remote'], 5000)
  return r.ok ? r.out.split(/\r?\n/)[0] || '' : ''
}

/**
 * ⭐ 2026-11-07：私有仓库的运行时凭据。
 *    token 只从本机文件临时读进内存拼 URL，**不写进任何文件、不打日志**（出错文本自动打码）。
 *    token 文件约定在桌面 token.txt（按当前用户解析，不硬编码机器路径）；没有时退回原 URL。
 */
const TOKEN_FILE = path.join(process.env.USERPROFILE || 'C:/Users/' + process.env.USERNAME, 'Desktop', 'token.txt')
export function scrubSecret(s) {
  try {
    const tok = fs.readFileSync(TOKEN_FILE, 'utf8').trim()
    return tok ? String(s).split(tok).join('***') : String(s)
  } catch { return String(s) }
}
export function fetchTarget() {
  try {
    const url = execFileSync(fs.existsSync(GIT) ? GIT : 'git', ['remote', 'get-url', 'origin'], { cwd: KIT_DIR, timeout: 8000, encoding: 'utf8' }).trim()
    const m = /^https:\/\/github\.com\/([^/]+)\//.exec(url)
    const tok = fs.readFileSync(TOKEN_FILE, 'utf8').trim()
    if (m && tok && !/\s/.test(tok)) return { url: url.replace('https://github.com/', `https://${m[1]}:${tok}@github.com/`), tok }
  } catch { /* 读不到就退回 origin */ }
  return { url: '', tok: '' }
}

/** 检查更新：git fetch + 对比 FETCH_HEAD 与本地 HEAD */
export function checkUpdate() {
  const version = currentVersion()
  const head = gitHead()
  const remote = remoteName()
  if (!remote) return { ok: true, version, head, upToDate: true, note: '本地仓库未配置远程（git remote add origin <url> 后可一键拉取更新）', behind: 0, newCommits: [] }
  const { url, tok } = fetchTarget()
  const f = git(['fetch', url || remote, 'main', '--quiet'], 60000)
  if (!f.ok) return { ok: false, version, head, note: 'fetch 失败：' + scrubSecret(f.error || '无法连接远程'), behind: -1 }
  const cmp = git(['rev-list', '--count', 'HEAD..FETCH_HEAD'], 30000)
  if (!cmp.ok) return { ok: false, version, head, note: '对比失败：' + scrubSecret(cmp.error || ''), behind: -1 }
  const behind = Number(cmp.out) || 0
  const log = behind ? git(['log', '--format=%h %s', 'HEAD..FETCH_HEAD'], 15000) : { out: '' }
  return {
    ok: true, version, head, remote,
    upToDate: behind === 0, behind,
    newCommits: behind ? log.out.split(/\r?\n/).filter(Boolean).slice(0, 8) : [],
  }
}

/** 更新状态文件（页面轮询用） */
export function updateState() { return stateRead('update.json', {}) }
function writeUpdateState(data) { stateWrite('update.json', { ...data, at: new Date().toISOString() }) }

/** 检查并写状态 */
export function checkAndRecord() {
  const r = checkUpdate()
  writeUpdateState({ kind: 'check', ...r })
  return r
}

/** 一键更新：独立进程跑 self-update.mjs（拉取 → 重启服务），立即返回 */
export function runUpdate() {
  const st = updateState()
  if (st.kind === 'running') return { ok: false, reason: '上一次更新还在进行中' }
  writeUpdateState({ kind: 'running', startedAt: Date.now() })
  const runner = path.join(KIT_DIR, 'src', 'self-update.mjs')
  const child = spawn(process.execPath, [runner], {
    detached: true, stdio: 'ignore',
    env: { ...process.env, KIT_DIR },
  })
  child.unref()
  kitLog('一键更新已派发（独立进程）')
  return { ok: true, started: true, detail: '更新在后台进行：拉取 → 自动重启服务。页面稍后刷新即是新版本。' }
}
