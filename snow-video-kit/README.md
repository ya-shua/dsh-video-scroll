# snow-video-kit ｜ 刷视频工具包（依附 SnowLuma · 她自己能用 · 自带 key 大脑）

> 📐 完整设计文档：[docs/设计-2026-11-03.md](docs/设计-2026-11-03.md)（架构/决策/数据流/接口/安全/回退）

> 一个**独立运行**的刷视频工具包（2026-11-08 起不再依赖 DSH）：QQ 连接成功 → 工具包就绪。
>
> - **她是谁由海螺决定**：人设读海螺 `/api/roles/{当前人格}`，记忆读环形的心，日报**由她自己决定写不写**——
>   不注入口吻样本教她"演自己"（这条是 2026-11-09 按使用者意见改的）。
> - **看画面 / 听声音借留影**：视觉与 ASR 直接用留影配好的模型（GLM-4V / SenseVoice），
>   经它的模块调用，不经过它的面板、也不往它记忆库里写东西。
> - **大脑自带 key**：OpenAI 兼容（baseURL + key + model）填在工作台，「测试连通」可先验后存。
> - 带一个**全新设计**的浅色「工作台」页面（非 DSH 面板样式）。

## 它由什么组成

| 组件 | 说明 |
|---|---|
| **桥接她** | `src/conch-bridge.mjs`：人设（海螺 `GET /api/roles/{人格}`，按小节抽取 + 字数上限）、记忆（环形的心 `ring_recall`/`ring_overview`）、可选语气样本（默认 0 条）；每级都有回退，任何一环挂了都不拦轮 |
| **看 / 听** | `src/eyes.mjs`：import 留影的 `describe.mjs` / `audio.mjs` / `ring-vision.mjs`。B站看故事板帧、抖音下直链后抽帧+ASR；详见下面「看画面 / 听声音」 |
|---|---|
| **Snow 守望器** | 从 `SnowLuma/config/onebot_*.json` 发现端点与 token，周期探测 `get_login_info`；**QQ 在线才放行值班轮**，掉线自动待命 |
| **B站引擎** | spawn `bili-duty/mcp_server.py`（stdio MCP，`BILI_MCP_TOOLS` 白名单），大脑多轮工具循环：荐视频 → 读字幕/评论 → `duty_report_append` 落盘；配额驱动层强制 |
| **抖音引擎** | `forward-pick.py` 采集候选 → 她逐条 `look_comments(vid)` 真读评论区（签名 API → DOM 双通道）→ 深模式下可 `look_deep(vid)` 真看画面/听声音 → 输出 `### <视频ID>` 日报 → 宿主写 `out/<日期>.md` 与 `seen.md` |
| **大脑** | OpenAI 兼容 `/chat/completions`（baseURL + key + model 填在工作台）；key 存 `state/brain-key`，不回显 |
| **她的工具** | `video_status / video_latest_report / video_run_round / video_bili_hot / video_bili_search`（stdio MCP：`src/kit-mcp.mjs`） |
| **工作台** | `http://127.0.0.1:8412`（全新设计的浅色页面）：总览 / 大脑 / 她的工具 / 运行日志 |

机器资产**复用现成的家目录**（`~/.dsh/bili-duty`、`~/.dsh/douyin-duty` 里的 venv、MCP、Chrome 登录态、签名器）——这些本来就不依赖 DSH 进程，只是目录名叫这个。

## 启动

```
双击「启动工作台.bat」（前台）或「后台启动.vbs」（无窗口，日志 state\web.log）
→ 打开 http://127.0.0.1:8412 （桌面会生成「刷视频工作台」快捷方式）
→ 「大脑」页填 baseURL / model / key → 点「测试连通」
→ 总览页点「立即跑一轮」
```

用 SnowLuma 自带 Node（`D:\AI\QQ助手\SnowLuma\node.exe`，v24），机器上不用装全局 Node。

## 让「她」能调用（QQ 内置工具包）

> ⚠️ **2026-11-08 起 DSH 侧已全部撤掉**：`mcp-ring`、`mcp-lumisphere`、`mcp-video-kit` 都不再注册
> （她的大脑在海螺里，不再经过 DSH）。下面这段配置留作**给别的智能体接入**时的样板，或回滚参考。

把下面一段加进任意 DSH profile 的 `cordis.patch.yml`（同一份 stdio 命令在别处也能挂）：

```yaml
- insert:
    - id: mcp-video-kit
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: video-kit
        transport: stdio
        command: D:\AI\QQ宠物号\SnowLuma\node.exe
        args: ['D:\我的电脑\桌面\插件\snow-video-kit\src\kit-mcp.mjs']
        toolCallTimeoutMs: 120000
```

之后她在 QQ 里就能 `video_status`（看两个任务状态）、`video_latest_report`（读今日日报）、
`video_run_round`（让她自己决定「现在去刷一轮」）、`video_bili_hot/search`（查热榜/搜索）。
`video_run_round` 是**异步派发**（独立进程跑），她拿到"已开始"，再用 `video_status` 查进度。

## 跨平台记忆库（抖音、B站互通）

- 统一库：`data/video-memory.db`（SQLite，node:sqlite 内置零依赖）；`config.json → memory.dbPath` 可接入任意 SQLite 文件；
- 两边值班轮自动把「挑过/判断/理由」写进同一张表，并互相注入最近记忆（B站知道抖音推过什么，反之亦然，避免重复选题与重复话术）；
- 「她」的 `video_memory` 工具可查最近/搜索/跨平台查重；工作台「记忆库」页可浏览、搜索、跑只读 SQL；
- 表：`videos`（挑过的视频）、`interactions`（评论/私信）、`events`（事件流）。

## 服务台已并入工作台（v0.5.0）

工作台新增「服务」页：7 个服务探活（环形的心 5173 / 留影 5188 / 声来 17878 / 刷视频 8412 / 综合面板 8390 / SnowLuma 5099 / qq-bridge 3100）、各面板打开入口、宠物号记忆只读统计、刷视频记忆库统计、5 份日志尾巴。桌面一键启动会**隐藏拉起全部四个插件服务**再开浏览器——原 8420 服务台不再需要（文件保留）。

## 环形的心插件适配（统一入口）

`src/ring-adapter.mjs` 把两套工具聚合成**一个 MCP 入口**：ring_*（原样代理 `环形的心/mcp/server.mjs`，记忆逻辑不变、上游更新自动跟上）+ video_*（刷视频）。DSH 注册已切换到它（mcp-ring → ring-adapter，mcp-video-kit 并入移除）——「她」的工具列表就是一套完整的「环形的心 · 刷视频」插件（实测 10 个工具聚合，ring_overview 返回真实记忆）。环形的心那半边不可用时 video_* 不受影响（降级设计）；也可用 `config.json → ring.mcpServer` 指定别的记忆服务。

## 看画面 / 听声音

两种模式，工作台「👁️ 看 / 听」卡片可切，写进 `config.json → media`：

| | fast（默认） | deep |
|---|---|---|
| 看到什么 | 标题、字幕、评论 | 再加**画面**（真看图）和**声音**（没字幕时真听） |
| 每轮深审 | — | B站 2 条 / 抖音 1 条（可配），每条 3 帧 |
| 花费 | 0 | 画面 ≈ ¥0.001/帧，ASR 按硅基计价 |

**她怎么「看」（B站）**：`bili_frames` 拿故事板帧（免费、不下整条视频）→ 留影视觉模型逐帧描述。

**她怎么「听」（B站，a+b 组合）**：

```
有字幕 → 直接读（免费、秒出）
   ↓ 没有
yt-dlp -f bestaudio 只拉音轨（不下整条视频）→ 留影 SenseVoice 转文字
   ↓ 还是不行
如实写「没听到」
```

**抖音**：分享页/视频页都不给播放直链（实测空壳、跳 /chat），只能走签名详情接口——
`dsh-video-scroll/douyin/tools/dy-play-url.mjs`：`dy-signer.mjs` 出 a_bogus →
`/aweme/v1/web/aweme/detail/` → `video.play_addr.url_list[0]` → 下载 → 留影 `describeVideo`（抽帧 + ASR 一步到位）。
>20 分钟的视频不下整条。

**降级一律如实说**：看不到就写「没看到画面」、听不到就写「没听到」，绝不编。

## 她自己决定写不写

日报不是"用她的口吻写"，是**她自己在看、自己决定写不写**：

- prompt 里不给语气样本（`conch.toneSamples` 默认 0）——注入了她就会模仿自己以前的样子，写出来是"像她的东西"；
- 配额说明是「最多记 N 条——**也可以一条都不记**」；
- 她觉得没什么可写，就输出 `（这轮没写）`：抖音轮返回 `skipped` 不落盘，B站轮比对今日条数没变就记一行 `她这轮没写`，都不算故障；
- 唯一硬要求是格式（`### <ID>` + 档位行），因为程序要靠它数配额——**这是程序的约束，不是对她的要求**。

## 她想刷就刷（agent 自由模式）

总览页的「她想刷就刷」卡：**自由模式开关**开着 = 她随时都能发起刷视频（无时间限制，峰谷窗不拦值班轮），
可选两道日限额：**每天最多几轮**、**每天花费上限 ¥**（设 0 = 不限）。限额对所有触发路径生效
（她的 video_run_round / 工作台按钮 / 计划任务），超限返回明确理由。
开关状态与今日用量（轮数/花费）在卡片上实时显示。

## 花费面板

大脑每次调用的 token 自动记进记忆库（token_usage 表，含任务分类）：工作台「花费」页看 **今日/本月/累计花费、按任务分类、14 天趋势、最近 50 笔明细**；价格表（¥/百万 tokens，按模型）可在页面上编辑，费用为估算（默认 input ¥4 / output ¥16 每百万，请按实际计费调整）。

## 供 QQ 智能体接入的两种方式

1. **stdio MCP**（DSH 现用）：cordis.patch.yml → mcp-ring → `snow-video-kit/src/ring-adapter.mjs`（统一入口，ring_* + video_*）；
2. **HTTP MCP**（任意远程/第三方智能体）：`POST http://127.0.0.1:8412/mcp`，令牌 = 工作台令牌（header `x-console-token` 或 `?token=`），无状态 JSON-RPC：initialize / tools/list / tools/call。

## 软件化

`install.bat` = 自检 + 桌面快捷方式 + 开机自启（后台无窗口）+ 立即启动；`uninstall.bat` = 停服务 + 撤自启（数据保留）。

## 隐私数据面（读一遍再上线）

- 记忆库 data/video-memory.db 存的是**观看历史**（平台/视频/判断/点评）——本机明文 SQLite；备份时与凭证同等对待；
- 环心留痕（ring_ingest）会把「今天挑了哪些视频」写进她的记忆（闲聊圈，speaker=user）——**她在 QQ 聊天里可能提及你的观看记录**，这是特性也是暴露面；不想让它发生：设环境变量 RING_INGEST_OFF=1（启动环境里）即可整体关闭；
- 日志不含 key/令牌（启动日志只打端口；历史日志已清）；
- key 只在 state/brain-key，工作台不回显；令牌在 state/console-token；
- 一切只监听 127.0.0.1，/mcp 与工作台都要令牌；/api/memory/query 只读、禁写。

## 安全与边界

- 工作台只监听 `127.0.0.1:8412`，令牌登录（`state/console-token`；桌面快捷方式带 `?token=` 自动登录）；
- 大脑 key 只存本机 `state/brain-key`，页面不回显；
- 默认**不自动发评论/私信**（douyin `autoSend:false`，B站白名单里没有发送类工具）；
- 整个工具包随 DSH 无关——只要 SnowLuma 的 Node 和家目录资产在，它就能跑。

## 已知边界

- **B站凭证**：`bili_credential.json` 目前缺失，两条补录路（都不依赖 DSH 面板）：
  `node tools/bili-login.mjs`（出二维码到 `state/bili-qrcode.png`，手机扫码**并点确认**）或
  `node tools/bili-cookie.mjs --cookie "SESSDATA=…; bili_jct=…; DedeUserID=…"`（先调 nav 验账号，验不过不写）；
- **声音是云端 ASR**：走留影配的硅基 SenseVoice，**音频片段会上传**；不想传就保持 `media.mode=fast`；
- **抖音深审**要签名器在（`~/.dsh/douyin-duty/signer/sdk`），`dy-signer` 会本地算 a_bogus，一次深审只发 1 个详情请求；
- 抖音 `autoSend`（自动发评论/分享）默认关，开了也只在后续版本接通；
- 值班计划窗口在 `config.json → schedule`（默认关）。

## 目录

```
snow-video-kit/
├── 启动工作台.bat / 后台启动.vbs / 停止工作台.bat
├── config.json           用户配置（snow 地址、brain、bili/douyin、schedule、conch、ring、media、web 端口）
├── state/                运行期私有数据（brain-key、console-token、conch-bridge-cache、round-*.json、kit.log）
├── tools/
│   ├── bili-login.mjs    扫码补 B站凭证（出码 + 轮询）
│   └── bili-cookie.mjs   用浏览器 Cookie 补凭证（先验账号再原子写盘）
└── src/
    ├── index.js          装配：Snow 守望器 + 工作台 +（可选）值班计划
    ├── config.js         配置/状态/路径解析
    ├── snow.mjs          QQ 在线守望器
    ├── conch-bridge.mjs  ★ 桥接她：海螺人设 + 环形的心记忆 + 可选语气样本
    ├── eyes.mjs          ★ 看/听：接留影的视觉与 ASR 模块
    ├── mcpclient.mjs     极简 stdio MCP 客户端（保留图片内容）
    ├── brain.mjs         OpenAI 兼容大脑（含工具循环、key 测试）
    ├── bili.mjs          B站引擎（值班轮 + 快捷查询 + look_deep）
    ├── douyin.mjs        抖音引擎（证据 + look_comments + look_deep + 日报）
    ├── rounds.mjs        轮编排（并发闸/进度/派发）
    ├── tools.mjs         她的 video_* 工具定义与执行
    ├── kit-mcp.mjs       stdio MCP server（挂给大脑用）
    ├── round-runner.mjs  独立进程跑一轮
    ├── check.js          自检（含海螺 / 环形的心 / 留影 / yt-dlp 四段）
    └── web/              工作台（全新设计）
```
