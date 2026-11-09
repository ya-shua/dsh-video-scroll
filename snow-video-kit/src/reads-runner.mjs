/**
 * reads-runner.mjs —— 独立进程跑一轮阅读（给工作台/她派发用）
 * 用法：node reads-runner.mjs --kind novel|tieba [--reason xxx]
 * 进度写 state/reads-<kind>.json；退出码 0=成功/跳过 1=失败
 */
const argv = process.argv.slice(2)
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? (argv[i + 1] ?? d) : d }
const kind = argOf('--kind', '')
const reason = argOf('--reason', 'detached')

if (kind !== 'tieba' && kind !== 'novel') { console.error('bad kind'); process.exit(1) }

const { loadConfig, stateWrite } = await import('./config.js')
const { runReads } = await import('./reads.mjs')

const startedAt = Date.now()
stateWrite(`reads-${kind}.json`, { status: 'running', startedAt, reason })
try {
  const r = await runReads(loadConfig(), kind, { reason })
  stateWrite(`reads-${kind}.json`, { status: r.ok ? 'done' : 'skipped', startedAt, endedAt: Date.now(), reason, ...r })
  console.log(JSON.stringify(r))
  process.exit(r.ok === false && (r.error || r.reason) ? 1 : 0)
} catch (e) {
  const msg = String(e?.message || e)
  stateWrite(`reads-${kind}.json`, { status: 'error', startedAt, endedAt: Date.now(), reason, error: msg })
  console.error(msg)
  process.exit(1)
}
process.on('unhandledRejection', (e) => { console.error(e); process.exit(1) })
