import { readFileSync, writeFileSync } from 'node:fs'

/**
 * build-client.mjs —— 生成合并包的 client.js（v1.3.0 统一入口版）
 * ============================================================================
 * 从两个上游插件的 client.js 机械提取 factory 主体，套上新的外壳：
 *   · 两个子面板不再各自注册 settings.section（外壳用包装过的 slots 拦截捕获它们），
 *     改为统一注册一个「刷视频插件」入口（落地页 + 「进入综合面板」按钮 + 页签）；
 *   · bili 的会话页签（conversation.view）等其它槽位原样放行；
 *   · 重新生成：node build-client.mjs
 * ============================================================================
 */

function extractBody(file, pkgId) {
  const src = readFileSync(file, 'utf8').split('\r\n').join('\n')
  const openToken = 'factory: (require) => {'
  const openIdx = src.lastIndexOf(openToken)
  if (openIdx < 0) throw new Error(`${file}: factory open token not found`)
  const bodyStart = openIdx + openToken.length
  const closeToken = '\n  },\n})'
  const closeIdx = src.lastIndexOf(closeToken)
  if (closeIdx < bodyStart) throw new Error(`${file}: factory close token not found`)
  const suffix = src.slice(closeIdx + closeToken.length)
  if (suffix.trim() !== '') throw new Error(`${file}: unexpected trailing content after load(): ${JSON.stringify(suffix.slice(0, 80))}`)
  const body = src.slice(bodyStart, closeIdx)
  if (!/\binject:\s*\['slots'\]/.test(body)) throw new Error(`${file}: extracted body lacks inject:['slots']`)
  if (!body.trimEnd().endsWith('}')) throw new Error(`${file}: body does not end with a return object`)
  console.error(`${pkgId}: body ${body.split('\n').length} lines, head=${JSON.stringify(body.slice(0, 60))}`)
  return body
}

const bili = extractBody('bili/client.js', 'dsh-bili-scroll')
const douyin = extractBody('douyin/client.js', 'dsh-douyin-scroll')

const header = `/**
 * dsh-video-scroll —— 浏览器半端（v1.3.0 统一入口版）
 * ============================================================================
 * 由 build-client.mjs 从两个上游插件的 client.js 机械合并生成：
 *   · bili/client.js   （c1overzz/dsh-bili-scroll）
 *   · douyin/client.js （NEWJO123/dsh-douyin-scroll）
 *
 * v1.3.0 行为：两个子面板【不再各自注册设置页区块】——外壳把它们的 slots 调用
 * 拦截下来，捕获各自的 Panel 组件，然后统一注册一个「刷视频插件」入口：
 * 落地页（说明 + 「进入综合面板」按钮）→ 页签式综合面板（刷B站 / 刷抖音）。
 * bili 的会话页签（conversation.view）等其它槽位原样放行。
 * 两个面板的 HTTP API（/api/bili-duty、/api/douyin-duty）不变。
 * 重新生成：node build-client.mjs
 * ============================================================================
 */
window.__ModuleLoader__.load({
  id: 'dsh-video-scroll',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const parts = []
    const failures = []
    // ── 刷B站 面板（dsh-bili-scroll 原样，仅换壳）─────────────────────────
    try {
      parts.push({ key: 'bili', mod: (function (require) {
${bili}
      })(require) })
    } catch (e) { failures.push(['bili', e]) }
    // ── 刷抖音 面板（dsh-douyin-scroll 原样，仅换壳）───────────────────────
    try {
      parts.push({ key: 'douyin', mod: (function (require) {
${douyin}
      })(require) })
    } catch (e) { failures.push(['douyin', e]) }

    // ══ 统一「刷视频插件」入口：落地页 + 综合面板（页签） ══════════════════
    function openConsole() {
      const ports = [8390, 8391, 8392, 8393, 8394, 8395, 8396, 8397, 8398]
      const next = (i) => {
        if (i >= ports.length) { window.alert('没找到本机控制台（8390-8398）。请确认 DSH 正在运行；也可以用桌面快捷方式「刷视频控制台」。'); return }
        fetch('http://127.0.0.1:' + ports[i] + '/ping', { mode: 'no-cors' })
          .then(() => { window.open('http://127.0.0.1:' + ports[i] + '/join', '_blank') })
          .catch(() => next(i + 1))
      }
      next(0)
    }
    function Shell({ bucket }) {
      const viewState = React.useState('landing')
      const view = viewState[0], setView = viewState[1]
      const tabState = React.useState(0)
      const tab = tabState[0], setTab = tabState[1]
      if (view === 'landing') {
        return h('div', { style: { padding: '6px 2px' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0 10px' } },
            h('div', { style: { fontSize: '16px', fontWeight: '600' } }, '🎬 刷视频插件'),
            h('div', { style: { color: '#8a93a6', fontSize: '12px' } }, '刷B站 + 刷抖音 · 综合面板'),
          ),
          h('div', { style: { color: '#8a93a6', fontSize: '12.5px', lineHeight: '1.8', margin: '0 0 14px', maxWidth: '620px' } },
            '两个功能已经合并到这里：日常自动值班、状态、日报都在综合面板里；扫码登录、评论、私信、收藏夹等完整设置在面板的对应页签内。原来的「刷B站」「刷抖音」独立设置页已收进面板，不再单独显示。'),
          h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '0 0 12px' } },
            h('button', {
              onClick: () => openConsole(),
              style: { background: '#4f7cff', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 24px', fontSize: '14px', cursor: 'pointer' },
            }, '🌐 在浏览器打开综合面板'),
            h('button', {
              onClick: () => setView('full'),
              style: { background: 'transparent', color: '#aeb9d6', border: '1px solid #3a4664', borderRadius: '10px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer' },
            }, '在此页展开'),
          ),
          h('div', { style: { marginTop: '4px', fontSize: '12px', color: '#8a93a6', lineHeight: '1.8' } },
            '· 浏览器面板是全功能版（自动在本机 8390-8398 找控制台；桌面也有「刷视频控制台」快捷方式）\\n' +
            '· 浏览器打不开时用「在此页展开」，或看 设置 → 插件 → 插件列表 是否有同步失败\\n' +
            '· 提示：看不到内容时，完全退出并重开一次 DSH（bundle 层要重启才组装）。'),
        )
      }
      const idx = Math.min(tab, bucket.length - 1)
      const cur = bucket[idx]
      return h('div', { style: { padding: '6px 2px' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '2px 0 14px' } },
          h('button', {
            onClick: () => setView('landing'),
            style: { background: 'transparent', border: '1px solid #3a4664', color: '#aeb9d6', borderRadius: '8px', padding: '5px 12px', fontSize: '12.5px', cursor: 'pointer' },
          }, '← 返回'),
          bucket.map((b, i) => h('button', {
            key: b.opts.id || i,
            onClick: () => setTab(i),
            style: {
              background: i === idx ? '#4f7cff' : 'transparent',
              color: i === idx ? '#fff' : '#aeb9d6',
              border: '1px solid ' + (i === idx ? '#4f7cff' : '#3a4664'),
              borderRadius: '8px', padding: '5px 14px', fontSize: '12.5px', cursor: 'pointer',
            },
          }, b.opts.label || b.opts.id)),
        ),
        cur && cur.render ? h(cur.render) : h('div', { style: { color: '#8a93a6', fontSize: '12.5px' } }, '面板加载失败'),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const realSlots = (typeof ctx.get === 'function' ? ctx.get('slots') : undefined) || ctx.slots
        if (!realSlots) return
        const bucket = []
        // 包装 slots：settings.section 被捕获进 bucket（不再单独显示），其它槽位原样放行
        const wrappedSlots = {
          inject: (name, reg) => {
            if (name === 'settings.section') {
              try { reg && reg() } catch (e) { console.error('[dsh-video-scroll] 捕获面板失败', e) }
              return
            }
            return realSlots.inject(name, reg)
          },
          register: (opts, render) => {
            if (opts && opts.name === 'settings.section') { bucket.push({ opts: opts, render: render }); return }
            return realSlots.register(opts, render)
          },
        }
        const wrappedCtx = new Proxy(ctx, {
          get(t, k) {
            if (k === 'get') return (n) => (n === 'slots' ? wrappedSlots : t.get(n))
            if (k === 'slots') return wrappedSlots
            const v = t[k]
            return typeof v === 'function' ? v.bind(t) : v
          },
        })
        for (const [name, error] of failures) console.error('[dsh-video-scroll] ' + name + ' 面板工厂失败', error)
        for (const part of parts) {
          try { part.mod.apply(wrappedCtx) } catch (e) { console.error('[dsh-video-scroll] 面板挂载失败：' + part.key, e) }
        }
        if (bucket.length) {
          realSlots.inject('settings.section', () => realSlots.register(
            { name: 'settings.section', id: 'video-scroll', order: 30, label: '刷视频插件' },
            () => h(Shell, { bucket: bucket }),
          ))
        }
      },
    }
  },
})
`
writeFileSync('client.js', header)
console.error('client.js written (v1.3.0 统一入口)')

// ══ 同时生成独立控制台用的 console/app.js（同一份面板 body，假宿主上下文挂载）══
const appJs = `/**
 * console/app.js —— 独立浏览器综合面板（build-client.mjs 生成，勿手改）
 * 同一份 bili/douyin 面板 factory，在"捕获 slots"的假宿主上下文里挂载，
 * 由本目录 server.mjs 提供页面并把 /api/* 代理回子插件内部路由。
 */
;(function () {
  const require = (n) => { if (n === 'react') return window.React; throw new Error('unexpected require ' + n) }
  const bucket = []
  const capSlots = {
    inject(name, reg) { if (name === 'settings.section') { try { reg && reg() } catch (e) { console.error('[console] 捕获面板失败', e) } } /* 其它槽位（会话页签等）在独立页跳过 */ },
    register(opts, render) { if (opts && opts.name === 'settings.section') bucket.push({ opts: opts, render: render }) },
  }
  const fakeCtx = {
    effect(fn) { try { return fn && fn() } catch (e) { console.error('[console] 样式注入失败', e) } },
    get(n) { return n === 'slots' ? capSlots : undefined },
    slots: capSlots,
  }
  const bili = (function (require) {
${bili}
  })(require)
  const douyin = (function (require) {
${douyin}
  })(require)
  bili.apply(fakeCtx)
  douyin.apply(fakeCtx)

  const React = window.React
  const h = React.createElement
  function App() {
    const tabState = React.useState(0)
    const tab = tabState[0], setTab = tabState[1]
    const item = bucket[Math.min(tab, bucket.length - 1)]
    const tabBtn = (active) => ({
      background: active ? '#4f7cff' : 'rgba(79,124,255,.08)',
      color: active ? '#fff' : '#aeb9d6',
      border: '1px solid ' + (active ? '#4f7cff' : 'rgba(79,124,255,.25)'),
      borderRadius: '999px', padding: '8px 22px', fontSize: '13.5px', fontWeight: active ? '600' : '400',
      cursor: 'pointer', transition: 'all .15s',
    })
    return h('div', {
      style: {
        minHeight: '100vh', boxSizing: 'border-box', padding: '28px 18px 56px',
        background: 'radial-gradient(1100px 480px at 50% -120px, #1c2740 0%, #0f1420 62%)',
      },
    },
      h('div', { style: { maxWidth: '900px', margin: '0 auto' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', margin: '0 2px 16px' } },
          h('div', null,
            h('div', { style: { fontSize: '20px', fontWeight: '700', letterSpacing: '.5px' } }, '🎬 刷视频综合面板'),
            h('div', { style: { color: '#7d8aa5', fontSize: '12px', marginTop: '3px' } }, 'dsh-video-scroll · 只监听本机 · 随 DSH 运行'),
          ),
          h('div', { style: { marginLeft: 'auto', display: 'flex', gap: '8px' } },
            bucket.map((b, i) => h('button', {
              key: b.opts.id || i,
              onClick: () => setTab(i),
              style: tabBtn(i === tab),
            }, b.opts.label || b.opts.id)),
          ),
        ),
        h('div', {
          style: {
            background: '#151c2b', border: '1px solid #26304a', borderRadius: '16px',
            padding: '18px 22px 22px', boxShadow: '0 10px 34px rgba(0,0,0,.38)', overflow: 'hidden',
          },
        },
          item && item.render ? h(item.render) : h('div', { style: { color: '#f06a6a' } }, '面板加载失败'),
        ),
        h('div', { style: { color: '#5d6a85', fontSize: '11.5px', textAlign: 'center', marginTop: '16px', lineHeight: '1.8' } },
          '配置与凭证都保存在本机 · B站数据走只读 MCP，抖音走本机 Chrome · DSH 关闭后面板随之下线'),
      ),
    )
  }
  const root = window.ReactDOM.createRoot(document.getElementById('root'))
  root.render(h(App))
})()
`
writeFileSync('console/app.js', appJs)
console.error('console/app.js written (独立控制台全功能面板)')
