/**
 * dsh-video-scroll —— 合并版入口（v1.4.0，单 entry + 浏览器全功能综合面板）
 * ============================================================================
 * 为什么是单入口（v1.0.0 的教训）：v1.0.0 曾给两个子功能各挂一个 entry（name 写成
 * 子路径 `dsh-video-scroll/bili`、`/douyin`）。宿主半端能挂载，但 **DSH 的浏览器
 * client-modules 扫描（exactPackageSpecifier）不接受带 `/` 的条目名** ⇒ 两条 entry
 * 被静默排除出浏览器 bundle 图 ⇒ 设置页里「刷B站」「刷抖音」两个面板消失。
 * ⇒ v1.1.0 起：**一个 entry（name = 包名，无斜杠）**，本模块作为根，在 apply 里用
 *   cordis 的 ctx.plugin 把两个子插件原样挂成子 fiber —— 宿主半端工具/定时器/家目录
 *   全部不变；client bundle 从包根的 exports['./client'] 提供。
 *
 * v1.3.0：DSH 设置收敛成一个「刷视频插件」入口（落地页，旧两页隐藏）。
 * v1.4.0（当前）：按用户要求，落地页主按钮改为**跳转网址**——本包在 127.0.0.1:8390
 *   起独立网址（console/server.mjs），浏览器里是**全功能综合面板**：
 *   · 面板 = 两个原装 React 面板原样复用（console/app.js，假宿主上下文挂载）；
 *   · 面板的所有 /api/* 调用由控制台**代理**到子插件桥接出来的内部路由
 *     （globalThis.__videoScrollConsole.<kind>.handle，完整业务逻辑零重写）；
 *   · 只监听本机回环 + key 门禁（cookie）；随 DSH 进程存活，DSH 关闭即下线。
 *   设置页内保留「在此页展开」作为备用（页签式，无需浏览器）。
 *
 * 设置说明：根 entry 不带 Config（原生设置页没有本插件字段），两个面板各自读写
 * `$DSH_HOME/bili-duty/config.json`、`$DSH_HOME/douyin-duty/config.json`。
 * ============================================================================
 */
import * as bili from './bili/index.js'
import * as douyin from './douyin/index.js'
import { startConsole } from './console/server.mjs'

export const name = 'video-scroll'
export const inject = ['webServer', 'tools', 'settings']

export function apply(ctx) {
  // 两个子插件各自声明 inject（webServer/tools/settings；douyin 另有 optional llm），
  // ctx.plugin 会读它们模块上的静态声明并各自起 fiber —— 与原来两个独立 entry 等价。
  ctx.plugin(bili, {})
  ctx.plugin(douyin, {})
  // 浏览器综合面板（startConsole 内部自己兜错误，挂了只记日志不拖死插件）
  ctx.effect(() => startConsole(), 'video-scroll: 浏览器综合面板')
}

