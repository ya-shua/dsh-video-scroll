# snow-video-kit v0.3.0

依附 SnowLuma 运行的 QQ 智能体刷视频工具包（脱离 DSH）。

## 亮点
- Snow 守望器：QQ 连接成功才放行值班轮，掉线自动待命
- 大脑：OpenAI 兼容 key（baseURL/key/model 自填），值班轮判断与日报全走它
- 抖音轮实测全链路：采集 12 条证据 → 判断 → 日报落盘（34 秒）
- 跨平台记忆库（SQLite，抖音/B站互通，历史日报已回填）
- 她的 video_* 六工具（stdio MCP + HTTP MCP）
- 工作台 8412：总览 / 综合面板 / 大脑 / 记忆库 / 花费 / 她的工具 / 日志
- 花费面板：token 记账 + 价格表（估算）
- 环形的心适配器：ring_* + video_* 一个 MCP 入口（10 工具聚合实测）

## 安装
见 README「安装」节（install.bat 一键安装 + 开机自启）。

## 校验
tar.gz 由 git archive 生成：`git archive --format=tar.gz -o <文件> v0.3.0`
