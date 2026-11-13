# 配置说明

程序优先加载本地 `config.local.mjs`，文件不存在时使用 `config.example.mjs`。更改后重新构建；配置有语法或校验错误时构建失败，不会静默退回示例。

## 构建配置

```js
export default {
  enableHealth: false,
  groups: ['效率工具', '搜索服务', '影音娱乐', '系统工具'],
  prefs: {
    theme: 'dark',
    network: 'auto',
    lanHost: '192.0.2.10',
    wanHost: 'nas.example.com',
    autoCheck: false
  },
  services: [
    {
      key: 'notes',
      name: '示例笔记',
      icon: 'chat',
      description: '替换成自己的笔记服务',
      port: 8081,
      group: '效率工具',
      tags: ['示例', '笔记'],
      favorite: true
    }
  ]
};
```

以上均为虚构示例。`lanHost` / `wanHost` 只填主机名或 IP，不含协议、路径和端口；IPv6 可加方括号。服务默认链接由内网主机和端口构成，固定检测同样使用该内网地址。

| 字段 | 说明 |
|---|---|
| `enableHealth` | 是否在生成的 Nginx 中开放固定 HTTP 检测，默认 `false` |
| `prefs.theme` | `dark`、`light` 或 `system` |
| `prefs.network` | `auto`、`lan` 或 `wan` |
| `prefs.autoCheck` | 页面可见时每 60 秒检查；另需服务端已启用检测 |
| `groups` | 默认分组，服务的 `group` 须在其中 |
| `services[].key` | 唯一的小写字母、数字、连字符标识；以字母开头，最多 40 字符 |
| `services[].port` | 1—65535 整数，仅 HTTP 根路径固定检测 |
| `services[].icon` | 内置图标名或在页面编辑时使用短文本/emoji |
| `containerName` | 可选显示及搜索元数据；不会连接 Docker Socket |

使用 SearXNG 时保留一个 `key: 'searxng'` 的服务，修改名称和端口即可。内置图标包括 `grid`、`chat`、`search`、`download`、`music`、`nas`、`globe` 等，完整清单见 `src/icons.mjs`。

## 浏览器设置与迁移

浏览器中编辑服务、分组、收藏、主题和访问方式会保存到当前来源的 localStorage。构建配置是新浏览器的初始值；已有浏览器配置不会在刷新时被新默认值覆盖。“补充常用入口”可以添加缺少的模板服务。

自动访问模式按当前页面主机名选择内外网；它不会试探哪个网络更快。内外网切换只改已识别的 NAS 直连主机，自定义反向代理域名保持原链接。浏览器的主机设置只影响跳转地址，**不会修改 Nginx 固定检测目标**；要更换检测目标需修改本地构建配置并重新部署。

旧版数据键 `nas-docker-dashboard` 与旧主题键保留；新版本写入 `nas-docker-dashboard-v3`。迁移保留原链接，不预设某款设备的旧端口纠错规则。导入前会额外保存当前本地配置，读取或存储失败时显示提示；主动清空的卡片列表不会被默认卡片覆盖。

## 可选 HTTP 检测

1. 在本地配置中设 `enableHealth: true`，填写部署服务器可访问的内网主机与端口。
2. 重新构建并部署 HTML、`deploy/default.conf` 和 `deploy/nav-health-common.conf`。
3. 在页面手动“检查入口”，或启用自动检查。

浏览器只向同源 `/api/health/<固定服务键>` 发 HEAD；Nginx 对固定根路径发无凭据 GET，不透传浏览器 Cookie、Authorization、查询参数或请求体，不返回上游正文。未知目标没有代理路由。重定向以无正文响应保留原始上游状态；未取得上游耗时时不显示耗时。

固定检测不支持卡片的任意 URL、登录会话、路径参数或 HTTPS 上游。自定义 HTTPS 反代卡片仍可作为普通导航使用。检测接口有速率、超时和前端并发限制，但不会代替反向代理访问控制。

本机开发检测还需设置 `NAV_ENABLE_CHECKS=1` 再启动 `server.mjs`。该模式明确显示“本机内网 HTTP 检测”；它与生产 Nginx 的检测来源不同。
