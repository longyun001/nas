import { STORAGE_KEY, LEGACY_KEY, GROUPS, DEFAULT_PREFS, defaultCards, normalizeCard, normalizeData, normalizePrefs, readState, effectiveNetwork, effectiveUrl, filterCards, classifyHttp, escapeHtml, monitorKey, safeHost, safeUrl } from './core.mjs';
import { icon, hasIcon } from './icons.mjs';
const $ = id => document.getElementById(id);
const browserStorage = (() => { try { return window.localStorage; } catch { return { getItem() { throw new Error('storage unavailable'); }, setItem() { throw new Error('storage unavailable'); } }; } })();
const initial = readState(browserStorage);
let data = initial.data;
let storageLocked = Boolean(initial.storageError);
let query = '', activeGroup = 'all', selectedIndex = -1;
let health = new Map(), checking = false, checker = null, lastChecked = null, checkSource = '';
let confirmCallback = null, toastTimer, undoCallback = null;
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
const colorFor = card => ['violet', 'cyan', 'amber', 'mint'][GROUPS.indexOf(card.group)] || 'cyan';
function fillIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
function showToast(message, undo = null) {
  clearTimeout(toastTimer); $('toastText').textContent = message; $('toast').hidden = false;
  undoCallback = undo; $('toastUndo').hidden = !undo;
  toastTimer = setTimeout(() => { $('toast').hidden = true; undoCallback = null; }, undo ? 10000 : 6500);
}
function persist() {
  data.updatedAt = new Date().toISOString();
  try {
    if (storageLocked) throw new Error('preserve unreadable storage');
    browserStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch { showToast('当前改动仅在本次打开期间生效，请先导出配置备份。'); return false; }
}
function applyTheme() {
  const theme = data.prefs.theme === 'system' ? (systemTheme.matches ? 'dark' : 'light') : data.prefs.theme;
  document.documentElement.dataset.theme = theme;
  $('themeToggle').innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
  $('themeToggle').setAttribute('aria-label', theme === 'dark' ? '切换为浅色主题' : '切换为深色主题');
}
function updateClock() {
  const now = new Date();
  $('clockTime').textContent = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  $('clockTime').dateTime = now.toISOString();
  $('clockDate').textContent = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
  const hour = now.getHours();
  const greeting = hour < 6 ? '夜深了，慢慢来' : hour < 11 ? '早上好，欢迎回来' : hour < 14 ? '中午好，欢迎回来' : hour < 18 ? '下午好，欢迎回来' : '晚上好，欢迎回来';
  $('greeting').innerHTML = `${greeting}<span class="greeting-dot">.</span>`;
}
function resolvedUrl(link) { return effectiveUrl(link.url, data.prefs, location.hostname); }
function serviceIcon(card) { return `<span class="service-icon ${colorFor(card)}">${hasIcon(card.icon) ? icon(card.icon) : escapeHtml(card.icon)}</span>`; }
function statusFor(card) {
  const key = monitorKey(card);
  if (!key) return { label: '未配置检测', tone: 'muted', detail: '此卡片的链接不在固定检测清单中。可正常打开，但不显示其他地址的检测结果。' };
  const result = health.get(key);
  if (!result) return { label: checking ? '检测中' : '未检测', tone: 'muted', detail: '还没有此服务的有效 HTTP 检测记录。' };
  if (result.error) return { label: '检测失败', tone: 'muted', detail: result.error };
  return { ...classifyHttp(result.code), detail: `HTTP ${result.code}${Number.isFinite(result.ms) ? ` · ${Math.round(result.ms)} ms` : ''}` };
}
function renderCard(card) {
  const mainUrl = card.links[0] && resolvedUrl(card.links[0]);
  const url = mainUrl && new URL(mainUrl);
  const state = statusFor(card);
  const label = url ? `:${url.port || (url.protocol === 'https:' ? '443' : '80')}` : '尚未设置链接';
  const openTag = mainUrl ? 'a' : 'div';
  const linkProps = mainUrl ? ` href="${escapeHtml(mainUrl)}" target="_blank" rel="noopener noreferrer" data-open="${escapeHtml(card.id)}"` : '';
  return `<article class="service-card" data-card-id="${escapeHtml(card.id)}">
    <${openTag} class="card-main"${linkProps}>${serviceIcon(card)}<div class="card-copy"><h3>${escapeHtml(card.name)}</h3><p>${escapeHtml(card.description || card.tags.join(' · ') || '自定义服务入口')}</p></div></${openTag}>
    <div class="card-actions"><button class="icon-button ${card.favorite ? 'starred' : ''}" data-action="favorite" data-id="${escapeHtml(card.id)}" aria-label="${card.favorite ? '取消收藏' : '收藏'} ${escapeHtml(card.name)}" aria-pressed="${card.favorite}">${icon('star')}</button><button class="icon-button edit-card" data-action="edit" data-id="${escapeHtml(card.id)}" aria-label="编辑 ${escapeHtml(card.name)}">${icon('edit')}</button></div>
    ${card.links.length > 1 ? `<div class="extra-links">${card.links.slice(1).map(link => `<a href="${escapeHtml(resolvedUrl(link))}" target="_blank" rel="noopener noreferrer" data-open="${escapeHtml(card.id)}">${escapeHtml(link.label)} ↗</a>`).join('')}</div>` : ''}
    <div class="card-bottom"><span class="card-port" title="${escapeHtml(mainUrl || '')}">${icon('link')}${escapeHtml(label)}${card.tags[0] ? ` · ${escapeHtml(card.tags[0])}` : ''}</span><button class="status-badge ${state.tone}" data-action="status" data-id="${escapeHtml(card.id)}" aria-label="${escapeHtml(card.name)}：${escapeHtml(state.label)}。查看检测详情" title="${escapeHtml(state.detail)}"><span class="tiny-dot"></span>${state.label}</button></div>
  </article>`;
}
function render() {
  const groups = [...new Set(data.cards.map(c => c.group))];
  const orderedGroups = [...GROUPS.filter(g => groups.includes(g)), ...groups.filter(g => !GROUPS.includes(g))];
  $('serviceCount').innerHTML = `${data.cards.length}<span>个</span>`;
  $('groupCount').innerHTML = `${groups.length}<span>组</span>`;
  const favorites = data.cards.filter(c => c.favorite);
  $('favoriteCount').innerHTML = `${favorites.length}<span>个</span>`;
  const network = effectiveNetwork(data.prefs, location.hostname);
  $('networkLabel').textContent = network === 'lan' ? '内网直连' : '外网入口';
  $('modeLabel').textContent = data.prefs.network === 'auto' ? '自动' : '手动';
  document.querySelectorAll('[data-network]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.network === data.prefs.network)));
  $('favoritesGrid').innerHTML = favorites.filter(c => c.links[0]).slice(0, 6).map(card => `<a class="favorite-card" href="${escapeHtml(resolvedUrl(card.links[0]))}" target="_blank" rel="noopener noreferrer" data-open="${escapeHtml(card.id)}">${serviceIcon(card)}<span class="favorite-copy"><strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(card.description || card.group)}</small></span>${icon('arrow')}</a>`).join('');
  $('favoriteSection').hidden = !favorites.some(c => c.links[0]) || Boolean(query) || activeGroup !== 'all';
  const tabs = [['all', '全部服务', data.cards.length], ['favorites', '已收藏', favorites.length], ...orderedGroups.map(g => [g, g, data.cards.filter(c => c.group === g).length])];
  $('groupTabs').innerHTML = tabs.map(([value, name, count]) => `<button type="button" data-group="${escapeHtml(value)}" class="${activeGroup === value ? 'active' : ''}" aria-current="${activeGroup === value ? 'true' : 'false'}">${escapeHtml(name)}<span class="tab-count">${count}</span></button>`).join('');
  const visible = filterCards(data.cards, query, activeGroup);
  $('visibleCount').textContent = String(visible.length);
  $('emptyState').hidden = visible.length !== 0;
  $('serviceGroups').innerHTML = (query ? ['搜索结果'] : orderedGroups).map(group => {
    const cards = query ? visible : visible.filter(c => c.group === group);
    return cards.length ? `<section class="service-group"><h3 class="group-heading">${icon('layers')}<span>${escapeHtml(group)}</span><span>${cards.length}</span></h3><div class="service-grid">${cards.map(renderCard).join('')}</div></section>` : '';
  }).join('');
  $('groupOptions').innerHTML = [...new Set([...GROUPS, ...groups])].map(g => `<option value="${escapeHtml(g)}"></option>`).join('');
  updateCheckCaption();
  updateKeyboardSelection();
}
function updateCheckCaption() {
  const caption = $('checkCaption').children[1];
  if (checking) caption.textContent = '正在检查 HTTP 入口…';
  else if (lastChecked) {
    const responded = [...health.values()].filter(r => !r.error && r.code >= 100 && r.code < 500).length;
    caption.textContent = `${checkSource === 'nas' ? 'NAS 内网' : '本机内网'} HTTP 检测 · ${responded}/${health.size} 个入口响应 · ${lastChecked.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`;
  } else caption.textContent = checker === false ? '当前部署未启用入口检测' : '入口尚未检测';
  $('checkButton').disabled = checking;
  $('checkButton').querySelector('.icon')?.classList.toggle('spinning', checking);
}
function info(title, message) { $('infoTitle').textContent = title; $('infoContent').textContent = message; $('infoDialog').showModal(); }
function confirmAction(title, message, callback, danger = false) {
  $('confirmTitle').textContent = title; $('confirmText').textContent = message;
  $('confirmAction').className = danger ? 'danger-button' : 'primary-button';
  $('confirmAction').textContent = danger ? '确认删除' : '确认';
  confirmCallback = callback; $('confirmDialog').showModal();
}
function showServiceEditor(id = null) {
  const card = data.cards.find(c => c.id === id);
  $('serviceForm').reset(); $('editId').value = card?.id || '';
  $('serviceDialogTitle').textContent = card ? '编辑服务' : '添加服务';
  $('fName').value = card?.name || ''; $('fDescription').value = card?.description || '';
  $('fIcon').value = card?.icon || 'grid'; $('fGroup').value = card?.group || GROUPS[3] || GROUPS[0];
  $('fLinks').value = card?.links.map(l => `${l.label} | ${l.url}`).join('\n') || '';
  $('fTags').value = card?.tags.join(', ') || ''; $('fContainer').value = card?.containerName || '';
  $('fFavorite').checked = card?.favorite || false;
  $('deleteButton').hidden = !card; $('serviceError').hidden = true;
  $('serviceDialog').showModal();
}
function openSettings() {
  $('sTheme').value = data.prefs.theme; $('sLanHost').value = data.prefs.lanHost;
  $('sWanHost').value = data.prefs.wanHost; $('sAutoCheck').checked = data.prefs.autoCheck;
  $('settingsError').hidden = true; $('settingsDialog').showModal();
}
async function checkHealth(manual = false) {
  if (checking || document.hidden) return;
  checking = true; render();
  try {
    if (!checker) {
      const res = await fetch('/api/health', { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(5000) });
      const cap = res.ok && await res.json();
      if (!cap || cap.version !== 1 || !Array.isArray(cap.keys) || !['nas', 'pc'].includes(cap.source)) throw new Error('checker unavailable');
      checker = cap; checkSource = cap.source;
    }
    const keys = [...new Set(data.cards.map(monitorKey).filter(key => key && checker.keys.includes(key)))];
    const queue = [...keys];
    await Promise.all(Array.from({ length: Math.min(3, keys.length) }, async () => {
      while (queue.length) {
        const key = queue.shift();
        try {
          const response = await fetch(`/api/health/${encodeURIComponent(key)}`, { method: 'HEAD', credentials: 'omit', cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(8000) });
          const raw = response.headers.get('X-NAS-Upstream-Status');
          if (!/^\d{3}$/u.test(raw || '') || response.headers.get('X-NAS-Check-From') !== checkSource) throw new Error('未取得可验证的 HTTP 状态');
          const seconds = Number(response.headers.get('X-NAS-Upstream-Time'));
          health.set(key, { code: Number(raw), ms: Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null, at: new Date().toISOString() });
        } catch { health.set(key, { error: '探测请求未完成，不能据此认定服务已停止。', at: new Date().toISOString() }); }
      }
    }));
    if (keys.length) lastChecked = new Date();
    else if (manual) showToast('当前卡片没有匹配固定检测清单的入口。');
  } catch {
    checker = false;
    if (manual) showToast('当前部署未启用同源入口检测；服务卡片保留“未检测”。');
  } finally { checking = false; render(); }
}
function searchWeb() {
  if (!query.trim()) { $('searchInput').focus(); showToast('先输入要搜索的内容。'); return; }
  const card = data.cards.find(c => c.key === 'searxng');
  if (!card?.links[0]) { showToast('请先添加标识为 searxng 的搜索服务。'); return; }
  const base = card.links[0].url;
  const target = new URL(effectiveUrl(base, data.prefs, location.hostname));
  target.pathname = `${target.pathname.replace(/\/$/u, '')}/search`;
  target.search = ''; target.hash = ''; target.searchParams.set('q', query.trim());
  window.open(target.href, '_blank', 'noopener,noreferrer');
}
function updateKeyboardSelection() {
  document.querySelectorAll('.keyboard-selected').forEach(el => el.classList.remove('keyboard-selected'));
  const visible = filterCards(data.cards, query, activeGroup);
  if (selectedIndex >= visible.length) selectedIndex = visible.length - 1;
  const card = selectedIndex >= 0 && visible[selectedIndex];
  if (card) document.querySelector(`[data-card-id="${card.id}"]`)?.classList.add('keyboard-selected');
}
document.addEventListener('click', event => {
  const close = event.target.closest('[data-close]');
  if (close) { $(close.dataset.close).close(); return; }
  const network = event.target.closest('[data-network]');
  if (network) { data.prefs.network = network.dataset.network; persist(); render(); return; }
  const tab = event.target.closest('[data-group]');
  if (tab) { activeGroup = tab.dataset.group; selectedIndex = -1; render(); return; }
  const open = event.target.closest('[data-open]');
  if (open) { const card = data.cards.find(c => c.id === open.dataset.open); if (card) { card.lastOpenedAt = new Date().toISOString(); persist(); } }
  const action = event.target.closest('[data-action]');
  if (!action) return;
  const card = data.cards.find(c => c.id === action.dataset.id);
  if (!card) return;
  if (action.dataset.action === 'favorite') { card.favorite = !card.favorite; persist(); render(); }
  if (action.dataset.action === 'edit') showServiceEditor(card.id);
  if (action.dataset.action === 'status') {
    const result = health.get(monitorKey(card));
    const details = result ? `\n\n${statusFor(card).detail}\n检测时间：${new Date(result.at).toLocaleString('zh-CN')}\n检测位置：${checkSource === 'nas' ? 'NAS 内网' : '当前电脑内网'}` : '';
    info(`${card.name} · ${statusFor(card).label}`, `${statusFor(card).detail}${details}\n\nHTTP 响应只说明该入口的响应情况，不代表容器或业务健康，也不代表独立外网可达。`);
  }
});
$('serviceForm').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const id = $('editId').value || (crypto.randomUUID?.() || `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
    const old = data.cards.find(c => c.id === id);
    const lines = $('fLinks').value.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 10) throw new Error('每张服务卡片最多 10 个入口');
    const links = lines.map(line => { const divider = line.indexOf('|'); return divider < 0 ? { label: '打开服务', url: line } : { label: line.slice(0, divider).trim(), url: line.slice(divider + 1).trim() }; });
    const card = normalizeCard({ ...old, id, name: $('fName').value, description: $('fDescription').value, icon: $('fIcon').value, group: $('fGroup').value, links, tags: $('fTags').value.split(/[,，]/u), containerName: $('fContainer').value, favorite: $('fFavorite').checked, updatedAt: new Date().toISOString(), createdAt: old?.createdAt || new Date().toISOString() });
    const index = data.cards.findIndex(c => c.id === id);
    if (index >= 0) data.cards[index] = card; else data.cards.push(card);
    const saved = persist(); $('serviceDialog').close(); render();
    if (saved) showToast(old ? '服务已更新。' : '新服务已添加。');
  } catch (error) { $('serviceError').textContent = error.message; $('serviceError').hidden = false; }
});
$('deleteButton').addEventListener('click', () => {
  const id = $('editId').value, index = data.cards.findIndex(c => c.id === id), card = data.cards[index];
  if (!card) return;
  $('serviceDialog').close();
  confirmAction('删除这张服务卡片？', `只移除“${card.name}”的导航卡片，服务本身仍会保留。`, () => {
    data.cards.splice(index, 1); persist(); render();
    showToast('卡片已删除。', () => { data.cards.splice(index, 0, card); persist(); render(); showToast('已恢复服务卡片。'); });
  }, true);
});
$('settingsForm').addEventListener('submit', event => {
  event.preventDefault();
  const lanHost = safeHost($('sLanHost').value, ''), wanHost = safeHost($('sWanHost').value, '');
  if (!lanHost || !wanHost) { $('settingsError').textContent = '请填写主机名或 IP，不含协议、路径和端口。IPv6 地址可以带方括号。'; $('settingsError').hidden = false; return; }
  data.prefs = normalizePrefs({ ...data.prefs, theme: $('sTheme').value, lanHost, wanHost, autoCheck: $('sAutoCheck').checked });
  const saved = persist(); applyTheme(); render(); $('settingsDialog').close();
  if (saved) showToast('导航设置已保存。');
  if (data.prefs.autoCheck) checkHealth();
});
$('exportButton').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `nas-navigation-${new Date().toLocaleDateString('sv-SE')}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); showToast('配置已导出。');
});
$('importButton').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error('配置文件不能超过 1 MB');
    const imported = normalizeData(JSON.parse(await file.text()));
    confirmAction('导入导航配置？', `将以备份中的 ${imported.cards.length} 张卡片替换当前浏览器配置。导入前的配置会额外保存在本地，旧版配置也会保留。`, () => {
      try {
        browserStorage.setItem(`${STORAGE_KEY}-before-import`, browserStorage.getItem(STORAGE_KEY) || JSON.stringify(data));
        browserStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
      } catch { showToast('本地存储不可写，导入已取消。请先导出现有配置。'); return; }
      data = imported; storageLocked = false; activeGroup = 'all'; query = ''; $('searchInput').value = '';
      health.clear(); lastChecked = null; applyTheme(); render(); $('settingsDialog').close(); showToast('配置已导入。');
      if (data.prefs.autoCheck) checkHealth();
    });
  } catch (error) { showToast(`无法导入：${error.message}`); }
  finally { event.target.value = ''; }
});
$('addPresets').addEventListener('click', () => {
  const missing = defaultCards().filter(c => !data.cards.some(existing => existing.key === c.key));
  if (!missing.length) { showToast('常用服务入口已经齐全。'); return; }
  confirmAction('补充常用服务入口？', `将添加 ${missing.map(c => c.name).join('、')}。现有卡片会保留，入口状态以检测结果为准。`, () => {
    data.cards.push(...missing); persist(); render(); $('settingsDialog').close(); showToast(`已补充 ${missing.length} 个入口。`); if (data.prefs.autoCheck) checkHealth();
  });
});
$('confirmAction').addEventListener('click', () => { $('confirmDialog').close(); const callback = confirmCallback; confirmCallback = null; callback?.(); });
$('toastUndo').addEventListener('click', () => { const callback = undoCallback; undoCallback = null; callback?.(); });
$('themeToggle').addEventListener('click', () => { data.prefs.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; persist(); applyTheme(); });
$('settingsButton').addEventListener('click', openSettings); $('footerSettings').addEventListener('click', openSettings);
$('addButton').addEventListener('click', () => showServiceEditor());
$('checkButton').addEventListener('click', () => checkHealth(true));
$('checkInfoButton').addEventListener('click', () => info('入口检测说明', '检测从服务器或预览电脑连接固定的 NAS 内网 Web 地址。\n\n“入口响应”表示收到了成功或重定向响应；“需要登录”表示 HTTP 401；“访问受限”表示 HTTP 403。这些都不是容器健康结论。\n\n自定义域名或不在检测清单内的地址显示“未配置检测”。未启用同源检测接口时，页面不会用跨域请求猜测在线状态。\n\n外网访问需要另用移动数据等独立网络验证。'));
$('searchInput').addEventListener('input', event => { query = event.target.value; selectedIndex = -1; render(); });
$('searchWeb').addEventListener('click', searchWeb);
$('searchForm').addEventListener('submit', event => {
  event.preventDefault(); if (!query.trim()) return;
  const results = filterCards(data.cards, query, activeGroup), card = results[Math.max(0, selectedIndex)];
  if (card?.links[0]) { window.open(resolvedUrl(card.links[0]), '_blank', 'noopener,noreferrer'); card.lastOpenedAt = new Date().toISOString(); persist(); }
  else showToast('没有匹配的服务，可点击 SearXNG 搜索。');
});
$('searchInput').addEventListener('keydown', event => {
  if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
  const results = filterCards(data.cards, query, activeGroup); if (!results.length) return;
  event.preventDefault(); selectedIndex = selectedIndex < 0 ? (event.key === 'ArrowDown' ? 0 : results.length - 1) : (selectedIndex + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
  updateKeyboardSelection();
  document.querySelector('.keyboard-selected')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});
$('clearSearch').addEventListener('click', () => { query = ''; activeGroup = 'all'; $('searchInput').value = ''; selectedIndex = -1; render(); $('searchInput').focus(); });
document.querySelector('.brand').addEventListener('click', () => { query = ''; activeGroup = 'all'; $('searchInput').value = ''; selectedIndex = -1; render(); });
$('dismissMigration').addEventListener('click', () => { $('migrationBanner').hidden = true; });
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]')) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('searchInput').focus(); $('searchInput').select(); }
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); $('searchInput').focus(); }
  if (event.key === 'Escape' && document.activeElement === $('searchInput')) { query = ''; selectedIndex = -1; $('searchInput').value = ''; render(); $('searchInput').blur(); }
});
systemTheme.addEventListener('change', () => { if (data.prefs.theme === 'system') applyTheme(); });
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  try { data = normalizeData(JSON.parse(event.newValue)); applyTheme(); render(); showToast('已同步另一个标签页的配置。'); } catch { showToast('另一个标签页写入了无效配置，当前页面保留原配置。'); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && data.prefs.autoCheck && (!lastChecked || Date.now() - lastChecked.getTime() > 60000)) checkHealth(); });
fillIcons(); applyTheme(); updateClock(); render();
if (initial.migrated) { $('migrationBanner').hidden = false; persist(); }
if (initial.storageError) showToast('原配置暂时无法读取，已保留原数据。请先导出备份或导入有效配置。');
if (data.prefs.autoCheck) checkHealth();
setInterval(updateClock, 15000);
setInterval(() => { if (data.prefs.autoCheck && checker !== false) checkHealth(); }, 60000);
