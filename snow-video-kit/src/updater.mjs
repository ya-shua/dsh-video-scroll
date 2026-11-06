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

/** 检查更新：git fetch + 对比 origin/main 与本地 HEAD */
export function checkUpdate() {
  const version = currentVersion()
  const head = gitHead()
  const remote = remoteName()
  if (!remote) return { ok: true, version, head, upToDate: true, note: '本地仓库未配置远程（git remote add origin <url> 后可一键拉取更新）', behind: 0, newCommits: [] }
  const f = git(['fetch', remote, '--quiet'], 60000)
  if (!f.ok) return { ok: false, version, head, note: 'fetch 失败：' + (f.error || '无法连接远程'), behind: -1 }
  const cmp = git(['rev-list', '--count', `HEAD..${remote}/main`], 30000)
  if (!cmp.ok) return { ok: false, version, head, note: '对比失败：' + (cmp.error || ''), behind: -1 }
  const behind = Number(cmp.out) || 0
  const log = behind ? git(['log', `--format=%h %s`, `HEAD..${remote}/main`], 15000) : { out: '' }
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
