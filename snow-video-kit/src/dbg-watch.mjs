import { pathToFileURL } from 'node:url'
import fs from 'node:fs'
const home = 'C:/Users/Lenovo/.dsh/douyin-duty'
const ev = JSON.parse(fs.readFileSync(home + '/round-evidence.json', 'utf8'))
const items = ev?.list || ev?.items || ev?.candidates || []
const vid = String(items[0]?.vid || items[0]?.aweme_id || '').trim()
console.log('取候选 vid:', vid)
process.env.DOUYIN_HOME = home
const mod = await import('./douyin.mjs')
const cfg = mod.__nothing // 不存在也没关系，直接手动调 execWatch 路径
