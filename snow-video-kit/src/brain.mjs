/**
 * brain.mjs —— 「大脑」客户端（OpenAI 兼容 /chat/completions）
 * 用户在页面里填 baseURL + key + model，值班轮的大脑操作就全走这里，脱离 DSH。
 * key 存在 state/brain-key 文件里，不进 config、不回显。
 */
import { stateRead, stateWriteText, stateText, kitLog } from './config.js'
import { recordUsage } from './usage.mjs'

const KEY_FILE = 'brain-key'

export function getBrainKey() { return stateText(KEY_FILE) }
export function setBrainKey(key) { stateWriteText(KEY_FILE, String(key || '').trim()) }
export function brainConfigured(cfg) { return Boolean(cfg.brain.baseUrl && cfg.brain.model && getBrainKey()) }

function headers(cfg) {
  return { 'content-type': 'application/json', authorization: `Bearer ${getBrainKey()}` }
}

/** 纯文本/多轮补全（不带工具）。messages: [{role, content}] */
export async function chat(cfg, messages, { temperature = cfg.brain.temperature, maxTokens = 4096, jsonMode = false, kind = 'chat' } = {}) {
  if (!brainConfigured(cfg)) throw new Error('大脑未配置：先在页面里填 baseURL / key / model')
  const body = { model: cfg.brain.model, messages, temperature, max_tokens: maxTokens }
  if (jsonMode) body.response_format = { type: 'json_object' }
  const r = await fetch(cfg.brain.baseUrl.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST', headers: headers(cfg), body: JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`大脑 HTTP ${r.status}: ${j?.error?.message || JSON.stringify(j).slice(0, 200)}`)
  const msg = j?.choices?.[0]?.message
  if (!msg) throw new Error('大脑返回缺少 choices[0].message')
  if (j.usage) recordUsage(kind, cfg.brain.model, j.usage)
  kitLog(`大脑调用 ok（${cfg.brain.model}，${j?.usage?.total_tokens ?? '?'} tokens）`)
  return msg
}

/**
 * 工具循环：把 MCP 工具暴露给大脑，模型自主决定调用，执行后继续，直到收尾。
 * @param tools    OpenAI tools 数组
 * @param execute  ({name, args}) => Promise<string>  工具执行器（返回给模型看的文本）
 * @param maxRounds 最多几轮工具往返
 */
export async function chatWithTools(cfg, messages, tools, execute, { maxRounds = cfg.brain.maxToolRounds || 14, temperature = cfg.brain.temperature, kind = 'tools' } = {}) {
  const convo = [...messages]
  let rounds = 0
  let usageAll = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  const trace = []
  for (;;) {
    const body = { model: cfg.brain.model, messages: convo, temperature, tools: tools.length ? tools : undefined }
    const r = await fetch(cfg.brain.baseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST', headers: headers(cfg), body: JSON.stringify(body),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`大脑 HTTP ${r.status}: ${j?.error?.message || JSON.stringify(j).slice(0, 200)}`)
    const msg = j?.choices?.[0]?.message
    if (!msg) throw new Error('大脑返回缺少 choices[0].message')
    if (j.usage) {
      usageAll.prompt_tokens += Number(j.usage.prompt_tokens) || 0
      usageAll.completion_tokens += Number(j.usage.completion_tokens) || 0
      usageAll.total_tokens += Number(j.usage.total_tokens) || 0
    }
    convo.push(msg)
    const calls = msg.tool_calls || []
    if (!calls.length) {
      if (usageAll.total_tokens) recordUsage(kind, cfg.brain.model, usageAll)
      return { final: msg.content || '', trace, rounds }
    }
    rounds += 1
    if (rounds > maxRounds) {
      convo.push({ role: 'tool', tool_call_id: calls[0].id, content: '（已达到工具往返上限，请立即基于已有信息收尾作答）' })
      trace.push({ round: rounds, forcedStop: true })
      continue
    }
    for (const call of calls) {
      let name = 'unknown', args = {}
      try {
        name = call?.function?.name || 'unknown'
        args = JSON.parse(call?.function?.arguments || '{}')
      } catch (e) {
        convo.push({ role: 'tool', tool_call_id: call.id, content: '参数解析失败：' + String(e?.message || e) })
        continue
      }
      kitLog(`大脑调用工具 ${name} ${JSON.stringify(args).slice(0, 160)}`)
      let content
      try { content = await execute({ name, args }) }
      catch (e) { content = '工具执行出错：' + String(e?.message || e) }
      trace.push({ round: rounds, tool: name, args })
      convo.push({ role: 'tool', tool_call_id: call.id, content: String(content).slice(0, 60000) })
    }
  }
}

/**
 * 连通性自检：一个 1 token 的最小请求。
 * override 里的 key/baseUrl/model 优先于已保存的（页面里填完就能先验，验通再保存）。
 */
export async function brainTest(cfg, override = {}) {
  const baseUrl = String(override.baseUrl || cfg.brain.baseUrl || '').trim().replace(/\/$/, '')
  const model = String(override.model || cfg.brain.model || '').trim()
  const key = String(override.key || getBrainKey() || '').trim()
  if (!baseUrl) return { ok: false, error: 'baseURL 还没填（例如 https://api.deepseek.com/v1）' }
  if (!model) return { ok: false, error: '模型名还没填' }
  if (!key) return { ok: false, error: 'key 还没填' }
  const t0 = Date.now()
  let r
  try {
    r = await fetch(baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: '回复两个字：就绪' }], max_tokens: 8, temperature: 0 }),
    })
  } catch (e) {
    const code = e?.cause?.code || e?.code || ''
    const detail = e?.cause?.message || e?.message || String(e)
    return { ok: false, error: `连不上 ${baseUrl}${code ? '（' + code + '）' : ''}：${String(detail).slice(0, 140)}`, ms: Date.now() - t0 }
  }
  const j = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = String(j?.error?.message || JSON.stringify(j).slice(0, 160))
    let hint = ''
    if (r.status === 401 || /invalid.? api.?key|unauthor/i.test(msg)) hint = '（key 不对，或已经失效）'
    else if (r.status === 403 && /quota|balance|free tier|insufficient/i.test(msg)) hint = '（这个 key 的额度用完了：充值或换一个）'
    else if (r.status === 404) hint = '（baseURL 或模型名不对）'
    else if (r.status === 429) hint = '（限流了，等会儿再试）'
    return { ok: false, error: `HTTP ${r.status}${hint}：${msg}`, ms: Date.now() - t0 }
  }
  const reply = String(j?.choices?.[0]?.message?.content || '').trim()
  if (!reply) return { ok: false, error: '能连上，但模型没回内容（模型名可能不对）', ms: Date.now() - t0 }
  if (j.usage) recordUsage('test', model, j.usage)
  return { ok: true, model, reply: reply.slice(0, 40), ms: Date.now() - t0, usage: j.usage || null }
}

/**
 * 拉取该 baseUrl 下可用的模型列表（OpenAI 兼容的 GET /models）。
 * override 里的 key/baseUrl 优先（页面上还没保存也能拉）。
 * 不同网关的返回字段可能是 data 或 models，做兼容。
 */
export async function listModels(cfg, override = {}) {
  const baseUrl = String(override.baseUrl || cfg.brain.baseUrl || '').trim().replace(/\/$/, '')
  const key = String(override.key || getBrainKey() || '').trim()
  if (!baseUrl) return { ok: false, error: 'baseURL 还没填' }
  if (!key) return { ok: false, error: 'key 还没填（或先填好再获取）' }
  let r
  try {
    r = await fetch(baseUrl + '/models', { headers: { authorization: 'Bearer ' + key } })
  } catch (e) {
    const code = e?.cause?.code || e?.code || ''
    return { ok: false, error: `连不上（${code || e?.message}），这个接口可能不支持获取模型` }
  }
  const j = await r.json().catch(() => ({}))
  if (!r.ok) {
    return { ok: false, error: `HTTP ${r.status}：${j?.error?.message || '该接口可能不支持 /models'}` }
  }
  const ids = (j.data || j.models || []).map((m) => (typeof m === 'string' ? m : m.id)).filter(Boolean)
  if (!ids.length) return { ok: false, error: '没返回模型列表（该接口可能不支持 /models）' }
  return { ok: true, models: [...new Set(ids)].sort() }
}
