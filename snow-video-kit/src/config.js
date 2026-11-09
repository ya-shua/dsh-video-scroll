/**
 * config.js —— snow-video-kit 配置与状态
 * ============================================================================
 * config.json  ：用户可改的配置（热读：每次使用现读，改了即生效）
 * state/       ：运行期私有数据（key、令牌、轮次进度），不进配置文件
 * 家目录       ：默认复用 ~/.dsh/{bili-duty,douyin-duty}（机器资产都在那，
 *                本身不依赖 DSH 进程——只是目录名叫这个而已）
 * ============================================================================
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

export const KIT_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
export const STATE_DIR = path.join(KIT_DIR, 'state')
export const CONFIG_FILE = path.join(KIT_DIR, 'config.json')

export function dshHome() { return process.env.DSH_HOME || path.join(os.homedir(), '.dsh') }
export const biliHome = () => path.join(dshHome(), 'bili-duty')
export const douyinHome = () => path.join(dshHome(), 'douyin-duty')

const DEFAULTS = {
  snow: {
    homeDir: 'D:\\AI\\QQ宠物号\\SnowLuma',   // 用来发现 OneBot token
    httpUrl: 'http://127.0.0.1:3000',        // OneBot HTTP（get_login_info 探测）
    probeEverySec: 30,                       // QQ 在线探测间隔
  },
  brain: {
    baseUrl: 'https://maas.qianwenaiapi.com/compatible-mode/v1', // OpenAI 兼容
    model: 'deepseek-v4.1-flash',
    enabled: true,
    maxToolRounds: 14,
    temperature: 0.6,
  },
  bili: {
    enabled: true,
    home: '',                                 // 空 = ~/.dsh/bili-duty
    python: '',                               // 空 = home/.venv/Scripts/python.exe
    // 交给大脑的工具白名单（只读 + duty 窄口；发评论类不在默认名单）
    tools: 'bili_search,bili_subtitle,bili_comments,bili_video_info,bili_cover,bili_frames,bili_recommend,bili_hot_videos,duty_paths,duty_report_append,duty_seen_append,duty_seen_recent,duty_digest_append',
    perDay: 5,
  },
  douyin: {
    enabled: true,
    home: '',                                 // 空 = ~/.dsh/douyin-duty
    node: '',                                 // 空 = 当前 node
    python: '',                               // 空 = home/.venv/Scripts/python.exe
    toolsDir: 'D:\\我的电脑\\桌面\\插件\\刷视频插件\\dsh-video-scroll\\douyin\\tools', // forward-pick.py / mcp-server.mjs 所在
    evidenceLimit: 12,
    perDay: 10,
    autoSend: false,                          // v1 默认只写日报不自动发送
  },
  schedule: { enabled: false, noon: ['12:00', '14:00'], night: ['00:30', '08:30'] },
  reads: {
    tiebaEnabled: false,    // 📖 看贴吧：默认关（用户在 📖 页开启）
    tiebaForums: [],        // 关注的吧名单（吧名，如 原神）
    tiebaPerRound: 3,       // 每轮最多推几帖
    novelEnabled: false,    // 📖 看小说：默认关
    novels: [],             // 追更书单 [{name, url}]（目录页链接）
  },
  agent: {
    freeRun: false,          // ★ 她想刷就刷：开着 = 值班轮不受峰谷时间窗限制，她的触发随时放行
    maxRoundsPerDay: 0,      // 每天最多几轮（B站+抖音合计，0 = 不限）
    maxCostPerDay: 0,        // 每天大脑花费上限（¥，0 = 不限）
  },
  // ⭐ 2026-11-08：桥接海螺——值班轮用「她」的人设/记忆/口气（enabled=false 整条关掉）
  conch: {
    enabled: true,
    url: 'http://127.0.0.1:7801',
    token: '',                                    // 海螺面板要令牌时填（默认未设密码则留空）
    homeDir: 'D:\\AI\\云端大肥鱼\\海螺',          // 读它的 config.json 拿当前人格名
    personaFallback: '',                          // 海螺挂了时的备用文件（空 = ~/.dsh/douyin-duty/persona.md）
    personaMaxChars: 4200,                        // 人设注入上限（按小节抽，不是硬截断）
    toneSamples: 0,                               // 语气样本条数（0=不注入；注入了她就容易"演"自己以前的样子）
    memoryTopics: ['刷视频', '抖音', 'B站', '爸', '口味', '喜欢'],
  },
  // 环形的心（她的长期记忆）：留空 = 自动找 桌面\插件\环形的心\mcp\server.mjs
  ring: { mcpServer: '', dbPath: '' },
  // ⭐ 看画面 / 听声音（借留影的模型）：fast = 只看文字；deep = 抽帧 + 听声
  media: {
    mode: 'fast',
    deepPerRound: { bili: 2, douyin: 1 },         // 每轮最多深审几条
    frames: 3,                                    // 深审抽几帧
    audio: 'auto',                                // auto（没字幕才听）| always | off
    liuyingHome: 'D:\\我的电脑\\桌面\\插件\\留影',
  },
  web: { port: 8412, host: '127.0.0.1' },
}

function deepMerge(base, extra) {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return base
  const out = { ...base }
  for (const [k, v] of Object.entries(extra)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = deepMerge(base[k], v)
    else out[k] = v
  }
  return out
}

export function loadConfig() {
  let user = {}
  try { user = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) } catch { /* 首次没有就用默认 */ }
  return deepMerge(DEFAULTS, user)
}

export function saveConfigPatch(patch) {
  const cur = (() => { try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) } catch { return {} } })()
  const next = deepMerge(cur, patch)
  writeAtomic(CONFIG_FILE, JSON.stringify(next, null, 2) + '\n')
  return next
}

export function writeAtomic(file, text) {
  const tmp = `${file}.${randomHex(4)}.tmp`
  fs.writeFileSync(tmp, text, 'utf8')
  fs.renameSync(tmp, file)
}
export function randomHex(n) { return randomBytes(Math.ceil(n / 2)).toString('hex').slice(0, n) }
import { randomBytes } from 'node:crypto'

export function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback } }

/** state 下的小文件读写（key/令牌/进度） */
export function stateRead(name, fallback) { return readJson(path.join(STATE_DIR, name), fallback) }
export function stateWrite(name, data) {
  fs.mkdirSync(STATE_DIR, { recursive: true })
  writeAtomic(path.join(STATE_DIR, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2))
}
export function stateText(name) { try { return fs.readFileSync(path.join(STATE_DIR, name), 'utf8').trim() } catch { return '' } }
export function stateWriteText(name, text) {
  fs.mkdirSync(STATE_DIR, { recursive: true })
  writeAtomic(path.join(STATE_DIR, name), text)
}

/** 依据配置解析两个子机器的家目录与可执行文件 */
export function resolveBili(cfg) {
  const home = cfg.bili.home || biliHome()
  const python = cfg.bili.python || path.join(home, '.venv', 'Scripts', 'python.exe')
  return { home, python, mcpServer: path.join(home, 'mcp_server.py') }
}
export function resolveDouyin(cfg) {
  const home = cfg.douyin.home || douyinHome()
  const node = cfg.douyin.node || process.execPath
  const python = cfg.douyin.python || path.join(home, '.venv', 'Scripts', 'python.exe')
  const toolsDir = cfg.douyin.toolsDir || path.join(home, 'tools')
  return { home, node, python, toolsDir, mcpServer: path.join(toolsDir, 'mcp-server.mjs') }
}

/** 运行日志（环形缓冲在内存，落盘一份追加文件） */
const logBuf = []
export function kitLog(msg) {
  const line = `${new Date().toISOString()}  ${msg}`
  logBuf.push(line)
  if (logBuf.length > 400) logBuf.splice(0, logBuf.length - 400)
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true })
    fs.appendFileSync(path.join(STATE_DIR, 'kit.log'), line + '\n', 'utf8')
  } catch { /* 落盘失败不致命 */ }
}
export const recentLogs = (n = 60) => logBuf.slice(-n)

export const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
