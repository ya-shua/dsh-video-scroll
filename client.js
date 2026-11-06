/**
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

    const React = require('react')
    const h = React.createElement

    const API = '/api/bili-duty'
    /* ⚠️ 原来 jget/jpost 直接 .json()、从不看 res.ok ⇒ HTTP 500 的 {ok:false,error}
     *    会被调用方当成「已保存 / 成功」，绿色提示把故障盖掉。（2026-10-16 审查修） */
    const asJson = async (res) => {
      if (res.ok) return res.json()
      const why = res.status === 401 ? '（未登录 / 没权限）' : res.status === 403 ? '（被宿主拦了）' : ''
      throw new Error('HTTP ' + res.status + why)
    }
    const jget = async (p) => asJson(await fetch(API + p, { credentials: 'same-origin' }))
    const jpost = async (p, body) => asJson(await fetch(API + p, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
    }))

    const CSS = `
[data-bd-page]{display:flex;flex-direction:column;gap:18px;padding:2px 2px 8px;max-width:640px;}
    [data-bd-page][data-bd-wide]{max-width:none;width:100%;}
    [data-bd-page][data-bd-wide] [data-bd-list]{grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}
[data-bd-sec]{display:flex;flex-direction:column;gap:8px;}
[data-bd-h]{font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-bd-row]{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
[data-bd-grow]{flex:1;min-width:0;}
[data-bd-label]{font-size:13px;}
[data-bd-note]{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-bd-sw]{flex:none;width:38px;height:22px;border-radius:11px;border:0;cursor:pointer;position:relative;
  background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.35));transition:background .15s;padding:0;}
[data-bd-sw][data-on]{background:#3b82f6;}
[data-bd-sw] i{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;
  transition:left .15s;display:block;}
[data-bd-sw][data-on] i{left:19px;}
[data-bd-sw][disabled]{opacity:.45;cursor:default;}
[data-bd-sub]{margin-left:14px;padding-left:12px;border-left:2px solid var(--dsw-alias-bg-layer-3,rgba(255,255,255,.1));
  display:flex;flex-direction:column;gap:10px;}
[data-bd-input]{width:100%;box-sizing:border-box;padding:7px 9px;border-radius:8px;font-size:12px;
  border:1px solid var(--dsw-alias-bg-layer-3,rgba(255,255,255,.14));
  background:var(--dsw-alias-bg-layer-4,rgba(128,128,128,.12));color:inherit;font-family:inherit;}
[data-bd-input]:focus{outline:none;border-color:#3b82f6;}
[data-bd-num]{width:88px;text-align:center;}
[data-bd-btn]{padding:7px 12px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap;
  border:1px solid var(--dsw-alias-bg-layer-3,rgba(255,255,255,.16));
  background:var(--dsw-alias-bg-layer-4,rgba(128,128,128,.14));color:inherit;}
[data-bd-btn]:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.24));}
[data-bd-btn][data-primary]{background:#3b82f6;border-color:#3b82f6;color:#fff;}
[data-bd-btn][disabled]{opacity:.5;cursor:default;}
[data-bd-msg]{font-size:11px;line-height:16px;padding:7px 9px;border-radius:8px;word-break:break-all;
  background:var(--dsw-alias-bg-layer-4,rgba(128,128,128,.12));color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-bd-msg][data-warn]{color:#f59e0b;}
[data-bd-msgbar]{position:sticky;top:0;z-index:6;background:var(--dsw-alias-bg-base,#151a24);box-shadow:0 1px 0 var(--dsw-alias-bg-layer-2,#2a3140);margin-bottom:4px;}
[data-bd-msg][data-good]{color:#22c55e;}
[data-bd-qr]{display:flex;gap:14px;align-items:flex-start;}
[data-bd-qr] img{width:150px;height:150px;border-radius:8px;background:#fff;padding:6px;}
[data-bd-pre]{margin:6px 0 0;padding:8px 9px;border-radius:8px;max-height:170px;overflow:auto;font-size:11px;
  line-height:15px;white-space:pre-wrap;word-break:break-all;
  background:var(--dsw-alias-bg-layer-4,rgba(0,0,0,.25));color:var(--dsw-alias-label-secondary,#c9ccd1);}
    /* ⭐ 2026-10-21 重做：卡片网格 + 颜色全部取「真实存在」的主题变量
       （之前用了 --dsw-alias-bg-layer-1 / --dsw-alias-bg-layer-3 —— 这两个在应用里根本不存在 ⇒
        fallback 落到硬编码深色，而文字用的 --dsw-alias-label-primary 是存在的 ⇒ 浅色主题下变近黑 ⇒ 黑底黑字看不见） */
    [data-bd-list]{margin:10px 0 0;max-height:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;}
    [data-bd-item]{display:flex;flex-direction:column;overflow:hidden;border-radius:12px;
      background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.06));
      border:1px solid var(--dsw-alias-bg-layer-3,rgba(127,127,127,.22));
      color:var(--dsw-alias-label-primary,inherit);}
    [data-bd-cover]{display:block;width:100%;aspect-ratio:16/9;height:auto;object-fit:cover;
      background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));}
    [data-bd-item-body]{display:flex;flex-direction:column;gap:4px;padding:9px 11px;min-width:0;}
    [data-bd-item-t]{font-size:13px;line-height:18px;font-weight:600;
      color:var(--dsw-alias-label-primary,inherit);
      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;}
    [data-bd-item-t] a{color:inherit;text-decoration:none;}
    [data-bd-item-t] a:hover{text-decoration:underline;}
    [data-bd-item-n]{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary,inherit);margin:0;}
    [data-bd-item-why]{font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary,inherit);
      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
    [data-bd-clickable]{cursor:pointer;transition:border-color .12s,background .12s;}
    [data-bd-clickable]:hover{border-color:var(--dsw-alias-brand-primary,rgba(76,141,255,.5));
      background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.1));}
    [data-bd-input]{flex:1;min-width:200px;font:inherit;font-size:12.5px;padding:6px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border,rgba(127,127,127,.3));background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));color:inherit;}
    [data-bd-input]:focus{outline:none;border-color:var(--dsw-alias-brand-primary,rgba(76,141,255,.6));}
    [data-bd-select]{font:inherit;font-size:12.5px;padding:6px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border,rgba(127,127,127,.3));background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));color:inherit;cursor:pointer;}
    [data-bd-chip]{cursor:pointer;white-space:nowrap;font:inherit;font-size:12px;padding:3px 10px;border-radius:999px;
      border:1px solid var(--dsw-alias-bg-layer-3,rgba(127,127,127,.22));background:transparent;
      color:var(--dsw-alias-label-secondary,inherit);}
    [data-bd-chip]:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.1));}
    [data-bd-chip][aria-selected=true]{color:var(--dsw-alias-label-primary,inherit);
      border-color:var(--dsw-alias-brand-primary,rgba(76,141,255,.6));
      background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4c8dff) 16%,transparent);}
    [data-bd-tier]{font-weight:600;color:var(--dsw-alias-label-secondary,inherit);}
    [data-bd-tier='值得看']{color:#3fb950;}
    [data-bd-tier='可以看']{color:#d29922;}
    [data-bd-tier='不值当']{color:var(--dsw-alias-label-tertiary,inherit);}
[data-bd-kv]{font-size:11px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a6);word-break:break-all;}
[data-bd-badge]{font-size:11px;padding:2px 7px;border-radius:6px;
  background:var(--dsw-alias-bg-layer-4,rgba(128,128,128,.14));color:var(--dsw-alias-label-secondary,#c9ccd1);}
`

    // ⚠️ 与 lib/state.mjs 的 WINDOWS 保持一致（官方口径：工作日 9–12、14–18 是高峰，其余都是谷时）
    const DEFAULT_WINDOWS = {
      noon: { label: '中午谷时', start: '12:00', end: '14:00' },
      night: { label: '晚上/夜间谷时', start: '18:00', end: '09:00' },
    }

    /* ────────────── 小组件 ────────────── */

    function Switch({ on, onChange, disabled }) {
      return h('button', {
        'data-bd-sw': '',
        'data-on': on ? '' : undefined,
        disabled: Boolean(disabled),
        title: on ? '已开' : '已关',
        onClick: () => { if (!disabled) onChange(!on) },
      }, h('i'))
    }

    function ToggleRow({ label, note, on, onChange, disabled }) {
      return h('div', { 'data-bd-row': '' },
        h('div', { 'data-bd-grow': '' },
          h('div', { 'data-bd-label': '' }, label),
          note ? h('div', { 'data-bd-note': '' }, note) : null),
        h(Switch, { on, onChange, disabled }))
    }

    function useStatus(intervalMs) {
      const [st, setSt] = React.useState(null)
      // ⭐ 2026-10-19（用户报"没有开关这一项，只能让 ai 帮我开"）：读不到配置时界面只显示"读设置中…"，
      //    用户会以为是开关坏了 ✗ ⇒ 数一下连续失败次数，交给界面把话说清楚（版本太旧 / 没重启 / 读不到）
      const [fails, setFails] = React.useState(0)
      React.useEffect(() => {
        let alive = true
        const tick = async () => {
          try {
            const d = await jget('/status')
            if (!alive) return
            if (d && d.ok) { setSt(d); setFails(0) } else setFails((n) => n + 1)
          } catch { if (alive) setFails((n) => n + 1) }
        }
        tick()
        const t = setInterval(tick, intervalMs || 5000)
        return () => { alive = false; clearInterval(t) }
      }, [intervalMs])
      return [st, setSt, fails]
    }

    /* ────────────── 设置页正文 ────────────── */

/* ────────────── 会话头那个 tab：它刷过的视频（最小实验版）────────────── */
function WatchTab() {
  const PAGE = 30
  const onOpenUrl = (u) => { jpost('/open', { what: 'url', u }).catch(() => {}) }
  const [rows, setRows] = React.useState(null)
  const [st, setSt] = React.useState('')      // '' | picked | skipped | commented
  const [tier, setTier] = React.useState('')  // '' | 值得看 / 可以看 / 不值当
  const [offset, setOffset] = React.useState(0)
  const [total, setTotal] = React.useState(0)
  const load = (s, t, off) => {
    setRows(null)
    const q = `/watched?limit=${PAGE}&offset=${off}` + (s ? '&state=' + s : '') + (t ? '&tier=' + encodeURIComponent(t) : '')
    jget(q).then((r) => {
      if (!r || !r.ok) { setRows([]); return }
      setRows(r.rows || [])
      setTotal(Number(r.total) || 0)
    }).catch(() => setRows([]))
  }
  React.useEffect(() => { load("", "", 0) }, [])
  const pick = (kind, v) => {
    const next = (kind === 'state' ? st : tier) === v ? '' : v
    if (kind === 'state') setSt(next); else setTier(next)
    setOffset(0)
    load(kind === 'state' ? next : st, kind === 'tier' ? next : tier, 0)
  }
  const go = (d) => { const n = Math.max(0, Math.min(offset + d, Math.max(0, total - 1))); setOffset(n); load(st, tier, n) }
  const chip = (label, on, active) => h('button', { 'data-bd-chip': '', 'aria-selected': active ? 'true' : 'false', onClick: on }, label)
  return h('div', { 'data-bd-page': '', 'data-bd-wide': '' },
    h('div', { 'data-bd-row': '' },
      chip('全部', () => pick('state', ''), st === ''),
      chip('挑了', () => pick('state', 'picked'), st === 'picked'),
      chip('跳过', () => pick('state', 'skipped'), st === 'skipped'),
      chip('发给你了', () => pick('state', 'commented'), st === 'commented'),
      h('div', { 'data-bd-note': '' }, rows === null ? '读取中…' : `共 ${total} 条`)),
    h('div', { 'data-bd-row': '' },
      chip('值得看', () => pick('tier', '值得看'), tier === '值得看'),
      chip('可以看', () => pick('tier', '可以看'), tier === '可以看'),
      chip('不值当', () => pick('tier', '不值当'), tier === '不值当')),
    rows && rows.length ? h('div', { 'data-bd-list': '' },
      rows.map((x, i) => h('div', { key: x.day + x.bvid, 'data-bd-item': '', 'data-bd-clickable': '', title: '在浏览器打开', onClick: () => onOpenUrl(x.url) },
        i < 30 ? h('img', { 'data-bd-cover': '', src: API + '/cover?bv=' + x.bvid, loading: 'lazy', alt: '' }) : null,
        h('div', { 'data-bd-item-body': '' },
          h('div', { 'data-bd-item-t': '' }, x.title),
          h('div', { 'data-bd-item-n': '' }, `${x.day} · ${x.up} · `, x.picked ? '挑中了' : '跳过', (x.delivered || x.commented) ? ' · 已发给你' : '',
            x.tier ? h('span', { 'data-bd-tier': x.tier }, ' · ' + x.tier) : null),
          x.why ? h('div', { 'data-bd-item-why': '' }, x.why) : null))))
      : h('div', { 'data-bd-note': '' }, rows === null ? '' : '这一类还没有记录 —— 跑一轮之后就有了'),
    total > PAGE ? h('div', { 'data-bd-row': '' },
      h('button', { 'data-bd-btn': '', disabled: offset <= 0, onClick: () => go(-PAGE) }, '上一页'),
      h('div', { 'data-bd-note': '' }, `${offset + 1}–${Math.min(offset + PAGE, total)} / ${total}`),
      h('button', { 'data-bd-btn': '', disabled: offset + PAGE >= total, onClick: () => go(PAGE) }, '下一页')) : null)
}

    function Panel() {
      const [st, setSt, fails] = useStatus(5000)
      const [busy, setBusy] = React.useState('')
      const [msg, setMsg] = React.useState('')
      const [msgTone, setMsgTone] = React.useState('')
      const [kws, setKws] = React.useState(null)
      const [favFolders, setFavFolders] = React.useState(null)   // 收藏夹列表（下拉用，null = 还没读）
      const [favId, setFavId] = React.useState(null)             // 选中的收藏夹 fid（字符串）
      const [persona, setPersona] = React.useState(null)   // 人设提示词草稿
      const [excl, setExcl] = React.useState(null)              // 排除词草稿（一行一个）
      const [cLen, setCLen] = React.useState(null)              // 评论长度 short/medium/long
      const [fSort, setFSort] = React.useState(null)            // 关键词搜索排序
      const [rl, setRl] = React.useState(null)
      const [newVer, setNewVer] = React.useState('')       // 发现的新版本号（空 = 没发现）          // 日报形态：full / brief / off
      const [optim, setOptim] = React.useState({})   // 乐观更新：点下去先变，成功再以服务端为准
      // ⚠️ 输入框必须绑"本地草稿"：页面每 5 秒轮询 /status，服务端那份会把 config 盖掉
      //    ⇒ 直接绑 cfg 的话，用户打字打到一半就被冲没了 ✗（2026-10-14 陌生人验收时抓到）
      const [perDay, setPerDay] = React.useState(null)
      const [perRound, setPerRound] = React.useState(null)
      const [replyPer, setReplyPer] = React.useState(null)
      const [dmUid, setDmUid] = React.useState(null)        // 私信收件人 UID（本地草稿）
      const [dmWatch, setDmWatch] = React.useState(null)          // 私信双向开关
      const [dmMode, setDmMode] = React.useState(null)      // 投递方式：off / only / both
      const [mention, setMention] = React.useState(null)
      const [login, setLogin] = React.useState(null)
      const [runNote, setRunNote] = React.useState(null)
      const [report, setReport] = React.useState(null)        // 非 null = 报告已展开   // 顶部那行状态（跑一轮/装依赖的反馈原来在最底下，看不见）
      const [watchedRows, setWatchedRows] = React.useState(null)   // null = 还没读；[] = 读到了但没记录
      const [watchedPicked, setWatchedPicked] = React.useState(false) // 只看挑中的
    const [watchedState, setWatchedState] = React.useState('')
    const [watchedTier, setWatchedTier] = React.useState('')
    const [watchedOffset, setWatchedOffset] = React.useState(0)
    const [watchedTotal, setWatchedTotal] = React.useState(0)
    /* ⭐ 2026-11-07（用户要求"把综合面板里面的功能拆出来查询排序"）：
     *    页签（日常/偏好/互动/高级）拆掉，四组功能一页全部平铺（不再藏）；
     *    「它刷过的视频」加 查询（搜标题/BV/理由）+ 排序（最新/最旧优先）。 */
    const [watchedQ, setWatchedQ] = React.useState('')
    const [watchedSort, setWatchedSort] = React.useState('new')
      const [diag, setDiag] = React.useState(null)      // 诊断信息文本
      const [checks, setChecks] = React.useState(null)   // 环境自检结果 [{name, ok, detail, fix}]
      const [loginState, setLoginState] = React.useState('')
      const [loginTone, setLoginTone] = React.useState('')
      /* ⚠️ 扫码轮询的 timer 必须能停：切走设置页后还在跑的话会在已卸载的组件上 setState，
       *    重复点「扫码登录」还会叠出第二个 timer。（2026-10-16 审查修） */
      const loginTimer = React.useRef(null)
      const alive = React.useRef(true)
      React.useEffect(() => () => {
        alive.current = false
        if (loginTimer.current) { clearInterval(loginTimer.current); loginTimer.current = null }
      }, [])

      const cfg = st?.config
      React.useEffect(() => {
        if (cfg && kws === null) setKws((cfg.keywords || []).join('\n'))
        if (cfg && persona === null) setPersona(cfg.personaPrompt || '')
        if (cfg && rl === null) setRl(cfg.reportLevel || 'full')
        if (cfg && perDay === null) setPerDay(String(cfg.perDay ?? 5))
        if (cfg && perRound === null) setPerRound(String(cfg.commentPerRound ?? 1))
        if (cfg && replyPer === null) setReplyPer(String(cfg.replyPerRound ?? 1))
        if (cfg && mention === null) setMention(cfg.mentionName || '')
        if (cfg && dmUid === null) setDmUid(cfg.dmUid ? String(cfg.dmUid) : '')
        if (cfg && dmMode === null) setDmMode(cfg.dmMode || 'only')
        if (cfg && dmWatch === null) setDmWatch(cfg.dmWatch !== false)   // 2.0 起默认开
        if (cfg && favId === null) setFavId(String(cfg.favFolderId ?? 0))
        if (cfg && excl === null) setExcl((cfg.excludeWords || []).join('\n'))
        if (cfg && cLen === null) setCLen(cfg.commentLength || 'medium')
        if (cfg && fSort === null) setFSort(cfg.searchSort || 'pubdate')
      }, [cfg])

      // ⭐ 收藏夹列表：只读一次，读不到就空列表（别每 5 秒重拉）
      // ⚠️ 2026-10-28：它要起一个 Python 去问 B站（1~3 秒）⇒ **延迟 1.2 秒再拉**，
      //    别在打开设置页的第一瞬间跟 /status 抢，否则页面看着像卡住（他报"退出再进会卡一段"）
      React.useEffect(() => {
        if (favFolders !== null) return
        const t = setTimeout(() => {
          jget('/fav-folders').then((r) => { if (alive.current) setFavFolders(r && r.ok ? (r.folders || []) : []) })
            .catch(() => { if (alive.current) setFavFolders([]) })
        }, 1200)
        return () => clearTimeout(t)
      }, [favFolders])

      const win = { ...DEFAULT_WINDOWS, ...(st?.windows || {}) }

      const say = (text, tone) => {
        setMsg(text); setMsgTone(tone || '')
        setRunNote(text ? { t: text, tone: tone || '' } : null)   // ⭐ 同时镜像到顶部，免得提示掉到页面最底下看不见
      }

      const patch = async (p, what) => {
        setOptim((old) => ({ ...old, ...p }))          // 先亮起来
        // ⭐ 2026-10-28：宿主每次保存都要顺手同步进 DSH 原生设置，几百毫秒回不来 ⇒
        //    先给一句「保存中…」，不然点下去到出结果之间是一片空白（他报「以前马上就出来，现在要等一会」）
        say(`${what || '设置'}：保存中…`, '')
        try {
          const r = await jpost('/config', p)
          if (r?.config) setSt((old) => ({ ...old, config: r.config }))
          // ⭐ DSH 原生设置页里显式设过的键由宿主说了算 ⇒ 我们这份也得写进去；写失败要说出来，别假装"已保存"
          if (r?.host && r.host.ok === false) say(`${what || '设置'}：插件自己那份存了，但 DSH 设置页那份没写进去（${r.host.error}）`, 'warn')
          else say(what ? `${what}：已保存` : '已保存', 'good')
        } catch (e) { say(String(e?.message ?? e), 'warn') }
        // 不管成功失败都清掉乐观值：成功时以服务端返回为准，失败时自动回到原样
        finally { setOptim({}); setBusy('') }
      }

      // 「它刷过的视频」：点开才读，读一次就留着（不会每 5 秒重拉）
    const WATCH_PAGE = 30
    const onLoadWatched = async (st, tr, off, kw = watchedQ, sort = watchedSort) => {
      setBusy('watched')
      try {
        const q = `/watched?limit=${WATCH_PAGE}&offset=${off}` + (st ? '&state=' + st : '') + (tr ? '&tier=' + encodeURIComponent(tr) : '') +
          (kw ? '&q=' + encodeURIComponent(kw) : '') + '&sort=' + encodeURIComponent(sort || 'new')
        const r = await jget(q)
        setWatchedRows(r && r.ok ? (r.rows || []) : [])
        setWatchedTotal(r && r.ok ? (Number(r.total) || 0) : 0)
        setWatchedState(st)
        setWatchedTier(tr)
        setWatchedOffset(off)
        if (!r || r.ok === false) say('读不到记录：' + ((r && r.error) || '未知原因'), 'warn')
      } catch (e) { say('读不到记录：' + String(e?.message ?? e), 'warn') } finally { setBusy('') }
    }
    const onWatchPick = (kind, v) => {
      const cur = kind === 'state' ? watchedState : watchedTier
      const next = cur === v ? '' : v
      return onLoadWatched(kind === 'state' ? next : watchedState, kind === 'tier' ? next : watchedTier, 0)
    }
    const onWatchPage = (d) => onLoadWatched(watchedState, watchedTier, Math.max(0, watchedOffset + d))

      const onShowReport = async () => {
        if (report !== null) { setReport(null); return }       // 再点一次收起
        setBusy('report')
        try {
          const r = await jget('/report')
          setReport(r && r.exists ? (r.text || '（报告是空的）') : '今天还没有报告 —— 跑一轮之后就有了')
        } catch (e) { setReport('读不到报告：' + String(e?.message ?? e)) } finally { setBusy('') }
      }

      /* ⭐ 2026-11-07（用户要求"窗口压缩的功能全部解放出来"）：挂载即展开——
       *    「它刷过的视频」「今天的报告」原来要点一下才读出来，现在打开面板自动读好摆在那，
       *    按钮「收起/收起报告」仍然可用（想收回去随时收）。只跑一次，不跟 5 秒轮询抢。 */
      React.useEffect(() => {
        const t = setTimeout(() => {
          onLoadWatched('', '', 0)
          jget('/report').then((r) => {
            if (alive.current) setReport(r && r.exists ? (r.text || '（报告是空的）') : '今天还没有报告 —— 跑一轮之后就有了')
          }).catch(() => {})
        }, 900)   // 跟收藏夹列表一样缓一拍，别跟 /status 抢第一秒
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      // ⭐ 复核评论：接口回"发送成功"≠ 公开可见（新号/风控会进审核，那时候连 @ 都不会推）
      //    所以让宿主真去拉一次评论列表 / 楼中楼，确认那条到底在不在。
      const onVerify = async () => {
        setBusy('verify')
        try {
          const r = await jpost('/verify', {})
          if (!r || !r.ok) { say('复核没跑成：' + ((r && r.error) || '未知原因'), 'warn'); return }
          const n = (r.checked || []).length
          const vis = (r.checked || []).filter((c) => c.visible === true).length
          if (!n) say(r.text || '没有需要复核的记录', 'good')
          else say(`复核完 ${n} 条：公开可见 ${vis} 条，其余「没查到」（可能还在审核 —— 看不到不等于没发出去）。结果也追加到今天的报告末尾了。`, vis ? 'good' : 'warn')
          if (r.report) setReport(null)
        } catch (e) { say(String(e?.message ?? e), 'warn') } finally { setBusy('') }
      }

      // ⭐ 把"要日志"变成"点一下"（2026-10-21）
      const onDiagnose = async () => {
        setBusy('diag')
        try {
          const r = await jget('/diagnose')
          const text = String(r?.text || '（没拿到诊断信息）')
          setDiag(text)
          copyText(text).catch(() => {})
          say('诊断信息已生成并复制到剪贴板', 'good')
        } catch (e) { say('生成诊断信息失败：' + String(e?.message ?? e), 'warn') } finally { setBusy('') }
      }
      const onSelfCheck = async () => {
        setBusy('selfcheck')
        try {
          const r = await jget('/selfcheck')
          setChecks(Array.isArray(r?.items) ? r.items : [])
        } catch (e) { say('自检失败：' + String(e?.message ?? e), 'warn') } finally { setBusy('') }
      }

      const copyText = async (text) => {
        const v = String(text || '')
        try {
          await navigator.clipboard.writeText(v)
          say('已复制：' + v, 'good')
        } catch {
          say('复制失败 —— 路径是：' + v)       // 兜底：至少把路径显示出来，手动选中也能复制
        }
      }

      const onOpenFolder = async (what) => {
        try {
          const r = await jpost('/open', { what })
          if (r && r.ok) say('已请系统打开：' + (r.opened || '') + '（要是没看到窗口，用旁边的「复制报告路径」——那个一定成）', 'good')
          else say('打不开（' + ((r && r.error) || '未知原因') + '）—— 你可以手动打开这个路径：' + ((r && r.dir) || ''))
        } catch (e) { say(String(e?.message ?? e), 'warn') }
      }

      const onUpgrade = async () => {
        setBusy('upgrade')
        try {
          const r = await jpost('/upgrade', {})
          // 原来这两句分两次 say，第二句把服务端的 hint 冲掉了 —— 合成一句。（2026-10-16 审查修）
          say(((r && r.hint) || '正在升级') + ' —— 升级过程写在下面的「主依赖的日志」里；完了记得重启一次 dsh（不重启还是旧版）', 'warn')
        } catch (e) { say(String(e?.message ?? e), 'warn') } finally { setBusy('') }
      }

      const onCheckUpdate = async () => {
        setBusy('update')
        try {
          const r = await jget('/update')
          if (r && r.ok && r.latest) {
            const from = r.source === 'github' ? '（npm 上还没发上去，这个版本来自 GitHub）' : ''
            if (r.hasNew) {
              setNewVer(r.latest)
              say('有新版 v' + r.latest + '（你的是 v' + r.current + '）' + from + ' —— 点右边的「一键升级」，完了重启一次 dsh', 'warn')
            } else say('已经是最新版 v' + r.current + from, 'good')
          } else {
            say('查不到最新版（可能网络不通）—— 你现在的版本是 v' + ((r && r.current) || '?'))
          }
        } catch (e) { say(String(e?.message ?? e), 'warn') } finally { setBusy('') }
      }

      const onCheck = async () => {
        setBusy('check')
        say('')
        try {
          const r = await jpost('/check', {})
          if (r && r.ok) say('能用！' + (r.steps || []).join('、'))
          else say('还不能用：' + (r && r.error ? r.error : '没拿到结果'))
        } catch (e) { say(String(e?.message ?? e), 'warn') } finally { setBusy('') }
      }

      const onInstallAsr = async () => {
        setBusy('asr')
        say('')
        try {
          const r = await jpost('/install-asr', {})
          say(r?.started ? '开始装转写依赖 —— 进度显示在下面（要下模型，慢一点正常）' : (r?.hint || '没起来'),
            r?.started ? 'good' : 'warn')
        } catch (e) { say(String(e?.message ?? e), 'warn') } finally { setBusy('') }
      }

      const onInstall = async () => {
        setBusy('install')
        say('')
        try {
          const r = await jpost('/install', {})
          say(r?.hint || '已经在后台开始装了', '')
        } catch (e) { say(String(e?.message ?? e), 'warn') }
        finally { setBusy('') }
      }

      const onRun = async () => {
        setBusy('run')
        try {
          const r = await jpost('/run', {})
          say(r?.started ? '已经在后台跑一轮了，报告会写在 out/ 里' : '没起来，看 duty.log', r?.started ? 'good' : 'warn')
        } catch (e) { say(String(e?.message ?? e), 'warn') }
        finally { setBusy('') }
      }

      const onLoginStart = async () => {
        setBusy('login')
        setLoginTone('')
        setLoginState('正在出码…')
        try {
          const r = await jpost('/login/start', {})
          if (!r?.ok) { setLoginTone('warn'); setLoginState(r?.error || '出码失败'); return }
          setLogin({ key: r.key, qr: r.qr })
          if (!r.qr) { setLoginTone('warn'); setLoginState('没画出二维码 —— 先点上面的「重装依赖」（venv 里要有 qrcode）') }
          else setLoginState('用手机 B站 扫这张码')
          if (loginTimer.current) { clearInterval(loginTimer.current); loginTimer.current = null }   // 重复点：先把上一轮停掉
          let n = 0
          const stop = () => { clearInterval(timer); if (loginTimer.current === timer) loginTimer.current = null }
          const timer = setInterval(async () => {
            if (!alive.current) { stop(); return }        // 已经切走设置页了：别再问、别再 setState
            n += 1
            try {
              const p = await jpost('/login/poll', { key: r.key })
              if (p?.state === 'ok') {
                stop(); setLogin(null)
                setLoginTone('good'); setLoginState('登录成功')
                setSt((old) => ({ ...old, loggedIn: true }))
              } else if (p?.state === 'scanned') { setLoginTone(''); setLoginState('扫到了，请在手机上确认') }
              else if (p?.state === 'expired') { stop(); setLogin(null); setLoginTone('warn'); setLoginState('二维码过期了，再点一次「扫码登录」') }
              // ⚠️ 扫码成功但响应里没有 SESSDATA 时服务端回 state='unknown'：原来没这个分支
              //    ⇒ 界面一直显示「等扫码…」，用户白等 3 分钟才超时。（2026-10-16 审查修）
              else if (p?.state === 'unknown') {
                stop(); setLogin(null); setLoginTone('warn')
                setLoginState('没登上：' + (p?.message || '响应里没有 SESSDATA —— 再点一次「扫码登录」'))
              }
              else { setLoginTone(''); setLoginState('等扫码…') }
            } catch { /* 抖动就下次再问 */ }
            if (n > 90) { stop(); setLogin(null); setLoginTone('warn'); setLoginState('超时了，再点一次「扫码登录」') }
          }, 2000)
          loginTimer.current = timer
        } catch (e) { setLoginTone('warn'); setLoginState(String(e?.message ?? e)) }
        finally { setBusy('') }
      }

      const onFavToday = async () => {
        setBusy('fav')
        try {
          const r = await jpost('/fav-today', {})
          if (!r || r.ok === false) say('收藏没做成：' + ((r && r.error) || '未知原因'), 'warn')
          else say(`收藏好了：${r.added}/${r.total} 条` + (r.failures && r.failures.length ? `（失败 ${r.failures.length} 条）` : ''), 'good')
        } catch (e) { say(String(e?.message ?? e), 'warn') } finally { setBusy('') }
      }

      const onSaveText = async () => {
        const list = String(kws || '').split('\n').map((s) => s.trim()).filter(Boolean)
        const list2 = String(excl || '').split('\n').map((s) => s.trim()).filter(Boolean)
        // ⭐ 被清空的项要显式带 clear —— 宿主有"空值不覆盖已有值"的保护（防自动保存清空人设），
        //    不带的话用户把关键词/排除词删光了也保存不上，界面还会说"已保存" ✗（2026-10-27 他报的）
        const clear = []
        if (!list.length) clear.push('keywords')
        if (!list2.length) clear.push('excludeWords')
        if (!String(persona || '').trim().length) clear.push('personaPrompt')
        await patch({ keywords: list, excludeWords: list2, commentLength: String(cLen || 'medium'), searchSort: String(fSort || 'pubdate'), personaPrompt: String(persona || '').trim(), ...(clear.length ? { clear } : {}) }, '关键词 / 排除词 / 人设')
      }

      if (!cfg) {
        return h('div', { 'data-bd-page': '' },
        // ⭐ 2026-10-28：提示改成吸顶固定在最上面 —— 以前它挨着「保存」，往下滚到某个开关就看不见了（他报「绿字没了」）
        msg ? h('div', { 'data-bd-msg': '', 'data-bd-msgbar': '', 'data-good': msgTone === 'good' ? '' : undefined, 'data-warn': msgTone === 'warn' ? '' : undefined }, msg) : null,
          h('div', { 'data-bd-note': '' }, fails >= 3
            ? '读不到插件配置（已经试了 ' + fails + ' 次）。常见原因有三个：装的还是 0.1.11 / 0.1.12（那两版有 bug，会卡在这里）；刚装完没重启 dsh；或者插件加载失败。'
            : '读设置中…'),
          fails >= 6 ? h('div', { 'data-bd-note': '' },
            '可以先试：升级到最新版（dsh plugin --profile web add github:c1overzz/dsh-bili-scroll）→ 重启 dsh；还不行就把 ' +
            '%USERPROFILE%\\.dsh\\bili-duty\\duty.log 的最后几十行发给作者。') : null)
      }

      // 点了先变，别等网络回来（宿主写 DSH 设置那一步可能要几百毫秒）
      const sw = (k) => Boolean(k in optim ? optim[k] : cfg[k])

      return h('div', { 'data-bd-page': '' },

        /* ── 今天 ── */
        h('div', { 'data-bd-row': '' },
          h('span', { 'data-bd-badge': '' }, `自动已挑 ${st.autoPicked ?? st.pickedToday ?? 0} / ${cfg.perDay} 条` + ((st.manualExtra > 0) ? ` · 手动 ${st.manualExtra} 条` : '')),
          h('span', { 'data-bd-badge': '' }, '环境' + (st.venvReady ? '已就绪' : (st.installing ? '正在装' : '未装'))),
          h('span', { 'data-bd-badge': '' }, st.loggedIn ? 'B站已登录' : 'B站未登录'),
            h('span', { 'data-bd-badge': '' }, 'v' + (st.version || '?')),
          h('div', { 'data-bd-grow': '' }),
          h('button', { 'data-bd-btn': '', disabled: busy === 'run', onClick: onRun }, '现在跑一轮')),
          runNote ? h('div', { 'data-bd-msg': '', 'data-good': runNote.tone === 'good' ? '' : undefined,
            'data-warn': runNote.tone === 'warn' ? '' : undefined }, runNote.t) : null,


        /* ── 2026-11-07：页签已拆（用户要求功能全部平铺），四组顺序保留 ── */
        h('div', { 'data-bd-row': '' },
          h('button', { 'data-bd-btn': '', 'data-primary': '', disabled: Boolean(busy), onClick: onSaveText }, '保存')),

        h('div', { 'data-bd-sec': '', 'data-bd-group': 'daily' },
          h('div', { 'data-bd-h': '' }, '什么时候自己跑'),
          h(ToggleRow, {
            label: '峰谷时段自动刷',
            note: '只在谷时跑 —— 工作日 12:00–14:00 与 18:00 之后（整个周末也算谷时）；关了就只能手动跑',
            on: sw('peakValley'),
            onChange: (v) => patch({ peakValley: v }, '峰谷时段自动刷'),
          }),
          sw('peakValley') ? h('div', { 'data-bd-sub': '' },
            ...['noon', 'night'].map((k) => h(ToggleRow, {
              key: k,
              label: win[k].label,
              note: `${win[k].start} – ${win[k].end}`,
              on: sw(k),
              onChange: (v) => patch({ [k]: v }, win[k].label),
            }))) : null),

        /* ── 一轮挑几条 ── */
        h('div', { 'data-bd-sec': '', 'data-bd-group': 'daily' },
          h('div', { 'data-bd-h': '' }, '一轮挑几条'),
          h('div', { 'data-bd-row': '' },
            h('div', { 'data-bd-grow': '' },
              h('div', { 'data-bd-label': '' }, '每天最多挑几条'),
              h('div', { 'data-bd-note': '' }, '填 0 = 不自动刷（还是能手动跑）')),
            h('input', {
              'data-bd-input': '', 'data-bd-num': '', type: 'number', min: 0, max: 50,
              value: perDay ?? '',
              onChange: (e) => setPerDay(e.target.value),
              onBlur: () => { const n = Math.max(0, Math.min(Number(perDay) || 0, 50)); setPerDay(String(n)); patch({ perDay: n }, '每天挑几条') },
            })),
          st.lastRunAt ? h('div', { 'data-bd-note': '' }, `上次跑：${new Date(st.lastRunAt).toLocaleString('zh-CN')}`) : null),

        /* ── 发言与转写 ── */
        h('div', { 'data-bd-sec': '', 'data-bd-group': 'social' },
          h('div', { 'data-bd-h': '' }, '它怎么把结果给你'),
          h('div', { 'data-bd-label': '' }, '投递方式'),
          h('select', {
            'data-bd-input': '', value: dmMode ?? 'only',
            onChange: (e) => { setDmMode(e.target.value); patch({ dmMode: e.target.value }, '投递方式') },
          },
            h('option', { value: 'only' }, '只发私信 —— 一条公开评论都不发（默认，最不打扰别人）'),
            h('option', { value: 'off' }, '只发评论 —— 在视频下面 @ 你（公开，别人也看得见）'),
            h('option', { value: 'both' }, '私信 + 评论 —— 两边都发')),
          h('div', { 'data-bd-label': '' }, '发给谁 / @ 谁（B站 昵称）'),
          h('input', {
            'data-bd-input': '', value: mention ?? '',
            placeholder: '填你自己的 B站 昵称；私信按它查 UID，评论也 @ 它',
            onChange: (e) => setMention(e.target.value),
            onBlur: () => { const v = String(mention || '').trim(); setMention(v); patch({ mentionName: v }, '发给谁') },
          }),
          (dmMode && dmMode !== 'off') ? h('div', { 'data-bd-note': '' }, '私信会发给他（用昵称自动查一次 UID）；查不到就改回只发评论，不会一条都不送。') : null,
          (dmMode && dmMode !== 'off') ? h('div', { 'data-bd-note': '' }, '私信内容 = 本轮每条的「标题 + 链接 + 一句话」，一轮合并成一条发。⚠️ 建议先让这个号和收件人互关：B站 对「陌生人私信」会限流，还可能不弹提醒。') : null,

          (dmMode === 'off' || dmMode === 'both') ? h('div', { 'data-bd-sep': '' }) : null,
          (dmMode === 'off' || dmMode === 'both') ? h(ToggleRow, {
            label: '自动评论并 @ 你',
            note: '开了之后它会在挑中的视频下面留评论，并 @ 上面那个人',
            on: sw('autoComment'),
            onChange: (v) => patch({ autoComment: v }, '自动评论'),
          }) : null,
          (dmMode === 'off' || dmMode === 'both') && sw('autoComment') ? h('div', { 'data-bd-sub': '' },
            h('div', { 'data-bd-row': '' },
              h('div', { 'data-bd-grow': '' },
                h('div', { 'data-bd-label': '' }, '每轮最多发几条评论'),
                h('div', { 'data-bd-note': '' }, '每条评论里 @ 一次上面那个人；填 0 = 这一轮不发评论')),
              h('input', {
                'data-bd-input': '', 'data-bd-num': '', type: 'number', min: 0, max: 20,
                value: perRound ?? '',
                onChange: (e) => setPerRound(e.target.value),
                onBlur: () => { const n = Math.max(0, Math.min(Number(perRound) || 0, 20)); setPerRound(String(n)); patch({ commentPerRound: n }, '每轮发几条评论') },
              }))) : null,
          (dmMode === 'off' || dmMode === 'both') && sw('autoComment') ? h('div', { 'data-bd-sub': '' },
            h('div', { 'data-bd-row': '' },
              h('div', { 'data-bd-grow': '' },
                h('div', { 'data-bd-label': '' }, '评论写多长'),
                h('div', { 'data-bd-note': '' }, '短 ≤15 字 · 中 ≤40 字 · 长 ≤100 字（默认中）')),
              h('select', {
                'data-bd-input': '', value: cLen ?? 'medium',
                onChange: (e) => { setCLen(e.target.value); patch({ commentLength: e.target.value }, '评论长度') },
              },
                h('option', { value: 'short' }, '短'),
                h('option', { value: 'medium' }, '中'),
                h('option', { value: 'long' }, '长')))) : null,
          (dmMode === 'off' || dmMode === 'both') ? h(ToggleRow, {
            label: '回复评论（只回楼中楼）',
            note: '开了之后它只回「直接回复到你那条评论下面的人」，不参与讨论',
            on: sw('replyToComments'),
            onChange: (v) => patch({ replyToComments: v }, '回复评论'),
          }) : null,
          (dmMode === 'off' || dmMode === 'both') && sw('replyToComments') ? h('div', { 'data-bd-sub': '' },
            h('div', { 'data-bd-row': '' },
              h('div', { 'data-bd-grow': '' },
                h('div', { 'data-bd-label': '' }, '每轮最多回几条'),
                h('div', { 'data-bd-note': '' }, '只回直接回在你那条评论下面的人')),
              h('input', {
                'data-bd-input': '', 'data-bd-num': '', type: 'number', min: 1, max: 10,
                value: replyPer ?? '',
                onChange: (e) => setReplyPer(e.target.value),
                onBlur: () => { const n = Math.max(1, Math.min(Number(replyPer) || 1, 10)); setReplyPer(String(n)); patch({ replyPerRound: n }, '每轮回几条') },
              }))) : null,

          h('div', { 'data-bd-sep': '' }),
          h(ToggleRow, {
            label: '私信双向（有人私信它就回一句）',
            note: '默认开。你在 B站 私信里跟它说话，它会回你（陌生人的私信不回）。⭐ 查私信本身不花 token，只有真收到你的新消息时才花一点点。',
            on: Boolean(dmWatch),
            onChange: (v) => { setDmWatch(v); patch({ dmWatch: v }, '私信双向') },
          }),
          // ⭐ 2026-10-23：**不加新输入框**，只把"它认谁当主人"显示出来 —— 填错当场看得见 ✓
          (st.ownerInfo && dmWatch) ? h('div', { 'data-bd-note': '' },
            '它会认这个人当主人：',
            (st.ownerInfo.name ? st.ownerInfo.name + ' · ' : ''),
            'uid ' + st.ownerInfo.uid,
            st.ownerInfo.self ? '（就是现在登录的这个号）' : '',
            ' —— 想换人，改上面那个「要 @ 谁」就行') : null,
          h(ToggleRow, {
            label: '本地转写没字幕的视频',
            note: '默认关；开了以后，没字幕的视频会在本机转写一遍（不花 API 钱）',
            on: sw('transcribe'),
            onChange: (v) => patch({ transcribe: v }, '本地转写'),
          }),
          sw('transcribe') ? h('div', { 'data-bd-sub': '' },
            h('div', { 'data-bd-row': '' },
              h('button', { 'data-bd-btn': '', disabled: busy === 'asr', onClick: onInstallAsr },
                st.asrReady ? '重装转写依赖' : '装转写依赖'),
              h('div', { 'data-bd-note': '' },
                !st.asrReady ? '还没装 —— 现在开着也没用：没字幕的视频会被跳过（报告里会写"因无字幕跳过 N 条"）'
                  : (st.asrModelReady ? '环境和模型都好了' : '环境好了；模型会在第一次转写时自动下（几百 MB）'))),
            h('div', { 'data-bd-note': '' },
              '点一下就好：建一个独立环境、装 faster-whisper + yt-dlp，并把 Whisper 模型也下好',
              h('br'),
              '（模型默认 small，几百 MB，走国内镜像；装一次就够了）'),
            st.asrTail ? h('div', null,
              h('div', { 'data-bd-note': '' }, st.asrInstalling ? '正在装转写依赖（进度）：' : '转写依赖的日志（末尾）—— 只有「没字幕的视频」用得到它：'),
              h('pre', { 'data-bd-pre': '' }, st.asrTail)) : null) : null),

        /* ── 关注什么 / 在哪儿刷 ── */
        h('div', { 'data-bd-sec': '', 'data-bd-group': 'taste' },
          h('div', { 'data-bd-h': '' }, '关注什么'),
          h('textarea', {
            'data-bd-input': '', rows: 5, placeholder: '一行一个关键词；留空 = 刷首页推荐流（像人一样随便逛）',
            value: kws ?? '', onChange: (e) => setKws(e.target.value),
          }),
          h('div', { 'data-bd-label': '' }, '排除词（一行一个）—— 标题 / UP / 简介里出现这些词的，整条跳过'),
          h('textarea', {
            'data-bd-input': '', rows: 3, placeholder: '一行一个词；留空 = 不过滤',
            value: excl ?? '', onChange: (e) => setExcl(e.target.value),
          }),
          h('div', { 'data-bd-label': '' }, '填了关键词时怎么排序'),
          h('select', { 'data-bd-input': '', value: fSort ?? 'pubdate', onChange: (e) => setFSort(e.target.value) },
            h('option', { value: 'pubdate' }, '最新（默认，适合看近几天）'),
            h('option', { value: 'click' }, '播放最多'),
            h('option', { value: 'dm' }, '弹幕最多'),
            h('option', { value: 'totalrank' }, '综合')),
          h('div', { 'data-bd-label': '' }, '它按什么说话（人设提示词）—— 留空也能用：默认口语、短句、必带一个只有看了那条视频才说得出的细节'),
          h('textarea', {
            'data-bd-input': '', rows: 6,
            placeholder: '想让它怎么说话就写在这儿 —— 比如「叫我某某，说话简短点，别用 emoji」。也可以直接填一个文件路径（如 D:\\deepseek\\AGENTS.md，或它所在的那个目录），每次运行都会重新读那个文件。留空 = 按中性说话（不扮演任何人）。',
            value: persona ?? '', onChange: (e) => setPersona(e.target.value),
          }),
          // ⭐ 2.0.5（issue #89）：把人设字数亮出来 —— 超 40000 只送前 40000、超 60000 保存就截，得让用户自己看得见
          h('div', { 'data-bd-note': '' },
            '字数：' + String(persona ?? '').length
            + (String(persona ?? '').length > 40000 ? '（⚠️ 超过 40000，超出的部分不会生效）' : '')
            + (String(persona ?? '').length > 60000 ? '（⚠️ 超过 60000，保存时会被截断）' : '')),
          h('div', { 'data-bd-note': '' },
            (st.personaFromWs && String(persona || '').trim() === '')
              ? '你现在还是用「工作区」里那份 AGENTS.md 说话的（照旧生效）。想把它搬到这儿改，就把上面的路径填成本机那个目录。'
              : '改完点下面「保存」；下一轮就按这个说话。'),
          h('div', { 'data-bd-label': '' }, '日报写多细'),
          h('select', {
            'data-bd-input': '', value: rl ?? 'full',
            onChange: (e) => { setRl(e.target.value); patch({ reportLevel: e.target.value }, '日报形态') },
          },
            h('option', { value: 'full' }, '完整 —— 每条：标题 / UP / 为什么值得（默认）'),
            h('option', { value: 'brief' }, '薄 —— 每条一两行，只留值不值得 + 链接'),
            h('option', { value: 'off' }, '不写 —— 只发评论，不生成日报文件')),
        h('div', { 'data-bd-label': '' }, '自动收藏到（这一轮挑中的视频存进你的收藏夹）'),
        h('select', {
          'data-bd-input': '', value: favId ?? '0',
          onChange: (e) => { setFavId(e.target.value); patch({ favFolderId: Math.max(0, Number(e.target.value) || 0) }, '自动收藏') },
        },
          h('option', { value: '0' }, '不收藏（默认）'),
          (favFolders || []).map((f) => h('option', { key: String(f.id), value: String(f.id) }, `${f.title}（${f.count} 条）`))),
        h('div', { 'data-bd-row': '' },
          h('button', { 'data-bd-btn': '', disabled: busy === 'fav', onClick: onFavToday }, '补收藏今天的'),
          h('div', { 'data-bd-note': '' },
            favFolders === null ? '收藏夹列表读取中…'
              : (favFolders.length ? '每轮跑完会把挑中的视频存进上面选的收藏夹'
                : '读不到收藏夹 —— 先「扫码登录」，或过会儿重开设置页'))),

          h('div', { 'data-bd-row': '' },
            msg ? h('div', { 'data-bd-msg': '', 'data-good': msgTone === 'good' ? '' : undefined, 'data-warn': msgTone === 'warn' ? '' : undefined }, msg) : null)),

        /* ── 环境与账号 ── */
        /* ── 它刷过的视频 ── */
        h('div', { 'data-bd-sec': '', 'data-bd-group': 'daily' },
          h('div', { 'data-bd-h': '' }, '它刷过的视频'),
          h('div', { 'data-bd-row': '' },
            h('button', { 'data-bd-btn': '', disabled: busy === 'watched', onClick: () => (watchedRows !== null ? setWatchedRows(null) : onLoadWatched(watchedState, watchedTier, watchedOffset)) },
              watchedRows !== null ? '收起' : '看它刷过什么'),
            h('div', { 'data-bd-note': '' },
              watchedRows === null ? '（点一下读出来；数据来自判重表 seen.md + 报告里的档位）'
                : (watchedTotal ? `共 ${watchedTotal} 条` : '这一类还没有记录 —— 跑一轮之后就有了'))),
          watchedRows !== null ? h('div', { 'data-bd-row': '' },
            [['', '全部'], ['picked', '挑了'], ['skipped', '跳过'], ['commented', '发给你了']].map(([v, label]) =>
              h('button', { key: v || 'all', 'data-bd-chip': '', 'aria-selected': watchedState === v ? 'true' : 'false', onClick: () => onWatchPick('state', v) }, label)),
            ['值得看', '可以看', '不值当'].map((v) =>
              h('button', { key: v, 'data-bd-chip': '', 'aria-selected': watchedTier === v ? 'true' : 'false', onClick: () => onWatchPick('tier', v) }, v))) : null,
          /* ⭐ 2026-11-07：查询 + 排序（用户要求"拆出来查询排序"） */
          watchedRows !== null ? h('div', { 'data-bd-row': '' },
            h('input', { 'data-bd-input': '', value: watchedQ, placeholder: '搜标题 / BV号 / 理由（回车查询）',
              onChange: (e) => setWatchedQ(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter') onLoadWatched(watchedState, watchedTier, 0, watchedQ, watchedSort) } }),
            h('select', { 'data-bd-select': '', value: watchedSort,
              onChange: (e) => { const v = e.target.value; setWatchedSort(v); onLoadWatched(watchedState, watchedTier, 0, watchedQ, v) } },
              h('option', { value: 'new' }, '最新优先'),
              h('option', { value: 'old' }, '最旧优先'))) : null,
          watchedRows !== null && watchedRows.length ? h('div', { 'data-bd-list': '' },
            watchedRows.map((x, i) => h('div', { key: x.day + x.bvid, 'data-bd-item': '' },
              // 封面走宿主代理（直连 i0.hdslb.com 会被防盗链挡，也等于把使用者 IP 交出去）
              i < 40 ? h('img', { 'data-bd-cover': '', src: API + '/cover?bv=' + x.bvid, loading: 'lazy', alt: '' }) : null,
              h('div', { 'data-bd-item-body': '' },
                h('div', { 'data-bd-item-t': '' },
                  h('a', { href: x.url, target: '_blank', rel: 'noreferrer' }, x.title)),
                h('div', { 'data-bd-item-n': '' },
                  `${x.day} · ${x.up} · `, x.picked ? '挑中了' : '跳过', (x.delivered || x.commented) ? ' · 已发给你' : '',
                  x.tier ? h('span', { 'data-bd-tier': x.tier }, ' · ' + x.tier) : null),
                x.why ? h('div', { 'data-bd-item-why': '' }, x.why) : null))))
            : null,
          watchedRows !== null && watchedTotal > WATCH_PAGE ? h('div', { 'data-bd-row': '' },
            h('button', { 'data-bd-btn': '', disabled: watchedOffset <= 0, onClick: () => onWatchPage(-WATCH_PAGE) }, '上一页'),
            h('div', { 'data-bd-note': '' }, `${watchedOffset + 1}–${Math.min(watchedOffset + WATCH_PAGE, watchedTotal)} / ${watchedTotal}`),
            h('button', { 'data-bd-btn': '', disabled: watchedOffset + WATCH_PAGE >= watchedTotal, onClick: () => onWatchPage(WATCH_PAGE) }, '下一页')) : null),

        h('div', { 'data-bd-sec': '', 'data-bd-group': 'adv' },
          h('div', { 'data-bd-row': '' },
            h('button', { 'data-bd-btn': '', disabled: busy === 'diag', onClick: onDiagnose }, '复制诊断信息'),
            h('button', { 'data-bd-btn': '', disabled: busy === 'selfcheck', onClick: onSelfCheck }, '环境自检'),
            h('div', { 'data-bd-note': '' }, '出问题时先点这两个：第一个把环境+日志拼成一段（已自动复制），第二个逐项告诉你哪一步不通。')),
          checks && checks.length ? h('div', { 'data-bd-list': '', 'data-bd-checks': '' },
            checks.map((x) => h('div', { key: x.name, 'data-bd-item': '', 'data-bd-item-t': '' },
              h('div', { 'data-bd-item-t': '' }, (x.ok ? '正常 · ' : '有问题 · ') + x.name),
              h('div', { 'data-bd-item-n': '' }, x.detail || ''),
              x.ok ? null : h('div', { 'data-bd-item-why': '' }, '怎么办：' + (x.fix || '把诊断信息发给作者'))))) : null,
          diag ? h('pre', { 'data-bd-pre': '' }, diag) : null,
          h('div', { 'data-bd-h': '' }, '环境与账号'),
          h('div', { 'data-bd-row': '' },
            h('button', { 'data-bd-btn': '', disabled: busy === 'install', onClick: onInstall },
              st.venvReady ? '重装主依赖' : '装主依赖（建 venv）'),
            h('button', { 'data-bd-btn': '', disabled: busy === 'check', onClick: onCheck }, '测一下'),
            h('button', { 'data-bd-btn': '', disabled: busy === 'update', onClick: onCheckUpdate }, '检查更新'),
            newVer ? h('button', { 'data-bd-btn': '', 'data-primary': '', disabled: busy === 'upgrade', onClick: onUpgrade }, '一键升级到 v' + newVer) : null,
            h('button', { 'data-bd-btn': '', disabled: busy === 'login', onClick: onLoginStart }, '扫码登录'),
            h('div', { 'data-bd-note': '' },
              !st.venvReady ? (st.installFailed ? '上次没装成 → 看下面日志' : '还没装 → 先点「装主依赖」')
                : (st.loggedIn ? '装好了 → 下一步「扫码登录」' : '环境好了 → 点「扫码登录」'))),
          loginState ? h('div', { 'data-bd-msg': '', 'data-good': loginTone === 'good' ? '' : undefined, 'data-warn': loginTone === 'warn' ? '' : undefined }, loginState) : null,
          st.installTail ? h('div', null,
            h('div', { 'data-bd-note': '' }, st.installing ? '正在装主依赖（进度）：' : '主依赖的日志（B站 搜索 / 字幕 / 评论 用得到，末尾）：'),
            h('pre', { 'data-bd-pre': '' }, st.installTail)) : null,
          login?.qr ? h('div', { 'data-bd-qr': '' },
            h('img', { src: login.qr, alt: 'B站登录二维码' }),
            h('div', { 'data-bd-note': '' },
              '手机 B站 → 我的 → 扫一扫。',
              h('br'),
              '确认时选「记住我 / 长期」那张 —— 选 24 小时的话，明天就得重扫。')) : null),
          (Array.isArray(st.missingDeps) && st.missingDeps.length)
            ? h('div', { 'data-bd-note': '' }, '还缺这几项：' + st.missingDeps.join(' / ') + '（qrcode = 画登录二维码用的）—— 点一次「重装主依赖」就会补上')
            : null,

        /* ── 它是怎么干活的（给他看的） ── */
        h('div', { 'data-bd-sec': '', 'data-bd-group': 'adv' },
          h('div', { 'data-bd-h': '' }, '它的地盘'),
          h('div', { 'data-bd-kv': '' },
            `家目录：${st.home}`,
            h('br'),
            `今天的报告：${st.report}`),
          h('div', { 'data-bd-row': '' },
            h('button', { 'data-bd-btn': '', disabled: busy === 'report', onClick: onShowReport },
              report !== null ? '收起报告' : '看今天的报告'),
            h('button', { 'data-bd-btn': '', onClick: () => onOpenFolder('out') }, '打开报告文件夹'),
            h('button', { 'data-bd-btn': '', onClick: () => onOpenFolder('home') }, '打开家目录'),
            h('button', { 'data-bd-btn': '', disabled: busy === 'verify', onClick: onVerify },
              '复核评论'),
            h('button', { 'data-bd-btn': '', onClick: () => copyText(st.report) }, '复制报告路径')),
          report !== null ? h('pre', { 'data-bd-pre': '' }, report) : null),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const style = document.createElement('style')
        style.setAttribute('data-plugin-css', 'dsh-bili-scroll')
        style.textContent = CSS
        document.head.appendChild(style)
        ctx.effect(() => () => style.remove(), 'dsh-bili-scroll: 设置页样式')

        // ⭐ 进「设置」：label 就是左侧导航里那一项（抄 dsh-meme 的写法）
        const slots = (typeof ctx.get === 'function' ? ctx.get('slots') : undefined) || ctx.slots
        if (!slots) return
        slots.inject('settings.section', () => slots.register(
          { name: 'settings.section', id: 'bili-scroll', order: 30, label: '刷B站' },
          () => h(Panel),
        ))

  // ⭐ 2026-10-20 实验：会话头第三个 tab（0.2.1 里这个槽位真实存在；老版本没有就静默跳过）
  try {
    slots.inject('conversation.view', () => slots.register({
      name: 'conversation.view',
      id: 'bili-watched',
      order: 20,
      label: '刷过的视频',
      scope: 'session',
    }, () => h(WatchTab)))
  } catch (e) { /* 没有这个槽位就算了 */ }
      },
    }
      })(require) })
    } catch (e) { failures.push(['bili', e]) }
    // ── 刷抖音 面板（dsh-douyin-scroll 原样，仅换壳）───────────────────────
    try {
      parts.push({ key: 'douyin', mod: (function (require) {

    const React = require('react')
    const h = React.createElement

    const API = '/api/douyin-duty'

    /**
     * ⭐ 面板构建号 —— **每次改完 client.js 就 +1**。
     *    为什么需要它：改 client.js 后如果不重启/刷新，浏览器会一直用缓存的旧 bundle，
     *    面板看起来"没变化"，很难判断是代码错了还是没加载。
     *    对一下面板右上角显示的 `v<版本>·b<N>` 就知道。
     */
    const PANEL_BUILD = 23

    const asJson = async (res) => {
      if (res.ok) return res.json()
      const why = res.status === 401 ? '（未登录 / 没权限）' : res.status === 403 ? '（被宿主拦了）' : ''
      throw new Error('HTTP ' + res.status + why)
    }
    const jget = async (p) => asJson(await fetch(API + p, { credentials: 'same-origin' }))
    const jpost = async (p, body) => asJson(await fetch(API + p, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
    }))
    // jpost 但失败/404 返回 null（用在新旧宿主兼容探测上，不炸面板）
    const jpostSoft = async (p, body) => { try { return await jpost(p, body) } catch { return null } }

    const CSS = `
[data-dy-page]{display:flex;flex-direction:column;gap:16px;padding:4px 2px 10px;max-width:660px;font-size:13px;}
[data-dy-card]{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:12px;
  border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));
  background:var(--dsw-alias-bg-overlay,rgba(128,128,128,.06));}
[data-dy-title]{font-size:13px;font-weight:600;}
[data-dy-sub]{font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-dy-row]{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
[data-dy-grow]{flex:1;min-width:0;}
[data-dy-btn]{padding:7px 13px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;
  border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));
  background:var(--dsw-alias-bg-overlay,rgba(128,128,128,.14));color:inherit;}
[data-dy-btn]:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.24));}
[data-dy-btn][data-primary]{background:#3b82f6;border-color:#3b82f6;color:#fff;}
[data-dy-btn][disabled]{opacity:.5;cursor:default;}
[data-dy-input]{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;font-size:12px;
  border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));
  background:var(--dsw-alias-bg-overlay,rgba(128,128,128,.12));color:inherit;font-family:inherit;}
[data-dy-input]:focus{outline:none;border-color:#3b82f6;}
[data-dy-badge]{font-size:11px;padding:3px 8px;border-radius:6px;
  background:var(--dsw-alias-bg-overlay,rgba(128,128,128,.14));
  color:var(--dsw-alias-label-secondary,#c9ccd1);}
[data-dy-badge][data-on]{background:rgba(34,197,94,.16);color:#22c55e;}
[data-dy-badge][data-off]{background:rgba(245,158,11,.16);color:#f59e0b;}
[data-dy-msg]{font-size:11px;line-height:17px;padding:8px 10px;border-radius:8px;
  background:var(--dsw-alias-bg-overlay,rgba(128,128,128,.12));
  color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-dy-msg][data-good]{color:#22c55e;}
[data-dy-msg][data-warn]{color:#f59e0b;}
[data-dy-kv]{font-size:11px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-dy-sw]{flex:none;width:38px;height:22px;border-radius:11px;border:0;cursor:pointer;position:relative;
  background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.35));transition:background .15s;padding:0;}
[data-dy-sw][data-on]{background:#3b82f6;}
[data-dy-sw] i{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;
  background:#fff;transition:left .15s;display:block;}
[data-dy-sw][data-on] i{left:19px;}
[data-dy-seg]{display:inline-flex;flex:none;border-radius:8px;overflow:hidden;
  border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));}
[data-dy-segbtn]{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#c9ccd1);
  font-size:11px;padding:4px 10px;cursor:pointer;}
[data-dy-segbtn][data-on]{background:#3b82f6;color:#fff;}
[data-dy-pre]{margin:0;padding:9px 10px;border-radius:8px;max-height:180px;overflow:auto;
  font-size:11px;line-height:15px;white-space:pre-wrap;word-break:break-all;
  background:var(--dsw-alias-bg-overlay,rgba(0,0,0,.25));
  color:var(--dsw-alias-label-secondary,#c9ccd1);}
[data-dy-time]{flex:none;width:78px;box-sizing:border-box;padding:6px 8px;border-radius:7px;
  font-size:12px;font-family:inherit;text-align:center;
  border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));
  background:var(--dsw-alias-bg-overlay,rgba(128,128,128,.12));color:inherit;}
[data-dy-time]:focus{outline:none;border-color:#3b82f6;}
[data-dy-mini]{padding:5px 10px;border-radius:7px;font-size:11px;cursor:pointer;font-family:inherit;
  border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));
  background:var(--dsw-alias-bg-overlay,rgba(128,128,128,.14));color:inherit;}
[data-dy-mini]:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.24));}
[data-dy-mini][disabled]{opacity:.5;cursor:default;}
[data-dy-mini][data-danger]{color:#f87171;}
/* 桌宠人格卡（2026-10-24 v5） */
[data-dy-personas]{display:flex;gap:8px;flex-wrap:wrap;}
[data-dy-pcard]{flex:1;min-width:150px;padding:10px;border-radius:10px;cursor:pointer;text-align:left;
  border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));
  background:var(--dsw-alias-bg-overlay,rgba(128,128,128,.1));color:inherit;font-family:inherit;}
[data-dy-pcard][data-on]{border-color:#3b82f6;background:rgba(59,130,246,.14);}
[data-dy-pcard-name]{font-size:12px;font-weight:600;}
[data-dy-pcard-desc]{font-size:11px;color:var(--dsw-alias-label-tertiary,#9aa0a6);margin-top:3px;line-height:15px;}
[data-dy-wrow]{display:flex;align-items:center;gap:6px;flex-wrap:nowrap;}
[data-dy-sep]{font-size:11px;color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-dy-step]{flex:none;width:20px;height:20px;border-radius:50%;font-size:11px;font-weight:600;
  display:inline-flex;align-items:center;justify-content:center;
  background:var(--dsw-alias-bg-overlay,rgba(128,128,128,.18));
  color:var(--dsw-alias-label-secondary,#c9ccd1);}
[data-dy-step][data-done]{background:rgba(34,197,94,.18);color:#22c55e;}
[data-dy-loginbox]:empty{display:none;}
[data-dy-qr]{display:block;}
[data-dy-people]{display:flex;flex-direction:column;gap:4px;max-height:260px;overflow:auto;
  padding:4px;border-radius:9px;background:var(--dsw-alias-bg-overlay,rgba(0,0,0,.16));}
[data-dy-person]{display:flex;align-items:center;gap:8px;width:100%;text-align:left;cursor:pointer;
  padding:7px 9px;border-radius:7px;border:0;background:transparent;color:inherit;font-family:inherit;font-size:12px;}
[data-dy-person]:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.22));}
[data-dy-person][data-picked]{background:rgba(59,130,246,.14);}
[data-dy-person][disabled]{cursor:default;opacity:.6;}
[data-dy-person-name]{font-weight:600;flex:none;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
[data-dy-person-sub]{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:11px;color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-dy-tag]{flex:none;font-size:10px;padding:1px 6px;border-radius:5px;
  background:rgba(245,158,11,.16);color:#f59e0b;}
[data-dy-tag][data-ok]{background:rgba(34,197,94,.16);color:#22c55e;}
[data-dy-msgrow]{padding:7px 9px;border-radius:8px;background:var(--dsw-alias-bg-overlay,rgba(0,0,0,.14));}
[data-dy-chat]{display:flex;flex-direction:column;gap:6px;max-height:320px;overflow:auto;
  padding:8px;border-radius:9px;background:var(--dsw-alias-bg-overlay,rgba(0,0,0,.16));}
[data-dy-bubble]{max-width:78%;padding:7px 10px;border-radius:10px;font-size:12px;line-height:17px;
  background:var(--dsw-alias-bg-overlay,rgba(128,128,128,.2));align-self:flex-start;}
[data-dy-bubble][data-mine]{align-self:flex-end;background:rgba(59,130,246,.22);}
[data-dy-bubble][data-them]{align-self:flex-start;background:rgba(128,128,128,.24);}
[data-dy-bubble-text]{white-space:pre-wrap;word-break:break-word;}
/* ── 面板三组（2026-10-25 重排）：20+ 张卡压成 7 张，分「常开必看 / 出问题才看 / 一次配好」──
 * 实际 DOM 结构（两层，别忘了）：
 *   div[data-dy-group]                 组容器（一组一行，flex）
 *     ├─ span[data-dy-groupname]       组名（常开必看 / 出问题才看 / 一次配好）
 *     └─ button[data-dy-groupbtn]      **只有折叠组有**：能点，带 data-open / aria-expanded
 *          └─ span[data-dy-groupchev]  「展开看 ▼ / 收起 ▲」或组①的提示文字
 * 组容器自己**不**带 data-dy-card ⇒ 卡片计数才正好 7。
 * [data-dy-subblock] 合并进同一张卡里的子块（带上分隔线；卡里第一块不出线）
 * [data-dy-inner]    原本就嵌在卡里的透明小卡（不参与顶层卡片计数）
 * [data-dy-subflat]  那两个状态屏（她的所思所想 / 聊天模式状态）的虚线框 */
[data-dy-group]{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;
  letter-spacing:.04em;color:var(--dsw-alias-label-secondary,#c9ccd1);}
div[data-dy-group]{padding:2px 4px 0;}
/* 折叠组：整行做成一颗大按钮，一眼看得出能点 */
button[data-dy-groupbtn]{width:100%;box-sizing:border-box;text-align:left;padding:10px 12px;
  border-radius:10px;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;
  letter-spacing:.04em;display:flex;align-items:center;gap:8px;
  border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));
  background:var(--dsw-alias-bg-overlay,rgba(128,128,128,.08));color:inherit;}
button[data-dy-groupbtn]:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.2));}
button[data-dy-groupbtn][data-open]{color:var(--dsw-alias-label-secondary,#c9ccd1);}
[data-dy-grouphint]{font-size:11px;font-weight:400;letter-spacing:0;
  color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-dy-groupchev]{margin-left:auto;font-size:11px;font-weight:400;letter-spacing:0;
  color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-dy-inner]{display:flex;flex-direction:column;gap:10px;}
[data-dy-subblock]{display:flex;flex-direction:column;gap:10px;margin-top:10px;padding-top:10px;
  border-top:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));}
[data-dy-subblock]:first-child{margin-top:0;padding-top:0;border-top:0;}
[data-dy-subflat]{display:flex;flex-direction:column;border-radius:10px;box-sizing:border-box;}
/* （旧版 GUI 浮层小宠的样式已随 v3 迁往 dsh-deskpet 删除） */
`

    function Switch({ on, onChange, disabled }) {
      return h('button', {
        'data-dy-sw': '', 'data-on': on ? '' : undefined,
        disabled: Boolean(disabled),
        onClick: () => { if (!disabled) onChange(!on) },
      }, h('i'))
    }

    /**
     * ⭐ 聊天模式的实时状态屏（2026-10-24，使用者两轮反馈打磨成拟人版）。
     *    使用者原话：「显示 AI 现在在干嘛」→「要拟人，小鱼在干啥干啥，
     *    最后是小鱼抱着手机等着你发消息呢，还有正在发送之类的」。
     *    设计：一条**小鱼的动作**（emoji + 一句话）+ 一行小字（技术参数，给排障用）。
     *    每 15 秒拉一次 /chat/watch（读状态文件，很轻）。
     */
    function ChatWatchStatus() {
      const [s, setS] = React.useState(null)
      const [tick, setTick] = React.useState(0) // 本地 1 秒一跳：让"下次还有 X 秒"活起来
      React.useEffect(() => {
        let alive = true
        const pull = async () => {
          try { const r = await jget('/chat/watch'); if (alive && r && r.ok) setS(r) } catch { /* 拉不到等下一拍 */ }
        }
        pull()
        const t = setInterval(pull, 15_000)
        const t2 = setInterval(() => setTick((x) => x + 1), 1000)
        return () => { alive = false; clearInterval(t); clearInterval(t2) }
      }, [])
      if (!s) return h('div', { 'data-dy-sub': '' }, '🐟 小鱼正在游过来…（状态加载中）')
      void tick // tick 只用于触发重渲染，不直接读
      const ago = s.lastCheckAt ? Math.max(0, Math.round((Date.now() - s.lastCheckAt) / 1000)) : null
      const sec = Number(s.sec || 30)
      const nextIn = s.lastCheckAt ? Math.max(0, sec - ago) : sec
      /* ⭐⭐ 2026-10-26 凌晨（主人：「如果是普通用户，他该怎么办，没那么聪明啊」）
       *   面板不再让用户读内部字段（lastResult / lastError 是给排障的），
       *   分两层显示：
       *     第一层 = 后端给的一句人话（s.human）+ 该干什么（s.action）—— 普通人只看这层
       *     第二层 = 技术细节（几秒前 · 走了哪条路 · 看了几次）—— 默认小字，排障才看
       *   health=broken 时把 action 高亮成橙色，warning 黄色，ok 绿点。
       */
      const health = s.health || (s.lastResult === 'error' ? 'warning' : 'ok')
      const DOT = { ok: '🟢', warning: '🟡', broken: '🔴', off: '⚪' }
      const FISH = {
        ok: `🐟 小鱼抱着手机趴在缸边等着呢——刚看过（${ago} 秒前），还没有新消息。下次去看还有 ${nextIn} 秒`,
        ok_prime: `🐳 小鱼刚接班，正在把聊天记录翻到最新一页（之前的不重播，从现在起只等新的）`,
        ok_new: `🔔 小鱼看到新消息了：「${s.lastNewText || ''}」——已经转给值班的小鱼接话`,
        error: `😵 小鱼撞缸了`,
        no_match: `🤔 小鱼在已建立会话里没找到「${s.to || '这个人'}」：${s.lastNote || '陌生人消息走不了这条路'}`,
        off: `😴 开关关了，小鱼在缸底睡觉（这条是旧状态）`,
        skip_no_to: `🫥 小鱼不知道该盯谁——还没选私信对象`,
        skip_no_login: `🫥 小鱼进不去抖音——还没登录`,
      }
      // 后端给了人话就用它（普通人只看得懂那个）；没给才退回老的拟人句
      const line = s.human || FISH[s.lastResult] || `🐟 小鱼状态：${s.lastResult || '刚下水，还没跑第一拍'}`
      const tone = health === 'broken' ? '#f59e0b' : health === 'warning' ? '#fbbf24' : null
      return h('div', { 'data-dy-inner': '', 'data-dy-subflat': '', style: { background: 'transparent', border: '1px dashed var(--dsw-alias-border-l2,rgba(255,255,255,.14))', padding: '8px 10px', gap: '4px' } },
        h('div', { 'data-dy-sub': '', style: { opacity: '.95' } }, `${DOT[health] || '🐟'} ${line}`),
        // 该干什么：只有真需要用户动手时才显示（action 为空 = 不用管）
        s.action
          ? h('div', { 'data-dy-sub': '', style: { color: tone || 'inherit', fontWeight: '500' } }, `👉 ${s.action}`)
          : null,
        h('div', { 'data-dy-sub': '', style: { opacity: '.7' } },
          `每 ${sec} 秒看一眼「${s.to || '私信对象'}」· 走 ${s.via || 'http'} · 已看 ${s.checks || 0} 次 · 提醒过 ${s.notified || 0} 条${s.failStreak ? ` · 连续失败 ${s.failStreak} 次` : ''}`))
    }

    /**
     * ⭐ 关键：绝不能让组件抛错把整页搞没。
     *    用 error boundary 包住 —— 任何子组件炸了只显示一句提示 + 重试，
     *    而不是像之前那样整块空白（一个 TDZ 错误就能让面板彻底消失）。
     */
    class Boundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { err: null }
      }
      static getDerivedStateFromError(err) {
        return { err: String((err && err.message) || err) }
      }
      render() {
        if (this.state.err) {
          return h('div', { 'data-dy-card': '' },
            h('div', { 'data-dy-title': '' }, '⚠️ 这个面板出错了'),
            h('div', { 'data-dy-sub': '' }, this.state.err),
            h('div', { 'data-dy-row': '' },
              h('button', {
                'data-dy-btn': '',
                onClick: () => this.setState({ err: null }),
              }, '重试')))
        }
        return this.props.children
      }
    }

    function Panel() {
      const [st, setSt] = React.useState(null)
      const [cfg, setCfg] = React.useState(null)
      const [busy, setBusy] = React.useState('')
      const [msg, setMsg] = React.useState('')
      const [msgTone, setMsgTone] = React.useState('')
      const [kws, setKws] = React.useState(null)
      /** ⭐ 一键自救的结果（{ok, human, need_user, fixed}）—— null = 还没点过 */
      const [chatFix, setChatFix] = React.useState(null)
      const [doctor, setDoctor] = React.useState(null)
      const [report, setReport] = React.useState(null)
      const [wins, setWins] = React.useState(null)
      const [upd, setUpd] = React.useState(null)
      const [ai, setAi] = React.useState(null)
      const [copied, setCopied] = React.useState('')
      // 扫码登录：qr = { url }，qrHint = 一句人话（出不来码时说什么）
      const [qr, setQr] = React.useState(null)
      const [qrHint, setQrHint] = React.useState('')
      // 私信对象：列表 + 选中的那个人
      const [people, setPeople] = React.useState(null)
      const [peopleHint, setPeopleHint] = React.useState('')
      // 新手流程说明
      const [guide, setGuide] = React.useState(null)
      // 当前登录的账号
      const [acc, setAcc] = React.useState(null)
      // 人设（使用者自己那份）
      const [persona, setPersona] = React.useState(null)
      // 私信对象：手动填的模式
      const [manualDm, setManualDm] = React.useState(null)
      // 每天挑几条（输入框草稿）
      const [perDayDraft, setPerDayDraft] = React.useState(null)
      // 记忆统计
      const [mem, setMem] = React.useState(null)
      // 消息（收件箱）：评论区 @ 我 + 谁私信我
      const [inbox, setInbox] = React.useState(null)
      // 聊天：当前跟谁聊、消息列表、输入框
      const [chat, setChat] = React.useState(null)
      const [chatText, setChatText] = React.useState('')
      // 最近一轮的日志
      const [runLog, setRunLog] = React.useState(null)
      // 「评论区 @ 提醒」（0.5.9）：开关 = 总闸，atPeers 多选 = 范围；会话列表只读一次
      // 聊天盯梢间隔的输入草稿（2026-10-24）
      const [cwSecDraft, setCwSecDraft] = React.useState(null)
      // dsh 入口路径（输入框草稿）—— 2026-10-23 加，见「出问题了？」卡片
      const [dshBinDraft, setDshBinDraft] = React.useState(null)
      /* ⭐ 面板三组折叠（2026-10-25 重排）—— 2026-11-07 起默认**全部展开**（用户要求"窗口压缩的功能全部解放出来"）。
       * 🔴 必须放在这里（和其它 useState 一起、在 `if (!st || !cfg) return` 之前），
       *    绝不能塞进条件分支：React 的 hook 顺序一变，整页就白。
       *    · foldErr = 「体检 / dsh 入口 / 关于 / MCP」（原来"出问题才看"，现默认展开，仍可手动收起）
       *    · foldCfg = 「策略 / 桌宠 / 消息与记忆」（原来"一次配好"，现默认展开，仍可手动收起） */
      const [foldErr, setFoldErr] = React.useState(true)
      const [foldCfg, setFoldCfg] = React.useState(true)

      const say = (t, tone) => { setMsg(t); setMsgTone(tone || '') }

      /**
       * ⭐ 查登录的号：带重试的账号查询（主人 2026-10-24 验收「一直显示正在查登录的号」）。
       *    旧版只在面板打开时查一次，/account 慢或失败就永远停在「正在查…」。
       *    现在：先拿缓存（秒回）；空/失败则带 refresh=1 强查，最多重试 3 次（间隔 4s）。
       */
      const loadAccount = async (attempt) => {
        try {
          let a = null
          try { a = await jget('/account') } catch { a = null }
          if (a && a.account && a.account.nick) { setAcc(a.account); return true }
          // 缓存空/没昵称 ⇒ 强制查一次（宿主跑体检，慢但准）
          a = await jget('/account?refresh=1')
          if (a && a.account && (a.account.nick || a.account.uid)) { setAcc(a.account); return true }
          return false
        } catch {
          if ((attempt || 0) < 2) {   // 还有得救：4 秒后再来（宿主可能正忙）
            await new Promise((r) => setTimeout(r, 4000))
            return loadAccount((attempt || 0) + 1)
          }
          return false
        }
      }

      React.useEffect(() => {
        let alive = true
        ;(async () => {
          try {
            const [s, c] = await Promise.all([jget('/status'), jget('/config')])
            if (!alive) return
            setSt(s)
            if (c && c.config) setCfg(c.config)
            if (s && s.loggedIn) {
              // 账号昵称：带重试，查到才把「正在查登录的号…」换下来
              const okAcc = alive ? await loadAccount(0) : false
              if (alive && !okAcc) {
                // 查了三轮还是空：挂一句实话，别让主人盯着"正在查"干等
                setAcc({ nick: '', uid: '', alive: false, at: '', failed: true })
                say('登录态在，但昵称没查到 —— 不影响使用', 'warn')
              }
            }
          } catch (e) {
            if (alive) say('读设置失败：' + String((e && e.message) || e), 'warn')
          }
        })()
        return () => { alive = false }
      }, [])

      const patch = async (p, label) => {
        setBusy('patch')
        try {
          const r = await jpost('/config', p)
          if (r && r.config) setCfg(r.config)
          say(label || '已保存', 'good')
        } catch (e) { say('保存失败：' + String((e && e.message) || e), 'warn') }
        finally { setBusy('') }
      }

      const onDoctor = async () => {
        setBusy('doctor')
        try {
          const r = await jpost('/doctor', {})
          setDoctor(r)
          const bad = (r.must_fix || []).length
          say(bad ? ('检查完：' + bad + ' 项要修') : '检查完：环境没问题', bad ? 'warn' : 'good')
        } catch (e) { say('检查失败：' + String((e && e.message) || e), 'warn') }
        finally { setBusy('') }
      }

      const onInstall = async () => {
        setBusy('install')
        try { await jpost('/install', {}); say('开始装依赖，进度看日志', 'good') }
        catch (e) { say('装依赖失败：' + String((e && e.message) || e), 'warn') }
        finally { setBusy('') }
      }

      /** 刷新状态（登录成功 / 装完之后要让按钮和进度条变） */
      const refresh = async () => {
        try {
          const [s, c] = await Promise.all([jget('/status'), jget('/config')])
          if (s) setSt(s)
          if (c && c.config) setCfg(c.config)
          if (s && s.loggedIn) {
            const okAcc = await loadAccount(0)
            if (!okAcc) setAcc({ nick: '', uid: '', alive: false, at: '', failed: true })
          } else setAcc(null)
        } catch { /* 刷不动就留着旧的 */ }
      }

      /**
       * ⭐ 扫码登录 · 第一步：出二维码
       * @param {boolean} force 强制重来（先关掉后台无头浏览器 —— 它占着同一个 Chrome 配置）
       */
      const onQr = async (force) => {
        setBusy('login'); setQrHint(''); setQr(null)
        try {
          const r = await jpost('/login/qr', { force: force ? '1' : '' })
          if (r && r.ok && r.qr_url) {
            setQr({ url: r.qr_url })
            say('二维码出来了 —— 用手机抖音扫一下', 'good')
          } else if (r && r.ok && r.already_logged_in) {
            // ⭐ 浏览器里本来就登录着，不用扫码 —— 直接把凭证导出来了
            setQrHint('')
            say('这个浏览器里本来就登录着，已经直接登录好了', 'good')
            await refresh()
          } else if (r && r.ok && r.no_qr_element) {
            // 没截到二维码图 —— 别放一张首页截图骗人，让用户看那个窗口
            setQrHint(r.hint || '没能自动截到二维码，请直接看那个 Chrome 窗口')
            say('二维码没截到，请看弹出的浏览器窗口', 'warn')
          } else if (r && r.conflict === 'profile_in_use') {
            setQrHint(r.error + ' —— 点「重新出码」，我会先把后台那个关掉再出。')
            say('后台浏览器占着窗口，需要先关掉它', 'warn')
          } else {
            setQrHint((r && (r.error || r.detail)) || '出二维码失败')
            say('出二维码失败', 'warn')
          }
        } catch (e) { setQrHint('出二维码失败：' + String((e && e.message) || e)); say('出二维码失败', 'warn') }
        finally { setBusy('') }
      }

      /** 第二步：我扫完了（轮询到成功；成功后会顺带关掉登录窗口）
       * 🔴 2026-10-24 主人验收「点了没反应」：旧版同步等 120 秒（宿主 spawnSync
       *    被 watch 堵死，面板期间什么都查不动）。改成**小步轮询**：每次只让宿主
       *    check 一次（秒回），前端自己转；不再有「按下去整页僵死」。 */
      const onWaitLogin = async () => {
        setBusy('wait')
        try {
          let done = false
          let usedCheck = true
          for (let i = 0; i < 40 && !done; i++) {   // 40 次 × ~2s ≈ 80 秒
            const r = await jpostSoft('/login/check', {})
            if (r === null) { usedCheck = false; break }   // 宿主太旧没有这条路由 ⇒ 落回 wait
            if (r && r.ok) {
              done = true
              setQr(null)
              say('登录成功 —— 可以刷了', 'good')
              await refresh()
              break
            }
            if (r && r.up === false) {   // 登录浏览器没了：别傻转，直接给提示
              setQrHint(r.hint || '登录用的浏览器还没开 —— 先点「扫码登录」')
              say('没等到，先出二维码', 'warn')
              break
            }
            if (r && r.verify && r.verify.length) {
              setQrHint('卡在验证：' + r.verify.join(' / ') + ' —— 在那个浏览器窗口里做完，不用重扫')
            } else if (i === 3) {
              setQrHint('在等你扫码…（手机抖音 → 扫一扫）')
            }
          }
          if (!done && usedCheck) { say('没等到，再试一次', 'warn'); setQrHint((prev) => prev || '等了一会儿还没扫上 —— 二维码可能过期了，点「重新出码」再来') }
          if (!done && !usedCheck) {   // 旧宿主兜底：一次 wait（还是同步，但只 20 秒）
            try {
              const r = await jpost('/login/wait', { seconds: 20 })
              if (r && r.ok) { setQr(null); say('登录成功 —— 可以刷了', 'good'); await refresh() }
              else { setQrHint((r && (r.hint || r.error)) || '还没好 —— 再点一次「我扫完了」'); say('还没好', 'warn') }
            } catch (e) { setQrHint('等待失败：' + String((e && e.message) || e)) }
          }
        } catch (e) { setQrHint('等待登录失败：' + String((e && e.message) || e)); say('等待失败', 'warn') }
        finally { setBusy('') }
      }

      const onCloseLogin = async () => {
        try { await jpost('/login/close', {}) } catch { /* 关不掉也无所谓 */ }
        setQr(null); setQrHint('登录窗口已关。想继续就再点一次「扫码登录」。')
      }

      const onLogout = async () => {
        setBusy('login')
        try {
          await jpost('/login/clear', {})
          setQr(null)
          say('已退出登录（Cookie 删了）', 'good')
          await refresh()
        } catch (e) { say('退出失败：' + String((e && e.message) || e), 'warn') }
        finally { setBusy('') }
      }

      /**
       * ⭐ 列出会话里的人 —— 让用户点选，不用手填 sec_uid。
       *    （2026-10-22 用户指出：新手不可能知道「稳定 id」是什么，更找不到）
       */
      const loadPeople = async () => {
        setBusy('people'); setPeopleHint('')
        try {
          const r = await jpost('/dm/people', {})
          if (r && r.ok) {
            setPeople(r.people || [])
            setPeopleHint(r.hint || '')
            if (!(r.people || []).length) say('会话列表是空的', 'warn')
            else say(`找到 ${r.people.length} 个人`, 'good')
          } else {
            setPeople([])
            setPeopleHint((r && (r.hint || r.error)) || '读不到会话列表')
            say('读不到会话列表', 'warn')
          }
        } catch (e) { setPeopleHint('读不到会话列表：' + String((e && e.message) || e)); say('读失败', 'warn') }
        finally { setBusy('') }
      }

      /** 0.5.5 私信对象列表：点选 = 追加进 dmPeers（去重），不再覆盖单值 */
      const pickPerson = async (p) => {
        const cur = Array.isArray(cfg.dmPeers) ? cfg.dmPeers : []
        const same = cur.some((x) => (p.sec_uid && x.sec_uid === p.sec_uid) || (!p.sec_uid && x.nick === p.nick))
        if (same) { say(`「${p.nick}」已经在列表里了`, 'warn'); return }
        const next = [...cur, { nick: p.nick, sec_uid: p.sec_uid || '' }]
        await patch({ dmPeers: next }, `已把「${p.nick}」加进私信对象（共 ${next.length} 人）`)
      }

      /* 0.5.7 「听他的话」开关已删（主人定稿：聊天模式开着 = 谁私信都接，列表只管发给谁） */

      /** 0.5.9 「评论区 @ 提醒」多选：开关管总闸，列表管范围；点人 = 加入/移除
       *  会话列表复用私信区读到的 people（读一次，不反复拉）
       *  🔴 移除到「一个不剩」时必须带 __clearKeys —— 否则空数组会被空值守卫保回磁盘旧值（清不掉） */
      const patchAtPeers = async (cur, msg) => {
        await patch(cur.length
          ? { atPeers: cur }
          : { atPeers: [], __clearKeys: ['atPeers'] }, msg)
      }
      const toggleAt = async (p) => {
        const cur = Array.isArray(cfg.atPeers) ? [...cfg.atPeers] : []
        const idx = cur.findIndex((x) => x.nick === p.nick)
        let msg
        if (idx >= 0) { cur.splice(idx, 1); msg = `已把「${p.nick}」移出 @ 名单` }
        else { cur.push({ nick: p.nick }); msg = `@ 名单加了「${p.nick}」（共 ${cur.length} 人）` }
        await patchAtPeers(cur, msg)
      }
      const removeAt = async (idx) => {
        const cur = Array.isArray(cfg.atPeers) ? [...cfg.atPeers] : []
        if (!cur[idx]) return
        const gone = cur.splice(idx, 1)[0]
        await patchAtPeers(cur, `已把「${gone.nick}」移出 @ 名单`)
      }
      const clearAt = async () => {
        // 🔴 数组守卫同款：真清空必须带 __clearKeys 显式口子，否则空数组会被保回磁盘旧值（清不掉）
        await patch({ atPeers: [], __clearKeys: ['atPeers'] }, '@ 名单已清空 —— 开关开着也不会 @ 任何人')
      }

      /** 0.5.5 把某人从列表里移除
       *  🔴 移除到「一个不剩」必须带 __clearKeys（空数组会被守卫保回磁盘旧值） */
      const removePeer = async (idx) => {
        const cur = Array.isArray(cfg.dmPeers) ? [...cfg.dmPeers] : []
        if (!cur[idx]) return
        const gone = cur.splice(idx, 1)[0]
        await patch(cur.length
          ? { dmPeers: cur }
          : { dmPeers: [], __clearKeys: ['dmPeers'] },
          `已把「${gone.nick || gone.sec_uid}」移出私信对象`)
      }

      /** 展开 / 收起「怎么用」（新手流程） */
      const toggleGuide = async () => {
        if (guide !== null) { setGuide(null); return }
        setBusy('guide')
        try {
          const r = await jget('/guide')
          setGuide((r && r.text) || '(说明文件缺失)')
        } catch (e) { say('读说明失败：' + String((e && e.message) || e), 'warn') }
        finally { setBusy('') }
      }

      /* ── 最近一轮发生了什么 ── */
      const loadRunLog = async () => {
        if (runLog !== null) { setRunLog(null); return }
        setBusy('log')
        try {
          const r = await jget('/log')
          setRunLog(r || { tail: '(读不到)' })
        } catch (e) { say('读日志失败：' + String((e && e.message) || e), 'warn') }
        finally { setBusy('') }
      }

      /* ── 消息收件箱 ── */
      const loadInbox = async () => {
        if (inbox !== null) { setInbox(null); return }
        setBusy('inbox')
        try {
          const r = await jget('/inbox')
          if (r && r.ok) {
            setInbox(r)
            const n = (r.at_n || 0) + (r.dm_n || 0)
            say(n ? `有 ${n} 条可能要回` : '没有需要回的消息', n ? 'warn' : 'good')
          } else {
            setInbox({ ok: false, at: [], dm: [], errors: [(r && (r.error || r.hint)) || '读不到'] })
            say('读消息失败', 'warn')
          }
        } catch (e) {
          setInbox({ ok: false, at: [], dm: [], errors: [String((e && e.message) || e)] })
          say('读消息失败', 'warn')
        } finally { setBusy('') }
      }

      /* ── 聊天模式 ── */
      const openChat = async (who) => {
        setBusy('chat')
        try {
          const r = await jpost('/chat/read', { to: who.nick, to_id: who.sec_uid || '' })
          if (r && r.ok) {
            setChat({ who: { nick: r.to || who.nick, sec_uid: r.to_sec_uid || who.sec_uid }, data: r })
            setChatText('')
            say(`打开了和「${r.to || who.nick}」的对话`, 'good')
          } else {
            say('读不到会话：' + ((r && (r.error || r.hint)) || '未知'), 'warn')
          }
        } catch (e) { say('读不到会话：' + String((e && e.message) || e), 'warn') }
        finally { setBusy('') }
      }

      /** ⭐ 聊天界面开着时自动刷新（2026-10-24 会话模式）：30 秒拉一次新消息，
       *  走 HTTP 快路径所以很轻；关掉聊天界面就停。正在输入/发送中不打扰。 */
      React.useEffect(() => {
        if (!chat || !chat.who) return undefined
        const t = setInterval(async () => {
          try {
            if (busy === 'send') return
            const r = await jpost('/chat/read', { to: chat.who.nick, to_id: chat.who.sec_uid || '' })
            if (r && r.ok) setChat((prev) => (prev && prev.who.sec_uid === (r.to_sec_uid || prev.who.sec_uid) ? { ...prev, data: r } : prev))
          } catch { /* 刷不到就等下一拍 */ }
        }, 30_000)
        return () => clearInterval(t)
      }, [chat && chat.who && chat.who.sec_uid, busy === 'send'])

      const sendChat = async () => {
        const text = String(chatText || '').trim()
        if (!text || !chat) return
        setBusy('send')
        try {
          const r = await jpost('/chat/send', { to: chat.who.nick, to_id: chat.who.sec_uid || '', text, confirm: true })
          if (r && r.ok && r.sent) {
            setChatText('')
            say('已发送', 'good')
            // 重新读一遍，让新消息和记忆都刷新
            const again = await jpost('/chat/read', { to: chat.who.nick, to_id: chat.who.sec_uid || '' })
            if (again && again.ok) setChat({ ...chat, data: again })
          } else {
            say('发送失败：' + ((r && (r.error || r.hint)) || '未知'), 'warn')
          }
        } catch (e) { say('发送失败：' + String((e && e.message) || e), 'warn') }
        finally { setBusy('') }
      }

      /** 记忆：看统计 / 清空 */      const loadMem = async () => {
        if (mem !== null) { setMem(null); return }
        setBusy('mem')
        try {
          const r = await jget('/memory')
          setMem((r && r.stats) || { dm: 0, comment: 0, bytes: 0 })
        } catch (e) { say('读记忆失败：' + String((e && e.message) || e), 'warn') }
        finally { setBusy('') }
      }
      const clearMem = async () => {
        setBusy('mem')
        try {
          const r = await jpost('/memory/clear', {})
          setMem((r && r.stats) || { dm: 0, comment: 0, bytes: 0 })
          say('记忆已清空（私信和评论区的记录都删了）', 'good')
        } catch (e) { say('清空失败：' + String((e && e.message) || e), 'warn') }
        finally { setBusy('') }
      }

      /**
       * 读人设。
       * ⭐ 2026-10-26：后端现在会多给三样，面板要靠它们说真话：
       *    effective       = **真正生效的那份内容**（自己写 → 插件自带 → 中性默认）
       *    effective_label = 那一份叫什么（给用户看的来源说明）
       *    default_text    = 中性默认（「填入中性默认」按钮用）
       * 以前只读 text（= 自己那份），没写就空框 ⇒ 用户以为人设丢了。
       */
      const loadPersona = async () => {
        if (persona !== null) { setPersona(null); return }
        setBusy('persona')
        try {
          const r = await jget('/persona')
          setPersona({
            text: String((r && r.text) || ''),
            custom: Boolean(r && r.custom),
            effective: String((r && r.effective) || ''),
            effectiveLabel: String((r && r.effective_label) || ''),
            defaultText: String((r && r.default_text) || ''),
            hint: (r && r.hint) || '',
          })
        } catch (e) { say('读人设失败：' + String((e && e.message) || e), 'warn') }
        finally { setBusy('') }
      }

      /** 存人设（空 = 删掉自己那份，退回默认） */
      const savePersona = async () => {
        if (!persona) return
        setBusy('persona')
        try {
          const r = await jpost('/persona', { text: persona.text })
          if (r && r.ok) {
            say(persona.text.trim() ? '人设已保存（下一轮生效）' : '已清空自定义人设，退回默认', 'good')
            setPersona({ ...persona, custom: Boolean(r.custom) })
          } else say('保存失败：' + ((r && r.error) || '未知'), 'warn')
        } catch (e) { say('保存失败：' + String((e && e.message) || e), 'warn') }
        finally { setBusy('') }
      }

      const onRun = async () => {
        setBusy('run')
        try {
          const r = await jpost('/run', {})
          /**
           * 🔴 2026-10-22 修：以前不管有没有真跑起来都说"已经开跑了"。
           *    现在按返回的 ok 分流，并把**真原因**显示出来
           *    （最常见的是上游模型 429 限流）。
           */
          if (r && r.ok) {
            say(r.message || '已经开跑了，跑完会弹通知', 'good')
          } else {
            const why = (r && (r.error || r.message || r.hint)) || '没跑起来'
            say('没跑起来：' + why, 'warn')
          }
        } catch (e) { say('跑失败：' + String((e && e.message) || e), 'warn') }
        finally { setBusy('') }
      }

      const onShowReport = async () => {
        setBusy('report')
        try {
          const r = await jget('/report')
          setReport(r && r.text ? r.text : '(今天还没有报告)')
        } catch (e) { say('读报告失败：' + String((e && e.message) || e), 'warn') }
        finally { setBusy('') }
      }

      const saveKws = async () => {
        const lines = String(kws || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
        /* 🔴 2026-10-25 晚：后端守卫「空数组不许盖掉非空列表」（keywords 就是这么丢的）。
         *    真想清空 = 把框删空再点保存 ⇒ 带 __clearKeys 显式口子，守卫放行。 */
        await patch(
          lines.length ? { keywords: lines } : { keywords: [], __clearKeys: ['keywords'] },
          lines.length ? '关键词已保存' : '关键词已清空',
        )
      }

      /** 当前编辑中的自定义时段（`null` = 还没动过，跟随 cfg） */
      const winList = wins !== null ? wins : (Array.isArray(cfg && cfg.windows) ? cfg.windows : [])
      const setWinAt = (i, k, v) => {
        const next = winList.map((w, j) => (j === i ? { ...w, [k]: v } : w))
        setWins(next)
      }
      const addWin = () => { setWins([...winList, { start: '09:00', end: '11:00', label: '' }]) }
      const delWin = (i) => { setWins(winList.filter((_, j) => j !== i)) }
      const saveWins = async () => {
        // ⚠️ 只挑合法的时间，别把半截输入存进去（存了也不会跑，只会让人以为配好了）
        const clean = winList
          .map((w) => ({
            start: String((w && w.start) || '').trim(),
            end: String((w && w.end) || '').trim(),
            label: String((w && w.label) || '').trim(),
          }))
          .filter((w) => /^\d{1,2}:\d{2}$/.test(w.start) && /^\d{1,2}:\d{2}$/.test(w.end))
        const dropped = winList.length - clean.length
        /* 🔴 2026-10-25 晚：数组守卫同款 —— 真清空走 __clearKeys 显式口子 */
        await patch(
          clean.length ? { windows: clean } : { windows: [], __clearKeys: ['windows'] },
          dropped
            ? `已保存 ${clean.length} 个时段（${dropped} 个时间格式不对，没存）`
            : (clean.length ? `已保存 ${clean.length} 个时段` : '已清空自定义时段'),
        )
        setWins(null)
      }

      const onCheckUpdate = async (force) => {
        setBusy('update')
        try {
          const r = await jget('/update' + (force ? '?force=1' : ''))
          setUpd(r)
          if (!r.checked) say('查不到最新版本（没发布或没网）', 'warn')
          else if (r.hasUpdate) say(`有新版本 v${r.latest}（当前 v${r.current}）`, 'warn')
          else say('已经是最新版 v' + r.current, 'good')
        } catch (e) { say('检查更新失败：' + String((e && e.message) || e), 'warn') }
        finally { setBusy('') }
      }

      /* ⭐ 0.5.5 自动检查更新（主人 2026-10-26：「自动检查更新放最上面」）：
       *    面板打开 3 秒后静默查一次（force=1 不吃缓存），有新版本就弹在顶部卡里，
       *    不打扰、不自动装（「检查更新只查不装」是 selfcheck 的红线）。 */
      React.useEffect(() => {
        let alive = true
        const t = setTimeout(async () => {
          try {
            const r = await jget('/update?force=1')
            if (alive) setUpd(r)
          } catch { /* 静默：查不到不打扰 */ }
        }, 3000)
        return () => { alive = false; clearTimeout(t) }
      }, [])

      const loadAi = async () => {
        setBusy('ai')
        try {
          const r = await jget('/ai-usage')
          setAi(r)
          if (!(r.mcp && r.mcp.exists)) say('MCP server 文件缺失，插件包可能不完整', 'warn')
        } catch (e) { say('读使用说明失败：' + String((e && e.message) || e), 'warn') }
        finally { setBusy('') }
      }

      const copy = async (text, what) => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text)
          else {
            const ta = document.createElement('textarea')
            ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
            document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove()
          }
          setCopied(what)
          say('已复制' + what, 'good')
          setTimeout(() => setCopied(''), 2000)
        } catch (e) { say('复制失败，手动选中吧', 'warn') }
      }

      if (!st || !cfg) {
        return h('div', { 'data-dy-page': '' },
          h('div', { 'data-dy-card': '' },
            h('div', { 'data-dy-sub': '' }, '读设置中…')))
      }

      const kwText = kws !== null ? kws : (Array.isArray(cfg.keywords) ? cfg.keywords.join('\n') : '')

      /* ⭐ 0.5.5 私信对象列表的小工具（面板侧只读展示用）；0.5.9 @ 多选列表 */
      const dmPeers = Array.isArray(cfg.dmPeers) ? cfg.dmPeers.filter((p) => p && (p.nick || p.sec_uid)) : []
      const atPeers = Array.isArray(cfg.atPeers) ? cfg.atPeers.filter((p) => p && String(p.nick || '').trim()) : []

      /* ════════════════════════════════════════════════════════════════════════
       * 面板结构（2026-10-25 重排：20+ 张卡 → 3 组 / 7 张卡）
       *   组 ①「常开必看」永远展开 —— 卡①开始使用 / 卡②刷抖音 / 卡③自动发送
       *   组 ②「出问题才看」默认收起 —— 卡④出问题了？（体检 / dsh 入口 / 报告 / MCP / 关于）
       *   组 ③「一次配好」默认收起 —— 卡⑤刷抖音的策略 / 卡⑥桌宠 / 卡⑦消息与记忆
       *   组标题用 data-dy-group（**不是** data-dy-card），所以卡片计数正好 7。
       *   折叠状态 = Panel 顶部那两个 useState（foldErr / foldCfg）。
       *   ⚠️ 这里的 h(...) 里**不许加 hook** —— 条件分支里加 hook 会让整页白屏。
       * ════════════════════════════════════════════════════════════════════════ */
      return h('div', { 'data-dy-page': '' },

        /* ══════ 组 ①「常开必看」—— **永远展开**（新手上手先看这三张，不折叠）══════ */
        h('div', { 'data-dy-group': '' },
          h('span', { 'data-dy-groupname': '' }, '常开必看'),
          h('span', { 'data-dy-grouphint': '' }, '装好之后天天要用的三张')),

        /* ── 卡 ⓪ 检查更新（0.5.5 主人令：放最上面）──
         *    面板打开 3 秒自动查一次；有新版就黄条提醒 + 给升级命令，没有就轻描淡写一行。 */
        (upd && upd.checked && upd.hasUpdate)
          ? h('div', { 'data-dy-card': '', 'data-dy-highlight': '' },
            h('div', { 'data-dy-row': '' },
              h('div', { 'data-dy-grow': '' },
                h('div', { 'data-dy-title': '' }, `🆙 有新版本 v${upd.latest}（当前 v${upd.current}）`),
                h('div', { 'data-dy-sub': '' }, (upd.source ? '来源：' + upd.source + '。' : '')
                  + (upd.how || '用命令行升级，装完重启 dsh 生效。'))),
              h('button', { 'data-dy-mini': '', disabled: busy === 'update', onClick: () => onCheckUpdate(true) }, '再查一次')))
          : null,

        /* ── 卡 ① 开始使用 ── */
  /* ── 开始使用：三步装机 + 扫码登录（⭐ 2026-10-24 主人令：放最上面，
           *    已登录时这里带「退出登录」按钮；第二个才是「刷抖音」状态卡）──
           * 🔴 2026-10-22：以前这里只写一句「命令行跑 node tools/qr-login.mjs start」——
           *    对新手等于"你自己去折腾"。现在做成**点按钮 → 出二维码 → 手机扫 → 点我扫完了**。
           *    进度条按状态自己算：没环境 → 没登录 → 能用了。 */
          h('div', { 'data-dy-card': '' },
            h('div', { 'data-dy-row': '' },
              h('div', { 'data-dy-grow': '' },
                h('div', { 'data-dy-title': '' }, '开始使用'),
                h('div', { 'data-dy-sub': '' },
                  st.venvReady && st.loggedIn
                    ? '✅ 都装好了，可以直接用'
                    : `还差 ${!st.venvReady ? '两步' : '一步'} —— 跟着数字点就行`)),
              h('span', {
                'data-dy-badge': '',
                'data-on': (st.venvReady && st.loggedIn) ? '' : undefined,
              }, (st.venvReady && st.loggedIn) ? '就绪' : '未就绪')),

            /* 第 ① 步 */
            h('div', { 'data-dy-row': '' },
              h('span', { 'data-dy-step': '', 'data-done': st.venvReady ? '' : undefined }, st.venvReady ? '✓' : '1'),
              h('div', { 'data-dy-grow': '' },
                h('div', { 'data-dy-sub': '' }, st.venvReady ? '运行环境好了' : '装运行环境（约 30 秒，一次就够）')),
              st.venvReady
                ? null
                : h('button', { 'data-dy-btn': '', 'data-primary': '', disabled: busy === 'install', onClick: onInstall },
                  busy === 'install' ? '装着…' : '装环境')),

            /* 第 ② 步 —— 扫码登录（新手最容易卡的地方，做成主按钮） */
            h('div', { 'data-dy-row': '' },
              h('span', { 'data-dy-step': '', 'data-done': st.loggedIn ? '' : undefined }, st.loggedIn ? '✓' : '2'),
              h('div', { 'data-dy-grow': '' },
                h('div', { 'data-dy-sub': '' }, st.loggedIn ? '已登录，可以刷了' : '扫码登录抖音（用手机抖音扫一下）')),
              st.loggedIn
                ? h('button', { 'data-dy-btn': '', disabled: busy === 'login', onClick: onLogout }, '退出登录')
                : h('button', { 'data-dy-btn': '', 'data-primary': '', disabled: busy === 'login', onClick: onQr },
                  busy === 'login' ? '准备中…' : '扫码登录')),

            /* 二维码区：只在没登录时出现 */
            !st.loggedIn
              ? h('div', { 'data-dy-loginbox': '' },
                qr && qr.url
                  ? h('div', { 'data-dy-row': '', style: { flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '6px 0' } },
                    h('img', {
                      'data-dy-qr': '', src: qr.url, alt: '抖音登录二维码',
                      style: { width: '190px', height: '190px', borderRadius: '10px', background: '#fff', padding: '6px' },
                    }),
                    h('div', { 'data-dy-sub': '', style: { textAlign: 'center' } },
                      '手机抖音 → 右上角「≡」→ 扫一扫'),
                    h('div', { 'data-dy-row': '' },
                      h('button', { 'data-dy-btn': '', 'data-primary': '', disabled: busy === 'wait', onClick: onWaitLogin },
                        busy === 'wait' ? '等你扫…' : '我扫完了'),
                      h('button', { 'data-dy-btn': '', disabled: Boolean(busy), onClick: () => onQr(true) }, '重新出码'),
                      h('button', { 'data-dy-btn': '', disabled: Boolean(busy), onClick: onCloseLogin }, '关掉窗口')),
                    h('div', { 'data-dy-sub': '', style: { textAlign: 'center', maxWidth: '420px' } },
                      '扫完如果抖音还弹「短信验证码」或「拖动滑块」—— 在那个弹出的浏览器窗口里做完，再点「我扫完了」。不用重新扫。'))
                  : h('div', { 'data-dy-sub': '' },
                    qrHint || '点上面的「扫码登录」，会弹出一个浏览器窗口显示二维码，手机扫一下就行。'))
              : null),

        /* ── 卡 ② 刷抖音（状态 / 现在跑一轮 / 看日志 / 怎么用 / 已登录账号）── */
  /* ── 状态 ── */
          h('div', { 'data-dy-card': '' },
            h('div', { 'data-dy-row': '' },
              h('div', { 'data-dy-grow': '' },
                h('div', { 'data-dy-title': '' }, '刷抖音'),
                h('div', { 'data-dy-sub': '' },
                  '峰谷时段自动刷一轮，把值得看的挑出来写成日报。不催你、不刷屏。')),
              h('button', { 'data-dy-mini': '', disabled: busy === 'guide', onClick: toggleGuide },
                guide === null ? '怎么用？' : '收起说明'),
              /* ⭐ 面板构建号 —— 改完面板对一下这个数，就知道浏览器有没有拿到新代码。
               *    括号里是**宿主**那边的构建号（宿主读磁盘上的 client.js）：
               *    两者不一致 = 浏览器还在跑旧 bundle（刷新页面 / 重启 dsh）。 */
              h('span', {
                'data-dy-badge': '', title: '面板构建版本（改完面板对一下这个数）',
                style: { fontVariantNumeric: 'tabular-nums' },
              }, 'v' + (st.version || '?') + '·b' + PANEL_BUILD
                + (st.panelBuild && st.panelBuild !== PANEL_BUILD
                  ? `（宿主 b${st.panelBuild} ≠ 浏览器 b${PANEL_BUILD} ⇒ 刷新页面）` : ''))),
            h('div', { 'data-dy-row': '' },
              h('span', {
                'data-dy-badge': '',
                'data-on': st.loggedIn ? '' : undefined,
                'data-off': st.loggedIn ? undefined : '',
              }, st.loggedIn ? '已登录' : '未登录'),
              /* ⭐ 登录的是哪个号 —— 只显示昵称就够（ID 太长，对用户没用） */
              st.loggedIn && acc && acc.nick
                ? h('span', { 'data-dy-account': '' }, '👤 ' + acc.nick)
                : (st.loggedIn
                  ? h('span', { 'data-dy-sub': '' }, acc && acc.failed ? '（昵称没查到，不影响用）' : '正在查登录的号…')
                  : null),
              h('span', {
                'data-dy-badge': '',
                'data-on': st.venvReady ? '' : undefined,
                'data-off': st.venvReady ? undefined : '',
              }, st.venvReady ? '环境就绪' : '环境未装'),
              h('span', { 'data-dy-badge': '' },
                '今天 ' + (st.pickedToday != null ? st.pickedToday : 0) + ' / ' + (cfg.perDay != null ? cfg.perDay : 0)),
              h('div', { 'data-dy-grow': '' }),
              h('button', {
                'data-dy-btn': '', 'data-primary': '',
                disabled: busy === 'run', onClick: onRun,
              }, busy === 'run' ? '跑着呢…' : '现在跑一轮')),
            msg ? h('div', {
              'data-dy-msg': '',
              'data-good': msgTone === 'good' ? '' : undefined,
              'data-warn': msgTone === 'warn' ? '' : undefined,
            }, msg) : null,
            /* ⭐ 「看日志」—— 点一轮没反应时，让用户能自己看清发生了什么 */
            h('div', { 'data-dy-row': '' },
              h('button', { 'data-dy-mini': '', disabled: busy === 'log', onClick: loadRunLog },
                runLog === null ? '看日志（跑一轮没反应就点这）' : '收起日志')),
            runLog !== null
              ? h('div', { 'data-dy-inner': '', style: { background: 'transparent', border: 'none', padding: 0, gap: '6px' } },
                h('div', { 'data-dy-kv': '' },
                  `上次跑：${runLog.lastRunAt ? new Date(runLog.lastRunAt).toLocaleString('zh-CN') : '从没跑过'}`
                  + `　今天已挑 ${runLog.pickedToday || 0} / ${runLog.perDay || 0}`),
                runLog.canRun === false
                  ? h('div', { 'data-dy-msg': '', 'data-warn': '' },
                    runLog.roundActive ? '⚠️ 上一轮还在跑 —— 等它结束再点'
                      : (runLog.pickedToday >= runLog.perDay ? '⚠️ 今天的配额用完了（改「每天挑几条」或等明天）' : '现在不能跑'))
                  : null,
                h('pre', { 'data-dy-pre': '', style: { maxHeight: '300px' } }, runLog.tail || '(日志是空的)'))
              : null,
            guide !== null
              ? h('pre', { 'data-dy-pre': '', style: { maxHeight: '380px' } }, guide)
              : null),

        /* ── 卡 ③ 自动发送（含「私信发给谁」·评论区 @ 你 · 聊天模式）────────────────────────
         *    私信对象紧跟在自动发送开关下面（0.5.5 主人令）—— 它们本来就是一件事：发给谁、发什么、发不发。
         *    2026-10-25 重排：20+ 张卡压成 7 张，功能一个不删，只合并。 */
        h('div', { 'data-dy-card': '', 'data-dy-highlight': cfg.autoSend ? '' : undefined },
          /* 合并卡的总标题：说清这张里装了什么（不然只见「自动发送」，找不到私信对象） */
          h('div', { 'data-dy-title': '' }, '自动发送（发给谁 · 评论区 @ 你 · 聊天模式）'),
          /* ── 自动发送开关（放在**最上面**，别埋在长面板底部） ── */
          h('div', { 'data-dy-subblock': '', 'data-dy-highlight': cfg.autoSend ? '' : undefined },
            h('div', { 'data-dy-row': '' },
              h('div', { 'data-dy-grow': '' },
                h('div', { 'data-dy-title': '' }, '自动发送'),
                h('div', { 'data-dy-sub': '' },
                  (cfg.autoSend
                    ? '✅ 开着（默认）：插件自己跑一轮时，会把值得的视频发给你'
                      + (cfg.autoComment ? '，也会发评论' : '') + '。'
                    : '关着：插件自己跑一轮只写报告 + 弹通知，不往抖音发任何东西。'))),
              h(Switch, {
                on: Boolean(cfg.autoSend),
                onChange: (v) => patch({ autoSend: v }, v
                  ? '✅ 已打开自动发送'
                  : '已关闭自动发送 —— 后台跑一轮只写报告'),
              })),
            h('div', { 'data-dy-row': '' },
              h('span', { 'data-dy-badge': '', 'data-on': cfg.autoSend ? '' : undefined, 'data-off': cfg.autoSend ? undefined : '' },
                cfg.autoSend ? '会自动发' : '只写报告'),
              h('span', { 'data-dy-sub': '' },
                '发给：' + (dmPeers.length
                  ? dmPeers.map((p) => p.nick || (p.sec_uid || '').slice(0, 8) + '…').join('、')
                  : (cfg.dmTo || '（还没选私信对象，去下面「私信发给谁」选）')))),
            h('div', { 'data-dy-sub': '' },
              '⚠️ 只管「插件自己在后台跑的轮次」。你当场在对话里让它发，不受这个开关影响。'),
  /* ── 私信发给谁（0.5.5：放自动发送正下方 —— 主人 2026-10-26 令；多人列表 + 每人「听他的话」开关） ── */
          h('div', { 'data-dy-subblock': '', style: { marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08))' } },
            h('div', { 'data-dy-row': '' },
              h('div', { 'data-dy-grow': '' },
                h('div', { 'data-dy-title': '' }, '私信发给谁'),
                h('div', { 'data-dy-sub': '' },
                  dmPeers.length
                    ? `已选 ${dmPeers.length} 人：${dmPeers.map((p) => p.nick || (p.sec_uid || '').slice(0, 8) + '…').join('、')}。日报和分享卡片发给每一个人。`
                    : '想让插件把好玩的发给你，先在这里选一个人（可以多选）。不选也行 —— 那就只写日报，不发私信。')),
              h('button', {
                'data-dy-btn': '', disabled: busy === 'people' || !st.loggedIn, onClick: loadPeople,
              }, busy === 'people' ? '读取中…' : (people === null ? '从我的会话里选' : '重新读取'))),

            !st.loggedIn
              ? h('div', { 'data-dy-sub': '' }, '（要先在上面扫码登录，才能读到你的人）')
              : null,

            /* ⭐ 0.5.5 已选列表：每人一行 —— 昵称 + 「听他的话」开关 + 移除 */
            dmPeers.length
              ? h('div', { 'data-dy-people': '' },
                dmPeers.map((p, i) => h('div', {
                  key: 'peer' + i,
                  'data-dy-person': '',
                  'data-picked': p.sec_uid ? '' : undefined,
                },
                  h('span', { 'data-dy-person-name': '' }, p.nick || (p.sec_uid || '').slice(0, 10) + '…'),
                  p.sec_uid
                    ? null
                    : h('span', { 'data-dy-tag': '', title: '群里可能发不出消息：在我这个号上试的，网页端发的别人收不到，手机端正常。别的号不一定这样。' }, '群聊 · 可能发不出'),
                  h('span', { 'data-dy-grow': '' }),
                  h('button', {
                    'data-dy-mini': '', disabled: Boolean(busy),
                    onClick: () => removePeer(i),
                  }, '移除'))))
              : null,

            /* 🔴 群聊限制写在明面上（不是 hover 小字）—— 主人 2026-10-26 令：
             *    「不在选项上说清吗」—— 选了群的人一眼就能看到这条限制。
             *    ⚠️ 措辞留余地：只在鱼号上试过，别把一次观察说成铁律（主人 2026-10-26 令）。 */
            dmPeers.some((p) => !p.sec_uid)
              ? h('div', { 'data-dy-msg': '', 'data-warn': '' },
                '⚠️ **群里可能发不出消息**：在我这个号上试的，网页端发的群里人收不到，手机端正常。'
                + '别的号不一定这样。看群消息没问题，要说话请用手机端。')
              : null,

            people && people.length
              ? h('div', { 'data-dy-people': '' },
                people.map((p, i) => {
                  const added = dmPeers.some((x) => (p.sec_uid && x.sec_uid === p.sec_uid) || (!p.sec_uid && x.nick === p.nick))
                  return h('button', {
                    key: 'p' + i,
                    'data-dy-person': '',
                    'data-picked': added ? '' : undefined,
                    disabled: Boolean(busy) || added,
                    onClick: () => pickPerson(p),
                  },
                    h('span', { 'data-dy-person-name': '' }, p.nick),
                    p.is_group
                      ? h('span', {
                        'data-dy-tag': '',
                        title: '群里可能发不出消息：在我这个号上试的，网页端发的别人收不到，手机端正常。别的号不一定这样。',
                      }, '群聊 · 可能发不出')
                      : null,
                    p.duplicate && !p.is_group ? h('span', { 'data-dy-tag': '' }, '重名') : null,
                    added ? h('span', { 'data-dy-tag': '', 'data-ok': '' }, '✓ 已在列表') : null,
                    p.preview ? h('span', { 'data-dy-person-sub': '' }, p.preview) : null)
                }))
              : null,

            people && !people.length
              ? h('div', { 'data-dy-msg': '', 'data-warn': '' }, peopleHint || '会话列表是空的')
              : null,
            peopleHint && people && people.length
              ? h('div', { 'data-dy-sub': '' }, peopleHint)
              : null,

            /* ⭐ 手动补一个会话列表里没有的人（留活路，但不再是主路径） */
            h('div', { 'data-dy-row': '' },
              h('button', {
                'data-dy-mini': '',
                onClick: () => setManualDm(manualDm === null ? { nick: '', id: '' } : null),
              }, manualDm === null ? '手动加一个（会话列表里没有的人）' : '收起')),
            manualDm !== null
              ? h('div', { 'data-dy-inner': '', style: { background: 'transparent', border: 'none', padding: 0, gap: '8px' } },
                h('div', { 'data-dy-sub': '' }, '昵称（显示用）'),
                h('input', {
                  'data-dy-input': '', value: manualDm.nick, placeholder: '比如：示例好友',
                  onChange: (e) => setManualDm({ ...manualDm, nick: e.target.value }),
                }),
                h('div', { 'data-dy-sub': '' }, '稳定 ID（sec_uid，从「从我的会话里选」拿最方便；没有它没法精确认人）'),
                h('input', {
                  'data-dy-input': '', value: manualDm.id, placeholder: 'MS4wLjABAAAA…',
                  onChange: (e) => setManualDm({ ...manualDm, id: e.target.value }),
                }),
                h('div', { 'data-dy-row': '' },
                  h('button', {
                    'data-dy-btn': '', 'data-primary': '', disabled: Boolean(busy) || !(manualDm.nick.trim() || manualDm.id.trim()),
                    onClick: async () => {
                      const cur = Array.isArray(cfg.dmPeers) ? cfg.dmPeers : []
                      const next = [...cur, { nick: manualDm.nick.trim(), sec_uid: manualDm.id.trim() }]
                      await patch({ dmPeers: next }, `已把「${manualDm.nick.trim() || manualDm.id.trim()}」加进私信对象`)
                      setManualDm(null)
                    },
                  }, '加进列表')))
              : null),


            /* ⭐⭐ 评论区 @ 提醒（0.5.9 主人定稿）—— 开关 = 总闸，选人 = 范围（可多个）：
             *    开关开着 + 名单有人 = 会 @；开关关 = 选了人也不 @；开着没选 = 待命（值班跳过）。
             *    会话列表只读一次（复用私信区的 people），不反复拉。 */
            h('div', { 'data-dy-row': '', style: { marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08))' } },
              h('div', { 'data-dy-grow': '' },
                h('div', { 'data-dy-title': '' }, '评论区 @ 提醒'),
                h('div', { 'data-dy-sub': '' },
                  !cfg.autoSend
                    ? '先打开上面的「自动发送」，这个才有用。'
                    : !cfg.commentAtMe
                      ? '总闸关着 —— 选了人也不 @。'
                      : atPeers.length
                        ? `开：挑到最值得的那条时，在评论区 @ ${atPeers.map((p) => p.nick).join('、')}（他刷抖音就能收到通知）。`
                        : '开着但还没选人 —— 待命中，选了人就开始 @。')),
              h(Switch, {
                on: Boolean(cfg.commentAtMe),
                disabled: !cfg.autoSend || busy === 'patch',
                onChange: (v) => {
                  // 🔴 0.5.9d：这里以前调 setShowAtPicker（那版 state 已删）⇒ 运行时
                  //    ReferenceError ⇒ onChange 整个崩 ⇒ patch 从没执行 ⇒ 主人点开关「没反应」。
                  //    教训：删 state 时要连引用一起删光；这类崩 node --check 查不出来。
                  if (!atPeers.length && v && !people) loadPeople()
                  patch({ commentAtMe: v }, v ? '✅ 评论区 @ 提醒：开（选了人就开始 @）' : '已关闭 —— 选了人也不 @')
                },
              })),
            cfg.autoSend && cfg.commentAtMe
              ? h('div', { 'data-dy-sub': '' },
                atPeers.length
                  ? `要 @ 的人（${atPeers.length}）：${atPeers.map((p) => p.nick).join('、')}`
                  : '要 @ 的人：（还没选 —— 点下面列表里的人）')
              : null,
            cfg.autoSend && cfg.commentAtMe && !people
              ? h('div', { 'data-dy-row': '' },
                h('button', {
                  'data-dy-mini': '', disabled: busy === 'people' || !st.loggedIn, onClick: loadPeople,
                }, busy === 'people' ? '读取会话列表中…' : '读一次会话列表（两个选人区共用，不反复拉）'))
              : null,
            cfg.autoSend && cfg.commentAtMe
              ? h('div', { 'data-dy-people': '' },
                people && people.length
                  ? people.map((p, i) => {
                    const added = atPeers.some((x) => x.nick === p.nick)
                    return h('button', {
                      key: 'at' + i,
                      'data-dy-person': '',
                      'data-picked': added ? '' : undefined,
                      disabled: Boolean(busy) || p.is_group,
                      onClick: () => toggleAt(p),
                    },
                      h('span', { 'data-dy-person-name': '' }, p.nick),
                      p.is_group ? h('span', { 'data-dy-tag': '' }, '群不能 @') : null,
                      added ? h('span', { 'data-dy-tag': '', 'data-ok': '' }, '✓ 要 @') : null)
                  })
                  : h('div', { 'data-dy-sub': '' }, busy === 'people' ? '读取中…' : '会话列表还没读'))
              : null,
            atPeers.length
              ? h('div', { 'data-dy-row': '' },
                atPeers.map((p, i) => h('span', {
                  key: 'atp' + i, 'data-dy-tag': '', 'data-ok': '', style: { marginRight: '6px' },
                },
                  p.nick + ' ',
                  h('button', {
                    'data-dy-mini': '', disabled: Boolean(busy), style: { marginLeft: '2px' },
                    onClick: () => removeAt(i),
                  }, '×'))),
                h('span', { 'data-dy-grow': '' }),
                h('button', { 'data-dy-mini': '', disabled: Boolean(busy), onClick: clearAt }, '全清（不 @ 了）'))
              : null,
            cfg.commentAtMe && cfg.autoSend
              ? h('div', { 'data-dy-sub': '', style: { marginTop: '4px', opacity: '.78' } },
                '💡 真 @ 需要起无头 Chrome 走「点选弹层」流程（约 20-40 秒）；@ 的昵称必须能在弹层里搜到（一般是关注/互关的人）。')
              : null,

            /* ⭐⭐ 聊天模式（2026-10-24）：使用者实测的「会话模式」进插件。
             *   每 N 秒静默读一次私信对象的会话（HTTP 快路径，不起浏览器），
             *   他来新消息就弹 Windows 通知。回话还是你来（或叫值班轮）。 */
            h('div', { 'data-dy-row': '', style: { marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08))' } },
              h('div', { 'data-dy-grow': '' },
                h('div', { 'data-dy-title': '' }, '聊天模式'),
                /* 🔴🔴 2026-10-25 主人：「聊天模式怎么打开了，关闭不了」
                 *
                 * 真因不是开关坏了：`dmToId` 被一次配置事故清空，而这里
                 *   `disabled: !cfg.dmToId`
                 * 让开关**永久变灰**——点它没反应。更糟的是右边那段说明文字
                 * 还写着"✅ 开着"，主人看到的就是"显示开着、关不掉"。
                 *
                 * ✅ 规矩（这条比修 bug 本身重要）：
                 *    **任何 disabled 都必须当场说清为什么**，不许只变灰。
                 *    变灰而不解释 = 让主人猜 = 他会以为软件坏了。
                 *    所以这里分成三档文案：
                 *      ① 没选私信对象 ⇒ 明说"开关是灰的，点不了不是坏了，先选人"
                 *      ② 正在保存     ⇒ 明说"保存中"
                 *      ③ 正常         ⇒ 说功能状态
                 */
                h('div', { 'data-dy-sub': '' },
                  !dmPeers.length
                    ? '⚠️ 还没选私信对象 —— 去下面「私信发给谁」点选一个人，小鱼才知道有消息时状态屏该显示谁。'
                    : busy === 'patch'
                      ? '保存中…'
                      : (cfg.chatWatch
                        ? `✅ 开着：每 ${Math.max(10, Math.min(Number(cfg.chatWatchSec || 30), 300))} 秒看一眼私信，**谁来的都看**（${dmPeers.map((p) => p.nick || (p.sec_uid || '').slice(0, 8) + '…').join('、')}）；有新消息就转给值班的小鱼接。不弹桌面通知，不起浏览器，很轻。`
                        : '关着（默认是开的）。关了之后来消息就没人接话——小鱼睡缸底。想恢复再打开。'))),
              h(Switch, {
                on: Boolean(cfg.chatWatch),
                disabled: busy === 'patch',
                /* 变灰时点它也给一句话——比"毫无反应"好，主人至少知道点到了 */
                onChange: (v) => {
                  patch({ chatWatch: v }, v
                    ? (dmPeers.length ? '✅ 已打开聊天模式（谁私信都接）' : '聊天模式开了 —— 建议先去「私信发给谁」点选对象，状态屏才好显示')
                    : '已关闭聊天模式')
                },
              })),
            busy === 'patch'
              ? h('div', { 'data-dy-sub': '' }, '保存中…')
              : null,
            !dmPeers.length
              ? h('div', { 'data-dy-sub': '' }, '（还没选私信对象 —— 在下面「私信发给谁」里点选）')
              : null,
            cfg.chatWatch
              ? h('div', { 'data-dy-row': '' },
                h('span', { 'data-dy-sub': '' }, '看消息的间隔（秒，10–300）'),
                h('input', {
                  'data-dy-input': '', style: { width: '90px' }, type: 'number', min: 10, max: 300,
                  value: cwSecDraft !== null ? cwSecDraft : String(cfg.chatWatchSec || 30),
                  onChange: (e) => setCwSecDraft(e.target.value),
                }),
                h('button', {
                  'data-dy-mini': '', disabled: Boolean(busy) || cwSecDraft === null,
                  onClick: async () => {
                    const n = Math.max(10, Math.min(Number(cwSecDraft) || 30, 300))
                    await patch({ chatWatchSec: n }, `聊天模式间隔已存：${n} 秒`)
                    setCwSecDraft(null)
                  },
                }, '保存'))
              : null,
            /* ⭐ 私信投给谁（2026-10-25 深夜「探明呗」后新增）：
             *    lead = 前台会话（排队等当前轮跑完，私聊夹在工作流里）
             *    duty = 常驻值班鱼 dm-duty-fish（独立会话秒醒，私聊不占前台）
             *    值班鱼不在时后端自动退回前台，状态屏会写明。 */
            cfg.chatWatch
              ? h('div', { 'data-dy-row': '' },
                h('span', { 'data-dy-sub': '' }, '消息投给'),
                h('div', { 'data-dy-seg': '', role: 'group' },
                  [['lead', '前台会话'], ['duty', '值班小鱼']].map(([v, label]) =>
                    h('button', {
                      key: 'cwt-' + v,
                      'data-dy-segbtn': '', 'data-on': (cfg.chatWatchTarget || 'lead') === v ? '' : undefined,
                      disabled: busy === 'patch',
                      onClick: () => patch({ chatWatchTarget: v },
                        v === 'duty'
                          ? '以后私信投给值班小鱼（独立会话，前台不受打扰；她不在会自动退回前台）'
                          : '以后私信投进前台会话（跟工作对话排一个队）'),
                    }, label))))
              : null,
            /* ⭐ 实时状态屏（2026-10-24 使用者要求：「我哪知道它有什么用、错在哪了」）：
             *    开着聊天模式时每 15 秒拉一次后端状态，显示几秒前看过、结果、通知弹没弹。 */
            cfg.chatWatch ? h(ChatWatchStatus, { key: 'cw-status' }) : null,
            /* ⭐⭐ 2026-10-26 凌晨（主人：「如果是普通用户，他该怎么办，没那么聪明啊」）
             *   一句话说明 + 一个按钮：不懂的人只会点这个。
             *   按钮背后是 /chat/fix —— 后端自动判断、能修的自己修，修不了的用
             *   「还差一步：……」告诉他去点哪儿。绝不让用户读日志。 */
            h('div', { 'data-dy-row': '', style: { marginTop: '8px', alignItems: 'center' } },
              h('button', {
                'data-dy-btn': '',
                disabled: busy === 'chatfix',
                onClick: async () => {
                  setBusy('chatfix')
                  try {
                    const r = await jpost('/chat/fix', {})
                    setChatFix(r)
                    say(r.ok ? '好了，现在能收发了' : (r.need_user ? `还差一步：${r.need_user.what}` : '还有问题，看下面的说明'), r.ok ? 'good' : 'warn')
                  } catch (e) { say('自检失败：' + String((e && e.message) || e), 'warn') }
                  finally { setBusy('') }
                },
              }, busy === 'chatfix' ? '检查中…' : '🔧 一键修好（不聊天时点这个）'),
              h('span', { 'data-dy-sub': '' }, '收到消息不回？先点这个，它自己会修。')),
            chatFix
              ? h('div', { 'data-dy-sub': '', style: { color: chatFix.ok ? '#22c55e' : '#f59e0b' } },
                `${chatFix.ok ? '✅' : '👉'} ${chatFix.human || ''}`
                  + (chatFix.need_user && chatFix.need_user.how ? `\n${chatFix.need_user.how}` : ''))
              : null),
        ),

        /* ══════ 组「出问题才看」—— **默认收起**（foldErr 初始 false），点标题行展开 ══════
         * 🔴 折叠状态是 Panel 顶部那两个 useState；这里只读、只 set，**绝不在条件分支里加 hook**。 */
        h('div', { 'data-dy-group': '' },
          h('button', {
            'data-dy-groupbtn': '', 'data-open': foldErr ? '' : undefined,
            'aria-expanded': foldErr ? 'true' : 'false',
            onClick: () => setFoldErr((v) => !v),
          },
            h('span', { 'data-dy-groupname': '' }, '出问题才看'),
            h('span', { 'data-dy-groupchev': '' }, foldErr ? '收起 ▲' : '展开看 ▼'))),

        /* ── 卡 ④ 出问题了？（体检 + dsh 入口 + 看报告 + 给别的 AI 用 + 关于）──
         *    都是「平时不看、出问题才翻」的东西，收进一张卡，默认折叠。 */
        foldErr
          ? h('div', { 'data-dy-card': '' },
      /* ── 环境体检 ── */
              h('div', { 'data-dy-subblock': '' },
                h('div', { 'data-dy-row': '' },
                  h('div', { 'data-dy-grow': '' },
                    h('div', { 'data-dy-title': '' }, '出问题了？'),
                    h('div', { 'data-dy-sub': '' }, '点一下，9 项环境逐个查，哪项红了直接告诉你怎么办')),
                  h('button', { 'data-dy-btn': '', disabled: busy === 'doctor', onClick: onDoctor },
                    busy === 'doctor' ? '查着…' : '检查环境')),
                doctor
                  ? h('div', { 'data-dy-kv': '' },
                    (doctor.items || []).map((it, i) => h('div', { key: 'd' + i },
                      (it.state === 'ok' ? '✅ ' : it.state === 'warn' ? '⚠️ ' : '❌ ')
                      + it.item + '：' + it.detail)))
                  : null,
                h('div', { 'data-dy-row': '' },
                  h('button', { 'data-dy-mini': '', disabled: busy === 'report', onClick: onShowReport }, '看今天的报告')),

                /**
                 * ⭐⭐ 2026-10-23 加：**dsh 入口路径**（起因：使用者反馈「总是显示找不到 dsh」）
                 * 🔴 桌面版不是 npm 全局装的，插件以前只能猜路径；猜不到就报"找不到 dsh"，
                 *    而面板上**根本没有地方填** —— 使用者彻底卡死。
                 *    现在：自动探测（多半能中）+ 这里可手填兜底 + 「自动找」清空回到探测。
                 */
                h('div', { 'data-dy-row': '', style: { marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08))' } },
                  h('div', { 'data-dy-grow': '' },
                    h('div', { 'data-dy-title': '' }, 'dsh 入口（后台跑一轮要用）'),
                    h('div', { 'data-dy-sub': '' },
                      cfg.dshBin
                        ? '已手填路径。点「自动找」清空，回到自动探测。'
                        : '留空 = 自动找（桌面版会去 app.asar 里找，一般能中）。只有报「找不到 dsh」时才需要填。'))),
                h('div', { 'data-dy-row': '' },
                  h('input', {
                    'data-dy-input': '', style: { flex: '1' },
                    placeholder: '…\\resources\\app.asar\\dsh\\node_modules\\@deepseek-ai\\dsh-desktop-host\\lib\\cli.js',
                    value: dshBinDraft !== null ? dshBinDraft : String(cfg.dshBin || ''),
                    onChange: (e) => setDshBinDraft(e.target.value),
                  }),
                  h('button', {
                    'data-dy-mini': '', disabled: Boolean(busy) || dshBinDraft === null,
                    onClick: async () => { await patch({ dshBin: String(dshBinDraft || '').trim() }, '已保存 dsh 入口路径'); setDshBinDraft(null) },
                  }, '保存'),
                  h('button', {
                    'data-dy-mini': '', disabled: Boolean(busy),
                    onClick: async () => { await patch({ dshBin: '' }, '已清空 ⇒ 回到自动探测'); setDshBinDraft(null) },
                  }, '自动找')),
                h('div', { 'data-dy-sub': '', style: { opacity: '.78' } },
                  '填这两个之一：<安装目录>\\resources\\app.asar\\dsh\\node_modules\\@deepseek-ai\\'
                  + 'dsh-desktop-host\\lib\\cli.js 或 …\\@deepseek-ai\\dsh\\lib\\bin.js')),
      /* ── 给别的 AI 用（MCP） ── */
              h('div', { 'data-dy-subblock': '' },
                h('div', { 'data-dy-row': '' },
                  h('div', { 'data-dy-grow': '' },
                    h('div', { 'data-dy-title': '' }, '给别的 AI 用'),
                    h('div', { 'data-dy-sub': '' },
                      '想让 Claude Code / Cursor / 别的 agent 也能刷抖音？这插件自带一个 MCP server，配一段 JSON 就能接。'))),
                h('div', { 'data-dy-row': '' },
                  h('button', {
                    'data-dy-btn': '', disabled: busy === 'ai', onClick: loadAi,
                  }, busy === 'ai' ? '读说明中…' : '看接入方式')),
                ai
                  ? h('div', { 'data-dy-inner': '', style: { background: 'transparent', border: 'none', padding: 0, gap: '8px' } },
                    h('div', { 'data-dy-kv': '' }, 'MCP server：' + ((ai.mcp && ai.mcp.server) || '(缺失)')),
                    ai.mcp && ai.mcp.exists
                      ? null
                      : h('div', { 'data-dy-msg': '', 'data-warn': '' }, '⚠️ 找不到 tools/mcp-server.mjs —— 插件包不完整，重新安装'),
                    h('div', { 'data-dy-sub': '' }, '把下面这段填进那个工具的 MCP 配置（路径已经按这台机器算好了）：'),
                    h('pre', { 'data-dy-pre': '' }, (ai.mcp && ai.mcp.configText) || ''),
                    h('div', { 'data-dy-row': '' },
                      h('button', {
                        'data-dy-mini': '',
                        onClick: () => copy((ai.mcp && ai.mcp.configText) || '', 'MCP 配置'),
                      }, copied === 'MCP 配置' ? '✓ 已复制' : '复制 MCP 配置'),
                      h('button', {
                        'data-dy-mini': '',
                        onClick: () => copy((ai.mcp && ai.mcp.selfTest) || '', '自测命令'),
                      }, copied === '自测命令' ? '✓ 已复制' : '复制自测命令')),
                    h('div', { 'data-dy-sub': '' }, '自测（不接任何客户端，先看它自己通不通）：'),
                    h('pre', { 'data-dy-pre': '' }, (ai.mcp && ai.mcp.selfTest) || ''),
                    ai.doc
                      ? h('div', { 'data-dy-row': '' },
                        h('button', {
                          'data-dy-mini': '',
                          onClick: () => copy(ai.doc, '使用说明'),
                        }, copied === '使用说明' ? '✓ 已复制' : '复制完整使用说明（贴给那个 AI 看）'))
                      : h('div', { 'data-dy-msg': '', 'data-warn': '' }, '读不到 AI-USAGE.md：' + (ai.doc_error || '未知原因')))
                  : h('div', { 'data-dy-sub': '' }, '点「看接入方式」会显示：MCP 配置、自测命令、给 AI 看的使用说明。')),
      /* ── 关于 / 检查更新 ── */
              h('div', { 'data-dy-subblock': '' },
                h('div', { 'data-dy-row': '' },
                  h('div', { 'data-dy-grow': '' },
                    h('div', { 'data-dy-title': '' }, '关于'),
                    h('div', { 'data-dy-sub': '' }, '当前版本 v' + (st.version || '?') + ' · 报告在 ' + (st.report || 'out/'))),
                  h('button', {
                    'data-dy-btn': '', disabled: busy === 'update', onClick: () => onCheckUpdate(true),
                  }, busy === 'update' ? '查着呢…' : '检查更新')),
                upd
                  ? h('div', { 'data-dy-kv': '' },
                    upd.checked
                      ? (upd.hasUpdate
                        ? `有新版本 v${upd.latest}（当前 v${upd.current}）`
                        : `已是最新版（v${upd.current}）`) + (upd.source ? `　来源：${upd.source}` : '')
                      : (upd.note || '查不到最新版本'),
                    upd.hasUpdate && upd.how ? h('div', { style: { marginTop: '4px' } }, '升级：' + upd.how) : null)
                  : null,
                upd && upd.tried && !upd.checked
                  ? h('div', { 'data-dy-sub': '' }, '试过：' + upd.tried.map((t) => t.source + (t.ok ? ' ✓' : ' ✗')).join('、'))
                  : null),
      /* ── 报告 ── */
              report !== null
                ? h('div', { 'data-dy-subblock': '' },
                  h('div', { 'data-dy-title': '' }, '报告'),
                  h('pre', { 'data-dy-pre': '' }, report))
                : null,
            )
          : null,

        /* ══════ 组「一次配好」—— **默认收起**（foldCfg 初始 false），点标题行展开 ══════
         * 🔴 折叠状态是 Panel 顶部那两个 useState；这里只读、只 set，**绝不在条件分支里加 hook**。 */
        h('div', { 'data-dy-group': '' },
          h('button', {
            'data-dy-groupbtn': '', 'data-open': foldCfg ? '' : undefined,
            'aria-expanded': foldCfg ? 'true' : 'false',
            onClick: () => setFoldCfg((v) => !v),
          },
            h('span', { 'data-dy-groupname': '' }, '一次配好'),
            h('span', { 'data-dy-groupchev': '' }, foldCfg ? '收起 ▲' : '展开看 ▼'))),

        /* ── 卡 ⑤ 刷抖音的策略：刷什么 / 什么时候自己跑 / 每天挑几条 / 日报多细 / 通知方式 ── */
        foldCfg
          ? h('div', { 'data-dy-card': '' },
              h('div', { 'data-dy-title': '' }, '刷抖音的策略'),
              h('div', { 'data-dy-sub': '' },
                '刷什么、什么时候自己跑、每天挑几条、日报写多细、消息怎么通知你 —— 一次配好就不用再管。'),
      /* ── 刷什么 ── */
              h('div', { 'data-dy-subblock': '' },
                h('div', { 'data-dy-title': '' }, '刷什么'),
                h('div', { 'data-dy-sub': '' }, '关注关键词，一行一个（留空 = 用内置默认那几组）'),
                h('textarea', {
                  'data-dy-input': '', rows: 5, value: kwText,
                  placeholder: '搞笑\n美食\n猫',
                  onChange: (e) => setKws(e.target.value),
                }),
                h('div', { 'data-dy-row': '' },
                  h('button', {
                    'data-dy-btn': '', 'data-primary': '',
                    disabled: Boolean(busy), onClick: saveKws,
                  }, '保存'))),
      /* ── 什么时候跑 ── */
              h('div', { 'data-dy-subblock': '' },
                h('div', { 'data-dy-row': '' },
                  h('div', { 'data-dy-grow': '' },
                    h('div', { 'data-dy-title': '' }, '什么时候自己跑'),
                    h('div', { 'data-dy-sub': '' }, '只在谷时跑（便宜）。全关 = 只在你点「现在跑一轮」时跑。'))),
                h('div', { 'data-dy-row': '' },
                  h('div', { 'data-dy-grow': '' }, h('div', { 'data-dy-sub': '' }, '中午谷时 12:00–14:00')),
                  h(Switch, {
                    on: Boolean(cfg.noon),
                    onChange: (v) => patch({ noon: v }, v ? '中午自动跑：开' : '中午自动跑：关'),
                  })),
                h('div', { 'data-dy-row': '' },
                  h('div', { 'data-dy-grow': '' }, h('div', { 'data-dy-sub': '' }, '晚上谷时 18:00–次日 09:00')),
                  h(Switch, {
                    on: Boolean(cfg.night),
                    onChange: (v) => patch({ night: v }, v ? '晚上自动跑：开' : '晚上自动跑：关'),
                  })),

                /* ⭐ 自定义时段：和上面两个开关**叠加**（任意一个命中就跑），每个时段每天只跑一次 */
                h('div', { 'data-dy-sub': '', style: { marginTop: '4px' } }, '自定义时段（可选，跟上面两个叠加）'),
                winList.length
                  ? winList.map((w, i) => h('div', { 'data-dy-wrow': '', key: 'w' + i },
                    h('input', {
                      'data-dy-time': '', type: 'time', value: String(w.start || ''),
                      onChange: (e) => setWinAt(i, 'start', e.target.value),
                    }),
                    h('span', { 'data-dy-sep': '' }, '→'),
                    h('input', {
                      'data-dy-time': '', type: 'time', value: String(w.end || ''),
                      onChange: (e) => setWinAt(i, 'end', e.target.value),
                    }),
                    h('input', {
                      'data-dy-input': '', style: { flex: '1', minWidth: '60px' },
                      placeholder: '备注（可空）', value: String(w.label || ''),
                      onChange: (e) => setWinAt(i, 'label', e.target.value),
                    }),
                    h('button', { 'data-dy-mini': '', 'data-danger': '', onClick: () => delWin(i) }, '删')))
                  : null,
                h('div', { 'data-dy-row': '' },
                  h('button', { 'data-dy-mini': '', onClick: addWin }, '+ 加一个时段'),
                  winList.length
                    ? h('button', {
                      'data-dy-mini': '', 'data-primary': '',
                      disabled: Boolean(busy), onClick: saveWins,
                    }, '保存时段')
                    : null,
                  h('div', { 'data-dy-grow': '' }),
                  winList.length
                    ? h('span', { 'data-dy-sub': '' }, '跨零点也行（23:00 → 02:00）')
                    : null),

                h('div', { 'data-dy-sub': '' }, '两个都关 = 只在点「现在跑一轮」时跑。')),
      /* ── 每天挑几条 / 日报多细 ── */
              h('div', { 'data-dy-subblock': '' },
                h('div', { 'data-dy-title': '' }, '每天挑几条'),
                h('div', { 'data-dy-sub': '' },
                  '全天总量（不是每轮）。0 = 不自动刷，只在你点「现在跑一轮」时跑。'),
                h('div', { 'data-dy-row': '' },
                  h('input', {
                    'data-dy-time': '', type: 'number', min: 0, max: 300,
                    style: { width: '72px' },
                    value: String(perDayDraft !== null ? perDayDraft : (cfg.perDay != null ? cfg.perDay : 5)),
                    onChange: (e) => setPerDayDraft(e.target.value),
                  }),
                  h('span', { 'data-dy-sub': '' }, '条 / 天'),
                  h('div', { 'data-dy-grow': '' }),
                  h('button', {
                    'data-dy-mini': '', 'data-primary': '',
                    disabled: Boolean(busy) || perDayDraft === null,
                    onClick: async () => {
                      const n = Math.max(0, Math.min(Number(perDayDraft) || 0, 300))
                      await patch({ perDay: n }, `每天最多 ${n} 条`)
                      setPerDayDraft(null)
                    },
                  }, '保存')),
                h('div', { 'data-dy-row': '' },
                  h('span', { 'data-dy-sub': '' }, '日报写多细：'),
                  h('select', {
                    'data-dy-input': '', style: { flex: '1', maxWidth: '180px' },
                    value: String(cfg.reportLevel || 'full'),
                    onChange: (e) => patch({ reportLevel: e.target.value }, '日报详细程度已保存'),
                  },
                    h('option', { value: 'full' }, '完整版（为什么值得 + 一句话）'),
                    h('option', { value: 'brief' }, '薄版（每条一两行）'),
                    h('option', { value: 'off' }, '不写日报')),

                  h('span', { 'data-dy-sub': '', style: { marginLeft: '12px' } }, '通知：'),
                  h('select', {
                    'data-dy-input': '', style: { flex: '1', maxWidth: '150px' },
                    value: String(cfg.notifyMode || 'toast'),
                    onChange: (e) => patch({ notifyMode: e.target.value }, '通知方式已保存'),
                  },
                    h('option', { value: 'toast' }, '弹 Windows 通知'),
                    h('option', { value: 'file' }, '只写文件（不打扰）'),
                    h('option', { value: 'webhook' }, '推 webhook'),
                    h('option', { value: 'both' }, '通知 + webhook')))),
            )
          : null,

        /* ── 卡 ⑥ 我的人设（桌宠联动开关 2026-10-26 按主人要求隐藏） ──
         *   主人：「人设是不是该改成我的人设」⇒ 对，这份是**你的**那份，
         *   不是泛称的"人设"。标题就叫「我的人设」。 */
        foldCfg
          ? h('div', { 'data-dy-card': '' },
              h('div', { 'data-dy-title': '' }, '我的人设'),
      /* ⭐⭐ 2026-10-25 拆分：卡⑥从「桌宠控制台」变成「联动桌宠」一个开关。
       *   为什么缩水：桌宠独立成插件了（dsh-deskpet），她的开关 / 人格 / 弹幕三态 /
       *   语音 / 按钮条全在**设置 → 桌宠**那边。在这里控制它们就是跨插件伸手，
       *   两份配置互相覆盖的坑我们踩过一次（dmTo 被清空那次就是这么来的）。
       *   这里只回答一个问题：**刷抖音的状态要不要喂给她**。
       *
       * 🔴 2026-10-26 主人：「联动桌宠选项暂时不要出现」⇒ 用 HIDE_PET_LINK 关掉。
       *   为什么用常量而不是删代码：
       *     · 删了以后要恢复就得重写一遍（这块逻辑+文案不短）
       *     · 后端 petLinkTo 还在工作（默认 true，状态源照常注册），
       *       只是**面板不让人看见/改它** —— 主人要的是"别出现在界面上"，
       *       不是"断掉联动"。
       *   要恢复：把下面的 HIDE_PET_LINK 改成 false 即可，别改别的。 */
              (() => {
                const HIDE_PET_LINK = true
                if (HIDE_PET_LINK) return null
                return h('div', { 'data-dy-subblock': '' },
                  h('div', { 'data-dy-row': '' },
                    h('div', { 'data-dy-grow': '' },
                      h('div', { 'data-dy-title': '' }, '联动桌宠'),
                      h('div', { 'data-dy-sub': '' },
                        (cfg.petLinkTo !== false
                          ? '✅ 开着：刷抖音的状态会喂给桌宠 —— 她在气泡里说「正一条条看视频文案」这种话，就是从这里来的。'
                          : '关着：桌宠不知道你在刷抖音，她自己待着（这不是故障）。'))),
                    h(Switch, {
                      on: cfg.petLinkTo !== false,
                      disabled: busy === 'patch',
                      onChange: (v) => patch({ petLinkTo: v },
                        v ? '✅ 联动开了：她知道你在刷抖音了' : '联动关了：她不再知道抖音的状态'),
                    })))
              })(),
                /* ⚠️ 2026-10-25 主人：「走动模式去掉，不生效也没动画」⇒ 这块直接删掉。 */
      /* ── 我的人设
       *   🔴 2026-10-26 主人：「人设默认的是不是有问题，人设是不是该改成我的人设」
       *      两件事一起改：
       *        ① 叫法 —— 卡片标题「人设」→「我的人设」（这是**你的**那份，不是泛称）
       *        ② 默认有真问题 —— 面板原来只读 $DOUYIN_HOME/persona.md，
       *           而实际生效的是**插件自带那份**（16970 字节完整人设），
       *           于是文本框空着、提示写"用的是默认"，看着就像人设丢了。
       *           现在后端会返回 effective（真正生效的内容）+ effective_label（哪一份），
       *           面板直接展示它，并在上面写清"现在用的是哪一份"。
       */
              h('div', { 'data-dy-subblock': '' },
                h('div', { 'data-dy-row': '' },
                  h('div', { 'data-dy-grow': '' },
                    h('div', { 'data-dy-sub': '' },
                      '人格是性格档位，这里补几句你额外想让她遵守的话（写日报时也用这份）。')),
                  h('button', { 'data-dy-mini': '', disabled: busy === 'persona', onClick: loadPersona },
                    persona === null ? '展开' : '收起')),
                persona !== null
                  ? h('div', { 'data-dy-inner': '', style: { background: 'transparent', border: 'none', padding: 0, gap: '8px' } },
                    // ⭐ 说清"现在生效的是哪一份"（别再让用户以为自己的人设丢了）
                    h('div', { 'data-dy-sub': '', style: { fontWeight: '500' } },
                      persona.custom
                        ? '✅ 正在用你写的这份'
                        : `ℹ️ 你没写自己的 —— 现在用的是「${persona.effective_label || '插件自带的那份'}」，内容就在下面`),
                    h('textarea', {
                      'data-dy-input': '', rows: 8,
                      // 没有自己那份时，把**真正生效的内容**显示出来（而不是空框）
                      value: persona.text || (persona.custom ? '' : (persona.effective || '')),
                      placeholder: '比如：\n- 说话软一点、别腻\n- 简短，别写成客服\n- 不透露任何私人信息',
                      onChange: (e) => setPersona({ ...persona, text: e.target.value }),
                    }),
                    h('div', { 'data-dy-row': '' },
                      h('button', {
                        'data-dy-btn': '', 'data-primary': '', disabled: Boolean(busy), onClick: savePersona,
                      }, persona.custom ? '保存' : '保存为我的人设'),
                      h('button', {
                        'data-dy-mini': '', disabled: Boolean(busy),
                        onClick: () => setPersona({ ...persona, text: persona.defaultText || '' }),
                      }, '填入中性默认'),
                      h('div', { 'data-dy-grow': '' }),
                      h('span', { 'data-dy-sub': '' }, '留空保存 = 退回上一份（自己写 → 插件自带 → 中性默认）')))
                  : null),
            )
          : null,

        /* ── 卡 ⑦ 消息与记忆：收件箱（谁找我）+ 聊天窗口 + 对话记忆（含清空） ── */
        foldCfg
          ? h('div', { 'data-dy-card': '' },
              h('div', { 'data-dy-title': '' }, '消息与记忆'),
              h('div', { 'data-dy-sub': '' },
                '谁在评论区 @ 了你、谁给你发了私信；点一条就能回。聊过的话记在本机，不上传。'),
      /* ── 消息：评论区 @ 我 + 谁私信我 ── */
              h('div', { 'data-dy-subblock': '' },
                h('div', { 'data-dy-row': '' },
                  h('div', { 'data-dy-grow': '' },
                    h('div', { 'data-dy-title': '' }, '消息'),
                    h('div', { 'data-dy-sub': '' },
                      '谁在评论区 @ 了你、谁最近给你发了私信。点一条就能回。')),
                  h('button', { 'data-dy-btn': '', disabled: busy === 'inbox' || !st.loggedIn, onClick: loadInbox },
                    busy === 'inbox' ? '读取中…' : (inbox === null ? '看看谁找我' : '收起'))),
                !st.loggedIn ? h('div', { 'data-dy-sub': '' }, '（要先扫码登录）') : null,

                inbox !== null && inbox.ok
                  ? h('div', { 'data-dy-inner': '', style: { background: 'transparent', border: 'none', padding: 0, gap: '10px' } },
                    /* 评论区 @ */
                    h('div', { 'data-dy-sub': '' }, `评论区 @ 我：${inbox.at_n || 0} 条`),
                    (inbox.at || []).length
                      ? h('div', { 'data-dy-people': '' },
                        inbox.at.map((a, i) => h('div', { key: 'at' + i, 'data-dy-msgrow': '' },
                          h('div', { 'data-dy-row': '' },
                            h('span', { 'data-dy-person-name': '' }, a.nickname || '（不知道是谁）'),
                            h('span', { 'data-dy-tag': '', ...(a.before === '回过' ? { 'data-ok': '' } : {}) }, a.before),
                            h('div', { 'data-dy-grow': '' }),
                            a.video_url
                              ? h('a', { href: a.video_url, target: '_blank', rel: 'noreferrer', 'data-dy-mini': '', style: { textDecoration: 'none' } }, '看视频')
                              : null),
                          h('div', { 'data-dy-person-sub': '', style: { whiteSpace: 'normal', marginTop: '2px' } }, a.content || ''),
                          a.my_comments_here && a.my_comments_here.length
                            ? h('div', { 'data-dy-sub': '', style: { marginTop: '2px' } },
                              '我在这条视频下说过：' + a.my_comments_here[a.my_comments_here.length - 1].text.slice(0, 40))
                            : null)))
                      : h('div', { 'data-dy-sub': '' }, (inbox.at_n ? '都回过了' : '最近没有人在评论区 @ 你')),

                    /* 私信 */
                    h('div', { 'data-dy-sub': '', style: { marginTop: '6px' } }, `最近私信：${inbox.dm_n || 0} 个可能要回`),
                    (inbox.dm || []).length
                      ? h('div', { 'data-dy-people': '' },
                        inbox.dm.map((p, i) => h('button', {
                          key: 'dm' + i, 'data-dy-person': '', 'data-dy-inbox-dm': '', disabled: Boolean(busy),
                          onClick: () => openChat(p),
                        },
                          h('span', { 'data-dy-person-name': '' }, p.nick),
                          p.duplicate ? h('span', { 'data-dy-tag': '' }, '重名') : null,
                          p.needs_reply ? h('span', { 'data-dy-tag': '' }, '该回了') : null,
                          h('span', { 'data-dy-person-sub': '' },
                            (p.their_last ? '他：' + String(p.their_last.text).slice(0, 26) : (p.preview || ''))),
                          h('span', { 'data-dy-tag': '' }, `记 ${p.remembered || 0}`))))
                      : h('div', { 'data-dy-sub': '' }, '最近没有私信'),
                    (inbox.errors && inbox.errors.length)
                      ? h('div', { 'data-dy-msg': '', 'data-warn': '' }, '有些读不到：' + inbox.errors.join('；'))
                      : null)
                  : null,
                inbox !== null && !inbox.ok
                  ? h('div', { 'data-dy-msg': '', 'data-warn': '' }, (inbox.errors || []).join('；') || '读不到消息')
                  : null),
      /* ── 聊天（带记忆） ── */
              chat !== null
                ? h('div', { 'data-dy-subblock': '' },
                  h('div', { 'data-dy-row': '' },
                    h('div', { 'data-dy-grow': '' },
                      h('div', { 'data-dy-title': '' }, '跟 ' + chat.who.nick + ' 聊'),
                      h('div', { 'data-dy-sub': '' },
                        chat.data.context && chat.data.context.facts && chat.data.context.facts.length
                          ? '记得关于他的：' + chat.data.context.facts.join('、')
                          : (chat.data.context && chat.data.context.note) ? chat.data.context.note : '记忆里还没有这个人')),
                    h('button', { 'data-dy-mini': '', onClick: () => { setChat(null); setChatText('') } }, '关掉')),

                  /* 消息气泡 */
                  h('div', { 'data-dy-chat': '' },
                    (chat.data.messages || []).map((m, i) => h('div', {
                      key: 'm' + i,
                      'data-dy-bubble': '',
                      'data-mine': m.from === 'me' ? '' : undefined,
                      'data-them': m.from === 'them' ? '' : undefined,
                    },
                      h('div', { 'data-dy-bubble-text': '' }, String(m.text || '').slice(0, 300)),
                      m.awe === 800 ? h('div', { 'data-dy-tag': '' }, '分享卡片') : null))),

                  /* 输入 */
                  h('div', { 'data-dy-row': '' },
                    h('input', {
                      'data-dy-input': '', style: { flex: '1' },
                      placeholder: '说点什么…（发出去会进记忆）',
                      value: chatText,
                      onChange: (e) => setChatText(e.target.value),
                      onKeyDown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } },
                    }),
                    h('button', {
                      'data-dy-btn': '', 'data-primary': '',
                      disabled: busy === 'send' || !String(chatText || '').trim(),
                      onClick: sendChat,
                    }, busy === 'send' ? '发送中…' : '发送')),
                  h('div', { 'data-dy-sub': '' },
                    '发出去的话会记进记忆，下次打开就知道聊到哪了。'))
                : null,
      /* ── 对话记忆 ── */
              h('div', { 'data-dy-subblock': '' },
                h('div', { 'data-dy-row': '' },
                  h('div', { 'data-dy-grow': '' },
                    h('div', { 'data-dy-title': '' }, '对话记忆'),
                    h('div', { 'data-dy-sub': '' },
                      '回私信、回评论时会记住聊过什么（存在本机，不上传）。这样它才不会把人当陌生人、重复问已经说过的事。')),
                  h('button', {
                    'data-dy-btn': '', disabled: busy === 'mem', onClick: loadMem,
                  }, mem === null ? '看记忆' : '收起')),
                mem !== null
                  ? h('div', { 'data-dy-inner': '', style: { background: 'transparent', border: 'none', padding: 0, gap: '8px' } },
                    h('div', { 'data-dy-kv': '' },
                      `私信记忆 ${mem.dm} 个人 · 评论区记忆 ${mem.comment} 条视频 · 共 ${Math.round((mem.bytes || 0) / 1024)} KB`),
                    h('div', { 'data-dy-sub': '' },
                      mem.dm || mem.comment
                        ? '想忘掉某个人：在对话里说「忘掉他」，或者清空全部。'
                        : '还没有记忆 —— 用它聊过天之后才会有。'),
                    h('div', { 'data-dy-row': '' },
                      h('button', {
                        'data-dy-mini': '', 'data-danger': '', disabled: Boolean(busy) || (!mem.dm && !mem.comment),
                        onClick: clearMem,
                      }, '清空全部记忆')))
                  : null),
            )
          : null,
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const style = document.createElement('style')
        style.setAttribute('data-plugin-css', 'dsh-douyin-scroll')
        style.textContent = CSS
        document.head.appendChild(style)
        ctx.effect(() => () => style.remove(), 'dsh-douyin-scroll: 设置页样式')

        const slots = (typeof ctx.get === 'function' ? ctx.get('slots') : undefined) || ctx.slots
        if (!slots) return
        slots.inject('settings.section', () => slots.register(
          { name: 'settings.section', id: 'douyin-scroll', order: 31, label: '刷抖音' },
          () => h(Boundary, null, h(Panel)),
        ))
        // ⭐ 桌面小宠（2026-10-24 v3）：她整个搬去独立插件 dsh-deskpet ——
        //    这里不再注册任何浮层/窗口（开关和功能都在 dsh-deskpet 插件里）。
      },
    }
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
            '· 浏览器面板是全功能版（自动在本机 8390-8398 找控制台；桌面也有「刷视频控制台」快捷方式）\n' +
            '· 浏览器打不开时用「在此页展开」，或看 设置 → 插件 → 插件列表 是否有同步失败\n' +
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
