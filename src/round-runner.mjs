/**
 * round-runner.mjs —— 独立进程跑一轮（给她/计划任务派发用）
 * 用法：node round-runner.mjs --kind bili [--reason xxx]
 * 进度写 state/round-<kind>.json；退出码 0=成功/跳过 1=失败
 */
const argv = process.argv.slice(2)
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? (argv[i + 1] ?? d) : d }
const kind = argOf('--kind', '')
const reason = argOf('--reason', 'detached')

if (kind !== 'bili' && kind !== 'douyin') { console.error('bad kind'); process.exit(1) }

const { runRound } = await import('./rounds.mjs')
const r = await runRound(kind, { reason })
console.log(JSON.stringify(r))
process.exit(r.ok === false && r.error ? 1 : 0)
process.on('unhandledRejection', (e) => { console.error(e); process.exit(1) })
