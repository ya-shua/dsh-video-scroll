/**
 * index.js —— snow-video-kit 入口
 * 装配：配置 → Snow 守望器（QQ 在线探测）→ 浏览器工作台。
 * 工具包的三种用法：
 *   1. 工作台（http://127.0.0.1:8412）：看状态 / 填大脑 key / 手动跑一轮 / 看日志；
 *   2. 她自己调用：把 src/kit-mcp.mjs 挂进 MCP（video_status / video_run_round / …）；
 *   3. 值班计划（可选）：schedule.enabled 时按窗口自动跑（仍要求 QQ 在线 + 大脑已配置）。
 */
import { loadConfig, kitLog, CONFIG_FILE } from './config.js'
import fs from 'node:fs'
import { startSnowWatcher } from './snow.mjs'
import { startWeb } from './web/server.mjs'

const cfg = loadConfig()
// 首次启动把默认配置落盘，方便用户直接改
try { if (!fs.existsSync(CONFIG_FILE)) fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + '\n', 'utf8') } catch { /* 忽略 */ }
kitLog('── snow-video-kit 启动 ──')
startSnowWatcher(cfg)
startWeb()

// 可选值班计划：在窗口内 + QQ 在线 + 大脑已配置 → 派一轮（每 10 分钟检查一次）
import { brainConfigured } from './brain.mjs'
import { kickRoundDetached, roundRunning } from './rounds.mjs'
function inWindow(cfg) {
  if (!cfg.schedule?.enabled) return false
  const now = new Date()
  const mins = now.getHours() * 60 + now.getMinutes()
  const toMin = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0) }
  for (const [a, b] of [cfg.schedule.noon, cfg.schedule.night]) {
    const x = toMin(a), y = toMin(b)
    const inR = x <= y ? (mins >= x && mins < y) : (mins >= x || mins < y)
    if (inR) return true
  }
  return false
}
setInterval(() => {
  try {
    // 自动派发只认值班计划窗口（schedule.enabled + 窗口内）；freeRun 只负责她主动发起时
    // 不受窗口限制，不在这里触发自动轮——否则会变成每 10 分钟系统自己刷
    if (!inWindow(cfg)) return
    if (!brainConfigured(cfg)) return
    for (const kind of ['bili', 'douyin']) {
      if (roundRunning(kind)) continue
      const r = kickRoundDetached(kind, '窗口值班')
      if (r.ok) kitLog(`窗口值班已派发：${kind}`)
    }
  } catch (e) { kitLog('窗口值班检查失败：' + String(e?.message || e)) }
}, 10 * 60 * 1000)

kitLog('装配完成：工作台 + Snow 守望器 +（可选）值班计划')
