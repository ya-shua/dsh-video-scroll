/**
 * usage.mjs —— 大脑花费记账（token / 费用）
 * 记进记忆库同一把 SQLite（表 token_usage），价格可配（config.json → pricing）。
 * 价格口径：每 100 万 token 的人民币单价（input/output 分开），成本 = 按量折算，仅估算。
 */
import { open } from './videomem.mjs'
import { loadConfig } from './config.js'

let inited = false
function ensure() {
  if (inited) return
  open().exec(`
    CREATE TABLE IF NOT EXISTS token_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      kind TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      cost REAL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_usage_at ON token_usage(at);
  `)
  inited = true
}

function priceFor(model) {
  const cfg = loadConfig()
  const table = cfg.pricing?.models || {}
  const p = table[model] || cfg.pricing?.default || { input: 4, output: 16 } // ¥/1M tokens，估算默认
  return { input: Number(p.input) || 0, output: Number(p.output) || 0 }
}

function costOf(model, p, c) {
  const pr = priceFor(model)
  return (p / 1e6) * pr.input + (c / 1e6) * pr.output
}

/** 记一笔（usage = OpenAI 返回的 usage 对象） */
export function recordUsage(kind, model, usage) {
  try {
    ensure()
    const p = Number(usage?.prompt_tokens) || 0
    const c = Number(usage?.completion_tokens) || 0
    const t = Number(usage?.total_tokens) || p + c
    const cost = Number(costOf(model, p, c).toFixed(6))
    open().prepare('INSERT INTO token_usage (at, kind, model, prompt_tokens, completion_tokens, total_tokens, cost) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(new Date().toISOString(), kind || 'other', model || '', p, c, t, cost)
    return { p, c, t, cost }
  } catch (e) { /* 记账失败不影响业务 */ return null }
}

function ymd(d) { return d.toISOString().slice(0, 10) }
function monthKey(d) { return d.toISOString().slice(0, 7) }

/** 汇总：今日 / 本月 / 累计 + 最近 14 天趋势 + 按任务分类 */
export function summary() {
  ensure()
  const db = open()
  const today = ymd(new Date())
  const month = monthKey(new Date())
  const one = (where, args) => db.prepare(`SELECT COUNT(*) AS calls, COALESCE(SUM(prompt_tokens),0) AS p, COALESCE(SUM(completion_tokens),0) AS c, COALESCE(SUM(total_tokens),0) AS t, COALESCE(SUM(cost),0) AS cost FROM token_usage WHERE ${where}`).get(...args)
  const todayS = one("substr(at,1,10) = ?", [today])
  const monthS = one("substr(at,1,7) = ?", [month])
  const allS = one("1=1", [])
  const byKind = db.prepare("SELECT kind, COUNT(*) AS calls, COALESCE(SUM(cost),0) AS cost, COALESCE(SUM(total_tokens),0) AS tokens FROM token_usage GROUP BY kind ORDER BY cost DESC").all()
  const trend = db.prepare("SELECT substr(at,1,10) AS day, COUNT(*) AS calls, COALESCE(SUM(total_tokens),0) AS tokens, COALESCE(SUM(cost),0) AS cost FROM token_usage WHERE at >= ? GROUP BY day ORDER BY day").all(new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10))
  const recent = db.prepare("SELECT at, kind, model, prompt_tokens, completion_tokens, total_tokens, cost FROM token_usage ORDER BY id DESC LIMIT 50").all()
  const pricing = { models: loadConfig().pricing?.models || {}, default: loadConfig().pricing?.default || { input: 4, output: 16 } }
  return {
    today: { ...todayS, cost: Number(todayS.cost.toFixed(2)) },
    month: { ...monthS, cost: Number(monthS.cost.toFixed(2)) },
    total: { ...allS, cost: Number(allS.cost.toFixed(2)) },
    byKind: byKind.map((k) => ({ ...k, cost: Number(k.cost.toFixed(2)) })),
    trend,
    recent,
    pricing,
  }
}

export { priceFor }
