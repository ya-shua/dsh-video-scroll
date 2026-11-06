/** check.js —— 自检：node src/check.js */
import fs from 'node:fs'
import path from 'node:path'
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

console.log(bad ? '\n有 ' + bad + ' 项未通过 ✗' : '\n自检全部通过 ✓')
process.exit(bad ? 1 : 0)
