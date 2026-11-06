# NOTICE / 第三方组件说明

本仓库（刷视频插件整合包）以 **MIT** 协议发布。其中包含了以下第三方项目的代码或衍生内容，它们各自保留原有的许可证与版权声明：

| 组件 | 位置 | 许可证 |
|---|---|---|
| dsh-bili-scroll（刷B站，上游 c1overzz/dsh-bili-scroll） | `dsh-video-scroll/bili/` | MIT（见 `dsh-video-scroll/bili/LICENSE` 与 `NOTICE.md`） |
| bilibili-mcp（B站 MCP 基座，AGI_Ananas） | `dsh-video-scroll/bili/vendor/bilibili-mcp/` | MIT（见同目录 `LICENSE` / `README.md`） |
| dsh-douyin-scroll（刷抖音，上游 NEWJO123/dsh-douyin-scroll） | `dsh-video-scroll/douyin/` | 见 `dsh-video-scroll/douyin/LICENSE` |
| React / React DOM（面板运行时） | `dsh-video-scroll/console/vendor/` | MIT（Meta Platforms） |
| SnowLuma（QQ 网关，独立程序，不在本仓库内） | 外部依赖 | — |

本仓库对以上上游项目所做的改动（合并挂载、面板改造、本地化补丁等）同样按 MIT 开放。
对各上游项目，请以其原许可证为准；如需单独使用上游代码，请保留其原始 LICENSE/NOTICE 文件。
