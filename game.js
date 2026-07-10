(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = id => document.getElementById(id);

  const ui = {
    hud: $('hud'), start: $('start'), how: $('how'), hangar:$('hangar'), missions:$('missions'), codex:$('codex'), settings:$('settings'), pause: $('pause'), upgrade: $('upgrade'), gameover: $('gameover'), controls: $('controls'),
    score: $('score'), wave: $('wave'), healthFill: $('healthFill'), xpFill: $('xpFill'), combo: $('combo'), dashRing: $('dashRing'),
    bestScore: $('bestScore'), finalScore: $('finalScore'), finalWave: $('finalWave'), finalShards: $('finalShards'), finalKills:$('finalKills'), runRewards:$('runRewards'), upgradeCards: $('upgradeCards'),
    playBtn: $('playBtn'), howBtn: $('howBtn'), howClose: $('howClose'), pauseBtn: $('pauseBtn'), resumeBtn: $('resumeBtn'), restartBtn: $('restartBtn'),
    againBtn: $('againBtn'), menuBtn: $('menuBtn'), quitBtn:$('quitBtn'), dashBtn: $('dashBtn'), abilityBtn:$('abilityBtn'), abilityLabel:$('abilityLabel'), abilityRing:$('abilityRing'), bossBar:$('bossBar'), bossFill:$('bossFill'), objectiveHud:$('objectiveHud'), stickZone: $('stickZone'), stickBase: $('stickBase'), stickKnob: $('stickKnob')
  };

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

  let W = 390, H = 844, DPR = 1;
  let state = 'menu';
  let last = performance.now();
  let time = 0;
  let shake = 0;
  let flash = 0;
  // Embedded previews often use an opaque/sandboxed origin where localStorage throws.
  // Keep storage optional so the game still boots and every button remains interactive.
  const storage = window.Shardwake?.storage || {
    get: (key, fallback = null) => { try { return localStorage.getItem(key) ?? fallback; } catch (_) { return fallback; } },
    set: (key, value) => { try { localStorage.setItem(key, value); return true; } catch (_) { return false; } }
  };
  let best = Number(storage.get('shardwake-best', '0') || 0);
  ui.bestScore.textContent = best.toLocaleString();

  const palette = {
    deep: '#06111c', sea1: '#0a2231', sea2: '#0b2c3c', sea3: '#104151',
    aqua: '#64f0da', blue: '#5c9fff', gold: '#ffd46d', coral: '#ff7182', white: '#ecfbff', ink: '#06131c'
  };
  const settings = () => window.Shardwake?.profile?.settings || { difficulty:'normal', sound:true, haptics:true, shake:true };
  const difficulty = () => ({ relaxed:.72, normal:1, storm:1.32 }[settings().difficulty] || 1);
  const skinColors = { aqua:'#64f0da', cobalt:'#5c9fff', solar:'#ffd46d', coral:'#ff7182', void:'#bd75ff' };
  palette.aqua = skinColors[window.Shardwake?.profile?.selectedSkin] || palette.aqua;

  const input = { x: 0, y: 0, active: false, pointerId: null, ox: 0, oy: 0 };

  let player;
  let shards = [];
  let enemies = [];
  let bullets = [];
  let enemyBullets = [];
  let particles = [];
  let meteors = [];
  let powerups = [];
  let floaters = [];
  let islands = [];
  let seaFacets = [];
  let wakes = [];
  let rain = [];
  let run;
  const biomes=[
    {name:'AZURE REACH',top:'#0b3044',mid:'#0b2536',bottom:'#06111c',accent:'#64f0da',weather:'clear'},
    {name:'EMBER SHOALS',top:'#402a35',mid:'#1f2735',bottom:'#09111d',accent:'#ff9a72',weather:'embers'},
    {name:'VIOLET ABYSS',top:'#271d46',mid:'#171936',bottom:'#080d1c',accent:'#bd75ff',weather:'storm'}
  ];
  const currentBiome=()=>biomes[Math.floor(((run?.wave||1)-1)/3)%biomes.length];

  const audio = {
    ctx: null,
    ensure() {
      try {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return;
        if (!this.ctx) this.ctx = new AudioCtor();
        if (this.ctx.state === 'suspended') this.ctx.resume().catch?.(() => {});
      } catch (_) {
        // Audio is optional in restricted mobile previews.
        this.ctx = null;
      }
    },
    tone(freq, duration = .08, type = 'sine', volume = .035, slide = 0) {
      if (!this.ctx || !settings().sound) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(now); osc.stop(now + duration);
    },
    collect(combo = 1) { this.tone(420 + Math.min(combo, 8) * 45, .07, 'triangle', .035, 90); },
    shoot() { this.tone(210, .045, 'square', .012, 80); },
    hit() { this.tone(105, .16, 'sawtooth', .045, -50); },
    dash() { this.tone(150, .18, 'sawtooth', .04, 520); },
    level() { [0, 90, 180].forEach((ms, i) => setTimeout(() => this.tone([440, 590, 790][i], .16, 'triangle', .04, 70), ms)); },
    explode() { this.tone(75, .28, 'sawtooth', .055, -30); }
  };

  function haptic(pattern = 10) {
    try { if (settings().haptics && navigator.vibrate) navigator.vibrate(pattern); } catch (_) {}
  }

  function resize() {
    W = innerWidth; H = innerHeight;
    DPR = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildBackdrop();
    if (player) {
      player.x = clamp(player.x, 30, W - 30);
      player.y = clamp(player.y, 70, H - 80);
    }
  }

  function buildBackdrop() {
    seaFacets = [];
    const cell = Math.max(75, Math.min(120, W / 4));
    for (let y = -cell; y < H + cell; y += cell) {
      for (let x = -cell; x < W + cell; x += cell) {
        seaFacets.push({ x: x + rand(-25,25), y: y + rand(-25,25), s: cell * rand(.75,1.3), shade: Math.floor(rand(0,3)), drift: rand(3,10) });
      }
    }
    islands = Array.from({ length: Math.max(5, Math.round(H / 145)) }, (_, i) => makeIsland(rand(-20, W + 20), i * (H / 5) + rand(-80, 80), rand(26, 62)));
    rain=Array.from({length:Math.min(55,Math.round(W*H/9000))},()=>({x:rand(0,W),y:rand(0,H),l:rand(8,25),speed:rand(380,720),alpha:rand(.08,.3)}));
  }

  function makeIsland(x, y, r) {
    const n = Math.floor(rand(6, 10));
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      pts.push({ a, r: r * rand(.72, 1.15) });
    }
    return { x, y, r, pts, speed: rand(8, 18), spin: rand(-.03, .03), angle: rand(0, TAU), hue: Math.random(), detail:Math.floor(rand(2,6)), crystal:Math.random()<.34 };
  }

  function resetGame() {
    time = 0; shake = 0; flash = 0;
    shards = []; enemies = []; bullets = []; enemyBullets = []; particles = []; meteors = []; powerups = []; wakes=[]; floaters = [];
    run = {
      elapsed: 0, score: 0, wave: 1, level: 1, xp: 0, xpNeed: 8, collected: 0,
      enemyTimer: .6, shardTimer: .15, meteorTimer: 10, combo: 0, comboTimer: 0,
      nextWave: 24, pendingLevel: false, kills:0, dashes:0, bosses:0, damageTaken:0,
      bossWave:0, bossSpawned:false, objective:'Collect shards and survive'
    };
    const rank = window.Shardwake?.profile?.level || 1;
    const perks=window.Shardwake?.profile?.perks||{};
    player = {
      x: W / 2, y: H * .68, vx: 0, vy: 0, angle: -Math.PI / 2, radius: 15,
      hp: 100 + Math.min(30,rank*2)+(perks.hull||0)*6, maxHp: 100 + Math.min(30,rank*2)+(perks.hull||0)*6, speed: (235 + Math.min(20,rank))*(1+(perks.engine||0)*.03), accel: 7.5,
      invuln: 0, dashTime: 0, dashCooldown: 0, dashCooldownMax: 3.3, dashPower: 680,
      magnet: 75+(perks.magnet||0)*8, fireTimer: .35, fireRate: .78*(1-(perks.cannon||0)*.04), bulletDamage: 1, bulletSpeed: 500,
      shield: 0, pickupValue: 1, multishot: 1, pierce: 0, drone: 0, droneTimer: 0,
      abilityCooldown:0, abilityCooldownMax:12, overdrive:0
    };
    buildBackdrop();
    for (let i = 0; i < 8; i++) spawnShard(true);
    updateHud();
  }

  function showOnly(name) {
    ['start','how','hangar','missions','codex','settings','pause','upgrade','gameover'].forEach(k => ui[k]?.classList.add('hidden'));
    if (name) ui[name].classList.remove('hidden');
  }

  function startGame() {
    audio.ensure();
    resetGame();
    state = 'playing';
    showOnly(null);
    ui.hud.classList.remove('hidden');
    ui.controls.classList.remove('hidden');
  }

  function goMenu() {
    state = 'menu';
    ui.hud.classList.add('hidden');
    ui.controls.classList.add('hidden');
    showOnly('start');
    ui.bestScore.textContent = best.toLocaleString();
  }

  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    showOnly('pause');
    ui.controls.classList.add('hidden');
  }

  function resumeGame() {
    if (state !== 'paused') return;
    state = 'playing';
    showOnly(null);
    ui.controls.classList.remove('hidden');
    last = performance.now();
  }

  function gameOver() {
    if (state === 'over') return;
    state = 'over';
    audio.explode(); haptic([25, 35, 70]);
    burst(player.x, player.y, palette.aqua, 34, 260);
    burst(player.x, player.y, palette.coral, 22, 180);
    if (run.score > best) {
      best = Math.floor(run.score);
      storage.set('shardwake-best', String(best));
    }
    ui.finalScore.textContent = Math.floor(run.score).toLocaleString();
    ui.finalWave.textContent = run.wave;
    ui.finalShards.textContent = run.collected;
    ui.finalKills.textContent = run.kills;
    const rewards = window.Shardwake?.addRun?.({score:Math.floor(run.score),wave:run.wave,shards:run.collected,kills:run.kills,dashes:run.dashes,bosses:run.bosses});
    ui.runRewards.textContent = rewards ? `+${rewards.reward} ◆   +${rewards.xp} RANK XP` : '';
    ui.controls.classList.add('hidden');
    setTimeout(() => showOnly('gameover'), 350);
  }

  function spawnShard(initial = false) {
    let x, y;
    if (initial) { x = rand(40, W - 40); y = rand(120, H - 130); }
    else {
      const side = Math.floor(rand(0, 4));
      if (side === 0) { x = rand(25, W - 25); y = -25; }
      else if (side === 1) { x = W + 25; y = rand(80, H - 80); }
      else if (side === 2) { x = rand(25, W - 25); y = H + 25; }
      else { x = -25; y = rand(80, H - 80); }
    }
    shards.push({ x, y, vx: rand(-8,8), vy: rand(-8,8), r: rand(7,10), a: rand(0,TAU), spin: rand(-2.4,2.4), pulse: rand(0,TAU), rare: Math.random() < .08 });
  }

  function spawnEnemy() {
    const side = Math.floor(rand(0, 4));
    let x, y;
    if (side === 0) { x = rand(-20, W + 20); y = -45; }
    else if (side === 1) { x = W + 45; y = rand(0, H); }
    else if (side === 2) { x = rand(-20, W + 20); y = H + 45; }
    else { x = -45; y = rand(0, H); }

    const roll = Math.random();
    let type = 'hunter';
    if (run.wave >= 2 && roll > .72) type = 'spinner';
    if (run.wave >= 4 && roll > .88) type = 'brute';
    if (run.wave >= 7 && roll > .95) type = 'wraith';
    if (run.wave >= 3 && roll > .82 && roll < .9) type = 'seer';
    const data = {
      hunter: { r: 14, speed: rand(68, 88) + run.wave * 4, hp: 2 + Math.floor(run.wave / 4), damage: 18, score: 55 },
      spinner: { r: 18, speed: rand(48, 62) + run.wave * 3, hp: 4 + Math.floor(run.wave / 3), damage: 24, score: 95 },
      brute: { r: 27, speed: rand(28, 40) + run.wave * 2, hp: 9 + run.wave, damage: 34, score: 180 },
      wraith: { r: 16, speed: rand(90,110)+run.wave*3, hp: 5+Math.floor(run.wave/2), damage:27, score:150 },
      seer: { r: 19, speed: rand(38,48)+run.wave*2, hp: 5+Math.floor(run.wave/3), damage:16, score:135 }
    }[type];
    data.speed*=difficulty(); data.damage=Math.round(data.damage*difficulty()); data.hp=Math.max(1,Math.round(data.hp*difficulty()));
    enemies.push({ x, y, vx: 0, vy: 0, angle: rand(0,TAU), spin: rand(-2,2), type, hit: 0, dead: false, ...data, maxHp: data.hp, wobble: rand(0,TAU),fireTimer:rand(1,2.4) });
  }

  function spawnBoss(){
    const hp=Math.round((65+run.wave*14)*difficulty());
    enemies.push({x:W/2,y:-70,vx:0,vy:0,angle:0,spin:.5,type:'boss',hit:0,dead:false,r:48,speed:32+run.wave,damage:42,score:1800,hp,maxHp:hp,wobble:0,boss:true,fireTimer:1.6,phase:1});
    run.bossSpawned=true; run.objective='Destroy the Abyssal Leviathan'; ui.bossBar.classList.remove('hidden');
    window.Shardwake?.toast?.('LEVIATHAN AWAKENED','coral'); haptic([30,50,30]);
  }

  function spawnPowerup(x,y){
    const types=['repair','shield','overdrive']; const type=types[Math.floor(rand(0,types.length))];
    powerups.push({x,y,type,r:13,a:0,life:12});
  }

  function enemyShoot(e,radial=false){
    const base=Math.atan2(player.y-e.y,player.x-e.x),count=radial?Math.min(12,6+(e.phase||1)*2):1;
    for(let i=0;i<count;i++){const a=radial?i/count*TAU+time*.25:base;enemyBullets.push({x:e.x,y:e.y,vx:Math.cos(a)*(radial?125:175),vy:Math.sin(a)*(radial?125:175),r:radial?5:6,life:5,damage:radial?12:16,phase:e.boss});}
    audio.tone(115,.12,'sawtooth',.018,45);
  }

  function useAbility(){
    if(state!=='playing'||player.abilityCooldown>0)return;
    player.abilityCooldown=player.abilityCooldownMax; shake=Math.max(shake,8); haptic([12,25,12]); audio.level();
    for(const e of enemies){const d=Math.hypot(e.x-player.x,e.y-player.y);if(d<220){e.hp-=4+Math.floor(run.level/3);e.x+=(e.x-player.x)/(d||1)*75;e.y+=(e.y-player.y)/(d||1)*75;if(e.hp<=0)killEnemy(e);}}
    for(const b of enemyBullets){if(Math.hypot(b.x-player.x,b.y-player.y)<260){b.dead=true;run.score+=8;}}
    burst(player.x,player.y,palette.gold,36,250); floater('TIDAL PULSE',player.x,player.y-35,palette.gold);
  }

  function spawnMeteor() {
    meteors.push({ x: rand(45, W - 45), y: rand(120, H - 105), r: rand(42, 60), t: 1.55, exploded: false, life: .35 });
  }

  function shoot() {
    if (!enemies.length) return;
    let target = null, dmin = Infinity;
    for (const e of enemies) {
      const d = dist2(player, e);
      if (d < dmin && d < 390 * 390) { dmin = d; target = e; }
    }
    if (!target) return;
    const base = Math.atan2(target.y - player.y, target.x - player.x);
    for (let i = 0; i < player.multishot; i++) {
      const spread = (i - (player.multishot - 1) / 2) * .13;
      const a = base + spread;
      bullets.push({ x: player.x + Math.cos(a) * 16, y: player.y + Math.sin(a) * 16, vx: Math.cos(a) * player.bulletSpeed, vy: Math.sin(a) * player.bulletSpeed, r: 4, life: 1.25, damage: player.bulletDamage, pierce: player.pierce });
    }
    audio.shoot();
  }

  function dash() {
    if (state !== 'playing' || player.dashCooldown > 0) return;
    audio.ensure(); audio.dash(); haptic(16);
    player.dashTime = .26;
    player.invuln = Math.max(player.invuln, .38);
    player.dashCooldown = player.dashCooldownMax;
    run.dashes++;
    let dx = input.x, dy = input.y;
    if (Math.hypot(dx,dy) < .15) { dx = Math.cos(player.angle); dy = Math.sin(player.angle); }
    const m = Math.hypot(dx,dy) || 1;
    player.vx = dx / m * player.dashPower;
    player.vy = dy / m * player.dashPower;
    for (let i = 0; i < 18; i++) particles.push({ x: player.x, y: player.y, vx: rand(-90,90) - dx * rand(80,250), vy: rand(-90,90) - dy * rand(80,250), life: rand(.25,.65), max: .65, size: rand(2,6), color: i % 3 ? palette.aqua : palette.blue, drag: .94 });
  }

  function damage(amount) {
    if (player.invuln > 0 || state !== 'playing') return;
    if (player.shield > 0) {
      player.shield--;
      player.invuln = .7;
      burst(player.x, player.y, palette.blue, 18, 150);
      floater('SHIELD', player.x, player.y - 24, palette.blue);
      haptic(18); audio.tone(300,.18,'triangle',.04,240);
      return;
    }
    player.hp -= amount;
    run.damageTaken += amount;
    player.invuln = .85;
    shake = Math.max(shake, 12);
    flash = .22;
    burst(player.x, player.y, palette.coral, 14, 150);
    floater(`-${amount}`, player.x, player.y - 25, palette.coral);
    audio.hit(); haptic([20,30,20]);
    if (player.hp <= 0) gameOver();
  }

  function killEnemy(e, ram = false) {
    if (e.dead) return;
    e.dead = true;
    run.kills++;
    if(e.boss){run.bosses++;run.objective='Survive the current';ui.bossBar.classList.add('hidden');window.Shardwake?.toast?.('LEVIATHAN DEFEATED  +RELIC','gold');spawnPowerup(e.x,e.y);}
    run.score += e.score * (1 + Math.min(run.combo, 10) * .05);
    shake = Math.max(shake, e.type === 'brute' ? 10 : 4);
    burst(e.x, e.y, e.type === 'brute' ? palette.coral : palette.blue, e.type === 'brute' ? 24 : 12, e.type === 'brute' ? 220 : 130);
    if (ram) floater('BREAK!', e.x, e.y, palette.gold);
    if (Math.random() < .3) shards.push({ x:e.x, y:e.y, vx:rand(-30,30), vy:rand(-30,30), r:8, a:rand(0,TAU), spin:rand(-2,2), pulse:0, rare:false });
    if(!e.boss && Math.random()<.045) spawnPowerup(e.x,e.y);
    audio.tone(e.type === 'brute' ? 90 : 130, .12, 'square', .025, -40);
  }

  function collectShard(s) {
    run.collected++;
    run.combo++;
    run.comboTimer = 2.4;
    const value = (s.rare ? 3 : 1) * player.pickupValue;
    run.xp += value;
    run.score += Math.round((s.rare ? 90 : 25) * (1 + Math.min(run.combo, 12) * .08));
    burst(s.x, s.y, s.rare ? palette.gold : palette.aqua, s.rare ? 14 : 7, s.rare ? 150 : 90);
    floater(s.rare ? `+${value} RARE` : `+${value}`, s.x, s.y - 12, s.rare ? palette.gold : palette.aqua);
    audio.collect(run.combo); haptic(s.rare ? 18 : 6);
    if (run.xp >= run.xpNeed) {
      run.xp -= run.xpNeed;
      run.level++;
      run.xpNeed = Math.round(7 + run.level * 3.3);
      run.pendingLevel = true;
    }
  }

  function burst(x, y, color, count = 10, power = 100) {
    for (let i = 0; i < count; i++) {
      const a = rand(0,TAU), p = rand(power*.25,power);
      particles.push({ x, y, vx:Math.cos(a)*p, vy:Math.sin(a)*p, life:rand(.25,.7), max:.7, size:rand(2,6), color, drag:rand(.90,.97) });
    }
  }

  function floater(text, x, y, color) {
    floaters.push({ text, x, y, color, life: .8, max: .8 });
  }

  const upgrades = [
    { id:'hull', icon:'♥', name:'REINFORCED HULL', desc:'+25 maximum hull and repair 25.', apply(){ player.maxHp += 25; player.hp = Math.min(player.maxHp, player.hp + 25); } },
    { id:'speed', icon:'➤', name:'TIDAL FINS', desc:'+14% movement speed and sharper steering.', apply(){ player.speed *= 1.14; player.accel *= 1.08; } },
    { id:'magnet', icon:'◉', name:'SHARD MAGNET', desc:'+55 pickup range.', apply(){ player.magnet += 55; } },
    { id:'rapid', icon:'≋', name:'RAPID WAKE', desc:'Wake-cannon fires 18% faster.', apply(){ player.fireRate = Math.max(.22, player.fireRate * .82); } },
    { id:'power', icon:'✹', name:'DENSE PROJECTILES', desc:'+1 projectile damage.', apply(){ player.bulletDamage += 1; } },
    { id:'dash', icon:'✦', name:'PHASE DASH', desc:'Dash recharges 22% faster.', apply(){ player.dashCooldownMax = Math.max(1.25, player.dashCooldownMax * .78); } },
    { id:'shield', icon:'⬡', name:'PRISM SHIELD', desc:'Gain 2 shields that block any hit.', apply(){ player.shield += 2; } },
    { id:'multi', icon:'⋰', name:'FORKED WAKE', desc:'+1 projectile per volley.', apply(){ player.multishot = Math.min(5, player.multishot + 1); } },
    { id:'pierce', icon:'◇', name:'PHASE ROUNDS', desc:'Projectiles pass through +1 hunter.', apply(){ player.pierce += 1; } },
    { id:'fortune', icon:'◆', name:'GILDED CURRENT', desc:'Shard energy value +1.', apply(){ player.pickupValue += 1; } },
    { id:'drone', icon:'◌', name:'ORBITAL WISP', desc:'Add a wisp that periodically strikes hunters.', apply(){ player.drone += 1; } },
    { id:'pulse', icon:'◉', name:'RESONANT CORE', desc:'Tidal Pulse recharges 20% faster.', apply(){player.abilityCooldownMax=Math.max(5,player.abilityCooldownMax*.8);} },
    { id:'velocity', icon:'»', name:'HYPERVELOCITY', desc:'+22% projectile speed and range.', apply(){player.bulletSpeed*=1.22;} }
  ];

  function openUpgrade() {
    if (state !== 'playing') return;
    state = 'upgrade';
    audio.level(); haptic([10,30,10]);
    ui.controls.classList.add('hidden');
    const choices = [...upgrades].sort(() => Math.random() - .5).slice(0,3);
    ui.upgradeCards.innerHTML = '';
    choices.forEach(u => {
      const btn = document.createElement('button');
      btn.className = 'card';
      btn.innerHTML = `<span class="card-icon">${u.icon}</span><span><h3>${u.name}</h3><p>${u.desc}</p></span>`;
      bindTap(btn, () => {
        u.apply();
        run.pendingLevel = false;
        state = 'playing';
        showOnly(null);
        ui.controls.classList.remove('hidden');
        last = performance.now();
      }, true);
      ui.upgradeCards.appendChild(btn);
    });
    showOnly('upgrade');
  }

  function update(dt) {
    time += dt;
    if (state !== 'playing') return;
    run.elapsed += dt;
    run.score += dt * (4 + run.wave);

    if (run.elapsed >= run.nextWave) {
      const previousBiome=currentBiome().name;
      run.wave++;
      run.nextWave += 24;
      if(run.wave%5===0){run.bossSpawned=false;setTimeout(()=>state==='playing'&&spawnBoss(),900);}
      floater(`WAVE ${run.wave}`, W/2, H*.34, palette.gold);
      if(currentBiome().name!==previousBiome)window.Shardwake?.toast?.(currentBiome().name,'aqua');
      haptic(12);
    }

    run.comboTimer -= dt;
    if (run.comboTimer <= 0) run.combo = 0;

    player.invuln = Math.max(0, player.invuln - dt);
    player.dashTime = Math.max(0, player.dashTime - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.abilityCooldown = Math.max(0,player.abilityCooldown-dt);
    player.overdrive = Math.max(0,player.overdrive-dt);

    let ix = input.x, iy = input.y;
    const im = Math.hypot(ix,iy);
    if (im > 1) { ix /= im; iy /= im; }
    if (player.dashTime <= 0) {
      const targetVx = ix * player.speed;
      const targetVy = iy * player.speed;
      const steer = 1 - Math.exp(-player.accel * dt);
      player.vx = lerp(player.vx, targetVx, steer);
      player.vy = lerp(player.vy, targetVy, steer);
      if (im < .08) { player.vx *= Math.pow(.08, dt); player.vy *= Math.pow(.08, dt); }
    }
    const vm = Math.hypot(player.vx, player.vy);
    if (vm > 15) player.angle = lerpAngle(player.angle, Math.atan2(player.vy, player.vx), 1 - Math.exp(-9*dt));
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    const margin = 22;
    if (player.x < margin || player.x > W-margin) player.vx *= -.28;
    if (player.y < 82 || player.y > H-60) player.vy *= -.28;
    player.x = clamp(player.x, margin, W-margin);
    player.y = clamp(player.y, 82, H-60);

    if (vm > 40) {
      const back = player.angle + Math.PI;
      particles.push({ x:player.x+Math.cos(back)*10, y:player.y+Math.sin(back)*10, vx:Math.cos(back)*rand(30,90)-player.vx*.18, vy:Math.sin(back)*rand(30,90)-player.vy*.18, life:rand(.12,.3), max:.3, size:rand(1.5,4), color:Math.random()<.6?palette.aqua:palette.blue, drag:.94 });
      if(Math.random()<Math.min(1,dt*34))wakes.push({x:player.x-Math.cos(player.angle)*15,y:player.y-Math.sin(player.angle)*15,r:rand(3,7),life:.7,max:.7});
    }

    player.fireTimer -= dt;
    if (player.fireTimer <= 0) { player.fireTimer += player.fireRate*(player.overdrive>0?.42:1); shoot(); }

    player.droneTimer -= dt;
    if (player.drone > 0 && player.droneTimer <= 0 && enemies.length) {
      player.droneTimer = Math.max(.32, 1.25 / player.drone);
      let target = enemies.reduce((a,b) => dist2(player,a) < dist2(player,b) ? a : b);
      target.hp -= 1 + Math.floor(player.drone / 3);
      burst(target.x,target.y,palette.gold,5,70);
      if (target.hp <= 0) killEnemy(target);
      audio.tone(660,.06,'triangle',.018,-140);
    }

    run.shardTimer -= dt;
    if (run.shardTimer <= 0 && shards.length < 14) { run.shardTimer = rand(.35,.7); spawnShard(); }
    run.enemyTimer -= dt;
    if (run.enemyTimer <= 0) {
      const density = Math.max(.38, 1.4 - run.wave * .08);
      run.enemyTimer = rand(density, density * 1.45);
      spawnEnemy();
      if (run.wave > 6 && Math.random() < .22) spawnEnemy();
    }
    run.meteorTimer -= dt;
    if (run.wave >= 2 && run.meteorTimer <= 0) {
      run.meteorTimer = Math.max(3.3, rand(7,10) - run.wave*.25);
      spawnMeteor();
      if (run.wave >= 7 && Math.random() < .35) setTimeout(() => state === 'playing' && spawnMeteor(), 320);
    }

    for (const s of shards) {
      s.a += s.spin * dt; s.pulse += dt*3;
      s.x += s.vx*dt; s.y += s.vy*dt;
      s.vx *= Math.pow(.5,dt); s.vy *= Math.pow(.5,dt);
      const dx = player.x-s.x, dy = player.y-s.y, d = Math.hypot(dx,dy);
      if (d < player.magnet) {
        const pull = (1-d/player.magnet)*720 + 70;
        s.vx += dx/(d||1)*pull*dt; s.vy += dy/(d||1)*pull*dt;
      }
      if (d < player.radius+s.r+4) s.collected = true;
    }
    for (const s of shards) if (s.collected) collectShard(s);
    shards = shards.filter(s => !s.collected && s.x>-80 && s.x<W+80 && s.y>-80 && s.y<H+80);

    for (const e of enemies) {
      e.hit = Math.max(0,e.hit-dt); e.wobble += dt*3;
      const dx=player.x-e.x, dy=player.y-e.y, d=Math.hypot(dx,dy)||1;
      let a = Math.atan2(dy,dx);
      if (e.type === 'spinner') a += Math.sin(e.wobble)*.65;
      if(e.type==='seer'&&d<240)a+=Math.PI*.82;
      if(e.boss){e.phase=e.hp/e.maxHp<.35?3:e.hp/e.maxHp<.7?2:1;a+=Math.sin(time*.75)*.5;}
      const sp = e.speed * (e.hit>0 ? .55 : 1);
      e.vx = lerp(e.vx,Math.cos(a)*sp,1-Math.exp(-2.6*dt));
      e.vy = lerp(e.vy,Math.sin(a)*sp,1-Math.exp(-2.6*dt));
      e.x += e.vx*dt; e.y += e.vy*dt;
      e.angle += (e.type==='spinner'?3.2:e.spin)*dt;
      if(e.type==='seer'||e.boss){e.fireTimer-=dt;if(e.fireTimer<=0){enemyShoot(e,e.boss);e.fireTimer=e.boss?Math.max(.7,1.8-e.phase*.3):rand(1.7,2.5);}}
      if (d < player.radius+e.r) {
        if (player.dashTime>0) { e.hp -= e.boss?8:999; if(e.hp<=0)killEnemy(e,true); else {e.hit=.16;shake=Math.max(shake,6);} }
        else { damage(e.damage); e.x -= dx/d*22; e.y -= dy/d*22; }
      }
    }

    for (const b of bullets) {
      b.x += b.vx*dt; b.y += b.vy*dt; b.life -= dt;
      for (const e of enemies) {
        if (e.dead || b.dead) continue;
        if ((b.x-e.x)**2+(b.y-e.y)**2 < (b.r+e.r)**2) {
          e.hp -= b.damage; e.hit=.09;
          burst(b.x,b.y,palette.aqua,4,55);
          if (e.hp<=0) killEnemy(e);
          if (b.pierce>0) b.pierce--; else b.dead=true;
        }
      }
    }
    bullets = bullets.filter(b => !b.dead && b.life>0 && b.x>-30&&b.x<W+30&&b.y>-30&&b.y<H+30);
    for(const b of enemyBullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;b.a=(b.a||0)+dt*5;const d=Math.hypot(b.x-player.x,b.y-player.y);if(d<player.radius+b.r){if(player.dashTime>0){b.dead=true;run.score+=12;burst(b.x,b.y,palette.gold,5,55);}else{b.dead=true;damage(b.damage);}}else if(!b.grazed&&d<player.radius+b.r+18){b.grazed=true;run.score+=18;floater('GRAZE',b.x,b.y,palette.gold);}}
    enemyBullets=enemyBullets.filter(b=>!b.dead&&b.life>0&&b.x>-50&&b.x<W+50&&b.y>-50&&b.y<H+50);
    enemies = enemies.filter(e => !e.dead && e.x>-100&&e.x<W+100&&e.y>-100&&e.y<H+100);

    for (const m of meteors) {
      if (!m.exploded) {
        m.t -= dt;
        if (m.t <= 0) {
          m.exploded=true; shake=Math.max(shake,14); flash=.13; audio.explode();
          burst(m.x,m.y,palette.coral,30,230);
          const d=Math.hypot(player.x-m.x,player.y-m.y);
          if (d<m.r+player.radius) damage(32);
          for (const e of enemies) if (Math.hypot(e.x-m.x,e.y-m.y)<m.r+e.r) { e.hp-=6; if(e.hp<=0) killEnemy(e); }
        }
      } else m.life -= dt;
    }
    meteors = meteors.filter(m => !m.exploded || m.life>0);

    for(const p of powerups){
      p.a+=dt*2.4;p.life-=dt;
      if(Math.hypot(player.x-p.x,player.y-p.y)<player.radius+p.r+6){
        p.life=0;
        if(p.type==='repair'){player.hp=Math.min(player.maxHp,player.hp+35);floater('+35 HULL',p.x,p.y,palette.aqua);}
        if(p.type==='shield'){player.shield+=2;floater('+2 SHIELDS',p.x,p.y,palette.blue);}
        if(p.type==='overdrive'){player.overdrive=10;floater('OVERDRIVE',p.x,p.y,palette.gold);}
        burst(p.x,p.y,palette.gold,18,160);audio.level();haptic(15);
      }
    }
    powerups=powerups.filter(p=>p.life>0);
    for(const w of wakes){w.r+=18*dt;w.life-=dt;}wakes=wakes.filter(w=>w.life>0);

    for (const p of particles) { p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=p.drag; p.vy*=p.drag; p.life-=dt; }
    particles = particles.filter(p=>p.life>0);
    for (const f of floaters) { f.y-=28*dt; f.life-=dt; }
    floaters=floaters.filter(f=>f.life>0);

    for (const i of islands) {
      i.y += i.speed*dt; i.angle += i.spin*dt;
      if (i.y-i.r>H+80) { i.y=-i.r-80; i.x=rand(-20,W+20); }
    }
    for (const f of seaFacets) { f.y += f.drift*dt; if (f.y>H+f.s) f.y=-f.s; }

    shake *= Math.pow(.025,dt);
    flash = Math.max(0,flash-dt);
    updateHud();
    if (run.pendingLevel && state === 'playing') openUpgrade();
  }

  function updateHud() {
    if (!run || !player) return;
    ui.score.textContent = Math.floor(run.score).toLocaleString();
    ui.wave.textContent = run.wave;
    ui.healthFill.style.transform = `scaleX(${clamp(player.hp/player.maxHp,0,1)})`;
    ui.xpFill.style.transform = `scaleX(${clamp(run.xp/run.xpNeed,0,1)})`;
    ui.dashRing.style.setProperty('--cooldown', `${player.dashCooldown/player.dashCooldownMax*360}deg`);
    ui.abilityRing.style.setProperty('--ability',`${player.abilityCooldown/player.abilityCooldownMax*360}deg`);
    ui.objectiveHud.textContent=`${currentBiome().name}  ·  ${run.objective.toUpperCase()}`;
    const boss=enemies.find(e=>e.boss);if(boss){ui.bossFill.style.transform=`scaleX(${clamp(boss.hp/boss.maxHp,0,1)})`;ui.bossBar.classList.remove('hidden');}else ui.bossBar.classList.add('hidden');
    if (run.combo >= 2 && run.comboTimer>0) { ui.combo.textContent=`x${run.combo}`; ui.combo.classList.remove('hidden'); }
    else ui.combo.classList.add('hidden');
  }

  function lerpAngle(a,b,t) {
    let d=(b-a+Math.PI)%(TAU)-Math.PI;
    return a+d*t;
  }

  function polygon(x,y,r,n,rot=0) {
    ctx.beginPath();
    for(let i=0;i<n;i++){
      const a=rot+i/n*TAU;
      const px=x+Math.cos(a)*r, py=y+Math.sin(a)*r;
      i?ctx.lineTo(px,py):ctx.moveTo(px,py);
    }
    ctx.closePath();
  }

  function drawBackdrop() {
    const biome=currentBiome();
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,biome.top); g.addColorStop(.55,biome.mid); g.addColorStop(1,biome.bottom);
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

    ctx.save(); ctx.globalAlpha=.18;
    for(const f of seaFacets){
      ctx.fillStyle=[biome.top,biome.mid,biome.bottom][f.shade];
      ctx.beginPath(); ctx.moveTo(f.x,f.y-f.s*.5); ctx.lineTo(f.x+f.s*.6,f.y); ctx.lineTo(f.x,f.y+f.s*.5); ctx.lineTo(f.x-f.s*.6,f.y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.055;ctx.strokeStyle=biome.accent;ctx.lineWidth=2;
    for(let y=-30;y<H+40;y+=52){ctx.beginPath();for(let x=-20;x<W+30;x+=18){const yy=y+Math.sin(x*.035+time*1.2+y*.01)*9;x===-20?ctx.moveTo(x,yy):ctx.lineTo(x,yy);}ctx.stroke();}
    ctx.restore();

    for(const isl of islands) drawIsland(isl);

    ctx.save(); ctx.globalAlpha=.12; ctx.strokeStyle='#9df8ec'; ctx.lineWidth=1;
    for(let y=(time*10)%70-70;y<H;y+=70){
      ctx.beginPath();
      for(let x=-20;x<W+20;x+=24){
        const yy=y+Math.sin(x*.025+time*.6)*5;
        x===-20?ctx.moveTo(x,yy):ctx.lineTo(x,yy);
      }
      ctx.stroke();
    }
    ctx.restore();

    if(biome.weather==='storm'){ctx.save();ctx.strokeStyle='#d7ccff';ctx.lineWidth=1;for(const r of rain){const y=(r.y+time*r.speed)%H;ctx.globalAlpha=r.alpha;ctx.beginPath();ctx.moveTo(r.x,y);ctx.lineTo(r.x-4,y+r.l);ctx.stroke();}ctx.restore();}
    if(biome.weather==='embers'){ctx.save();for(let i=0;i<24;i++){const x=(i*83+Math.sin(i*3.1)*41)%W,y=H-((time*(18+i%5*5)+i*97)%(H+40));ctx.globalAlpha=.12+(i%4)*.04;ctx.fillStyle=i%2?'#ff9a72':'#ffd46d';ctx.fillRect(x,y,2,2);}ctx.restore();}
  }

  function drawIsland(isl){
    ctx.save(); ctx.translate(isl.x,isl.y); ctx.rotate(isl.angle);
    ctx.fillStyle='rgba(0,0,0,.18)';
    ctx.beginPath();
    isl.pts.forEach((p,i)=>{const x=Math.cos(p.a)*p.r+7,y=Math.sin(p.a)*p.r+12;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.fill();
    const colors=isl.hue>.5?['#183f46','#226050','#31745a']:['#173b4b','#23566a','#337b7b'];
    ctx.beginPath(); isl.pts.forEach((p,i)=>{const x=Math.cos(p.a)*p.r,y=Math.sin(p.a)*p.r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}); ctx.closePath(); ctx.fillStyle=colors[0];ctx.fill();
    for(let i=0;i<isl.pts.length;i+=2){
      const p=isl.pts[i],q=isl.pts[(i+1)%isl.pts.length];
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(p.a)*p.r,Math.sin(p.a)*p.r);ctx.lineTo(Math.cos(q.a)*q.r,Math.sin(q.a)*q.r);ctx.closePath();ctx.fillStyle=colors[(i/2)%2+1];ctx.fill();
    }
    if(isl.r>40){
      ctx.fillStyle='#73a66d'; polygon(-isl.r*.18,-isl.r*.08,isl.r*.13,3,-.7);ctx.fill();
      ctx.fillStyle='#47745e';polygon(isl.r*.2,isl.r*.06,isl.r*.1,3,.2);ctx.fill();
    }
    for(let i=0;i<isl.detail;i++){const a=i/isl.detail*TAU+isl.hue*4,r=isl.r*(.18+(i%2)*.22);ctx.fillStyle=i%2?'#86a98a':'#406c62';polygon(Math.cos(a)*r,Math.sin(a)*r,3+(i%3),3,a);ctx.fill();}
    if(isl.crystal){ctx.shadowColor=currentBiome().accent;ctx.shadowBlur=8;ctx.fillStyle=currentBiome().accent;polygon(isl.r*.08,-isl.r*.12,6,4,Math.PI/4);ctx.fill();ctx.shadowBlur=0;}
    ctx.restore();
  }

  function drawShard(s){
    const pulse=1+Math.sin(s.pulse)*.08;
    ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.a);ctx.scale(pulse,pulse);
    ctx.shadowColor=s.rare?palette.gold:palette.aqua;ctx.shadowBlur=s.rare?18:10;
    ctx.fillStyle=s.rare?palette.gold:palette.aqua;
    ctx.beginPath();ctx.moveTo(0,-s.r*1.35);ctx.lineTo(s.r*.85,0);ctx.lineTo(0,s.r*1.2);ctx.lineTo(-s.r*.85,0);ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle=s.rare?'#fff4bd':'#d6fff9';ctx.beginPath();ctx.moveTo(0,-s.r*1.35);ctx.lineTo(s.r*.85,0);ctx.lineTo(0,0);ctx.closePath();ctx.fill();
    ctx.fillStyle=s.rare?'#d9a838':'#37aeb3';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(s.r*.85,0);ctx.lineTo(0,s.r*1.2);ctx.closePath();ctx.fill();
    ctx.restore();
  }

  function drawPlayer(){
    const blink=player.invuln>0 && Math.floor(time*18)%2===0;
    if(blink)return;
    ctx.save();ctx.translate(player.x,player.y);ctx.rotate(player.angle+Math.PI/2);
    if(player.shield>0){ctx.strokeStyle=palette.blue;ctx.globalAlpha=.35+.15*Math.sin(time*5);ctx.lineWidth=3;ctx.shadowColor=palette.blue;ctx.shadowBlur=14;polygon(0,0,25,6,time*.4);ctx.stroke();ctx.globalAlpha=1;ctx.shadowBlur=0;}
    ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(6,12,16,10,0,0,TAU);ctx.fill();
    ctx.shadowColor=palette.aqua;ctx.shadowBlur=15;
    ctx.fillStyle=palette.aqua;ctx.beginPath();ctx.moveTo(0,-20);ctx.lineTo(14,15);ctx.lineTo(0,9);ctx.lineTo(-14,15);ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle='#d8fff9';ctx.beginPath();ctx.moveTo(0,-20);ctx.lineTo(0,9);ctx.lineTo(-14,15);ctx.closePath();ctx.fill();
    ctx.fillStyle=palette.blue;ctx.beginPath();ctx.moveTo(0,-20);ctx.lineTo(14,15);ctx.lineTo(0,9);ctx.closePath();ctx.fill();
    ctx.fillStyle=palette.gold;polygon(0,2,4.2,4,Math.PI/4);ctx.fill();
    ctx.restore();

    if(player.drone>0){
      const count=Math.min(6,player.drone);
      for(let i=0;i<count;i++){
        const a=time*(1.2+i*.05)+i/count*TAU;
        const x=player.x+Math.cos(a)*34,y=player.y+Math.sin(a)*34;
        ctx.save();ctx.shadowColor=palette.gold;ctx.shadowBlur=12;ctx.fillStyle=palette.gold;polygon(x,y,4,4,a);ctx.fill();ctx.restore();
      }
    }
  }

  function drawEnemy(e){
    ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle);ctx.globalAlpha=e.hit>0?.6:1;
    const c=e.type==='boss'?'#ff5470':e.type==='seer'?'#ffd46d':e.type==='brute'?palette.coral:(e.type==='spinner'||e.type==='wraith')?'#bd75ff':'#5b91bd';
    ctx.shadowColor=c;ctx.shadowBlur=e.hit>0?18:5;
    if(e.type==='boss'){
      ctx.fillStyle=c;polygon(0,0,e.r,8,time*.2);ctx.fill();ctx.fillStyle='#5a1732';polygon(0,0,e.r*.68,6,-time*.35);ctx.fill();ctx.fillStyle=palette.gold;polygon(0,0,10,4,Math.PI/4);ctx.fill();
    } else if(e.type==='hunter'){
      ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(0,-e.r*1.25);ctx.lineTo(e.r,e.r);ctx.lineTo(0,e.r*.45);ctx.lineTo(-e.r,e.r);ctx.closePath();ctx.fill();
      ctx.fillStyle='#17384b';ctx.beginPath();ctx.moveTo(0,-e.r*1.25);ctx.lineTo(0,e.r*.45);ctx.lineTo(-e.r,e.r);ctx.closePath();ctx.fill();
    } else if(e.type==='seer'){
      ctx.strokeStyle=c;ctx.lineWidth=4;polygon(0,0,e.r,4,time*.4);ctx.stroke();ctx.fillStyle='#fff2b8';ctx.beginPath();ctx.arc(0,0,e.r*.38,0,TAU);ctx.fill();ctx.fillStyle='#503d24';ctx.beginPath();ctx.arc(Math.cos(e.angle)*2,Math.sin(e.angle)*2,e.r*.17,0,TAU);ctx.fill();
    } else if(e.type==='spinner'){
      ctx.fillStyle=c;for(let i=0;i<3;i++){ctx.rotate(TAU/3);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(e.r*.4,-e.r*1.4);ctx.lineTo(-e.r*.4,-e.r*.85);ctx.closePath();ctx.fill();}
      ctx.fillStyle='#f2d8ff';polygon(0,0,e.r*.42,6,time);ctx.fill();
    } else {
      ctx.fillStyle=c;polygon(0,0,e.r,6,Math.PI/6);ctx.fill();
      ctx.fillStyle='#872f47';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(e.r*Math.cos(Math.PI/6),e.r*Math.sin(Math.PI/6));ctx.lineTo(e.r*Math.cos(Math.PI/2),e.r*Math.sin(Math.PI/2));ctx.closePath();ctx.fill();
      ctx.fillStyle='#ffc2c9';polygon(0,0,e.r*.35,6,Math.PI/6);ctx.fill();
    }
    ctx.shadowBlur=0;
    if(e.hp<e.maxHp){ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(-e.r,e.r+8,e.r*2,3);ctx.fillStyle=palette.coral;ctx.fillRect(-e.r,e.r+8,e.r*2*(e.hp/e.maxHp),3);}
    ctx.restore();
  }

  function drawMeteor(m){
    if(!m.exploded){
      const p=1-clamp(m.t/1.55,0,1);
      ctx.save();ctx.strokeStyle=`rgba(255,104,123,${.28+p*.6})`;ctx.fillStyle=`rgba(255,80,105,${.03+p*.09})`;ctx.lineWidth=2+p*3;ctx.setLineDash([7,7]);
      ctx.beginPath();ctx.arc(m.x,m.y,m.r,0,TAU);ctx.fill();ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle=palette.coral;polygon(m.x,m.y,5+p*7,3,time*2);ctx.fill();ctx.restore();
    } else {
      ctx.save();ctx.globalAlpha=clamp(m.life/.35,0,1);const g=ctx.createRadialGradient(m.x,m.y,0,m.x,m.y,m.r*1.15);g.addColorStop(0,'#fff2c8');g.addColorStop(.28,palette.coral);g.addColorStop(1,'rgba(255,80,100,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(m.x,m.y,m.r*1.15,0,TAU);ctx.fill();ctx.restore();
    }
  }

  function draw(){
    ctx.save();
    const sx=shake&&settings().shake?rand(-shake,shake):0, sy=shake&&settings().shake?rand(-shake,shake):0;
    ctx.translate(sx,sy);
    drawBackdrop();

    if(state==='menu') drawMenuScene();
    else if(player){
      for(const w of wakes){ctx.save();ctx.globalAlpha=clamp(w.life/w.max,0,1)*.25;ctx.strokeStyle=palette.aqua;ctx.lineWidth=2;ctx.beginPath();ctx.arc(w.x,w.y,w.r,0,TAU);ctx.stroke();ctx.restore();}
      for(const m of meteors) drawMeteor(m);
      for(const s of shards) drawShard(s);
      for(const p of powerups){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);ctx.shadowColor=palette.gold;ctx.shadowBlur=18;ctx.fillStyle=p.type==='repair'?palette.aqua:p.type==='shield'?palette.blue:palette.gold;polygon(0,0,p.r,6,Math.PI/6);ctx.fill();ctx.fillStyle=palette.white;polygon(0,0,4,4,Math.PI/4);ctx.fill();ctx.restore();}
      for(const b of bullets){ctx.save();ctx.shadowColor=palette.aqua;ctx.shadowBlur=10;ctx.fillStyle=palette.white;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,TAU);ctx.fill();ctx.restore();}
      for(const b of enemyBullets){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.a);ctx.shadowColor=b.phase?'#ff5470':'#ffd46d';ctx.shadowBlur=14;ctx.fillStyle=b.phase?'#ff8b9b':'#ffe39a';polygon(0,0,b.r,4,Math.PI/4);ctx.fill();ctx.restore();}
      for(const e of enemies) drawEnemy(e);
      drawPlayer();
      for(const p of particles){ctx.save();ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;polygon(p.x,p.y,p.size,Math.random()<.5?3:4,p.life*3);ctx.fill();ctx.restore();}
      for(const f of floaters){ctx.save();ctx.globalAlpha=clamp(f.life/f.max,0,1);ctx.fillStyle=f.color;ctx.font='900 14px ui-rounded, sans-serif';ctx.textAlign='center';ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=5;ctx.fillText(f.text,f.x,f.y);ctx.restore();}
    }
    ctx.restore();
    const vignette=ctx.createRadialGradient(W/2,H*.48,Math.min(W,H)*.18,W/2,H*.48,Math.max(W,H)*.7);vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,4,12,.52)');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
    if(flash>0){ctx.fillStyle=`rgba(255,220,220,${flash*.55})`;ctx.fillRect(0,0,W,H);}
  }

  function drawMenuScene(){
    for(let i=0;i<7;i++){
      const y=((i*150+time*18)%(H+180))-90;
      const x=W*.5+Math.sin(i*1.8+time*.3)*W*.36;
      ctx.save();ctx.globalAlpha=.2;ctx.translate(x,y);ctx.rotate(time*.2+i);ctx.fillStyle=i%2?palette.aqua:palette.blue;polygon(0,0,8+(i%3)*4,4,Math.PI/4);ctx.fill();ctx.restore();
    }
  }

  function frame(now){
    const dt=Math.min(.033,(now-last)/1000||0);last=now;
    update(dt);draw();requestAnimationFrame(frame);
  }

  function pointerPos(e){return{x:e.clientX,y:e.clientY};}
  function startStick(e){
    if(state!=='playing'||input.active)return;
    audio.ensure();
    const p=pointerPos(e);input.active=true;input.pointerId=e.pointerId;input.ox=p.x;input.oy=p.y;
    const size=110;ui.stickBase.style.left=`${clamp(p.x-size/2,18,W*.62-size-6)}px`;ui.stickBase.style.bottom='auto';ui.stickBase.style.top=`${clamp(p.y-size/2,90,H-size-30)}px`;
    updateStick(e);
    ui.stickZone.setPointerCapture?.(e.pointerId);
  }
  function updateStick(e){
    if(!input.active||e.pointerId!==input.pointerId)return;
    const p=pointerPos(e),dx=p.x-input.ox,dy=p.y-input.oy,max=42,m=Math.hypot(dx,dy),k=m>max?max/m:1;
    input.x=clamp(dx/max,-1,1);input.y=clamp(dy/max,-1,1);
    ui.stickKnob.style.transform=`translate(${dx*k}px,${dy*k}px)`;
  }
  function endStick(e){
    if(e.pointerId!==input.pointerId)return;
    input.active=false;input.pointerId=null;input.x=0;input.y=0;ui.stickKnob.style.transform='translate(0,0)';
  }

  // iPhone previews vary between Pointer Events, Touch Events and synthesized clicks.
  // Bind immediate press events plus click while suppressing duplicate delivery from a single tap.
  function bindTap(element, handler, once = false) {
    let lastFire = -1000;
    let done = false;
    const fire = e => {
      const now = performance.now();
      if (done || now - lastFire < 350) return;
      lastFire = now;
      if (e?.cancelable) e.preventDefault();
      handler(e);
      if (once) done = true;
    };
    element.addEventListener('pointerdown', fire, { passive: false });
    element.addEventListener('touchstart', fire, { passive: false });
    element.addEventListener('click', fire, { passive: false });
  }

  bindTap(ui.playBtn, startGame);
  bindTap(ui.howBtn,()=>showOnly('how'));
  bindTap(ui.howClose,()=>showOnly('start'));
  bindTap(ui.pauseBtn,pauseGame);
  bindTap(ui.resumeBtn,resumeGame);
  bindTap(ui.restartBtn,startGame);
  bindTap(ui.againBtn,startGame);
  bindTap(ui.menuBtn,goMenu);
  bindTap(ui.quitBtn,goMenu);
  bindTap(ui.dashBtn,dash);
  bindTap(ui.abilityBtn,useAbility);
  ui.stickZone.addEventListener('pointerdown',startStick);
  ui.stickZone.addEventListener('pointermove',updateStick);
  ui.stickZone.addEventListener('pointerup',endStick);
  ui.stickZone.addEventListener('pointercancel',endStick);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pauseGame();});
  window.addEventListener('resize',resize);
  window.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('shardwake:skin',e=>{palette.aqua=e.detail.color;});

  window.addEventListener('keydown',e=>{
    if(e.key==='Escape') state==='playing'?pauseGame():state==='paused'&&resumeGame();
    if(e.code==='Space') dash();
  });
  const keys=new Set();
  window.addEventListener('keydown',e=>keys.add(e.key.toLowerCase()));
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  setInterval(()=>{
    if(state!=='playing'||input.active)return;
    input.x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('q')||keys.has('arrowleft')?1:0);
    input.y=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('z')||keys.has('arrowup')?1:0);
  },16);

  resize();
  requestAnimationFrame(frame);
})();
