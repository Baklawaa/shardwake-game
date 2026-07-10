(() => {
  'use strict';

  const KEY = 'shardwake-profile-v2';
  const defaults = {
    version: 2, level: 1, xp: 0, currency: 0, totalRuns: 0, totalKills: 0,
    totalShards: 0, totalDashes: 0, bosses: 0, selectedSkin: 'aqua',
    unlockedSkins: ['aqua'], claimed: [], perks: { hull:0, engine:0, magnet:0, cannon:0 },
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
      return { ...structuredClone(defaults), ...saved, perks: { ...defaults.perks, ...(saved.perks || {}) }, settings: { ...defaults.settings, ...(saved.settings || {}) } };
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

  api.buyPerk = id => {
    const p=api.profile, level=p.perks[id]||0;
    if(level>=5)return false;
    const cost=20+(level*level+level)*12;
    if(p.currency<cost){api.toast('NOT ENOUGH SHARDS','coral');return false;}
    p.currency-=cost;p.perks[id]=level+1;api.save();api.toast(`${id.toUpperCase()} CORE MK ${level+1}`,'gold');api.emit('profile');return true;
  };

  api.achievements = [
    { id: 'first-flight', name: 'FIRST FLIGHT', desc: 'Complete one run', test: p => p.totalRuns >= 1, reward: 8 },
    { id: 'shard-hunter', name: 'SHARD HUNTER', desc: 'Collect 100 shards', test: p => p.totalShards >= 100, reward: 20 },
    { id: 'breaker', name: 'BREAKER', desc: 'Destroy 250 enemies', test: p => p.totalKills >= 250, reward: 30 },
    { id: 'untouchable', name: 'BLINK DRIVE', desc: 'Dash 100 times', test: p => p.totalDashes >= 100, reward: 25 },
    { id: 'abyss-gazer', name: 'ABYSS GAZER', desc: 'Defeat a Leviathan', test: p => p.bosses >= 1, reward: 50 },
    { id: 'veteran', name: 'CURRENT VETERAN', desc: 'Reach rank 10', test: p => p.level >= 10, reward: 80 },
    { id: 'fleet', name: 'PRISM FLEET', desc: 'Unlock four wake signatures', test: p => p.unlockedSkins.length >= 4, reward: 60 },
    { id: 'legend', name: 'SEA LEGEND', desc: 'Defeat 10 Leviathans', test: p => p.bosses >= 10, reward: 150 }
  ];

  api.checkAchievements = () => {
    for (const a of api.achievements) if (!api.profile.claimed.includes(a.id) && a.test(api.profile)) {
      api.profile.claimed.push(a.id); api.profile.currency += a.reward; api.toast(`${a.name}  +${a.reward} ◆`, 'gold');
    }
  };
})();
