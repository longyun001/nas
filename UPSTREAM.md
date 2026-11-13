# Homepage 参考记录

本次参考官方 [Homepage v2.8.0](https://github.com/gethomepage/homepage/tree/v2.8.0)，固定提交为 `08a0c1df566464bfdb327f3fd8f1f5a058d56640`。查阅日期：2026-11-13。

| 上游代码 | 本项目采用的思路 |
|---|---|
| [services/item.jsx](https://github.com/gethomepage/homepage/blob/08a0c1df566464bfdb327f3fd8f1f5a058d56640/src/components/services/item.jsx) | 服务名称、说明、操作与状态分别呈现 |
| [services/group.jsx](https://github.com/gethomepage/homepage/blob/08a0c1df566464bfdb327f3fd8f1f5a058d56640/src/components/services/group.jsx) | 按服务分组，随屏幕宽度调整卡片列数 |
| [quicklaunch.jsx](https://github.com/gethomepage/homepage/blob/08a0c1df566464bfdb327f3fd8f1f5a058d56640/src/components/quicklaunch.jsx) | 快捷键搜索、名称优先和键盘选择 |
| [contexts/theme.jsx](https://github.com/gethomepage/homepage/blob/08a0c1df566464bfdb327f3fd8f1f5a058d56640/src/utils/contexts/theme.jsx) | 主题设置保存在浏览器，支持系统主题 |
| [services/site-monitor.jsx](https://github.com/gethomepage/homepage/blob/08a0c1df566464bfdb327f3fd8f1f5a058d56640/src/components/services/site-monitor.jsx) | 前端通过同源接口获取入口响应状态 |
| [api/siteMonitor.js](https://github.com/gethomepage/homepage/blob/08a0c1df566464bfdb327f3fd8f1f5a058d56640/src/pages/api/siteMonitor.js) | 检测目标来自固定配置，区分 HTTP 响应与业务健康 |

本项目使用 Nginx 静态导航架构，以原生 HTML、CSS 和 JavaScript 独立实现上述交互，没有引入 Homepage 的 Next.js/React 运行时，也没有复制上述文件的实现代码。图标为本项目内联 SVG，页面页脚保留上游链接。Homepage 的许可证见其 [LICENSE](https://github.com/gethomepage/homepage/blob/v2.8.0/LICENSE)。
