// Homepage v2.8.0 is the architectural reference. See ../UPSTREAM.md.
export const STORAGE_KEY = 'nas-docker-dashboard-v3';
export const LEGACY_KEY = 'nas-docker-dashboard';
export const THEME_KEY = 'nas-docker-dashboard-theme';
import config from '../config.mjs';
export const GROUPS = config.groups;
export const DEFAULT_PREFS = config.prefs;
export const SERVICE_DEFS = config.services;
const text = (value, limit = 200) => typeof value === 'string' ? value.slice(0, limit).trim() : '';
const enumValue = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
export function safeUrl(value) {
  if (typeof value !== 'string' || value.length > 4096 || /[\u0000-\u001f\u007f]/u.test(value)) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function safeHost(value, fallback) {
  const candidate = text(value, 253);
  if (!candidate || /[\s/?#@\\]/u.test(candidate)) return fallback;
  try {
    const formatted = candidate.includes(':') && !candidate.startsWith('[') ? `[${candidate}]` : candidate;
    const url = new URL(`http://${formatted}`);
    if (url.port || url.username || url.password) return fallback;
    return url.hostname;
  } catch { return fallback; }
}
export function normalizePrefs(value = {}) {
  return {
    theme: enumValue(value.theme, ['light', 'dark', 'system'], DEFAULT_PREFS.theme),
    network: enumValue(value.network, ['auto', 'lan', 'wan'], 'auto'),
    lanHost: safeHost(value.lanHost, DEFAULT_PREFS.lanHost),
    wanHost: safeHost(value.wanHost, DEFAULT_PREFS.wanHost),
    autoCheck: typeof value.autoCheck === 'boolean' ? value.autoCheck : DEFAULT_PREFS.autoCheck
  };
}
export function identifyService(card) {
  const byContainer = SERVICE_DEFS.find(s => s.containerName && s.containerName === card.containerName);
  if (byContainer) return byContainer;
  const lower = text(card.name).toLowerCase();
  return SERVICE_DEFS.find(s => s.key === card.key || s.name.toLowerCase() === lower) ?? null;
}
export function defaultCards(now = new Date().toISOString()) {
  return SERVICE_DEFS.map(def => ({ ...def, id: def.key, links: [{ label: '打开服务', url: `http://${DEFAULT_PREFS.lanHost}:${def.port}/` }], createdAt: now, updatedAt: now }));
}
export function normalizeCard(input, index = 0) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !text(input.name, 80)) throw new Error(`第 ${index + 1} 张卡片缺少有效名称`);
  const known = identifyService(input);
  const links = (Array.isArray(input.links) ? input.links : []).slice(0, 10).map(link => {
    const url = safeUrl(link?.url);
    if (!url) throw new Error(`“${text(input.name, 80)}”含有无效链接，仅支持不含账号密码的 HTTP / HTTPS 地址`);
    return { label: text(link.label, 40) || '打开服务', url };
  });
  const tags = [...new Set((Array.isArray(input.tags) ? input.tags : []).map(t => text(t, 24)).filter(Boolean))].slice(0, 12);
  const safeId = text(input.id, 100).replace(/[^A-Za-z0-9_-]/gu, '') || `card-${index}`;
  const firstUrl = links[0] && new URL(links[0].url);
  return {
    id: safeId, key: known?.key ?? '', name: text(input.name, 80),
    icon: text(input.icon, 24) || known?.icon || 'grid',
    description: text(input.description, 240), containerName: text(input.containerName, 120),
    port: firstUrl ? Number(firstUrl.port || (firstUrl.protocol === 'https:' ? 443 : 80)) : 0,
    internalPort: Math.max(0, Math.min(65535, Number(input.internalPort) || 0)),
    group: text(input.group, 40) || known?.group || (tags.includes('AI') ? GROUPS[0] : '我的服务'),
    tags, links, favorite: input.favorite === true,
    createdAt: text(input.createdAt, 40), updatedAt: text(input.updatedAt, 40), lastOpenedAt: text(input.lastOpenedAt, 40)
    // Deliberately discard legacy static running/stopped values: they were not observations.
  };
}
export function normalizeData(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.cards) || input.cards.length > 500) throw new Error('请选择包含 cards 数组的导航备份，最多支持 500 张卡片');
  const used = new Set();
  const cards = input.cards.map((card, i) => {
    const normalized = normalizeCard(card, i);
    if (used.has(normalized.id)) normalized.id = `${normalized.id}-${i}`;
    used.add(normalized.id);
    return normalized;
  });
  return { version: 3, prefs: normalizePrefs(input.prefs ?? { theme: input.theme }), cards, updatedAt: new Date().toISOString() };
}
export function newData() {
  return { version: 3, prefs: { ...DEFAULT_PREFS }, cards: defaultCards(), updatedAt: new Date().toISOString() };
}
export function readState(storage) {
  try {
    const current = storage.getItem(STORAGE_KEY);
    if (current !== null) return { data: normalizeData(JSON.parse(current)), migrated: false };
    const legacy = storage.getItem(LEGACY_KEY);
    if (legacy !== null) {
      const data = normalizeData(JSON.parse(legacy), { legacy: true });
      data.prefs.theme = enumValue(storage.getItem(THEME_KEY), ['dark', 'light', 'system'], data.prefs.theme);
      return { data, migrated: true };
    }
    const data = newData();
    data.prefs.theme = enumValue(storage.getItem(THEME_KEY), ['dark', 'light', 'system'], 'dark');
    return { data, migrated: false };
  } catch {
    return { data: newData(), migrated: false, storageError: true };
  }
}
export function effectiveNetwork(prefs, pageHostname) {
  if (prefs.network !== 'auto') return prefs.network;
  const host = String(pageHostname).toLowerCase();
  return ['localhost', '127.0.0.1', '[::1]', prefs.lanHost].includes(host) ? 'lan' : 'wan';
}
export function effectiveUrl(value, prefs, pageHostname) {
  const safe = safeUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  const hosts = new Set([DEFAULT_PREFS.lanHost, DEFAULT_PREFS.wanHost, prefs.lanHost, prefs.wanHost]);
  if (hosts.has(url.hostname)) url.hostname = effectiveNetwork(prefs, pageHostname) === 'lan' ? prefs.lanHost : prefs.wanHost;
  return url.href;
}
export function monitorKey(card) {
  const known = identifyService(card);
  if (!known || !card.links[0]) return null;
  const url = new URL(card.links[0].url);
  return [DEFAULT_PREFS.lanHost, DEFAULT_PREFS.wanHost].includes(url.hostname) && url.protocol === 'http:' && url.port === String(known.port) && url.pathname === '/' && !url.search && !url.hash ? known.key : null;
}
export function filterCards(cards, query = '', group = 'all') {
  const q = query.toLocaleLowerCase().trim();
  return cards.filter(card => (group === 'all' || group === 'favorites' && card.favorite || card.group === group) && (!q || [card.name, card.description, card.containerName, card.group, ...card.tags].join(' ').toLocaleLowerCase().includes(q))).sort((a, b) => {
    if (!q) return 0;
    return Number(b.name.toLocaleLowerCase().includes(q)) - Number(a.name.toLocaleLowerCase().includes(q));
  });
}
export function classifyHttp(value) {
  const code = Number(value);
  if (!Number.isInteger(code) || code < 100 || code > 599) return { label: '检测失败', tone: 'muted' };
  if (code === 401) return { label: '需要登录', tone: 'good' };
  if (code === 403) return { label: '访问受限', tone: 'warning' };
  if (code >= 200 && code < 400) return { label: '入口响应', tone: 'good' };
  if (code === 404) return { label: '未找到入口', tone: 'warning' };
  if (code >= 500) return { label: '响应异常', tone: 'warning' };
  return { label: `HTTP ${code}`, tone: 'muted' };
}
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/gu, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
