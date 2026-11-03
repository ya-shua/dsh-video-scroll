/**
 * snow.mjs —— SnowLuma 守望器：QQ 连接成功 = 工具包就绪
 * 从 SnowLuma/config/onebot_<QQ号>.json 发现 HTTP 端点与 token（兼容数组/对象两种形态），
 * 每 probeEverySec 探一次 get_login_info；值班轮只在 QQ 在线时放行。
 */
import fs from 'node:fs'
import path from 'node:path'
import { kitLog } from './config.js'

const snowState = { online: false, selfId: '', nick: '', lastCheck: 0, endpoint: '', error: '', timer: null }

function accountFiles(snowHome) {
  try { return fs.readdirSync(path.join(snowHome, 'config')).filter((f) => /^onebot_\d+\.json$/.test(f)).map((f) => path.join(snowHome, 'config', f)) } catch { return [] }
}
function endpointsFrom(file) {
  let j
  try { j = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return [] }
  const out = []
  const nets = j?.networks || {}
  const servers = Array.isArray(nets.httpServers) ? nets.httpServers : (nets.httpServers && typeof nets.httpServers === 'object' ? Object.values(nets.httpServers) : [])
  for (const s of servers) {
    if (!s?.port) continue
    out.push({ httpUrl: `http://127.0.0.1:${s.port}`, token: s.accessToken || '' })
  }
  return out
}

async function probe(ep) {
  const r = await fetch(ep.httpUrl.replace(/\/$/, '') + '/get_login_info', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: ep.token ? `Bearer ${ep.token}` : '' },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(6000),
  })
  const j = await r.json().catch(() => ({}))
  if (j?.retcode === 0 && j?.data?.user_id) return { online: true, selfId: String(j.data.user_id), nick: j.data.nickname || '' }
  return null
}

async function checkOnce(cfg) {
  const files = accountFiles(cfg.snow.homeDir)
  for (const f of files) {
    for (const ep of endpointsFrom(f)) {
      try {
        const r = await probe(ep)
        if (r) {
          const changed = !snowState.online || snowState.selfId !== r.selfId
          snowState.online = true; snowState.selfId = r.selfId; snowState.nick = r.nick
          snowState.lastCheck = Date.now(); snowState.endpoint = ep.httpUrl; snowState.error = ''
          if (changed) kitLog(`QQ 已连接：${r.selfId}（${r.nick}）→ 工具包就绪`)
          return
        }
      } catch { /* 试下一个 */ }
    }
  }
  if (snowState.online) kitLog('QQ 已断开/未登录 → 工具包转入待命（值班轮暂停）')
  snowState.online = false; snowState.lastCheck = Date.now(); snowState.error = files.length ? '全部端点探测失败' : 'SnowLuma/config 下没有 onebot_*.json'
}

export function startSnowWatcher(cfg) {
  const tick = async () => { try { await checkOnce(cfg) } catch (e) { snowState.error = String(e?.message || e) } }
  tick()
  snowState.timer = setInterval(tick, Math.max(10, cfg.snow.probeEverySec || 30) * 1000)
  return () => clearInterval(snowState.timer)
}
export const snowStatus = () => ({ ...snowState, timer: undefined })
export const requireOnline = () => { if (!snowState.online) throw new Error('QQ 未连接（SnowLuma 未登录）——值班轮暂停，等 QQ 上线后自动恢复') }
