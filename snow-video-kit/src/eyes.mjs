/**
 * eyes.mjs —— 「看画面 / 听声音」
 * ============================================================================
 * 全部借留影（D:\我的电脑\桌面\插件\留影）的模型与实现：
 *   · 视觉：留影 vision.json 里的 channels（默认 GLM-4V-Flash）
 *   · 听声：留影 vision.json 里的 asr（默认硅基 SenseVoiceSmall）
 *
 * 只 import 它的模块，**不经过**它的面板服务、**不写**它的记忆库（不走 visionNote）。
 * ⚠️ ring-vision.mjs 只 re-export 了 describeVideo / loadVisionConfig；
 *    describeImage 在 describe.mjs、transcribeAudio 在 audio.mjs —— 分开 import。
 *
 * 降级：留影目录不在 / 没配模型 / 抽帧失败 / ASR 失败
 *       → 返回 { ok:false, error }，调用方如实写「没看到/没听到」，绝不编。
 * ============================================================================
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { kitLog } from './config.js'

let mods = null
let modHome = ''

const url = (p) => pathToFileURL(p).href

async function loadLiuying(cfg) {
  const home = String(cfg.media?.liuyingHome || '')
  if (!home) return null
  const files = {
    ring: path.join(home, 'src', 'ring-vision.mjs'),
    describe: path.join(home, 'src', 'describe.mjs'),
    audio: path.join(home, 'src', 'audio.mjs'),
  }
  if (!fs.existsSync(files.ring)) return null
  if (mods && modHome === home) return mods
  try {
    mods = {
      ring: await import(url(files.ring)),
      describe: fs.existsSync(files.describe) ? await import(url(files.describe)) : null,
      audio: fs.existsSync(files.audio) ? await import(url(files.audio)) : null,
    }
    modHome = home
    kitLog('eyes：已接上留影（' + home + '）')
    return mods
  } catch (e) {
    kitLog('eyes：加载留影失败 → ' + String(e?.message || e))
    return null
  }
}

function liuyingCfg(cfg) {
  const dataDir = path.join(modHome, 'data')
  return mods.ring.loadVisionConfig({ dataDir })
}

function pickChannel(vcfg) {
  const list = (vcfg.channels || []).filter((c) => c && c.baseUrl && c.model)
  if (list.length) return list[0]
  if (vcfg.baseUrl && vcfg.model) return { baseUrl: vcfg.baseUrl, model: vcfg.model, apiKey: vcfg.apiKey }
  return null
}

/** 多帧 → 一段画面描述（逐帧问留影的视觉模型） */
export async function describeFrames(cfg, { frames = [], hint = '', label = '视频' } = {}) {
  const m = await loadLiuying(cfg)
  if (!m?.describe?.describeImage) return { ok: false, error: '留影目录不在或缺 describe.mjs（media.liuyingHome）' }
  const vcfg = liuyingCfg(cfg)
  const ch = pickChannel(vcfg)
  if (!ch) return { ok: false, error: '留影没配视觉模型（channels 空）' }
  const maxFrames = Math.max(1, Math.min(6, cfg.media?.frames || 3))
  const descs = []
  const points = []
  let used = 0
  for (const f of frames.slice(0, maxFrames)) {
    try {
      const out = await m.describe.describeImage({
        baseUrl: ch.baseUrl, model: ch.model, apiKey: ch.apiKey,
        imageBase64: f.base64, mime: f.mime || 'image/jpeg',
        hint: `这是一段${label}的一帧。${hint}`.trim(),
        timeoutMs: vcfg.timeoutMs || 45000,
      })
      used++
      if (out.desc) descs.push(out.desc)
      for (const p of (out.points || [])) if (!points.includes(p)) points.push(p)
    } catch (e) {
      kitLog('eyes：描述一帧失败 → ' + String(e?.message || e))
    }
  }
  if (!descs.length) return { ok: false, error: '视觉模型没看出内容', used }
  return { ok: true, desc: descs.join('；').slice(0, 300), points: points.slice(0, 6), used }
}

/** 音轨 → 文字（留影的 transcribeAudio） */
export async function transcribeBuffer(cfg, audioBuffer) {
  const m = await loadLiuying(cfg)
  if (!m?.audio?.transcribeAudio) return { ok: false, error: '留影目录不在或缺 audio.mjs' }
  const vcfg = liuyingCfg(cfg)
  const asr = vcfg.asr || {}
  if (!asr.enabled || !asr.baseUrl) return { ok: false, error: '留影没开 ASR（asr.enabled）' }
  try {
    const out = await m.audio.transcribeAudio({
      audioBuffer,
      baseUrl: asr.baseUrl, model: asr.model, apiKey: asr.apiKey,
      language: asr.language || '', timeoutMs: 90000,
    })
    return { ok: true, text: out.text }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}

/** 视频 Buffer → 抽帧 +（可选）听声，一步到位（留影 describeVideo） */
export async function describeVideoBuffer(cfg, buffer, { frames, audio = false, hint = '' } = {}) {
  const m = await loadLiuying(cfg)
  if (!m?.ring?.describeVideo) return { ok: false, error: '留影目录不在（ring-vision.mjs）' }
  const vcfg = liuyingCfg(cfg)
  const ch = pickChannel(vcfg)
  if (!ch) return { ok: false, error: '留影没配视觉模型' }
  vcfg.dataDir = path.join(modHome, 'data')
  try {
    // mode 用 even（按时长均匀取）——留影默认的 scene（镜头切换检测）
    // 对静态/慢节奏短视频会一帧都选不中，实测抖音 13 秒视频直接 ffmpeg -22 失败。
    const r = await m.ring.describeVideo(buffer, {
      cfg: vcfg, channel: ch, text: hint,
      frames: frames || cfg.media?.frames || 3,
      mode: 'even',
      audio: Boolean(audio),
    })
    return { ok: true, desc: r.desc, points: r.points || [], frames: r.frames }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}

/** 下载一段视频（带 UA/Referer；只 GET CDN，不模拟操作） */
export async function downloadMedia(url2, { referer = '', ua = '', maxBytes = 20 * 1024 * 1024, timeoutMs = 90000 } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const headers = {
      'user-agent': ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      accept: '*/*',
    }
    if (referer) headers.referer = referer
    const r = await fetch(url2, { signal: ctrl.signal, headers, redirect: 'follow' })
    if (!r.ok) throw new Error(`下载 HTTP ${r.status}`)
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > maxBytes) throw new Error(`视频太大（${Math.round(buf.length / 1048576)}MB）`)
    return buf
  } finally { clearTimeout(timer) }
}

/** ⭐ 2026-11-12 三模式等级（用户要求）：text(0)=只看文本 / hybrid(1)=文本+画面帧 / visual(2)=全套（画面+声音）
 *  旧值兼容：fast→text、deep→visual（未知值按 text 处理，不会误开视觉） */
export function mediaLevel(cfg) {
  const m = String(cfg.media?.mode || 'text')
  if (m === 'hybrid') return 1
  if (m === 'visual' || m === 'deep') return 2
  return 0
}

/** 每轮还能深审几条（调用方自己记账，这里只给上限） */
export function deepQuota(cfg, kind) {
  const n = cfg.media?.deepPerRound?.[kind]
  return Number.isFinite(Number(n)) ? Number(n) : 0
}