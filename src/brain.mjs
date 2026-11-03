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

/** 连通性自检：一个 1 token 的最小请求 */
export async function brainTest(cfg) {
  const t0 = Date.now()
  const msg = await chat(cfg, [{ role: 'user', content: '回复两个字：就绪' }], { maxTokens: 8, temperature: 0, kind: 'test' })
  return { ok: true, model: cfg.brain.model, reply: String(msg.content || '').trim().slice(0, 40), ms: Date.now() - t0 }
}
