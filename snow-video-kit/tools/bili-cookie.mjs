#!/usr/bin/env node
/**
 * tools/bili-cookie.mjs —— 用浏览器 Cookie 直接补 B站凭证（不扫码）
 * ============================================================================
 * 用法：
 *   node tools/bili-cookie.mjs --cookie "SESSDATA=xxx; bili_jct=yyy; DedeUserID=123; buvid3=zzz"
 *
 * 干什么：解析 → 调 /x/web-interface/nav 验一次（拿到昵称才算真登录）→
 *         写 ~/.dsh/bili-duty/bili_credential.json（mcp_server.py 认的四个字段）。
 * 验不过就不写，免得留一份坏凭证让所有工具一起报错。
 */
import fs from 'node:fs'
import path from 'node:path'
import { loadConfig, resolveBili } from '../src/config.js'

const argv = process.argv.slice(2)
const argOf = (k) => { const i = argv.indexOf(k); return i >= 0 ? (argv[i + 1] ?? '') : '' }
const raw = (argOf('--cookie') || '').trim()
if (!raw) {
  console.log('用法: node tools/bili-cookie.mjs --cookie "SESSDATA=...; bili_jct=...; DedeUserID=..."')
  process.exit(1)
}

const bag = {}
for (const part of raw.split(';')) {
  const s = part.trim(); if (!s) continue
  const i = s.indexOf('='); if (i > 0) bag[s.slice(0, i).trim()] = s.slice(i + 1).trim()
}
const pick = (k) => bag[k] || bag[k.toLowerCase()] || bag[k.toUpperCase()] || ''

const sessdata = pick('SESSDATA')
const biliJct = pick('bili_jct')
const userId = pick('DedeUserID')
const buvid3 = pick('buvid3')
if (!sessdata || !biliJct) {
  console.log('缺关键字段：SESSDATA 和 bili_jct 都要有（DedeUserID 也建议带上）')
  process.exit(1)
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const cookie = `SESSDATA=${sessdata}; bili_jct=${biliJct}; DedeUserID=${userId}; buvid3=${buvid3}`

let nav = null
try {
  const r = await fetch('https://api.bilibili.com/x/web-interface/nav', {
    headers: { 'user-agent': UA, referer: 'https://www.bilibili.com/', cookie },
  })
  nav = await r.json()
} catch (e) {
  console.log('验证请求失败（网络）：' + String(e?.message || e).slice(0, 160))
  process.exit(1)
}

if (nav?.code !== 0 || !nav?.data?.isLogin) {
  console.log('这份 Cookie 验不过：' + (nav?.message || '未登录') + '（code=' + nav?.code + '）——没写入')
  process.exit(1)
}

const cfg = loadConfig()
const resolve = resolveBili(cfg)
const file = path.join(resolve.home, 'bili_credential.json')
const out = {
  sessdata,
  bili_jct: biliJct,
  buvid3,
  dedeuserid: String(nav.data.mid || userId || ''),
}

try {
  fs.writeFileSync(file + '.tmp', JSON.stringify(out, null, 2), 'utf8')
  fs.renameSync(file + '.tmp', file)   // 原子写：中途断电也不会留半截 JSON
} catch (e) {
  console.log('写凭证失败：' + String(e?.message || e).slice(0, 160))
  process.exit(1)
}

console.log(`OK 已写入 ${file}`)
console.log(`登录账号：${nav.data.uname}（mid=${nav.data.mid}，等级 ${nav.data.level}）`)
process.exit(0)