import { access } from 'node:fs/promises';
import example from './config.example.mjs';

export function validateConfig(input) {
  if (!input || typeof input !== 'object') throw new Error('Config must be an object');
  if (!Array.isArray(input.groups) || !input.groups.length || input.groups.length > 30 || input.groups.some(group => typeof group !== 'string' || !group.trim() || group.length > 40)) throw new Error('Invalid groups');
  const prefs = input.prefs;
  if (!prefs || !['dark', 'light', 'system'].includes(prefs.theme) || !['auto', 'lan', 'wan'].includes(prefs.network) || typeof prefs.autoCheck !== 'boolean') throw new Error('Invalid preferences');
  function host(value) {
    if (typeof value !== 'string' || !value || value.length > 253 || /[\s/?#@\\;{}'"$]/u.test(value)) throw new Error('Host must contain only an IP or hostname, without a port');
    const normalized = value.includes(':') && !value.startsWith('[') ? `[${value}]` : value;
    const parsed = new URL(`http://${normalized}`);
    if (parsed.port || parsed.username || parsed.password || parsed.pathname !== '/') throw new Error('Invalid host');
    return parsed.hostname;
  }
  const keys = new Set();
  if (!Array.isArray(input.services) || input.services.length > 100) throw new Error('Invalid services');
  const services = input.services.map(service => {
    if (!service || !/^[a-z][a-z0-9-]{0,39}$/u.test(service.key) || keys.has(service.key)) throw new Error('Service keys must be unique safe identifiers');
    keys.add(service.key);
    if (typeof service.name !== 'string' || !service.name.trim() || service.name.length > 80) throw new Error('Invalid service name');
    if (!Number.isInteger(service.port) || service.port < 1 || service.port > 65535) throw new Error('Invalid service port');
    if (!input.groups.includes(service.group)) throw new Error('Unknown service group');
    if (service.tags !== undefined && (!Array.isArray(service.tags) || service.tags.some(tag => typeof tag !== 'string' || tag.length > 24))) throw new Error('Invalid tags');
    return {
      key: service.key, name: service.name.trim(), port: service.port, group: service.group,
      icon: typeof service.icon === 'string' ? service.icon.slice(0, 24) : 'grid',
      description: typeof service.description === 'string' ? service.description.slice(0, 240) : '',
      containerName: typeof service.containerName === 'string' ? service.containerName.slice(0, 120) : '',
      tags: (service.tags || []).slice(0, 12), favorite: service.favorite === true
    };
  });
  if (typeof input.enableHealth !== 'boolean') throw new Error('enableHealth must be a boolean');
  return { enableHealth: input.enableHealth, groups: [...input.groups], prefs: { theme: prefs.theme, network: prefs.network, lanHost: host(prefs.lanHost), wanHost: host(prefs.wanHost), autoCheck: prefs.autoCheck }, services };
}

const localFile = new URL('./config.local.mjs', import.meta.url);
let selected = example;
try { await access(localFile); selected = (await import(localFile.href)).default; }
catch (error) { if (error.code !== 'ENOENT') throw error; }
export default validateConfig(selected);
