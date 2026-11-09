#!/usr/bin/env node
/**
 * tools/dy-play-url.mjs —— 拿一条抖音作品的播放直链（只读一次详情接口）
 * ============================================================================
 * 为什么需要它：抖音 web 的分享页 / 视频页都不吐 play_addr（实测 200 但空壳、
 * 视频页会跳 /chat），直链只能从**签名详情接口**读：
 *   dy-signer.mjs 出 a_bogus → /aweme/v1/web/aweme/detail/ → video.play_addr.url_list
 *
 * 风控：一次调用只发 1 个详情请求（+签名器本地计算），不模拟点击/播放；
 *       调用方负责低频（每轮 ≤1 条）与缓存。
 *
 * 用法：node tools/dy-play-url.mjs --aweme <id>
 * 输出：{ ok, url, urls[], durationMs, desc, error? }
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { homeDir } from '../lib/paths.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const HOME = homeDir()
const argv = process.argv.slice(2)
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? (argv[i + 1] ?? d) : d }
const AWEME = String(argOf('--aweme', '')).trim()
const UA = process.env.DY_UA || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const out = (o) => { console.log(JSON.stringify(o)); process.exit(o.ok ? 0 : 1) }

if (!/^\d{15,25}$/.test(AWEME)) out({ ok: false, error: '--aweme 不是作品 ID' })

const cookieFile = path.join(HOME, 'douyin_cookie.txt')
if (!fs.existsSync(cookieFile)) out({ ok: false, error: '没有 douyin_cookie.txt（先在设置页登录）' })
const cookieRaw = fs.readFileSync(cookieFile, 'utf8').trim()
const cookies = {}
for (const part of cookieRaw.split(';')) {
  const s = part.trim(); if (!s) continue
  const i = s.indexOf('='); if (i > 0) cookies[s.slice(0, i)] = s.slice(i + 1)
}

const rel = '/aweme/v1/web/aweme/detail/?aweme_id=' + AWEME
  + '&aid=6383&app_name=douyin_web&device_platform=webapp&channel=channel_pc_web'
  + '&pc_client_type=1&version_code=170400&version_name=17.4.0&cookie_enabled=true'
  + '&platform=PC&downlink=10&browser_language=zh-CN&browser_platform=Win32'
  + '&browser_name=Chrome&browser_version=131.0.0.0&screen_width=1920&screen_height=1080'

const signer = path.join(HERE, 'dy-signer.mjs')
if (!fs.existsSync(signer)) out({ ok: false, error: 'dy-signer.mjs 不在：' + signer })

let signed
const outFile = path.join(os.tmpdir(), 'dy-sign-' + process.pid + '-' + Date.now() + '.json')
try {
  execFileSync(process.execPath, [signer, rel], {
    cwd: HOME, encoding: 'utf8', timeout: 90000,
    env: { ...process.env, DY_COOKIES: JSON.stringify({ ttwid: cookies.ttwid || '', UIFID_TEMP: cookies.UIFID_TEMP || '' }), DY_SIGNER_OUT: outFile },
  })
  signed = JSON.parse(fs.readFileSync(outFile, 'utf8'))
} catch (e) {
  out({ ok: false, error: '签名失败：' + String(e?.message || e).slice(0, 200) })
} finally {
  fs.rmSync(outFile, { force: true })
}
if (!signed?.signedUrl) out({ ok: false, error: '签名器没给出 URL：' + (signed?.err || '未知') })

let body
try {
  const r = await fetch(signed.signedUrl, {
    headers: { 'user-agent': UA, referer: 'https://www.douyin.com/', cookie: cookieRaw, ...(signed.headers || {}) },
  })
  body = await r.json()
} catch (e) {
  out({ ok: false, error: '详情接口请求失败：' + String(e?.message || e).slice(0, 200) })
}

const d = body?.aweme_detail
if (!d) out({ ok: false, error: '详情没有 aweme_detail（可能被风控或作品已删）', status_code: body?.status_code })
const urls = Array.isArray(d?.video?.play_addr?.url_list) ? d.video.play_addr.url_list : []
if (!urls.length) out({ ok: false, error: '没有 play_addr（图文作品或受限作品？）' })
out({
  ok: true,
  url: urls[0],
  urls,
  durationMs: Number(d?.video?.duration) || 0,
  desc: String(d?.desc || '').slice(0, 120),
})