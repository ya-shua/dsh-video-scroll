# snow-video-kit ｜ 刷视频工具包（依附 SnowLuma · 她自己能用 · 自带 key 大脑）

> 📐 完整设计文档：[docs/设计-2026-11-03.md](docs/设计-2026-11-03.md)（架构/决策/数据流/接口/安全/回退）

> 一个依附 **SnowLuma** 运行的刷视频工具包：**QQ 连接成功 → 工具包就绪**；
> 把刷B站/刷抖音的能力变成 **她（AI 角色）自己能调用的 `video_*` 工具**；
> 值班轮的「大脑」用你在页面里填的 **OpenAI 兼容 key**（baseURL+key+model），**彻底脱离 DSH**；
> 带一个**全新深色设计**的浅色「工作台」页面（非 DSH 面板样式）。

## 它由什么组成

| 组件 | 说明 |
|---|---|
| **Snow 守望器** | 从 `SnowLuma/config/onebot_*.json` 发现端点与 token，周期探测 `get_login_info`；**QQ 在线才放行值班轮**，掉线自动待命 |
| **B站引擎** | spawn `bili-duty/mcp_server.py`（stdio MCP，`BILI_MCP_TOOLS` 白名单），大脑多轮工具循环：荐视频 → 读字幕/评论 → `duty_report_append` 落盘；配额驱动层强制 |
| **抖音引擎** | `forward-pick.py` 纯代码采集证据 → 大脑一次判断输出 `### <视频ID>` 日报 → 宿主写 `out/<日期>.md` 与 `seen.md` |
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

用 SnowLuma 自带 Node（`D:\AI\QQ大肥鱼\SnowLuma\node.exe`，v24），机器上不用装全局 Node。

## 让「她」能调用（QQ 内置工具包）

把下面一段加进 DSH profile 的 `cordis.patch.yml`（她现在的大脑在 DSH 里；将来换 ring-bridge 大脑时，同一份 stdio 命令原样可挂）：

```yaml
- insert:
    - id: mcp-video-kit
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: video-kit
        transport: stdio
        command: D:\AI\QQ大肥鱼\SnowLuma\node.exe
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

## 环形的心插件适配（统一入口）

`src/ring-adapter.mjs` 把两套工具聚合成**一个 MCP 入口**：ring_*（原样代理 `环形的心/mcp/server.mjs`，记忆逻辑不变、上游更新自动跟上）+ video_*（刷视频）。DSH 注册已切换到它（mcp-ring → ring-adapter，mcp-video-kit 并入移除）——「她」的工具列表就是一套完整的「环形的心 · 刷视频」插件（实测 10 个工具聚合，ring_overview 返回真实记忆）。环形的心那半边不可用时 video_* 不受影响（降级设计）；也可用 `config.json → ring.mcpServer` 指定别的记忆服务。

## 花费面板

大脑每次调用的 token 自动记进记忆库（token_usage 表，含任务分类）：工作台「花费」页看 **今日/本月/累计花费、按任务分类、14 天趋势、最近 50 笔明细**；价格表（¥/百万 tokens，按模型）可在页面上编辑，费用为估算（默认 input ¥4 / output ¥16 每百万，请按实际计费调整）。

## 供 QQ 智能体接入的两种方式

1. **stdio MCP**（DSH 现用）：cordis.patch.yml → mcp-ring → `snow-video-kit/src/ring-adapter.mjs`（统一入口，ring_* + video_*）；
2. **HTTP MCP**（任意远程/第三方智能体）：`POST http://127.0.0.1:8412/mcp`，令牌 = 工作台令牌（header `x-console-token` 或 `?token=`），无状态 JSON-RPC：initialize / tools/list / tools/call。

## 软件化

`install.bat` = 自检 + 桌面快捷方式 + 开机自启（后台无窗口）+ 立即启动；`uninstall.bat` = 停服务 + 撤自启（数据保留）。

## 安全与边界

- 工作台只监听 `127.0.0.1:8412`，令牌登录（`state/console-token`；桌面快捷方式带 `?token=` 自动登录）；
- 大脑 key 只存本机 `state/brain-key`，页面不回显；
- 默认**不自动发评论/私信**（douyin `autoSend:false`，B站白名单里没有发送类工具）；
- 整个工具包随 DSH 无关——只要 SnowLuma 的 Node 和家目录资产在，它就能跑。

## 已知边界（v0.1）

- B站值班轮需要先扫码：`bili_credential.json` 目前缺失（综合面板或 DSH 面板扫码即可）；
- 抖音 `autoSend`（自动发评论/分享）默认关，开了也只在后续版本接通；
- ASR 本地转写未接（`transcribe` 相关 venv 未装）；
- 值班计划窗口在 `config.json → schedule`（默认关）。

## 目录

```
snow-video-kit/
├── 启动工作台.bat / 后台启动.vbs / 停止工作台.bat
├── config.json           用户配置（snow 地址、brain、bili/douyin、schedule、web 端口）
├── state/                运行期私有数据（key、console-token、round-*.json、kit.log）
└── src/
    ├── index.js          装配：Snow 守望器 + 工作台 +（可选）值班计划
    ├── config.js         配置/状态/路径解析
    ├── snow.mjs          QQ 在线守望器
    ├── mcpclient.mjs     极简 stdio MCP 客户端
    ├── brain.mjs         OpenAI 兼容大脑（含工具循环）
    ├── bili.mjs          B站引擎（值班轮 + 快捷查询）
    ├── douyin.mjs        抖音引擎（证据 + 日报）
    ├── rounds.mjs        轮编排（并发闸/进度/派发）
    ├── tools.mjs         她的 video_* 工具定义与执行
    ├── kit-mcp.mjs       stdio MCP server（挂给大脑用）
    ├── round-runner.mjs  独立进程跑一轮
    ├── check.js          自检
    └── web/              工作台（全新设计）
```
