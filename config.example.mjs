// Documentation-only examples. Copy to config.local.mjs and edit locally.
// Never put passwords, API keys, tokens or URL credentials in this file.
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
    { key: 'notes', name: '示例笔记', icon: 'chat', description: '替换为你自己的笔记服务', port: 8081, group: '效率工具', tags: ['示例', '笔记'], favorite: true },
    { key: 'searxng', name: '示例搜索', icon: 'search', description: '替换为你自己的 SearXNG', port: 8080, group: '搜索服务', tags: ['示例', '搜索'], favorite: true },
    { key: 'dashboard', name: '示例导航', icon: 'grid', description: '替换为你自己的导航页地址', port: 8880, group: '系统工具', tags: ['示例', '导航'], favorite: true }
  ]
};
