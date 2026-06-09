/* ============================================================
   FocusLock — App logic
   ------------------------------------------------------------
   All behavior lives here. The HTML uses inline onclick="..."
   handlers, so the functions below must stay GLOBAL — do not
   wrap this file in a module or IIFE.

   Quick edit guide:
     • Add/remove a blockable app → edit the APPS array.
     • Change default focus schedules → edit focusSchedules.
     • Change bypass token count    → edit bypassTokens.
   Sections are divided by the ─── headers below.
   ============================================================ */

// ─── Clock ───────────────────────────────────────────────────────
function updateClock(){
  const n=new Date();let h=n.getHours(),m=n.getMinutes();
  const ap=h>=12?'PM':'AM';h=h%12||12;
  document.getElementById('clock').textContent=h+':'+String(m).padStart(2,'0')+' '+ap;
}
updateClock();setInterval(updateClock,10000);

// ─── App catalogue ───────────────────────────────────────────────
// domain is the website that gets auto-blocked when the app is toggled
const APPS=[
  {id:'instagram', name:'Instagram',  domain:'instagram.com',       icon:'📸', bg:'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)'},
  {id:'twitter',   name:'X (Twitter)',domain:'x.com',               icon:'🐦', bg:'#000'},
  {id:'youtube',   name:'YouTube',    domain:'youtube.com',         icon:'▶️', bg:'#FF0000'},
  {id:'linkedin',  name:'LinkedIn',   domain:'linkedin.com',        icon:'💼', bg:'#0077B5'},
  {id:'facebook',  name:'Facebook',   domain:'facebook.com',        icon:'💬', bg:'#3b5998'},
  {id:'netflix',   name:'Netflix',    domain:'netflix.com',         icon:'🎬', bg:'#E50914'},
  {id:'tiktok',    name:'TikTok',     domain:'tiktok.com',          icon:'🎵', bg:'#111'},
  {id:'spotify',   name:'Spotify',    domain:'open.spotify.com',    icon:'🎵', bg:'#1DB954'},
  {id:'discord',   name:'Discord',    domain:'discord.com',         icon:'🎮', bg:'#7289DA'},
  {id:'whatsapp',  name:'WhatsApp',   domain:'web.whatsapp.com',    icon:'💬', bg:'#25D366'},
];
const APP_MAP=Object.fromEntries(APPS.map(a=>[a.id,a]));

// ─── Global state ────────────────────────────────────────────────
// blockedApps: Set of appIds toggled on globally
let blockedApps=new Set(['instagram','twitter','netflix']);
// customSites: manually added domains (not auto-synced from apps)
let customSites=['reddit.com','news.ycombinator.com'];
let bypassTokens=3;
let bypassActiveUntil=null;
let currentDetailId=null;

// Derived: auto-blocked domains = domains whose appId is in blockedApps
function autoBlockedDomains(){
  return APPS.filter(a=>blockedApps.has(a.id)).map(a=>a.domain);
}

// Per-focus schedules
let focusSchedules=[
  {id:'f1',name:'Work Hours',   purpose:'Stay focused on work tasks',start:'09:00',end:'17:00',days:[1,2,3,4,5],icon:'🎯',active:true,
   focusApps:new Set(['instagram','twitter','tiktok','youtube','netflix']),
   focusSites:[]},
  {id:'f2',name:'Evening Wind-Down',purpose:'Unplug before bed',  start:'21:00',end:'23:59',days:[0,1,2,3,4,5,6],icon:'🌙',active:true,
   focusApps:new Set(['instagram','twitter','tiktok','discord']),
   focusSites:[]},
];
let focusIdCounter=3;
let selectedDays=[0,1,2,3,4,5];
let selectedIcon='🎯';

// ─── Helpers ─────────────────────────────────────────────────────
function fmt12(t){const[hh,mm]=t.split(':').map(Number);const ap=hh>=12?'PM':'AM';const h=hh%12||12;return h+':'+(mm<10?'0':'')+mm+' '+ap;}
function dayLabel(days){
  if(days.length===7)return'Daily';
  const s=JSON.stringify([...days].sort((a,b)=>a-b));
  if(s==='[1,2,3,4,5]')return'Mon–Fri';
  if(s==='[0,6]')return'Weekends';
  return[...days].sort((a,b)=>a-b).map(d=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ');
}
function isActiveNow(f){
  if(!f.active)return false;
  const now=new Date();const dow=now.getDay();
  if(!f.days.includes(dow))return false;
  const cur=now.getHours()*60+now.getMinutes();
  const[sh,sm]=f.start.split(':').map(Number);const[eh,em]=f.end.split(':').map(Number);
  return cur>=sh*60+sm&&cur<=eh*60+em;
}
function getActiveFocus(){return focusSchedules.find(f=>isActiveNow(f))||null;}
function getNextFocus(){
  const now=new Date();const cur=now.getHours()*60+now.getMinutes();const dow=now.getDay();
  let best=null,bestMin=Infinity;
  for(const f of focusSchedules){
    if(!f.active)continue;
    const[sh,sm]=f.start.split(':').map(Number);const mins=sh*60+sm;
    for(let d=0;d<7;d++){
      const day=(dow+d)%7;if(!f.days.includes(day))continue;
      const diff=d===0?mins-cur:mins+1440*d-cur;
      if(diff>0&&diff<bestMin){bestMin=diff;best=f;}break;
    }
  }
  return best;
}
function isBypassed(){
  if(!bypassActiveUntil)return false;
  if(bypassActiveUntil===-1)return new Date()<new Date(new Date().toDateString()+' 23:59:59');
  return new Date()<bypassActiveUntil;
}
function tokenDotsHTML(count,total=3,big=false){
  const cls=big?'dts-dot':'token';
  return[...Array(total)].map((_,i)=>'<div class="'+cls+(i>=count?' used':'')+'"></div>').join('');
}

// ─── Global Apps panel ────────────────────────────────────────────
// When an app is toggled ON, its domain auto-appears in the websites panel.
// When toggled OFF, the domain is removed from auto list.
function renderGlobalApps(){
  APPS.forEach(app=>{
    const el=document.getElementById('gac-'+app.id);
    if(!el)return;
    const on=blockedApps.has(app.id);
    el.innerHTML=
      '<div class="app-card">'+
        '<div class="app-icon" style="background:'+app.bg+';">'+app.icon+'</div>'+
        '<div class="app-info">'+
          '<div class="app-name">'+app.name+'</div>'+
          '<div class="app-sub">'+app.domain+(on?' · auto-blocked':' · not blocked')+'</div>'+
        '</div>'+
        '<div class="toggle-wrap">'+
          '<button class="toggle'+(on?' on':'')+'" onclick="toggleGlobalApp(\''+app.id+'\')"></button>'+
          (on?'<span class="auto-badge">AUTO</span>':'')+
        '</div>'+
      '</div>';
  });
}

function toggleGlobalApp(id){
  if(blockedApps.has(id))blockedApps.delete(id);
  else blockedApps.add(id);
  renderGlobalApps();
  renderGlobalSites();
  updateStats();
}

// ─── Global Websites panel ────────────────────────────────────────
function renderGlobalSites(){
  // Auto-blocked section
  const al=document.getElementById('auto-sites-list');
  const autoDomains=autoBlockedDomains();
  if(autoDomains.length===0){
    al.innerHTML='<div style="color:#555;font-size:13px;padding:10px 18px;font-style:italic;">Block an app above to auto-block its website.</div>';
  } else {
    al.innerHTML=autoDomains.map(domain=>{
      const app=APPS.find(a=>a.domain===domain);
      return '<div class="web-row">'+
        '<div class="web-icon">'+app.icon+'</div>'+
        '<div class="app-info"><div class="web-url">'+domain+'</div><div class="web-domain">Auto-blocked via '+app.name+'</div></div>'+
        '<button class="toggle on locked" disabled title="Toggle the app to unblock"></button>'+
      '</div><div class="divider"></div>';
    }).join('');
  }
  // Custom sites section
  const cl=document.getElementById('custom-sites-list');
  if(customSites.length===0){
    cl.innerHTML='<div style="color:#555;font-size:13px;padding:10px 18px;font-style:italic;">No custom sites added yet.</div>';
  } else {
    cl.innerHTML=customSites.map((site,i)=>
      '<div class="web-row" id="csr-'+i+'">'+
        '<div class="web-icon">🔗</div>'+
        '<div class="app-info"><div class="web-url">'+site+'</div><div class="web-domain">'+site.split('/')[0]+'</div></div>'+
        '<button class="toggle on" onclick="removeCustomSite('+i+')"></button>'+
      '</div><div class="divider"></div>'
    ).join('');
  }
  updateStats();
}

function addGlobalSite(){
  const inp=document.getElementById('site-input');
  let url=inp.value.trim().replace(/^https?:\/\//,'').replace(/\/$/,'');
  if(!url)return;
  // Don't add if it's already auto-blocked
  if(autoBlockedDomains().includes(url)){inp.value='';return;}
  if(!customSites.includes(url))customSites.push(url);
  inp.value='';inp.blur();
  renderGlobalSites();
}

function removeCustomSite(i){
  customSites.splice(i,1);
  renderGlobalSites();
}

// ─── Dashboard ────────────────────────────────────────────────────
function renderDashboard(){
  const af=getActiveFocus();const bp=isBypassed();
  const badge=document.getElementById('status-badge');
  if(bp){badge.className='bypassed-badge';badge.innerHTML='<div class="dot-bypass"></div><span>Bypassed</span>';}
  else if(af){badge.className='blocker-badge';badge.innerHTML='<div class="dot-on"></div><span>'+af.name+' Active</span>';}
  else{badge.className='blocker-badge';badge.innerHTML='<div class="dot-on"></div><span>Blocking Active</span>';}

  // Active focus card
  const aw=document.getElementById('dash-active-wrap');
  if(af){
    const byp=isBypassed();
    const bLabel=byp?'⏸ Bypassed':'🔓 Bypass';
    const bCls='bypass-btn'+(byp?' bypassed':'');
    const bDis=(bypassTokens<=0&&!byp)||byp?'disabled':'';
    aw.innerHTML=
      '<div class="dash-card active-focus" onclick="openDetail(\''+af.id+'\')">'+
        '<div class="dash-card-header active-bg">'+
          '<span class="dash-card-label red">🔴 Focus Active</span>'+
          '<div class="lock-badge"><span>🔒 Locked</span></div>'+
        '</div>'+
        '<div class="dash-card-body">'+
          '<div style="font-size:26px;margin-bottom:5px;">'+af.icon+'</div>'+
          '<div class="dash-focus-name">'+af.name+'</div>'+
          '<div class="dash-focus-purpose">'+af.purpose+'</div>'+
          '<div class="dash-time-row">'+
            '<div class="dash-time-box"><div class="dash-time-val">'+fmt12(af.start)+'</div><div class="dash-time-lbl">Started</div></div>'+
            '<div class="dash-time-box"><div class="dash-time-val">'+fmt12(af.end)+'</div><div class="dash-time-lbl">Ends</div></div>'+
            '<div class="dash-time-box"><div class="dash-time-val">'+dayLabel(af.days)+'</div><div class="dash-time-lbl">Days</div></div>'+
          '</div>'+
        '</div>'+
        '<div class="bypass-row">'+
          '<div style="display:flex;flex-direction:column;gap:5px;">'+
            '<div style="color:#555;font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;">Bypass Tokens</div>'+
            '<div class="bypass-tokens">'+tokenDotsHTML(bypassTokens)+'</div>'+
          '</div>'+
          '<button class="'+bCls+'" '+bDis+' onclick="event.stopPropagation();openBypassModal()">'+bLabel+'</button>'+
        '</div>'+
        '<div class="tap-hint">👆 Tap card to view restrictions</div>'+
      '</div>';
  } else {
    aw.innerHTML=
      '<div class="dash-card" style="cursor:default;">'+
        '<div class="dash-card-body" style="text-align:center;padding:24px 16px;">'+
          '<div style="font-size:32px;margin-bottom:8px;">✅</div>'+
          '<div class="dash-focus-name" style="font-size:17px;">No Active Focus</div>'+
          '<div class="dash-focus-purpose">You\'re in free time right now.</div>'+
        '</div>'+
      '</div>';
  }

  // Next focus card
  const nf=getNextFocus();
  const nw=document.getElementById('dash-next-wrap');
  if(nf){
    nw.innerHTML=
      '<div class="dash-card" onclick="openDetail(\''+nf.id+'\')">'+
        '<div class="dash-card-header"><span class="dash-card-label grey">Up next — tap to view</span></div>'+
        '<div class="dash-card-body">'+
          '<div class="dash-next-body">'+
            '<div style="font-size:24px;">'+nf.icon+'</div>'+
            '<div><div class="dash-focus-name" style="font-size:16px;">'+nf.name+'</div>'+
            '<div style="color:#888;font-size:12px;margin-top:2px;">'+fmt12(nf.start)+' – '+fmt12(nf.end)+' · '+dayLabel(nf.days)+'</div></div>'+
            '<span style="color:#333;font-size:20px;margin-left:auto;">›</span>'+
          '</div>'+
        '</div>'+
      '</div>';
  } else {
    nw.innerHTML='<div class="dash-empty"><span class="emoji">📭</span>No upcoming focus scheduled.</div>';
  }
}

// ─── Focus Detail Panel ───────────────────────────────────────────
function openDetail(id){
  const f=focusSchedules.find(x=>x.id===id);
  if(!f)return;
  currentDetailId=id;
  const locked=isActiveNow(f);
  document.getElementById('detail-title').textContent=f.name;
  renderDetailStatic(f,locked);
  renderDetailContent(f,locked);
  document.getElementById('detail-panel').classList.add('open');
}

function renderDetailStatic(f,locked){
  // hero + token strip + optional locked banner — never re-rendered on interaction
  document.getElementById('detail-static').innerHTML=
    // Hero
    '<div class="detail-hero">'+
      '<div class="detail-hero-row">'+
        '<div class="detail-hero-icon">'+f.icon+'</div>'+
        '<div><div class="detail-hero-name">'+f.name+'</div><div class="detail-hero-purpose">'+f.purpose+'</div></div>'+
      '</div>'+
      '<div class="detail-chips">'+
        '<div class="detail-chip"><div class="detail-chip-val">'+fmt12(f.start)+'</div><div class="detail-chip-lbl">Start</div></div>'+
        '<div class="detail-chip"><div class="detail-chip-val">'+fmt12(f.end)+'</div><div class="detail-chip-lbl">End</div></div>'+
        '<div class="detail-chip"><div class="detail-chip-val">'+dayLabel(f.days)+'</div><div class="detail-chip-lbl">Days</div></div>'+
      '</div>'+
    '</div>'+
    // Token strip — always visible, always up to date
    '<div class="detail-token-strip" id="detail-token-strip">'+
      '<div class="dts-left">'+
        '<div class="dts-label">Bypass Tokens</div>'+
        '<div class="dts-sub" id="dts-sub-text">'+bypassTokens+' remaining this month</div>'+
      '</div>'+
      '<div class="dts-right">'+
        '<div class="dts-dots" id="dts-dots">'+tokenDotsHTML(bypassTokens,3,true)+'</div>'+
        '<div class="dts-count" id="dts-count">'+bypassTokens+'/3</div>'+
        (locked&&bypassTokens>0&&!isBypassed()?'<button style="background:rgba(224,90,107,0.15);border:0.5px solid rgba(224,90,107,0.35);color:#e05a6b;border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;margin-left:6px;" onclick="openBypassModal()">Bypass</button>':'')+
      '</div>'+
    '</div>'+
    // Locked banner (only when active)
    (locked?
      '<div class="locked-banner">'+
        '<span style="font-size:20px;flex-shrink:0;">🔒</span>'+
        '<div><div class="locked-banner-text">This focus is currently active</div>'+
        '<div class="locked-banner-sub">View-only while running. Use a bypass token to pause it.</div></div>'+
      '</div>':''
    );
}

function refreshDetailTokens(){
  const d=document.getElementById('dts-dots');
  const c=document.getElementById('dts-count');
  const s=document.getElementById('dts-sub-text');
  if(d)d.innerHTML=tokenDotsHTML(bypassTokens,3,true);
  if(c)c.textContent=bypassTokens+'/3';
  if(s)s.textContent=bypassTokens+' remaining this month';
}

function renderDetailContent(f,locked){
  const dc=document.getElementById('detail-content');
  let h='';

  // ── Blocked Apps ──
  h+='<div class="section-label">Apps Blocked in This Focus</div>';
  // auto-domain tracking: if app is blocked in focus, its domain is included automatically
  APPS.forEach(app=>{
    const on=f.focusApps.has(app.id);
    const tCls='toggle'+(on?' on':'')+(locked?' locked':'');
    const handler=locked?'':'onclick="toggleFocusApp(\''+f.id+'\',\''+app.id+'\')"';
    h+='<div class="app-card">'+
        '<div class="app-icon" style="background:'+app.bg+';">'+app.icon+'</div>'+
        '<div class="app-info"><div class="app-name">'+app.name+'</div>'+
        '<div class="app-sub">'+app.domain+(on?' · blocked in focus':'')+'</div></div>'+
        '<div class="toggle-wrap">'+
          '<button class="'+tCls+'" '+(locked?'disabled':'')+' '+handler+'></button>'+
          (on?'<span class="auto-badge">+WEB</span>':'')+
        '</div>'+
      '</div><div class="divider"></div>';
  });

  // ── Auto-blocked websites from focus apps ──
  const focusAutoDomains=APPS.filter(a=>f.focusApps.has(a.id)).map(a=>a.domain);
  h+='<div class="section-label">Auto-blocked Websites</div>';
  if(focusAutoDomains.length===0){
    h+='<div style="color:#555;font-size:13px;padding:10px 18px;font-style:italic;">Block an app above to auto-add its website.</div>';
  } else {
    focusAutoDomains.forEach(domain=>{
      const app=APPS.find(a=>a.domain===domain);
      h+='<div class="web-row"><div class="web-icon">'+app.icon+'</div>'+
          '<div class="app-info"><div class="web-url">'+domain+'</div><div class="web-domain">Auto via '+app.name+'</div></div>'+
          '<button class="toggle on locked" disabled></button></div><div class="divider"></div>';
    });
  }

  // ── Custom extra websites for this focus ──
  h+='<div class="section-label">Extra Blocked Websites</div>';
  if(!locked){
    h+='<div class="detail-web-add-row">'+
        '<input class="detail-web-input" id="dwi-'+f.id+'" placeholder="e.g. distracting-site.com" autocapitalize="none" autocorrect="off"/>'+
        '<button class="detail-web-add-btn" onclick="addFocusSite(\''+f.id+'\')">Add</button>'+
      '</div>';
  }
  if(f.focusSites.length===0){
    h+='<div style="color:#555;font-size:13px;padding:10px 18px;font-style:italic;">No extra websites blocked for this focus.</div>';
  } else {
    f.focusSites.forEach((site,i)=>{
      h+='<div class="web-row"><div class="web-icon">🔗</div>'+
          '<div class="app-info"><div class="web-url">'+site+'</div><div class="web-domain">'+site.split('/')[0]+'</div></div>'+
          (locked
            ?'<button class="toggle on locked" disabled></button>'
            :'<button class="toggle on" onclick="removeFocusSite(\''+f.id+'\','+i+')"></button>')+
        '</div><div class="divider"></div>';
    });
  }

  // ── Focus toggle + delete (only when not active) ──
  if(!locked){
    h+='<div class="section-label">Schedule Status</div>'+
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 18px;">'+
        '<div><div style="color:#e8e8f0;font-size:14px;font-weight:600;">Enable this Focus</div>'+
        '<div style="color:#555;font-size:11px;margin-top:2px;">Turns blocking on/off for this schedule</div></div>'+
        '<button class="toggle'+(f.active?' on':'')+'" onclick="toggleFocusActive(\''+f.id+'\')"></button>'+
      '</div>';
    h+='<button class="del-focus-btn" onclick="deleteFocusFromDetail(\''+f.id+'\')">Delete This Focus</button>';
  }
  h+='<div style="height:24px;"></div>';
  dc.innerHTML=h;
}

function closeDetail(){
  document.getElementById('detail-panel').classList.remove('open');
  currentDetailId=null;
  renderFocusCards();
  renderDashboard();
}

// ─── Per-focus actions ────────────────────────────────────────────
function toggleFocusApp(fid,appId){
  const f=focusSchedules.find(x=>x.id===fid);
  if(!f||isActiveNow(f))return;
  if(f.focusApps.has(appId))f.focusApps.delete(appId);
  else f.focusApps.add(appId);
  renderDetailContent(f,false);
}
function addFocusSite(fid){
  const f=focusSchedules.find(x=>x.id===fid);if(!f)return;
  const inp=document.getElementById('dwi-'+fid);
  let url=inp.value.trim().replace(/^https?:\/\//,'').replace(/\/$/,'');
  if(!url)return;
  f.focusSites.push(url);inp.value='';
  renderDetailContent(f,false);
}
function removeFocusSite(fid,idx){
  const f=focusSchedules.find(x=>x.id===fid);if(!f)return;
  f.focusSites.splice(idx,1);renderDetailContent(f,false);
}
function toggleFocusActive(fid){
  const f=focusSchedules.find(x=>x.id===fid);
  if(!f||isActiveNow(f))return;
  f.active=!f.active;renderDetailContent(f,false);
}
function deleteFocusFromDetail(fid){
  focusSchedules=focusSchedules.filter(x=>x.id!==fid);
  closeDetail();
}

// ─── Customize panel ─────────────────────────────────────────────
function renderCustomizeTokens(){
  const num=document.getElementById('cust-token-num');
  const bar=document.getElementById('cust-token-bar');
  if(num)num.textContent=bypassTokens;
  if(bar)bar.innerHTML=[...Array(3)].map((_,i)=>
    '<div class="token-bar-seg '+(i<bypassTokens?'filled':'empty')+'"></div>'
  ).join('');
}

function renderFocusCards(){
  const container=document.getElementById('focus-cards');if(!container)return;
  container.innerHTML='';
  document.getElementById('focus-count-num').textContent=focusSchedules.length;
  document.getElementById('add-focus-btn').className='add-focus-btn'+(focusSchedules.length>=10?' maxed':'');
  focusSchedules.forEach(f=>{
    const active=isActiveNow(f);
    const appCount=f.focusApps.size;
    const webCount=APPS.filter(a=>f.focusApps.has(a.id)).length+f.focusSites.length;
    const div=document.createElement('div');
    div.className='focus-card';
    div.onclick=()=>openDetail(f.id);
    div.innerHTML=
      '<div class="focus-card-header">'+
        '<div class="focus-card-icon">'+f.icon+'</div>'+
        '<div style="flex:1;min-width:0;">'+
          '<div class="focus-card-name">'+f.name+(active?' <span style="color:#e05a6b;font-size:10px;">● Active</span>':'')+'</div>'+
          '<div class="focus-card-time">'+fmt12(f.start)+' – '+fmt12(f.end)+' · '+dayLabel(f.days)+'</div>'+
        '</div>'+
        '<span style="color:#333;font-size:20px;flex-shrink:0;">›</span>'+
      '</div>'+
      '<div class="focus-card-footer">'+
        '<span class="focus-card-purpose">'+f.purpose+'</span>'+
        '<span style="color:#555;font-size:10px;flex-shrink:0;margin-left:8px;">'+appCount+' apps · '+webCount+' sites'+(active?' 🔒':'')+'</span>'+
      '</div>';
    container.appendChild(div);
  });
  renderCustomizeTokens();
}

// ─── Bypass ──────────────────────────────────────────────────────
function openBypassModal(){
  if(bypassTokens<=0||isBypassed())return;
  document.getElementById('bypass-warning-text').textContent=
    '⚠️ '+bypassTokens+' bypass token'+(bypassTokens===1?'':'s')+' left this month. Only pauses the current focus — others stay active.';
  document.getElementById('modal-bypass').classList.add('show');
}
function activateBypass(minutes){
  bypassTokens=Math.max(0,bypassTokens-1);
  bypassActiveUntil=minutes===-1?-1:new Date(Date.now()+minutes*60000);
  closeModal('modal-bypass');
  updateStats();renderDashboard();renderCustomizeTokens();
  refreshDetailTokens();
}

// ─── New Focus modal ─────────────────────────────────────────────
function openNewFocusModal(){
  if(focusSchedules.length>=10)return;
  ['new-focus-name','new-focus-purpose'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('new-focus-start').value='09:00';
  document.getElementById('new-focus-end').value='17:00';
  selectedDays=[0,1,2,3,4,5];
  document.querySelectorAll('.day-btn').forEach(b=>b.classList.toggle('active',selectedDays.includes(parseInt(b.dataset.day))));
  selectedIcon='🎯';
  document.querySelectorAll('.icon-btn').forEach(b=>b.classList.toggle('active',b.dataset.icon==='🎯'));
  document.getElementById('modal-new-focus').classList.add('show');
  setTimeout(()=>document.getElementById('new-focus-name').focus(),300);
}
function saveNewFocus(){
  const name=document.getElementById('new-focus-name').value.trim();
  const purpose=document.getElementById('new-focus-purpose').value.trim();
  const start=document.getElementById('new-focus-start').value;
  const end=document.getElementById('new-focus-end').value;
  if(!name){document.getElementById('new-focus-name').focus();return;}
  if(!selectedDays.length){alert('Pick at least one day.');return;}
  focusSchedules.push({id:'f'+focusIdCounter++,name,purpose:purpose||'Stay focused',start,end,days:[...selectedDays],icon:selectedIcon,active:true,focusApps:new Set(),focusSites:[]});
  closeModal('modal-new-focus');renderFocusCards();renderDashboard();
}
document.querySelectorAll('.day-btn').forEach(b=>{
  b.addEventListener('click',()=>{
    const d=parseInt(b.dataset.day);
    if(selectedDays.includes(d)){if(selectedDays.length===1)return;selectedDays=selectedDays.filter(x=>x!==d);}
    else selectedDays.push(d);
    b.classList.toggle('active',selectedDays.includes(d));
  });
});
document.querySelectorAll('.icon-btn').forEach(b=>{
  b.addEventListener('click',()=>{document.querySelectorAll('.icon-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');selectedIcon=b.dataset.icon;});
});

// ─── Nav & sidebar ────────────────────────────────────────────────
function switchTab(tab){
  ['dash','apps','sites','customize'].forEach(t=>{
    document.getElementById('panel-'+t).classList.remove('active');
    document.getElementById('nav-'+t).classList.remove('active');
    const sb=document.getElementById('sb-'+t);if(sb)sb.classList.remove('active');
  });
  document.getElementById('panel-'+tab).classList.add('active');
  document.getElementById('nav-'+tab).classList.add('active');
  const sb=document.getElementById('sb-'+tab);if(sb)sb.classList.add('active');
  if(tab==='dash')renderDashboard();
  if(tab==='apps')renderGlobalApps();
  if(tab==='sites')renderGlobalSites();
  if(tab==='customize')renderFocusCards();
}
function openSidebar(){document.getElementById('sidebar').classList.add('open');document.getElementById('overlay').style.display='block';}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('overlay').style.display='none';}
function closeModal(id){document.getElementById(id).classList.remove('show');}

// ─── Stats ───────────────────────────────────────────────────────
function updateStats(){
  const autoCount=autoBlockedDomains().length;
  const total=blockedApps.size+customSites.length+autoCount;
  document.getElementById('stat-total').textContent=total;
  document.getElementById('sb-app-count').textContent=blockedApps.size;
  document.getElementById('sb-site-count').textContent=autoCount+customSites.length;
  document.getElementById('stat-bypass').textContent=bypassTokens;
}
function updateStrict(v){document.getElementById('strict-lbl').textContent=['','Low','Medium','High'][v];}

document.getElementById('site-input').addEventListener('keydown',e=>{if(e.key==='Enter')addGlobalSite();});

// ─── Init ─────────────────────────────────────────────────────────
renderGlobalApps();
renderGlobalSites();
renderDashboard();
renderFocusCards();
updateStats();
