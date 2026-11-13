/**
 * eyes.mjs —— 「看画面 / 听声音」
 * ============================================================================
 * 全部走留影（D:\我的电脑\桌面\插件\留影）的正式入口 visionNote：
 *   · 视觉：留影 vision.json 里的 channels（默认 GLM-4V-Flash）
 *   · 听声：留影 vision.json 里的 asr（默认硅基 SenseVoiceSmall）
 *   · 看完的结果由留影统一扇出（ringmind → 记忆库）+ eye.db 记账 + 留档
 *
 * ⭐ 2026-11-14 起：不再只借模型绕开留影——画面/听声都从 visionNote 过，
 *    同一段字节按内容哈希去重（同一视频反复深审不会重复烧 token）。
 *    ASR 的开/关、even 抽帧模式这些 kit 特有需求，通过给 visionNote 传覆盖 cfg 实现。
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

/** 多帧 → 一段画面描述（走留影 visionNote 官方入口：看成 + 记账 + 留档 + 扇出） */
export async function describeFrames(cfg, { frames = [], hint = '', label = '视频', key = 'frames' } = {}) {
  const m = await loadLiuying(cfg)
  if (!m?.ring?.visionNote) return { ok: false, error: '留影目录不在或缺 ring-vision.mjs（media.liuyingHome）' }
  const vcfg = liuyingCfg(cfg)
  const ch = pickChannel(vcfg)
  if (!ch) return { ok: false, error: '留影没配视觉模型（channels 空）' }
  const maxFrames = Math.max(1, Math.min(6, cfg.media?.frames || 3))
  const list = frames.slice(0, maxFrames)
  if (!list.length) return { ok: false, error: '没有可看的帧' }
  const r = await m.ring.visionNote(
    {
      key,
      sender: '刷视频',
      text: `这是一段${label}的帧。${hint}`.trim(),
      imageBuffers: list.map((f) => ({ base64: f.base64, mime: f.mime || 'image/jpeg' })),
      at: Date.now(),
    },
    {
      cfg: { ...vcfg, perMessage: maxFrames }, // 帧数不受用户「每条消息最多看」限制，这里就是一"条"
      dataDir: path.join(modHome, 'data'),
    },
  )
  if (!r.ok) return { ok: false, error: r.error ?? r.skipped ?? '留影没看成' }
  const seen = (r.results || []).filter((x) => x.desc)
  if (!seen.length) {
    const why = (r.results || [])[0]?.skipped
    return { ok: false, error: why === 'seen' ? '留影记过这些帧了（内容去重）' : `留影没看成（${why ?? '未知'}）` }
  }
  const descs = []
  const points = []
  for (const x of seen) {
    descs.push(x.desc)
    for (const p of (x.points || [])) if (!points.includes(p)) points.push(p)
  }
  return { ok: true, desc: descs.join('；').slice(0, 300), points: points.slice(0, 6), used: seen.length }
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

/** 视频 Buffer → 看画面 +（可选）听声，走留影 visionNote 官方入口（记账 + 留档 + 扇出） */
export async function describeVideoBuffer(cfg, buffer, { frames, audio = false, hint = '', key = 'douyin' } = {}) {
  const m = await loadLiuying(cfg)
  if (!m?.ring?.visionNote) return { ok: false, error: '留影目录不在（ring-vision.mjs）' }
  const vcfg = liuyingCfg(cfg)
  const ch = pickChannel(vcfg)
  if (!ch) return { ok: false, error: '留影没配视觉模型' }
  const wantAudio = Boolean(audio) && Boolean(vcfg.asr?.enabled && vcfg.asr?.baseUrl)
  const r = await m.ring.visionNote(
    {
      key,
      sender: '刷视频',
      text: hint || '',
      videoBuffers: [{ buffer, mime: 'video/mp4' }],
      audio: wantAudio, // hybrid 模式强制不听声；留影侧 asr 没开也不听
      at: Date.now(),
    },
    {
      // mode 用 even（按时长均匀取）——留影默认的 scene（镜头切换检测）
      // 对静态/慢节奏短视频会一帧都选不中，实测抖音 13 秒视频直接 ffmpeg -22 失败。
      cfg: { ...vcfg, video: { ...(vcfg.video || {}), mode: 'even', frames: frames || cfg.media?.frames || 3 } },
      dataDir: path.join(modHome, 'data'),
    },
  )
  if (!r.ok) return { ok: false, error: r.error ?? r.skipped ?? '留影没看成' }
  const x = (r.results || [])[0]
  if (!x?.desc) {
    const why = x?.skipped === 'seen' ? '留影记过这条了（内容去重）' : `留影没看成（${x?.skipped ?? x?.error ?? '未知'}）`
    return { ok: false, error: why }
  }
  return { ok: true, desc: x.desc, points: x.points || [], frames: x.frames }
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