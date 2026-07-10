(() => {
  'use strict';

  const KEY = 'shardwake-profile-v2';
  const defaults = {
    version: 2, level: 1, xp: 0, currency: 0, totalRuns: 0, totalKills: 0,
    totalShards: 0, totalDashes: 0, bosses: 0, selectedSkin: 'aqua',
    unlockedSkins: ['aqua'], claimed: [],
    settings: { difficulty: 'normal', sound: true, haptics: true, shake: true, contrast: false },
    missions: {}
  };

  const storage = {
    get(key, fallback = null) { try { return localStorage.getItem(key) ?? fallback; } catch (_) { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, value); return true; } catch (_) { return false; } },
    remove(key) { try { localStorage.removeItem(key); } catch (_) {} }
  };

  function load() {
    try {
      const saved = JSON.parse(storage.get(KEY, '{}'));
      return { ...structuredClone(defaults), ...saved, settings: { ...defaults.settings, ...(saved.settings || {}) } };
    } catch (_) { return structuredClone(defaults); }
  }

  const api = window.Shardwake = window.Shardwake || {};
  api.storage = storage;
  api.profile = load();
  api.save = () => storage.set(KEY, JSON.stringify(api.profile));
  api.reset = () => { storage.remove(KEY); storage.remove('shardwake-best'); location.reload(); };
  api.emit = (name, detail = {}) => window.dispatchEvent(new CustomEvent(`shardwake:${name}`, { detail }));
  api.toast = (text, tone = 'aqua') => api.emit('toast', { text, tone });

  api.addRun = stats => {
    const p = api.profile;
    const reward = Math.max(1, Math.floor(stats.score / 450) + stats.wave + stats.bosses * 8);
    const xp = Math.max(5, stats.wave * 6 + stats.kills + stats.bosses * 25);
    p.currency += reward; p.xp += xp; p.totalRuns++;
    p.totalKills += stats.kills; p.totalShards += stats.shards; p.totalDashes += stats.dashes; p.bosses += stats.bosses;
    while (p.xp >= p.level * 80) { p.xp -= p.level * 80; p.level++; api.toast(`RANK ${p.level} REACHED`, 'gold'); }
    api.checkAchievements(); api.save(); api.emit('profile', { reward, xp });
    return { reward, xp };
  };

  api.achievements = [
    { id: 'first-flight', name: 'FIRST FLIGHT', desc: 'Complete one run', test: p => p.totalRuns >= 1, reward: 8 },
    { id: 'shard-hunter', name: 'SHARD HUNTER', desc: 'Collect 100 shards', test: p => p.totalShards >= 100, reward: 20 },
    { id: 'breaker', name: 'BREAKER', desc: 'Destroy 250 enemies', test: p => p.totalKills >= 250, reward: 30 },
    { id: 'untouchable', name: 'BLINK DRIVE', desc: 'Dash 100 times', test: p => p.totalDashes >= 100, reward: 25 },
    { id: 'abyss-gazer', name: 'ABYSS GAZER', desc: 'Defeat a Leviathan', test: p => p.bosses >= 1, reward: 50 },
    { id: 'veteran', name: 'CURRENT VETERAN', desc: 'Reach rank 10', test: p => p.level >= 10, reward: 80 }
  ];

  api.checkAchievements = () => {
    for (const a of api.achievements) if (!api.profile.claimed.includes(a.id) && a.test(api.profile)) {
      api.profile.claimed.push(a.id); api.profile.currency += a.reward; api.toast(`${a.name}  +${a.reward} ◆`, 'gold');
    }
  };
})();
