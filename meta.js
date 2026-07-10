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
    $('shipPreview').style.color=skins.find(x=>x.id===p.selectedSkin)?.color;
    renderCores(); renderSkins(); renderMissions();
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
  window.addEventListener('error',()=>{$('bootError').hidden=false;});
  if('serviceWorker' in navigator) addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  updateProfile(); applySettings();
})();
