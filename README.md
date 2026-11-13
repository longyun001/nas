# NAS Navigation · NAS 导航

一个轻量的 NAS 服务导航页，支持分组、收藏、快捷搜索、明暗主题和可选的 HTTP 入口检测。构建后是单个 HTML 文件，可放到已有 Web 服务器，也可用 Docker 部署。

界面与交互参考 [Homepage v2.8.0](https://github.com/gethomepage/homepage/tree/v2.8.0)，使用原生 HTML、CSS、JavaScript 独立实现；代码参考记录见 [UPSTREAM.md](UPSTREAM.md)。

**本仓库只包含程序代码、文档和虚构示例。** 示例地址使用文档保留 IP `192.0.2.10` 和域名 `nas.example.com`，不指向实际设备。仓库不包含个人服务清单、浏览器导出、备份、现场报告、截图、账号或凭据。HTTP 检测默认关闭。

## 功能

- 自适应服务卡片、分组筛选、快捷收藏、多入口链接。
- 名称、说明、标签搜索；`Ctrl+K` / `/` 聚焦，方向键选择，Enter 打开；可接入自己的 SearXNG。
- 深色、浅色、跟随系统主题；内网、外网和自动链接模式。
- 浏览器本地保存配置，支持新增、编辑、删除撤销以及 JSON 导入导出。
- 旧版 `nas-docker-dashboard` 卡片结构兼容迁移，保留原链接和旧存储键。
- 可选的固定目标同源 HTTP 检测，区分入口响应、需要登录、访问受限和响应异常。
- 无前端第三方依赖、CDN、外部字体或遥测脚本。

## 本地快速预览

需要 Node.js 22 或更新版本，无须安装依赖包：

```sh
git clone https://github.com/longyun001/nas.git
cd nas
node build.mjs
node --test tests/*.test.mjs
node server.mjs
```

打开 `http://127.0.0.1:8877/`。默认展示三个虚构服务，点击前请替换成自己的地址。浏览器中的服务卡片和偏好按访问来源保存在 localStorage；不同域名、端口、设备之间通过手动导出/导入迁移。

## 配置自己的服务

复制示例为本地配置；该文件已被 Git 忽略。

```sh
cp config.example.mjs config.local.mjs
```

PowerShell 可使用：

```powershell
Copy-Item config.example.mjs config.local.mjs
```

修改 `config.local.mjs` 中的内网主机、外网主机、分组和服务端口，再运行 `node build.mjs`。具体字段、浏览器设置和检测开关见 [配置说明](docs/CONFIGURATION.md)。密码、API Key 和带凭据的 URL 不应写入配置。

构建会将主机及默认服务写入 HTML 和 Nginx 配置，所以 `config.local.mjs`、`dist/`、`deploy/` 和个人导出文件都不属于本仓库的公开发布内容。

## 部署

使用 Docker Compose：

```sh
docker compose up -d --build
```

默认只绑定本机 `http://127.0.0.1:8880/`。局域网访问、已有 Nginx 挂载、更新和回滚步骤见 [部署说明](docs/DEPLOYMENT.md)。Docker 镜像包含构建时的本地配置，应保存在自己的部署环境中。

仅需要静态导航时，部署 `dist/index.html` 即可。入口检测需使用生成的 Nginx 配置并显式开启，普通静态托管不会提供该接口。

## 状态的含义

| 显示 | 含义 |
|---|---|
| 入口响应 | 收到 2xx 或 3xx HTTP 响应 |
| 需要登录 | 收到 HTTP 401 |
| 访问受限 | 收到 HTTP 403 |
| 响应异常 | 收到 5xx |
| 检测失败 / 未检测 | 没有取得可验证的结果 |

检测只表示部署服务器到固定内网 HTTP 入口的响应，不能证明容器或业务健康，也不代表独立外网可达。自定义地址未匹配固定目标时不会套用其他服务的状态。

## 目录与检查

```text
config.example.mjs       虚构示例配置
config.mjs               本地配置加载及字段校验
src/                     页面、样式、图标、交互与核心逻辑
build.mjs                单文件构建与固定 Nginx 检测配置生成
server.mjs               仅监听回环地址的开发预览
tests/                   核心行为、配置与构建测试
docs/                    配置、部署和隐私说明
release-files.json       公开发布文件白名单
scripts/check-public.mjs 发布前检查
```

```sh
node build.mjs
node --test tests/*.test.mjs
node scripts/check-public.mjs
```

测试覆盖旧数据保留、URL 安全、特殊字符搜索、内外网和 IPv6 链接、检测匹配、配置校验、CSP 哈希与单文件构建。尚未把 Docker 构建或真实服务业务测试列为自动测试结果。

发布与隐私边界见 [隐私说明](docs/PRIVACY.md)。上游代码和许可证链接见 [参考记录](UPSTREAM.md)。
