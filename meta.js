(() => {
  'use strict';
  const S = window.Shardwake;
  const $ = id => document.getElementById(id);
  const skins = [
    { id:'aqua', name:'TIDEBORN', color:'#64f0da', cost:0 },
    { id:'cobalt', name:'COBALT', color:'#5c9fff', cost:35 },
    { id:'solar', name:'SOLAR', color:'#ffd46d', cost:75 },
    { id:'coral', name:'CORAL', color:'#ff7182', cost:120 },
    { id:'void', name:'VOID', color:'#bd75ff', cost:200 }
  ];
  const cores=[
    {id:'hull',icon:'♥',name:'HULL',desc:'+6 starting hull / mark'},
    {id:'engine',icon:'➤',name:'ENGINE',desc:'+3% speed / mark'},
    {id:'magnet',icon:'◉',name:'MAGNET',desc:'+8 pickup range / mark'},
    {id:'cannon',icon:'✹',name:'CANNON',desc:'+4% fire rate / mark'}
  ];
  const codexEntries=[
    {id:'hunter',name:'HUNTER',desc:'Fast pursuit craft'},
    {id:'spinner',name:'SPINNER',desc:'Unstable interceptor'},
    {id:'seer',name:'SEER',desc:'Long-range artillery'},
    {id:'brute',name:'BRUTE',desc:'Armoured rammer'},
    {id:'wraith',name:'WRAITH',desc:'Phasing predator'},
    {id:'leviathan',name:'LEVIATHAN',desc:'Three-phase abyss boss'}
  ];

  function bindTap(el, fn) {
    if (!el) return;
    let last = -1000;
    const fire = e => { const now = performance.now(); if (now-last < 320) return; last=now; e.cancelable && e.preventDefault(); fn(e); };
    el.addEventListener('pointerdown', fire, { passive:false }); el.addEventListener('click', fire);
  }

  function updateProfile() {
    const p=S.profile;
    $('profileLevel').textContent=p.level; $('profileCurrency').textContent=p.currency;
    $('hangarStats').innerHTML=`<span>RANK<b>${p.level}</b></span><span>RUNS<b>${p.totalRuns}</b></span><span>KILLS<b>${p.totalKills}</b></span><span>BOSSES<b>${p.bosses}</b></span>`;
    $('shipPreview').style.setProperty('--ship-glow',skins.find(x=>x.id===p.selectedSkin)?.color||'#64f0da');
    renderCores(); renderSkins(); renderMissions(); renderCodex();
  }

  function codexPolygon(ctx,x,y,r,n,rotation=0){ctx.beginPath();for(let i=0;i<n;i++){const a=rotation+i/n*Math.PI*2,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();}
  function drawCodexAsset(canvas,type,unlocked){
    const dpr=Math.min(devicePixelRatio||1,2),w=112,h=78;canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=`${w}px`;canvas.style.height=`${h}px`;const c=canvas.getContext('2d');c.scale(dpr,dpr);c.translate(w/2,h/2);c.globalAlpha=unlocked?1:.32;const color=unlocked?({hunter:'#5c9fff',spinner:'#bd75ff',seer:'#ffd46d',brute:'#ff7182',wraith:'#9d71e8',leviathan:'#ff5470'}[type]):'#02070d';c.shadowColor=unlocked?color:'transparent';c.shadowBlur=unlocked?14:0;c.fillStyle=color;c.strokeStyle=color;c.lineWidth=4;
    if(type==='hunter'){c.beginPath();c.moveTo(0,-25);c.lineTo(20,20);c.lineTo(0,9);c.lineTo(-20,20);c.closePath();c.fill();}
    else if(type==='spinner'){for(let i=0;i<3;i++){c.rotate(Math.PI*2/3);c.beginPath();c.moveTo(0,0);c.lineTo(7,-28);c.lineTo(-7,-17);c.closePath();c.fill();}codexPolygon(c,0,0,9,6);c.fill();}
    else if(type==='seer'){codexPolygon(c,0,0,24,4,Math.PI/4);c.stroke();c.beginPath();c.arc(0,0,10,0,Math.PI*2);c.fill();}
    else if(type==='leviathan'){codexPolygon(c,0,0,31,8,.2);c.fill();c.fillStyle=unlocked?'#5a1732':'#071018';codexPolygon(c,0,0,21,6,-.3);c.fill();}
    else {codexPolygon(c,0,0,type==='brute'?25:20,type==='brute'?6:5,.25);c.fill();}
    if(!unlocked){c.globalAlpha=.9;c.fillStyle='#66808d';c.shadowBlur=0;c.font='900 18px sans-serif';c.textAlign='center';c.fillText('?',0,6);}
  }
  function renderCodex(){
    const found=S.profile.discovered||[];$('codexProgress').textContent=`${found.length}/${codexEntries.length}`;$('codexGrid').innerHTML='';
    for(const entry of codexEntries){const unlocked=found.includes(entry.id),card=document.createElement('article'),canvas=document.createElement('canvas');card.className=unlocked?'discovered':'locked';const info=document.createElement('div');info.innerHTML=`<b>${unlocked?entry.name:'UNKNOWN'}</b><span>${unlocked?entry.desc:'Encounter this entity to reveal it'}</span>`;drawCodexAsset(canvas,entry.id,unlocked);card.appendChild(canvas);card.appendChild(info);$('codexGrid').appendChild(card);}
  }

  function renderCores(){
    $('coreGrid').innerHTML='';
    for(const core of cores){const level=S.profile.perks[core.id]||0,cost=20+(level*level+level)*12,b=document.createElement('button');b.className='core-card';b.innerHTML=`<i>${core.icon}</i><span><b>${core.name} <em>MK ${level}</em></b><small>${level>=5?'MAXIMUM':core.desc}</small></span><strong>${level>=5?'MAX':`${cost} ◆`}</strong>`;bindTap(b,()=>{if(S.buyPerk(core.id))updateProfile();});$('coreGrid').appendChild(b);}
  }

  function renderSkins() {
    $('skinGrid').innerHTML='';
    for(const skin of skins){
      const owned=S.profile.unlockedSkins.includes(skin.id), selected=S.profile.selectedSkin===skin.id;
      const b=document.createElement('button'); b.className=`skin-card${selected?' selected':''}`;
      b.innerHTML=`<i style="--skin:${skin.color}"></i><b>${skin.name}</b><small>${owned?(selected?'EQUIPPED':'OWNED'):`${skin.cost} ◆`}</small>`;
      bindTap(b,()=>{
        if(!owned){ if(S.profile.currency<skin.cost){S.toast('NOT ENOUGH SHARDS','coral');return;} S.profile.currency-=skin.cost;S.profile.unlockedSkins.push(skin.id);S.checkAchievements(); }
        S.profile.selectedSkin=skin.id;S.save();updateProfile();S.emit('skin',{color:skin.color});
      }); $('skinGrid').appendChild(b);
    }
  }

  function dayKey(){ return new Date().toISOString().slice(0,10); }
  function renderMissions(){
    const p=S.profile, key=dayKey();
    const base=p.missions[key] ||= { startKills:p.totalKills,startShards:p.totalShards,startRuns:p.totalRuns,claimed:[] };
    base.claimed ||= [];
    const missions=[
      {id:'kills',name:'CLEAR THE DECK',desc:'Destroy 40 enemies',value:p.totalKills-base.startKills,max:40,reward:18},
      {id:'shards',name:'LUMINOUS TIDE',desc:'Collect 30 shards',value:p.totalShards-base.startShards,max:30,reward:15},
      {id:'runs',name:'THREE VOYAGES',desc:'Complete 3 runs',value:p.totalRuns-base.startRuns,max:3,reward:25}
    ];
    $('missionList').innerHTML='';missions.forEach(m=>{const done=m.value>=m.max,claimed=base.claimed.includes(m.id),a=document.createElement('article');a.className=`${done?'ready':''} ${claimed?'done':''}`;a.innerHTML=`<div><b>${m.name}</b><span>${m.desc}</span></div><strong>${claimed?'✓':done?`CLAIM ${m.reward} ◆`:`${Math.min(m.value,m.max)}/${m.max}`}</strong><i style="--progress:${Math.min(100,m.value/m.max*100)}%"></i>`;if(done&&!claimed)bindTap(a,()=>{base.claimed.push(m.id);p.currency+=m.reward;S.save();S.toast(`${m.name}  +${m.reward} ◆`,'gold');updateProfile();});$('missionList').appendChild(a);});
    $('achievementList').innerHTML=S.achievements.map(a=>`<article class="${p.claimed.includes(a.id)?'done':''}"><div><b>${a.name}</b><span>${a.desc}</span></div><strong>${p.claimed.includes(a.id)?'✓':`+${a.reward} ◆`}</strong></article>`).join('');
  }

  function applySettings(){
    const s=S.profile.settings; document.body.classList.toggle('high-contrast',s.contrast);
    for(const [id,key] of [['soundToggle','sound'],['hapticToggle','haptics'],['shakeToggle','shake'],['contrastToggle','contrast']]) $(id).checked=s[key];
    $('difficulty').value=s.difficulty;
  }

  document.querySelectorAll('.nav-btn').forEach(b=>bindTap(b,()=>{document.querySelectorAll('.panel').forEach(x=>x.classList.add('hidden'));$(b.dataset.panel).classList.remove('hidden');updateProfile();}));
  document.querySelectorAll('.close-meta').forEach(b=>bindTap(b,()=>{b.closest('.panel').classList.add('hidden');$('start').classList.remove('hidden');updateProfile();}));
  $('difficulty').addEventListener('change',e=>{S.profile.settings.difficulty=e.target.value;S.save();});
  for(const [id,key] of [['soundToggle','sound'],['hapticToggle','haptics'],['shakeToggle','shake'],['contrastToggle','contrast']]) $(id).addEventListener('change',e=>{S.profile.settings[key]=e.target.checked;S.save();applySettings();});
  bindTap($('resetProgress'),()=>{ if(confirm('Reset all Shardwake progress?')) S.reset(); });
  window.addEventListener('shardwake:toast',e=>{const t=document.createElement('div');t.className=`toast ${e.detail.tone}`;t.textContent=e.detail.text;$('toastLayer').appendChild(t);setTimeout(()=>t.remove(),3200);});
  window.addEventListener('shardwake:profile',updateProfile);
  window.addEventListener('shardwake:discovery',renderCodex);
  window.addEventListener('error',()=>{$('bootError').hidden=false;});
  document.addEventListener('selectstart',e=>e.preventDefault(),{passive:false});
  document.addEventListener('dragstart',e=>e.preventDefault(),{passive:false});
  if('serviceWorker' in navigator) addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  updateProfile(); applySettings();
})();
