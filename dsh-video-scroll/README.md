# dsh-video-scroll ｜ 刷视频插件（合并版）

> 一个 DSH 插件包，**两个功能**：**刷B站**（设置 → 刷B站）+ **刷抖音**（设置 → 刷抖音）。
> 由下面两个开源插件整合而成，功能**原样保留**（工具、设置页、家目录、定时器、MCP 全部不变）：
>
> - **刷B站** ← [c1overzz/dsh-bili-scroll](https://github.com/c1overzz/dsh-bili-scroll) v2.3.1（MIT），源码在 [`bili/`](bili/)
> - **刷抖音** ← [NEWJO123/dsh-douyin-scroll](https://github.com/NEWJO123/dsh-douyin-scroll) v0.5.4（MIT），源码在 [`douyin/`](douyin/)

## 合并结构（v1.1.0 · 单一 entry）

| 层 | 内容 |
|---|---|
| **entry** | 一个：`id: video-scroll` → `name: dsh-video-scroll`（根 [`index.js`](index.js)） |
| **宿主半端** | 根 `apply()` 用 cordis `ctx.plugin` 把 `bili/index.js`、`douyin/index.js` 原样挂成两个子 fiber —— 工具（`bili_*`/`douyin_*`）、HTTP 前缀（`/api/bili-duty`、`/api/douyin-duty`）、家目录（`$DSH_HOME/bili-duty`、`$DSH_HOME/douyin-duty`）、定时器、值班 profile 全部不变 |
| **浏览器半端** | 包根 [`client.js`](client.js) 注册「刷B站」「刷抖音」两个设置页面板（slot id 仍是 `bili-scroll`/`douyin-scroll`），由 [`build-client.mjs`](build-client.mjs) 从两个上游 client.js 机械合并生成 |

> ⚠️ **为什么必须单入口**：DSH 的浏览器 client-modules 扫描（`exactPackageSpecifier`）**不接受带 `/` 的条目名**。
> v1.0.0 曾用子路径条目（`dsh-video-scroll/bili`）——宿主半端正常挂载，但两条 entry 被静默排除出浏览器
> bundle 图 ⇒ **设置页面板消失**。v1.1.0 改单入口后修复。给后来者的教训：条目名只能用裸包名。

**设置**：根 entry 不带 Config（原生设置页没有本插件的表单字段），两个面板各自读写
`$DSH_HOME/bili-duty/config.json`、`$DSH_HOME/douyin-duty/config.json` —— 两个子插件本来就是
"本地优先"设计，宿主设置行不存在时自动退回本地配置 ✓。之前单独安装的配置/凭证/日报全部继承。

## 安装 / 更新

```bash
# 装进桌面版 profile（本机桌面版用的就是 desktop）：
dsh plugin --profile desktop add link:"D:\我的电脑\桌面\刷视频插件\dsh-video-scroll"

# 装完必须重启一次 dsh（bundle 层要重启才组装），然后进 设置 → 刷B站 / 刷抖音。
```

更新合并包：改完文件（或 git pull 上游后同步进子目录）再跑一遍同一条 add 命令即可，**幂等**。

## 从「两个单独插件」换成这个合并包

```bash
dsh plugin --profile desktop remove dsh-bili-scroll dsh-douyin-scroll
dsh plugin --profile desktop add link:"D:\我的电脑\桌面\刷视频插件\dsh-video-scroll"
```

⚠️ profile 用户层 `cordis.patch.yml` 里旧的 `bili-scroll` / `douyin-scroll` 覆盖行要删掉
（条目已不存在；它们保存的值——pythonPath、聊天盯梢、私信对象等——两个插件家目录的
`config.json` 里本来就有，无需迁移）。本机已按此处理（备份 `cordis.patch.yml.bak-videoscroll-*`）。

## 自检

```bash
node selfcheck.mjs        # 或用 DSH 自带 Node 跑也行
```

自检含「client.js 工厂桩环境真跑」一项，能在装之前就确认两个面板能注册出来。

## 设置统一入口 + 浏览器全功能综合面板（v1.4.0）

- **DSH 设置里只有一个「刷视频插件」区块**（旧的「刷B站」「刷抖音」独立页签收进面板，不再单独显示）。
  落地页两个按钮：**「🌐 在浏览器打开综合面板」**（主）与「在此页展开」（备用）。
- **浏览器综合面板 = 全功能**：地址 `http://127.0.0.1:8390`（被占自动往后找；设置页按钮会自动
  探测端口打开，桌面也有「刷视频控制台」快捷方式）。里面是**两个原装 React 面板原样复用**
  （页签：刷B站 / 刷抖音）——扫码登录、评论 @、私信投递、收藏夹、日报……一个不少。
- 实现要点：面板代码由 `build-client.mjs` 从上游 client.js 原样抽出，在独立页用假宿主上下文
  挂载（console/app.js，自带 vendor React 运行时，离线可用）；面板的全部 `/api/*` 调用由
  控制台**原样代理**给子插件桥接出来的内部路由（`__videoScrollConsole.<kind>.handle`）——
  业务逻辑零重写，上游更新面板后重跑 build 脚本即可跟上。
- 安全边界：只监听 127.0.0.1；key 门禁（随机 key 存 `$DSH_HOME/video-scroll-console.json`，
  cookie + 快捷方式/`/join` 携带）；代理只对这两个子插件前缀；控制台随 DSH 进程存活，
  DSH 关闭即下线。

## 三个注意点

1. **不要点子面板里的「检查更新 / 一键升级」**—— 那是上游单包插件的升级逻辑，会试图把旧的单独插件
   （`dsh-bili-scroll` / `dsh-douyin-scroll`）装回来，跟合并包打架。要升级就更新本目录子模块后重新 add。
2. `bili/index.js` 里有几行标注「**临时启动探针**」的代码（每次启动往 `$DSH_HOME/bili-duty/boot-probe.log`
   写 4 行里程碑日志），是合并排障用的。一切正常可以删掉那几行（`_probe` 定义与三处调用），不影响任何功能。
3. 插件的详细功能说明见各自子目录的 README：[`bili/README.md`](bili/README.md)、[`douyin/README.md`](douyin/README.md)、
   抖音进阶有 [`douyin/GUIDE.md`](douyin/GUIDE.md)。

## 许可

MIT。上游两个项目的许可与版权见 [LICENSE](LICENSE) 与各自子目录（bili 内含 vendor/bilibili-mcp，同为 MIT）。
