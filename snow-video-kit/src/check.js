/** check.js —— 自检：node src/check.js */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { loadConfig, resolveBili, resolveDouyin, KIT_DIR } from './config.js'
import { existsSync } from 'node:fs'

const cfg = loadConfig()
let bad = 0
const ok = (m) => console.log('  ✓ ' + m)
const bad_ = (m) => { console.log('  ✗ ' + m); bad++ }
const rb = resolveBili(cfg), rd = resolveDouyin(cfg)

console.log('1) 配置')
ok('config.json 加载成功（KIT_DIR=' + KIT_DIR + ')')
existsSync(rb.mcpServer) ? ok('B站 MCP server 存在') : bad_('B站 mcp_server.py 缺失: ' + rb.mcpServer)
existsSync(rd.mcpServer) ? ok('抖音 MCP server 存在') : bad_('抖音 tools/mcp-server.mjs 缺失: ' + rd.mcpServer)
existsSync(rd.python) ? ok('抖音 venv python 存在') : bad_('抖音 venv python 缺失（先在 DSH 面板装依赖或手动建 venv）')

console.log('2) SnowLuma')
existsSync(path.join(cfg.snow.homeDir, 'config')) ? ok('SnowLuma homeDir 存在') : bad_('SnowLuma homeDir 不存在: ' + cfg.snow.homeDir)
const accts = fs.readdirSync(path.join(cfg.snow.homeDir, 'config')).filter((f) => /^onebot_\d+\.json$/.test(f))
accts.length ? ok('发现 ' + accts.length + ' 个 OneBot 账号文件') : bad_('没有 onebot_*.json（QQ 账号未配置）')

console.log('3) 大脑')
cfg.brain.baseUrl && cfg.brain.model ? ok('baseUrl/model 已填: ' + cfg.brain.model) : bad_('baseUrl/model 未填')
const key = (() => { try { return fs.readFileSync(KIT_DIR + '/state/brain-key', 'utf8').trim() } catch { return '' } })()
key ? ok('key 已保存（' + key.length + ' 位）') : console.log('  - key 未填（去工作台「大脑」页填）')

console.log('4) 桥接她（海螺）+ 记忆（环形的心）')
if (cfg.conch?.enabled === false) {
  console.log('  - 桥接已关（config.conch.enabled=false）')
} else {
  const home = cfg.conch?.homeDir || ''
  const conchCfg = path.join(home, 'config.json')
  existsSync(conchCfg) ? ok('海螺目录存在（人格名从它的 config.json 读）') : bad_('海螺目录不存在: ' + home)
  const ringP = cfg.ring?.mcpServer || path.join(path.dirname(path.dirname(KIT_DIR)), '环形的心', 'mcp', 'server.mjs')
  existsSync(ringP) ? ok('环形的心 mcp/server.mjs 存在') : bad_('环形的心 MCP 缺失: ' + ringP)
  try {
    const j = JSON.parse(fs.readFileSync(conchCfg, 'utf8'))
    j.persona ? ok('当前人格：' + j.persona) : bad_('海螺 config.json 没有 persona 字段')
  } catch { /* 上面已经报过 */ }
}

console.log('5) 看/听（留影）')
const ly = cfg.media?.liuyingHome || ''
if (cfg.media?.mode !== 'deep') {
  console.log('  - 当前快模式（只看文字）；深模式才需要留影')
} else {
  const vis = path.join(ly, 'src', 'ring-vision.mjs')
  const des = path.join(ly, 'src', 'describe.mjs')
  if (existsSync(vis) && existsSync(des)) {
    ok('留影已接上（' + ly + '）')
    try {
      const vj = JSON.parse(fs.readFileSync(path.join(ly, 'data', 'vision.json'), 'utf8'))
      const chs = (vj.channels || []).filter((c) => c.baseUrl && c.model)
      chs.length ? ok('视觉模型通道 ' + chs.length + ' 条（' + chs.map((c) => c.model).join(' / ') + '）') : bad_('留影没配视觉模型')
      vj.asr?.enabled ? ok('ASR 已开：' + (vj.asr.model || '')) : console.log('  - 留影 ASR 未开（听不到声音）')
    } catch { bad_('留影 data/vision.json 读不到') }
  } else {
    bad_('留影缺失: ' + ly + '（深模式会退回快模式）')
  }
  // B站没字幕时要靠 yt-dlp 只拉音轨（画面用故事板帧，不用它下整条视频）
  try {
    const v = execFileSync(rb.python, ['-m', 'yt_dlp', '--version'], { timeout: 30000, encoding: 'utf8' }).trim()
    ok('yt-dlp 可用（' + v + '）→ B站没字幕也能转成文字')
  } catch {
    console.log('  - yt-dlp 没装：B站没字幕的视频只能如实写「没听到」')
    console.log('    装法：' + rb.python + ' -m pip install yt-dlp')
  }
}

console.log(bad ? '\n有 ' + bad + ' 项未通过 ✗' : '\n自检全部通过 ✓')
process.exit(bad ? 1 : 0)
