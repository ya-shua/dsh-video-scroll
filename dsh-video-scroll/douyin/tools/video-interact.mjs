#!/usr/bin/env node
/**
 * tools/video-interact.mjs —— 在真实抖音视频页里点赞 / 收藏（⭐ 2026-11-07 新增）
 * ============================================================================
 * 用法:
 *   node tools/video-interact.mjs --aweme <id> --like 1 --fav 1
 *     --like 1   点赞（0 = 不动点赞）
 *     --fav  1   收藏（0 = 不动收藏）
 *
 * 路径：无头 Chrome（共享会话，已起就复用）→ prepareWorkPage 稳健打开视频页
 *       （带 history 拦截 + 等作品路由就绪，和 comment-read-dom 同一套底座）→
 *       在页面上**真实点击**点赞 / 收藏按钮（凭据由抖音自己的前端生成，和
 *       comment-reply / card-share 同一套规矩：不签名、不调写接口、不绕过验证）。
 *
 * 选择器按候选列表逐个试（抖音页面版本会换），点完读回状态确认真的生效；
 * 都失败就 ok:false，让调用方如实报告。
 *
 * 输出：一行 JSON { ok, aweme_id, like, fav, notes:[] }
 * ============================================================================
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openPage, sleep } from '../lib/chrome.mjs'
import { prepareWorkPage } from '../lib/douyin-work.mjs'

const argOf = (k, d = '') => { const i = process.argv.indexOf(k); return i >= 0 ? String(process.argv[i + 1] ?? d) : d }
const AID = String(argOf('--aweme', '')).trim()
const DO_LIKE = argOf('--like', '0') === '1'
const DO_FAV = argOf('--fav', '0') === '1'
const out = (o) => { process.stdout.write(JSON.stringify(o)); process.exit(0) }

if (!/^\d{15,25}$/.test(AID)) out({ ok: false, error: 'aweme id 不对（15–25 位数字）' })
if (!DO_LIKE && !DO_FAV) out({ ok: true, aweme_id: AID, like: null, fav: null, notes: ['没要求任何动作'] })

const READ_STATE = `(function(){
  function probe(sel) {
    var el = document.querySelector(sel);
    if (!el) return null;
    var active = el.getAttribute('aria-pressed') === 'true'
      || /(^|\\s)(active|selected)/.test(String(el.className || ''));
    return { sel: sel, active: active };
  }
  var digg = null, fav = null;
  for (var s of ['[data-e2e="feed-active-video-digg"]', '[data-e2e="video-player-digg"]']) { digg = probe(s); if (digg) break; }
  for (var s of ['[data-e2e="feed-active-video-collect"]', '[data-e2e="video-player-collect"]']) { fav = probe(s); if (fav) break; }
  return JSON.stringify({ digg: digg, fav: fav });
})()`

try {
  const c = await openPage({ isolated: true })
  const { send, ev } = c
  const notes = []
  const result = { ok: true, aweme_id: AID, like: null, fav: null, notes }

  await prepareWorkPage(c, { aweme: AID })

  const clickSel = async (selectors) => {
    for (const sel of selectors) {
      const r = await ev(`(function(){
        var el = document.querySelector(${JSON.stringify(sel)});
        if (!el) return 'null';
        var r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return 'null';
        return JSON.stringify({x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2)});
      })()`)
      const j = JSON.parse(r || '{}')
      if (!j.x) continue
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: j.x, y: j.y, button: 'none', buttons: 0 })
      await sleep(150)
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: j.x, y: j.y, button: 'left', buttons: 1, clickCount: 1 })
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: j.x, y: j.y, button: 'left', buttons: 0, clickCount: 1 })
      await sleep(900)
      return sel
    }
    return null
  }

  if (DO_LIKE) {
    const before = JSON.parse(await ev(READ_STATE) || '{}').digg
    const sel = await clickSel(['[data-e2e="feed-active-video-digg"]', '[data-e2e="video-player-digg"]'])
    await sleep(400)
    const after = JSON.parse(await ev(READ_STATE) || '{}').digg
    if (!sel) { result.like = false; notes.push('点赞按钮没找到') }
    else {
      result.like = after ? after.active : null
      notes.push('点赞' + (result.like ? '已生效' : '点了但状态没确认（' + sel + '）'))
    }
  }
  if (DO_FAV) {
    const sel = await clickSel(['[data-e2e="feed-active-video-collect"]', '[data-e2e="video-player-collect"]'])
    await sleep(400)
    const after = JSON.parse(await ev(READ_STATE) || '{}').fav
    if (!sel) { result.fav = false; notes.push('收藏按钮没找到') }
    else {
      result.fav = after ? after.active : null
      notes.push('收藏' + (result.fav ? '已生效' : '点了但状态没确认（' + sel + '）'))
    }
  }
  out(result)
} catch (e) {
  out({ ok: false, error: String(e).slice(0, 200) })
}
