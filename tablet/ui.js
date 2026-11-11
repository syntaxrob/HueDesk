/* =========================================================================
   HueDesk Tablet UI : touch-first, kiosk-ready front end on the shared engine
   ========================================================================= */
const ICON={
  play:'<path class="f" d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
  lights:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  fx:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  cues:'<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  keys:'<path stroke-width="3.2" d="M6 5h.01M12 5h.01M18 5h.01M6 11h.01M12 11h.01M18 11h.01M6 17h.01M12 17h.01M18 17h.01"/>',
  setup:'<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.8"/>',
  full:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  exitfull:'<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'};
const svg=n=>`<svg viewBox="0 0 24 24" class="ic">${ICON[n]}</svg>`;
const TABS=[['play','PLAY'],['lights','LIGHTS'],['fx','FX'],['cues','CUES'],['keys','KEYPAD'],['setup','SETUP']];
let curTab='play',tileEls={},wheelImg=null,wheelSig=null,clockSec=-1,KT=[];
window.HUEDESK_DEVICE='tablet';
const vib=ms=>{try{navigator.vibrate&&navigator.vibrate(ms);}catch(e){}};

/* ---------------- kiosk settings (device only, not part of the show) ---------------- */
const KIOSK_KEY='huedesk.tablet.kiosk';
let K={wake:true,idleHome:5,idleDim:0,hideEmpty:true,lockFx:true,pin:''};
try{Object.assign(K,JSON.parse(store.get(KIOSK_KEY)||'{}'));}catch(e){}
function saveK(){store.set(KIOSK_KEY,JSON.stringify(K));}
let wakeLock=null;
async function applyWake(){try{
  if(K.wake&&'wakeLock' in navigator&&document.visibilityState==='visible'){if(!wakeLock){wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>{wakeLock=null;});}}
  else if(!K.wake&&wakeLock){await wakeLock.release();wakeLock=null;}}catch(e){}}
function isFs(){return !!(document.fullscreenElement||document.webkitFullscreenElement);}
function toggleFs(){const d=document,el=d.documentElement;try{
  if(isFs())(d.exitFullscreen||d.webkitExitFullscreen).call(d);
  else{const r=el.requestFullscreen||el.webkitRequestFullscreen;if(r)r.call(el);else msg('Full screen is not available in this browser. Add HueDesk to your home screen instead (see Setup).','warn');}}catch(e){}}
function setLocked(v){RT.locked=v;store.set('huedesk.tablet.locked',v?'1':'0');document.body.classList.toggle('locked',v);
  document.body.classList.toggle('playonly',!K.lockFx);if(v){closeModal();if(!tabAllowed(curTab))showTab('play');}msg(v?'Locked':'Unlocked',v?'':'ok');}
function tabAllowed(t){if(!RT.locked)return true;if(['cues','keys','setup'].includes(t))return false;if(!K.lockFx&&t!=='play')return false;return true;}
function lockTap(){
  if(RT.locked){pinPad('Enter PIN to unlock',p=>{if(p===K.pin)setLocked(false);else{vib([40,40,40]);msg('Wrong PIN','err');}});return;}
  if(!K.pin){pinPad('Choose a 4-digit PIN',p1=>pinPad('Enter it again',p2=>{if(p1===p2){K.pin=p1;saveK();setLocked(true);}else msg('The PINs did not match','err');}));return;}
  setLocked(true);}
function pinPad(title,cb){let v='';const b=modal(title,`<div class="pin"><div class="pindots" id="pinDots"></div><div class="pinkeys">${['1','2','3','4','5','6','7','8','9','C','0','⌫'].map(k=>`<button class="b" data-k="${k}">${k}</button>`).join('')}</div></div>`);
  const draw=()=>{$('#pinDots').innerHTML=[0,1,2,3].map(i=>`<i class="${i<v.length?'on':''}"></i>`).join('');};draw();
  $$('[data-k]',b).forEach(btn=>btn.onclick=()=>{vib(8);const k=btn.dataset.k;if(k==='C')v='';else if(k==='⌫')v=v.slice(0,-1);else if(v.length<4)v+=k;draw();
    if(v.length===4){const val=v;setTimeout(()=>{closeModal();cb(val);},140);}});}
/* idle handling */
let lastAct=Date.now(),sleeping=false;
function sleepNow(){sleeping=true;$('#sleep').hidden=false;}
function wakeUp(){sleeping=false;$('#sleep').hidden=true;lastAct=Date.now();}
function idleTick(){const idle=(Date.now()-lastAct)/60000;
  if(K.idleHome>0&&idle>=K.idleHome&&!RT.tour&&(curTab!=='play'||!$('#modal').hidden)){closeModal();showTab('play');}
  if(K.idleDim>0&&idle>=K.idleDim&&!sleeping&&!RT.tour)sleepNow();}

/* ---------------- feedback + modals ---------------- */
let toastT=0;
function msg(text,type=''){const el=$('#toast');el.textContent=text;el.className='show '+type;clearTimeout(toastT);toastT=setTimeout(()=>{el.className='';},type==='err'?6000:3400);}
function modal(title,html,wide){const m=$('#modal');$('.mt',m).textContent=title;const b=$('.mb',m);b.innerHTML=html;m.hidden=false;m.classList.toggle('wide',!!wide);RT.modal=true;return b;}
function closeModal(){$('#modal').hidden=true;RT.modal=false;const f=RT.onClose;RT.onClose=null;f&&f();}
function promptModal(title,val,cb,type='text'){modal(title,`<input id="pmIn" type="${type}" value="${esc(val)}" ${type==='number'?'inputmode="decimal" step="any"':''}><div class="mfoot"><button class="b" id="pmC">Cancel</button><button class="b pri" id="pmOk">OK</button></div>`);
  const inp=$('#pmIn');setTimeout(()=>inp.focus(),50);const ok=()=>{const v=inp.value;closeModal();cb(v);};
  $('#pmOk').onclick=ok;$('#pmC').onclick=closeModal;inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();ok();}};}
function choose(title,text,opts,cb){modal(title,`<p class="hint" style="font-size:17px;margin:0">${text}</p><div class="mfoot"><button class="b" data-ch="">Cancel</button>${opts.map(([v,l,c])=>`<button class="b ${c||''}" data-ch="${v}">${l}</button>`).join('')}</div>`);
  $$('[data-ch]').forEach(b=>b.onclick=()=>{closeModal();if(b.dataset.ch)cb(b.dataset.ch);});}
function disarm(){RT.armed=null;}
function clearSmart(){doClear();}
function execOffNow(e){Object.assign(RT.ex[e],{active:false,off:null,cueIdx:-1,fade:null,paused:false,cueSel:-1});}

/* ---------------- touch helpers ---------------- */
function press(container,sel,{tap,long}){let timer=0,tgt=null,sx=0,sy=0,fired=false;
  container.addEventListener('pointerdown',e=>{tgt=e.target.closest(sel);if(!tgt||!container.contains(tgt))return;sx=e.clientX;sy=e.clientY;fired=false;
    if(long)timer=setTimeout(()=>{if(!tgt)return;fired=true;if(RT.locked)return;vib(25);long(tgt,e);},560);});
  container.addEventListener('pointermove',e=>{if(tgt&&Math.hypot(e.clientX-sx,e.clientY-sy)>12){clearTimeout(timer);tgt=null;}});
  container.addEventListener('pointerup',()=>{clearTimeout(timer);if(tgt&&!fired){vib(8);tap&&tap(tgt);}tgt=null;});
  container.addEventListener('pointercancel',()=>{clearTimeout(timer);tgt=null;});
  container.addEventListener('contextmenu',e=>e.preventDefault());}
function makeSlider(el,{get,set,dir='h',label='',fmt=v=>Math.round(v*100)+'%',onStart,color}){
  el.classList.add(dir==='h'?'hs':'vf');if(color)el.style.setProperty('--fc2',color);
  el.innerHTML=`<div class="fill"></div>${label?`<span class="lbl">${label}</span>`:''}<span class="val"></span>`;
  let sx=0,sy=0,sv=0,act=false,moved=false;
  el.addEventListener('pointerdown',e=>{act=true;moved=false;sx=e.clientX;sy=e.clientY;sv=get();el.setPointerCapture(e.pointerId);if(onStart&&onStart()===false)act=false;});
  el.addEventListener('pointermove',e=>{if(!act)return;const r=el.getBoundingClientRect(),d=dir==='h'?(e.clientX-sx)/r.width:(sy-e.clientY)/r.height;
    if(!moved&&Math.abs(d)>.015)moved=true;if(moved)set(clamp(sv+d,0,1));});
  const end=()=>{act=false;};el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
  el._paint=()=>{const v=get();if(el._v===v)return;el._v=v;el.style.setProperty('--v',v);el.querySelector('.val').textContent=fmt(v);};}

/* ---------------- tabs ---------------- */
function buildTabs(){$('#tabs').innerHTML=TABS.map(([k,l])=>`<button class="tabbtn" data-tab="${k}">${svg(k)}<span>${l}</span></button>`).join('');
  $$('.tabbtn').forEach(b=>b.onclick=()=>{vib(6);showTab(b.dataset.tab);});}
function showTab(t){if(!tabAllowed(t))return;curTab=t;$$('.tab').forEach(s=>s.classList.toggle('on',s.id==='tab-'+t));
  $$('.tabbtn').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));wheelSig=null;if(t==='cues')renderCues();if(t==='setup')renderSetup();}

/* ---------------- render ---------------- */
function renderAll(){$('#showName').textContent=S.name;renderFixtures();renderChips();renderSwatches();renderFxTab();renderMacroBar();buildExecs();renderCues();renderSetup();selChanged();}
function renderFixtures(){const host=$('#fixGrid');tileEls={};
  if(!S.fixtures.length){host.innerHTML=`<div class="hint" style="padding:40px;text-align:center">No lights yet. Go to <b>Setup</b> to connect your Hue Bridge.</div>`;return;}
  const rooms=new Map();for(const f of S.fixtures){const r=f.room||'Unassigned';if(!rooms.has(r))rooms.set(r,[]);rooms.get(r).push(f);}
  host.innerHTML=[...rooms].map(([r,fs])=>`<div class="room"><div class="roomh"><b>${esc(r)}</b><button class="chip" data-room="${esc(r)}">Select ${fs.length}</button></div><div class="fxs">${fs.map(f=>
    `<div class="fx${f.reachable===false?' unr':''}" data-f="${f.id}"><div class="fxc"></div><span class="fxn">${f.id}</span><span class="fxd"></span><span class="fxe">FX</span><span class="fxname">${esc(f.name)}</span><i class="fxlamp"></i></div>`).join('')}</div></div>`).join('');
  $$('.fx',host).forEach(el=>tileEls[el.dataset.f]=el);}
function renderChips(){$('#selChips').innerHTML=`<button class="chip" data-sc="all">All</button><button class="chip" data-sc="none">None</button><button class="chip" data-sc="invert">Invert</button><button class="chip" data-sc="odd">Odd</button><button class="chip" data-sc="even">Even</button><span class="chip sep"></span>`+
  S.groups.slice().sort((a,b)=>a.slot-b.slot).filter(g=>g.fixtures.length!==S.fixtures.length).map(g=>`<button class="chip" data-g="${g.slot}">${esc(g.name)}</button>`).join('')+`<button class="chip edit" data-sc="newgroup">+ Group</button>`;}
function renderSwatches(){$('#swatches').innerHTML=S.colours.slice().sort((a,b)=>a.slot-b.slot).map(c=>`<button class="sw" data-s="${c.slot}" style="--c:${c2hex(c.c)}"><i></i><span>${esc(c.name)}</span></button>`).join('')+
  `<button class="sw edit" data-s="new"><i style="background:none;border:2px dashed var(--ln2);display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--tx2)">+</i><span>Save</span></button>`;
  $('#fadeChips').innerHTML='<span>Fade</span>'+[0,1,2,5,10].map(v=>`<button class="chip" data-fade="${v}">${v}s</button>`).join('');}
function renderFxTab(){
  $('#fxTiles').innerHTML=S.effects.slice().sort((a,b)=>a.slot-b.slot).map(d=>`<button class="pt" data-fx="${d.slot}"><small>${d.slot}</small><span class="ico">${FX_ICON[d.type]||''}</span>${esc(d.name)}</button>`).join('')+`<button class="pt add edit" data-fx="new">+ New effect</button>`;
  $('#sceneTiles').innerHTML=(S.scenes.length?S.scenes.slice().sort((a,b)=>a.slot-b.slot).map(s=>`<button class="pt scene" data-scene="${s.slot}"><small>${s.slot}</small>${esc(s.name)}</button>`).join(''):`<div class="hint" style="grid-column:1/-1">No scenes yet. Set a look on the Lights tab and use STORE.</div>`);
  $('#macroTiles').innerHTML=S.macros.slice().sort((a,b)=>a.slot-b.slot).map(m=>`<button class="pt mac" data-mac="${m.slot}"><small>${m.slot}</small>${esc(m.name)}</button>`).join('')+`<button class="pt add edit" data-mac="new">+ New macro</button>`;
  $('#sms').innerHTML=S.sm.map((s,i)=>`<div class="sm" data-sm="${i}"><div class="smh">SPEED ${i+1}</div><div class="smv"><span>${s.bpm}</span><small>BPM</small></div><i class="smled"></i>
    <div class="smb"><button class="b tap" data-smact="tap">TAP</button><button class="b" data-smact="minus">−</button><button class="b" data-smact="plus">+</button><button class="b" data-smact="half">÷2</button><button class="b" data-smact="dbl">×2</button></div></div>`).join('');}
function renderMacroBar(){$('#macroBar').innerHTML=S.macros.slice().sort((a,b)=>a.slot-b.slot).map(m=>`<button class="chip mac" data-mac="${m.slot}">${esc(m.name)}</button>`).join('');
  $('#macroBar').style.display=S.macros.length?'':'none';}
const faders=[];
function buildExecs(){const host=$('#execGrid');faders.length=0;
  const vis=S.executors.map((ex,e)=>e).filter(e=>!K.hideEmpty||S.executors[e].cues.length);
  host.innerHTML=vis.map(e=>`<div class="xc" data-e="${e}"><div class="xch"><div class="xl1"><span class="xn">${e+1}</span><span class="xl"></span><span class="xm"></span></div><div class="xcur"></div><div class="xnext"></div><div class="xbar"><i></i></div></div>
    <div class="xbody"><div class="vfd"></div><div class="xbtns"><button class="b grn" data-x="go">GO</button><button class="b" data-x="b2">BACK</button><button class="b" data-x="off">OFF</button><button class="b fl" data-x="flash">FLASH</button></div></div></div>`).join('')
    ||`<div class="emptyplay hint">Nothing to play yet.<br>${RT.locked?'Ask whoever runs the desk to add some cues.':'Set a look on <b>Lights</b> and press <b>STORE</b>, or build starter cues in <b>Setup</b>.'}</div>`;
  $$('.xc',host).forEach(card=>{const e=+card.dataset.e;const fd=$('.vfd',card);
    makeSlider(fd,{dir:'v',get:()=>RT.ex[e].level,set:v=>setLevel(e,v),fmt:v=>Math.round(v*100)});faders[e]=fd;
    const fl=$('[data-x=flash]',card);
    fl.addEventListener('pointerdown',ev=>{fl.setPointerCapture(ev.pointerId);RT.ex[e].flash=true;vib(10);});
    const up=()=>{RT.ex[e].flash=false;};fl.addEventListener('pointerup',up);fl.addEventListener('pointercancel',up);
    $$('[data-x]:not([data-x=flash])',card).forEach(b=>b.onclick=()=>{vib(10);const x=b.dataset.x;if(x==='go')execGo(e);else if(x==='b2')execBack(e);else execOff(e);});});}
function renderCues(){const e=RT.selExec,ex=S.executors[e],xr=RT.ex[e];
  $('#xsel').innerHTML=S.executors.map((x,i)=>`<button class="chip${i===e?' on':''}${RT.ex[i].active&&!RT.ex[i].off?' live':''}" data-xs="${i}"><b>${i+1}</b>${esc(x.label||'empty')}</button>`).join('');
  $('#cueTitle').innerHTML=`Exec ${e+1}${ex.label?' · '+esc(ex.label):''}<small>${ex.mode==='chase'?'chaser':'sequence'} · ${ex.cues.length} cue${ex.cues.length===1?'':'s'}</small>`;
  $('[data-cq=back]').textContent=ex.mode==='chase'?(xr.paused?'RESUME':'PAUSE'):'BACK';
  $('#cueList').innerHTML=ex.cues.length?ex.cues.map((c,i)=>`<div class="cr" data-i="${i}"><span class="cm"></span><span class="cn">${fmtNum(c.num)}</span><span class="cname">${c.name?esc(c.name):'<span style="color:var(--tx3)">Cue '+fmtNum(c.num)+'</span>'}<small>${Object.keys(c.values).length} lights${c.effects&&c.effects.length?' · FX':''}</small></span><span class="cf">${fmtNum(c.fade)}s</span><button class="b" data-cg="${i}">GO TO</button><button class="b edit" data-ce="${i}">EDIT</button></div>`).join('')
    :`<div class="emptycues hint">No cues on this executor yet.<br>Set a look on <b>Lights</b>, come back and tap <b>+ STORE CUE</b>.</div>`;}
function renderSetup(){const st=S.settings,demo=MODE==='demo';
  $('#suIp').value=st.ip||'';$('#suUser').value=st.user||'';$('#suName').value=S.name;$('#suRate').value=st.rate;$('#suRateV').textContent=st.rate+'/s';$('#suGrp').checked=!!st.groupOpt;
  $('#suDemoNote').textContent=demo?'Demo mode: virtual lights. Your real show is kept separately.':'';$('#suDemoNote').style.display=demo?'':'none';
  $('#suConn').textContent=demo?'Use my bridge':'Connect';$('#suDemo').textContent=demo?'Restart demo':'Try demo mode';
  $('#kWake').checked=K.wake;$('#kWakeNote').textContent=('wakeLock' in navigator)?'':'This browser cannot keep the screen awake from a plain http address. Set the screen timeout in the tablet\'s settings or use a kiosk browser instead.';$('#kHome').value=K.idleHome;$('#kDim').value=K.idleDim;$('#kHide').checked=K.hideEmpty;$('#kLockFx').checked=K.lockFx;$('#kPin').textContent=K.pin?'Change lock PIN':'Set lock PIN';
  $('#patchCount').textContent=`${S.fixtures.length} lights`;
  $('#patchTbl').innerHTML=`<tr><th>No</th><th>Name</th><th>Room</th><th>Type</th><th>Status</th></tr>`+S.fixtures.map(f=>`<tr><td>${f.id}</td><td>${esc(f.name)}</td><td>${esc(f.room)}</td><td>${f.caps.color?'Colour':f.caps.ct?'White ambiance':isSwitch(f)?'On/off plug':'Dimmable'}</td><td style="color:${f.reachable===false?'var(--red)':'var(--grn)'}">${f.reachable===false?'unreachable':'ok'}</td></tr>`).join('');}
function selChanged(){const n=RT.sel.length;let txt='No lights selected',sub='Tap lights, a room or a group';
  if(n){const key=[...RT.sel].sort((a,b)=>a-b).join(',');const g=S.groups.find(g=>[...g.fixtures].sort((a,b)=>a-b).join(',')===key);
    txt=g?g.name:(n===1?(fixById(RT.sel[0])?.name||''):`${n} lights`);sub=g?`${n} light${n>1?'s':''}`:(n===1?`Fixture ${RT.sel[0]}`:'custom selection');}
  $('#selSum').innerHTML=`${esc(txt)}<small>${sub}</small>`;
  const key=[...RT.sel].sort((a,b)=>a-b).join(',');
  $$('#selChips [data-g]').forEach(c=>{const g=slotOf(S.groups,c.dataset.g);c.classList.toggle('on',!!g&&n>0&&[...g.fixtures].sort((a,b)=>a-b).join(',')===key);});
  const on=new Set(RT.pfx.map(x=>x.slot));$$('#fxTiles [data-fx]').forEach(t=>t.classList.toggle('act',on.has(+t.dataset.fx)));}
function progTouched(){selChanged();}

/* ---------------- editors (shared show format with desktop) ---------------- */
function editEffect(slot){let d=effBySlot(slot);
  if(!d){d=Object.assign({slot},fxDefaults(),{name:'Effect '+slot,type:'sine'});S.effects.push(d);touch();}
  const types=[['sine','Sine (dim)'],['ramp','Ramp (dim)'],['pulse','Chase pulse (dim)'],['random','Sparkle (dim)'],['flicker','Fire flicker'],['rainbow','Rainbow (colour)'],['colour2','Two-colour (colour)']];
  const b=modal('Effect '+slot,`
    <div class="row"><label>Name</label><input data-k="name" value="${esc(d.name)}"></div>
    <div class="row"><label>Form</label><select data-k="type">${types.map(([v,l])=>`<option value="${v}"${d.type===v?' selected':''}>${l}</option>`).join('')}</select></div>
    <div class="row"><label>Speed (BPM)</label><input data-k="bpm" type="number" inputmode="decimal" min="0.1" max="300" step="0.1" value="${d.bpm}" style="max-width:110px">
      <select data-k="sm"><option value="0"${!d.sm?' selected':''}>Own speed</option><option value="1"${d.sm==1?' selected':''}>Speed master 1</option><option value="2"${d.sm==2?' selected':''}>Speed master 2</option></select></div>
    <div class="row" data-for="sine ramp pulse random flicker"><label>Low / High %</label><input data-k="low" type="number" inputmode="numeric" min="0" max="100" value="${d.low}" style="max-width:100px"><input data-k="high" type="number" inputmode="numeric" min="0" max="100" value="${d.high}" style="max-width:100px"></div>
    <div class="row" data-for="pulse random"><label>Width %</label><input data-k="width" type="range" min="5" max="95" value="${d.width}" style="flex:1"></div>
    <div class="row" data-for="rainbow"><label>Saturation</label><input data-k="sat" type="range" min="0" max="100" value="${d.sat}" style="flex:1"></div>
    <div class="row" data-for="colour2"><label>Colours</label><input data-k="c1" type="color" value="${c2hex(d.c1)}" style="width:70px;padding:4px"><input data-k="c2" type="color" value="${c2hex(d.c2)}" style="width:70px;padding:4px"><input data-k="smooth" type="checkbox"${d.smooth?' checked':''}> Smooth</div>
    <div class="row" data-for="sine ramp pulse rainbow colour2"><label>Phase spread</label><input data-k="spread" type="range" min="0" max="720" step="15" value="${d.spread}" style="flex:1"><span id="spv" style="font-family:var(--fm)">${d.spread}°</span></div>
    <div class="row" data-for="sine ramp pulse rainbow colour2"><label>Blocks / Wings</label><input data-k="blocks" type="number" inputmode="numeric" min="1" max="16" value="${d.blocks}" style="max-width:90px"><input data-k="wings" type="number" inputmode="numeric" min="1" max="8" value="${d.wings}" style="max-width:90px"></div>
    <canvas id="fxPrev" width="640" height="56"></canvas><div class="hint" id="fxHint"></div>
    <div class="mfoot"><button class="b dng" id="fxDel">Delete</button><span style="flex:1"></span><button class="b" id="fxApply">Apply to selection</button><button class="b pri" id="fxClose">Done</button></div>`);
  const vis=()=>{$$('[data-for]',b).forEach(r=>r.style.display=r.dataset.for.split(' ').includes(d.type)?'':'none');
    const per=60/(d.sm?S.sm[d.sm-1].bpm:d.bpm),n=Math.max(1,RT.sel.length||S.fixtures.length),ref=n/(+S.settings.rate||10);
    $('#fxHint').textContent=`One cycle every ${per.toFixed(1)}s. ${per<ref*3?'Faster than Hue can show smoothly on this many lights.':'Should look smooth on real bulbs.'}`;};
  $$('[data-k]',b).forEach(inp=>inp.addEventListener('input',()=>{const k=inp.dataset.k;
    if(inp.type==='checkbox')d[k]=inp.checked;else if(inp.type==='color')d[k]=hex2c(inp.value);else if(['name','type'].includes(k))d[k]=inp.value;else d[k]=+inp.value;
    if(k==='spread')$('#spv').textContent=inp.value+'°';vis();touch(false);renderFxTab();selChanged();}));
  vis();$('#fxClose').onclick=closeModal;$('#fxApply').onclick=()=>{closeModal();toggleEffect(slot);};
  $('#fxDel').onclick=()=>choose('Delete effect?',`${esc(d.name)} will be removed from the pool. Cues that already use it keep their copy.`,[['y','Delete','dng']],()=>{S.effects=S.effects.filter(x=>x!==d);RT.pfx=RT.pfx.filter(x=>x.slot!==slot);touch();});
  let run=true;RT.onClose=()=>{run=false;};const cv=$('#fxPrev'),ctx=cv.getContext('2d');
  const loop=()=>{if(!run)return;const t=now(),N=16,w=cv.width/N;ctx.fillStyle='#000';ctx.fillRect(0,0,cv.width,cv.height);
    for(let i=0;i<N;i++){const r=fxValue(d,i,N,t,i+1),dim=r.dim??100,c=r.c||ctC(330);ctx.fillStyle=cCss(c,dim);ctx.globalAlpha=dim<=.4?.08:.3+.7*dim/100;
      ctx.beginPath();ctx.arc(i*w+w/2,28,Math.min(18,w/2-3),0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}requestAnimationFrame(loop);};loop();}
function editMacro(slot){let m=slotOf(S.macros,slot);if(!m){m={slot,name:'Macro '+slot,lines:''};S.macros.push(m);touch();}
  modal('Macro '+slot,`<div class="row"><label>Name</label><input id="mName" value="${esc(m.name)}"></div>
    <div class="hint">One command per line, e.g. <code>Off Executor 1 Thru 10</code> or <code>Goto Cue 3 Executor 1</code>.</div>
    <textarea id="mLines" rows="6">${esc(m.lines)}</textarea>
    <div class="mfoot"><button class="b dng" id="mDel">Delete</button><span style="flex:1"></span><button class="b" id="mRun">Run</button><button class="b pri" id="mOk">Done</button></div>`);
  const save=()=>{m.name=$('#mName').value;m.lines=$('#mLines').value;touch();};
  $('#mOk').onclick=()=>{save();closeModal();};$('#mRun').onclick=()=>{save();runMacro(m);};$('#mDel').onclick=()=>{S.macros=S.macros.filter(x=>x!==m);touch();closeModal();};}
function editColour(slot){const it=slotOf(S.colours,slot);if(!it)return;
  modal('Colour '+slot,`<div class="row"><label>Name</label><input id="cName" value="${esc(it.name)}"></div>
    <div class="row"><label>Colour</label><input type="color" id="cHex" value="${c2hex(it.c)}" style="width:90px;padding:4px"></div>
    <div class="row"><label>Or white (K)</label><input type="number" inputmode="numeric" id="cK" min="2000" max="6500" step="50" placeholder="e.g. 2700" value="${it.c.cm==='ct'?Math.round(1e6/it.c.ct):''}"></div>
    <div class="mfoot"><button class="b dng" id="cDel">Delete</button><span style="flex:1"></span><button class="b" id="cFrom">Use selected light's colour</button><button class="b pri" id="cOk">Done</button></div>`);
  $('#cHex').oninput=e=>{it.c=hex2c(e.target.value);$('#cK').value='';touch(false);renderSwatches();};
  $('#cK').oninput=e=>{const k=+e.target.value;if(k>=2000&&k<=6600){it.c=ctC(1e6/k);touch(false);renderSwatches();}};
  $('#cFrom').onclick=()=>{if(!RT.sel.length)return msg('Select a light first','warn');it.c={...progCV(RT.sel[0])};$('#cHex').value=c2hex(it.c);touch(false);renderSwatches();};
  $('#cDel').onclick=()=>{S.colours=S.colours.filter(x=>x!==it);touch();closeModal();};
  $('#cOk').onclick=()=>{it.name=$('#cName').value;touch();closeModal();};}
function editExec(e){const ex=S.executors[e];
  modal('Executor '+(e+1),`<div class="row"><label>Label</label><input data-k="label" value="${esc(ex.label)}"></div>
    <div class="row"><label>Mode</label><select data-k="mode"><option value="seq"${ex.mode==='seq'?' selected':''}>Sequence: GO steps through cues</option><option value="chase"${ex.mode==='chase'?' selected':''}>Chaser: cues step automatically</option></select></div>
    <div class="row"><label>Chaser speed</label><input data-k="bpm" type="number" inputmode="decimal" min="0.5" max="300" step="0.5" value="${ex.bpm}" style="max-width:110px"><select data-k="sm"><option value="0"${!ex.sm?' selected':''}>Own speed</option><option value="1"${ex.sm==1?' selected':''}>Speed master 1</option><option value="2"${ex.sm==2?' selected':''}>Speed master 2</option></select></div>
    <div class="row"><label>Chaser xfade %</label><input data-k="xfade" type="number" inputmode="numeric" min="0" max="100" value="${ex.xfade}" style="max-width:110px"></div>
    <div class="row"><label>Off fade (s)</label><input data-k="offFade" type="number" inputmode="decimal" min="0" step="0.5" value="${ex.offFade}" style="max-width:110px"></div>
    <div class="row"><label>New cue fade (s)</label><input data-k="defFade" type="number" inputmode="decimal" min="0" step="0.5" value="${ex.defFade}" style="max-width:110px"></div>
    <div class="mfoot"><button class="b dng" id="exWipe">Delete all cues</button><span style="flex:1"></span><button class="b pri" id="exOk">Done</button></div>`);
  $$('[data-k]').forEach(inp=>inp.addEventListener('input',()=>{const k=inp.dataset.k;ex[k]=['label','mode'].includes(k)?inp.value:+inp.value;if(k==='mode')execOffNow(e);touch();}));
  $('#exOk').onclick=closeModal;
  $('#exWipe').onclick=()=>choose('Delete all cues?',`Executor ${e+1} will be emptied.`,[['y','Delete all','dng']],()=>{execOffNow(e);ex.cues=[];ex.label='';touch();});}
function editCue(e,i){const ex=S.executors[e],c=ex.cues[i];if(!c)return;
  modal(`Cue ${fmtNum(c.num)} · Exec ${e+1}`,`<div class="row"><label>Name</label><input id="ceName" value="${esc(c.name)}" placeholder="Cue ${fmtNum(c.num)}"></div>
    <div class="row"><label>Fade (s)</label><input id="ceFade" type="number" inputmode="decimal" min="0" step="0.5" value="${c.fade}"></div>
    <div class="row"><label>Delay (s)</label><input id="ceDelay" type="number" inputmode="decimal" min="0" step="0.5" value="${c.delay||0}"></div>
    <div class="hint">${Object.keys(c.values).length} lights${c.effects&&c.effects.length?`, ${c.effects.length} effect${c.effects.length>1?'s':''}`:''}.</div>
    <div class="mgrid"><button class="b grn" id="ceGo">Go to this cue</button><button class="b" id="ceLoad">Load into Lights to edit</button>
      <button class="b org" id="ceMerge">Merge current look in</button><button class="b red" id="ceOver">Replace with current look</button>
      <button class="b dng" id="ceDel">Delete cue</button><button class="b pri" id="ceOk">Save</button></div>`);
  const save=()=>{c.name=$('#ceName').value;c.fade=Math.max(0,+$('#ceFade').value||0);c.delay=Math.max(0,+$('#ceDelay').value||0);touch();};
  $('#ceOk').onclick=()=>{save();closeModal();};
  $('#ceGo').onclick=()=>{save();closeModal();execGo(e,ex.cues.indexOf(c));};
  $('#ceLoad').onclick=()=>{save();closeModal();loadCue(e,ex.cues.indexOf(c));showTab('lights');};
  $('#ceMerge').onclick=()=>{save();closeModal();storeCue(e,c.num,'merge');};
  $('#ceOver').onclick=()=>{save();closeModal();storeCue(e,c.num,'overwrite');};
  $('#ceDel').onclick=()=>choose('Delete cue?',`Cue ${fmtNum(c.num)} will be removed.`,[['y','Delete','dng']],()=>deleteCue(e,ex.cues.indexOf(c)));}
function storeDialog(){const pc=progContent();
  if(!Object.keys(pc.values).length&&!pc.effects.length){msg('Nothing to store yet: set some lights first','warn');return;}
  const b=modal('Store this look',`<div class="hint">Add it as the next cue on an executor:</div>
    <div class="xpick">${S.executors.map((ex,e)=>`<button class="b" data-se="${e}"><span><b style="font-family:var(--fm)">${e+1}</b> ${esc(ex.label||'Empty')}</span><small>${ex.cues.length} cue${ex.cues.length===1?'':'s'}</small></button>`).join('')}</div>
    <div class="mfoot"><button class="b" id="stCancel">Cancel</button><button class="b" id="stScene">Save as a scene</button></div>`,true);
  $$('[data-se]',b).forEach(x=>x.onclick=()=>{closeModal();storeCue(+x.dataset.se,null);renderCues();});
  $('#stScene').onclick=()=>{closeModal();const s=S.scenes.reduce((m,x)=>Math.max(m,x.slot),0)+1;storeToPool('scenes',s);promptModal('Name this scene','Scene '+s,v=>{const it=slotOf(S.scenes,s);if(it&&v){it.name=v;touch();}});};
  $('#stCancel').onclick=closeModal;}
function openAgenda(){const draw=()=>{const b=modal('Agenda',`<div class="hint">Runs commands at set times while HueDesk is open on this tablet.</div>
    ${S.agenda.map((a,i)=>`<div class="agrow" data-i="${i}"><div class="row"><input type="checkbox" data-a="enabled"${a.enabled?' checked':''}><input type="time" data-a="time" value="${a.time}" style="max-width:150px"><div class="days">${'SMTWTFS'.split('').map((l,d)=>`<button data-day="${d}" class="${a.days.includes(d)?'on':''}">${l}</button>`).join('')}</div></div>
      <div class="row"><input data-a="cmd" value="${esc(a.cmd)}"><button class="b" data-run>Run</button><button class="b dng" data-del>Remove</button></div></div>`).join('')||'<div class="hint">No entries yet.</div>'}
    <div class="mfoot"><button class="b" id="agAdd">Add entry</button><button class="b pri" id="agOk">Done</button></div>`,true);
    $$('.agrow',b).forEach(row=>{const a=S.agenda[+row.dataset.i];
      $$('[data-a]',row).forEach(inp=>inp.addEventListener('input',()=>{a[inp.dataset.a]=inp.type==='checkbox'?inp.checked:inp.value;touch(false);}));
      $$('[data-day]',row).forEach(btn=>btn.onclick=()=>{const d=+btn.dataset.day;a.days=a.days.includes(d)?a.days.filter(x=>x!==d):[...a.days,d];btn.classList.toggle('on');touch(false);});
      $('[data-run]',row).onclick=()=>runCommand(a.cmd);$('[data-del]',row).onclick=()=>{S.agenda.splice(+row.dataset.i,1);touch(false);draw();};});
    $('#agAdd').onclick=()=>{S.agenda.push({time:'07:00',days:[1,2,3,4,5],cmd:'Goto Cue 1 Executor 1',enabled:true});touch(false);draw();};$('#agOk').onclick=closeModal;};draw();}
function agendaTick(){const d=new Date(),hm=pad(d.getHours())+':'+pad(d.getMinutes()),key=d.toDateString()+' '+hm;
  for(const a of S.agenda){if(!a.enabled||a.time!==hm||!a.days.includes(d.getDay())||a._last===key)continue;a._last=key;touch(false);msg('Agenda: '+a.cmd,'ok');runCommand(a.cmd);}}
function exportShow(){const out=JSON.parse(JSON.stringify(S));out.settings={...out.settings,ip:'',user:''};/* never export the bridge address or app key */
  const blob=new Blob([JSON.stringify(out,null,1)],{type:'application/json'});const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`huedesk-${(S.name||'show').replace(/[^\w-]+/g,'_')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);msg('Show exported','ok');}
function loadShowData(j){const show=migrate(j);S=Object.assign(show,{settings:S.settings});for(let x=0;x<NEX;x++)execOffNow(x);touch();connect();}
function startTicker(fn,ms){try{const w=new Worker(URL.createObjectURL(new Blob([`setInterval(()=>postMessage(0),${ms})`],{type:'text/javascript'})));w.onmessage=fn;return;}catch(e){}setInterval(fn,ms);}

/* ---------------- keypad ---------------- */
const KEYROWS=[['Fixture','Group','Preset','Cue','Exec','Scene'],['7','8','9','Thru','Full','Store'],['4','5','6','+','At','Update'],['1','2','3','-','Go','Off'],['0','.','⌫','Clear','Go-','Enter']];
function buildKeypad(){$('#kGrid').innerHTML=KEYROWS.flat().map(k=>{const c=/^[0-9.]$/.test(k)?'num':k==='Enter'?'ent':k==='Store'?'st':k==='Go'?'gok':'';return `<button class="b ${c}" data-key="${k}">${k==='Enter'?'ENTER':k}</button>`;}).join('');
  press($('#kGrid'),'[data-key]',{tap:el=>kpress(el.dataset.key)});drawK();}
function kpress(k){const last=KT[KT.length-1];
  if(/^[0-9.]$/.test(k)){if(last!=null&&/^[0-9.]+$/.test(last))KT[KT.length-1]=last+k;else KT.push(k);}
  else if(k==='⌫'){if(last!=null){if(/^[0-9.]+$/.test(last)&&last.length>1)KT[KT.length-1]=last.slice(0,-1);else KT.pop();}}
  else if(k==='Clear'){if(KT.length)KT=[];else clearSmart();}
  else if(k==='Enter'){const c=KT.join(' ');KT=[];if(c){RT.hist=RT.hist.filter(h=>h!==c);RT.hist.push(c);try{runCommand(c);}catch(err){msg('Error: '+err.message,'err');}}}
  else KT.push(k);drawK();}
function drawK(){$('#kLine').textContent=KT.join(' ');
  $('#kHist').innerHTML=RT.hist.slice(-8).reverse().map(h=>`<button data-h="${esc(h)}">${esc(h)}</button>`).join('');
  $$('#kHist [data-h]').forEach(b=>b.onclick=()=>{KT=b.dataset.h.split(' ');drawK();});}

/* ---------------- colour wheel ---------------- */
function drawWheelBase(){const cv=$('#wheel'),ctx=cv.getContext('2d'),W=cv.width,R=W/2-2,img=ctx.createImageData(W,W);
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){const dx=x-W/2,dy=y-W/2,r=Math.hypot(dx,dy);if(r>R+1)continue;
    const h=(Math.atan2(dy,dx)*180/Math.PI+360)%360,[cr,cg,cb]=hsv2rgb(h,Math.min(1,r/R),1),o=(y*W+x)*4;
    img.data[o]=cr;img.data[o+1]=cg;img.data[o+2]=cb;img.data[o+3]=255*clamp(R+1-r,0,1);}wheelImg=img;}
function drawCt(ctx,cv){const g=ctx.createLinearGradient(0,0,cv.width,0);for(let i=0;i<=10;i++){const m=500-347*i/10;g.addColorStop(i/10,`rgb(${k2rgb(1e6/m).map(v=>v|0).join(',')})`);}ctx.fillStyle=g;ctx.fillRect(0,0,cv.width,cv.height);}
function paintWheel(){const fs=RT.sel.slice(0,48),sig=fs.map(f=>{const c=progCV(f);return c.cm==='ct'?'t'+Math.round(c.ct):Math.round(c.h)+'/'+Math.round(c.s);}).join('|');
  if(sig===wheelSig)return;wheelSig=sig;const cv=$('#wheel'),ctx=cv.getContext('2d'),W=cv.width,R=W/2-2;ctx.putImageData(wheelImg,0,0);
  fs.forEach((f,i)=>{const c=progCV(f);if(c.cm==='ct')return;const a=c.h*Math.PI/180,r=c.s/100*R,x=W/2+Math.cos(a)*r,y=W/2+Math.sin(a)*r;
    ctx.beginPath();ctx.arc(x,y,i?9:17,0,Math.PI*2);ctx.lineWidth=i?3:6;ctx.strokeStyle=i?'rgba(0,0,0,.7)':'#000';ctx.stroke();if(!i){ctx.lineWidth=3;ctx.strokeStyle='#fff';ctx.stroke();}});
  const cb=$('#ctbar'),c2=cb.getContext('2d');drawCt(c2,cb);const f=fs[0];
  if(f!=null){const c=progCV(f);if(c.cm==='ct'){const x=(500-c.ct)/347*cb.width;c2.fillStyle='#000';c2.fillRect(x-6,0,12,cb.height);c2.fillStyle='#fff';c2.fillRect(x-3,4,6,cb.height-8);}}}

/* ---------------- guided tour (tablet) ---------------- */
const TOUR=[
 {t:'Welcome to HueDesk Tablet',b:()=>`<p>This is the touch version of HueDesk, made to be carried round the house or left on the wall as a control panel.</p>
   ${MODE==='demo'?`<p>You are in <b>demo mode</b> with ${S.fixtures.length} virtual lights, so nothing in your home will change.</p>`:'<p>Your bridge is connected. Nothing changes in the house until you set lights or press GO.</p>'}
   <p>Tap <b>Next</b> to see each part of the screen.</p>`},
 {sel:'#top .stat',grow:'#outm',pad:6,t:'Status',b:()=>`<p>The light shows the connection: <b>green</b> connected, <b>cyan</b> demo, <b>red</b> a problem. The number beside it is how many commands per second are going to the bridge.</p>`},
 {sel:'#top .gm',grow:'#boBtn',pad:6,t:'Always-there controls',b:()=>`<ul><li><b>GRAND</b> dims everything at once. Drag it; a tap does nothing.</li><li>The <b>full screen</b> button hides the browser bars.</li>
   <li>The <b>padlock</b> locks the tablet with a PIN so the household can play cues but not change the show.</li><li><b>BLACKOUT</b> turns every light off instantly. Tap again to bring them back.</li></ul>`},
 {sel:'#tabs',tab:'play',t:'Tabs',b:()=>`<p>Everything is grouped into tabs: <b>Play</b> to run cues, <b>Lights</b> to set lights by hand, <b>FX</b> for effects, scenes and speed, <b>Cues</b> to manage recorded cues, <b>Keypad</b> for desk commands and <b>Setup</b> for the bridge and kiosk options.</p>`},
 {sel:'#macroBar',tab:'play',t:'Macros',b:()=>`<p>One-tap buttons that run a list of commands, like <b>All Off</b>, <b>Morning</b> or <b>Night</b>. Edit them on the FX tab.</p>`},
 {sel:'#execGrid .xc',tab:'play',t:'Executors',b:()=>`<p>Each card plays back a list of cues.</p><ul><li><b>GO</b> fades to the next cue, <b>BACK</b> goes back one, <b>OFF</b> fades it out, <b>FLASH</b> is full while held.</li>
   <li>The <b>fader</b> is its brightness. Drag it up from zero to start it.</li><li>The green line is the current cue, underneath is the next one.</li><li><b>Long-press</b> the card title to change its settings.</li></ul>`},
 {sel:'#tab-lights .lpane',tab:'lights',t:'Choosing lights',b:()=>`<ul><li><b>Tap</b> a light to select or deselect it. <b>Long-press</b> selects just that one.</li><li><b>Select</b> beside a room picks the whole room. The chips at the top pick groups, all, none and more.</li>
   <li>The tile shows what the desk is sending; the strip at the bottom shows what the bulb is doing. A red number means you have set it by hand.</li></ul>`},
 {sel:'#tab-lights .rpane',tab:'lights',t:'Setting a look',b:()=>`<ul><li>Drag on the <b>colour wheel</b> for colour, or the <b>bar</b> for warm to cool white.</li><li>Drag the <b>brightness</b> slider, or use OFF, 25, 50, 75, FULL.</li>
   <li>Tap a <b>colour circle</b> for a preset. Long-press it to edit.</li><li><b>Fade</b> sets how gently your changes arrive.</li>
   <li><b>STORE</b> saves the look as a cue or a scene. <b>CLEAR</b> lets go of the lights (they stay as they are). <b>UNDO</b> takes back your last change.</li></ul>`},
 {sel:'#fxCard',tab:'fx',t:'Effects',b:()=>`<p>Select lights on the Lights tab, then tap an effect to run it on them. Tap again to stop. Long-press to edit speed, colours and spread, with a live preview.</p>`},
 {sel:'#smCard',grow:'#lookCard',tab:'fx',t:'Speed, scenes and macros',b:()=>`<ul><li><b>TAP</b> a speed master in time with music; effects linked to it follow the beat.</li><li><b>Scenes</b> load a saved look onto the lights.</li><li><b>Macros</b> run lists of commands. Long-press to edit.</li></ul>`},
 {sel:'#tab-cues',tab:'cues',t:'Cues',b:()=>`<ul><li>Pick an executor along the top to see its cues.</li><li><b>GO TO</b> jumps straight to a cue. <b>EDIT</b> renames it, changes its fade, or replaces it with the current look.</li>
   <li><b>+ STORE CUE</b> adds the current look as a new cue. <b>UPDATE</b> merges your changes into the live cue.</li></ul>`},
 {sel:'#tab-keys .kp',tab:'keys',t:'Keypad',b:()=>`<p>The same command language as the desktop desk. Build a command with the keys and press <b>ENTER</b>, for example <b>Group 2 At 50</b> or <b>Go Exec 1</b>. Recent commands appear above the keys for one-tap reuse.</p>`},
 {sel:'#kioskSec',tab:'setup',t:'Kiosk options',b:()=>`<ul><li>Keep the screen awake, return to Play after a while, dim the screen when idle.</li><li>Set a <b>PIN</b>, then lock. Locked hides Cues, Keypad, Setup and all editing.</li>
   <li>Setup also has the bridge connection, show loading and saving, and step-by-step kiosk instructions for iPad and Android.</li></ul>`},
 {tab:'play',t:'You are ready',b:()=>`<ol><li>Go to <b>Lights</b>, tap <b>Select</b> on a room.</li><li>Tap a colour and drag the brightness.</li><li>Tap <b>STORE</b> and pick an executor.</li><li>Back on <b>Play</b>, use <b>GO</b> and <b>OFF</b> on that card.</li></ol>
   <p>Replay this tour any time from <b>Setup</b>.</p>`}];
let tourI=0;
const TOUR_DEMO_KEY='huedesk.tablet.tourDemoHide',TOUR_REAL_KEY='huedesk.tablet.tourRealDone';
function tourWanted(){if(RT.locked)return false;if(MODE==='demo')return store.get(TOUR_DEMO_KEY)!=='1';return !!(S.settings.ip&&S.settings.user)&&store.get(TOUR_REAL_KEY)!=='1';}
function startTour(force){if(RT.tour||RT.locked)return;if(!force&&!tourWanted())return;if(RT.modal)closeModal();
  RT.tour=true;tourI=0;if(MODE!=='demo')store.set(TOUR_REAL_KEY,'1');
  $('#tourNo').checked=store.get(TOUR_DEMO_KEY)==='1';$('#tour .tno').hidden=MODE!=='demo';
  $('#tour').hidden=false;$('#tour .tdots').innerHTML=TOUR.map(()=>'<i></i>').join('');showStep();}
function endTour(){RT.tour=false;$('#tour').hidden=true;showTab('play');}
function tourGo(d){const n=tourI+d;if(n<0)return;if(n>=TOUR.length){endTour();return;}tourI=n;showStep();}
function tourRect(st){if(!st.sel)return null;const a=$(st.sel);if(!a||!a.offsetParent)return null;let r=a.getBoundingClientRect();
  if(st.grow){const b=$(st.grow);if(b&&b.offsetParent){const q=b.getBoundingClientRect();r={left:Math.min(r.left,q.left),top:Math.min(r.top,q.top),right:Math.max(r.right,q.right),bottom:Math.max(r.bottom,q.bottom)};}}
  const p=st.pad??6;return {left:r.left-p,top:r.top-p,width:r.right-r.left+2*p,height:r.bottom-r.top+2*p,right:r.right+p,bottom:r.bottom+p};}
function showStep(){const st=TOUR[tourI];if(st.tab)showTab(st.tab);
  $('#tour .tstep').textContent=`STEP ${tourI+1} OF ${TOUR.length}`;$$('#tour .tdots i').forEach((d,i)=>d.classList.toggle('on',i<=tourI));
  $('#tour h3').textContent=st.t;$('#tour .tbody').innerHTML=st.b();$('#tourBack').style.visibility=tourI===0?'hidden':'visible';
  $('#tourNext').textContent=tourI===TOUR.length-1?'Finish':'Next';requestAnimationFrame(placeStep);}
function placeStep(){if(!RT.tour)return;const st=TOUR[tourI],card=$('#tour .tcard'),spot=$('#tour .tspot'),r=tourRect(st);
  const W=innerWidth,H=innerHeight,cw=card.offsetWidth,ch=card.offsetHeight,m=14;
  if(!r){spot.classList.add('none');Object.assign(spot.style,{left:W/2+'px',top:H/2+'px',width:'0px',height:'0px'});card.style.left=Math.max(m,(W-cw)/2)+'px';card.style.top=Math.max(m,(H-ch)/2)+'px';return;}
  spot.classList.remove('none');Object.assign(spot.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
  const opts=[{x:r.right+m,y:r.top,fit:W-r.right-m>=cw+m},{x:r.left-cw-m,y:r.top,fit:r.left-m>=cw+m},{x:r.left,y:r.bottom+m,fit:H-r.bottom-m>=ch+m},{x:r.left,y:r.top-ch-m,fit:r.top-m>=ch+m}];
  const o=opts.find(x=>x.fit)||{x:(W-cw)/2,y:H-ch-m};card.style.left=clamp(o.x,m,W-cw-m)+'px';card.style.top=clamp(o.y,m,H-ch-m)+'px';}
function openWelcome(){modal('Welcome',`<div class="welcome"><h2>HUE<span style="color:var(--amb)">DESK</span> TABLET</h2>
  <p>A touch lighting console for your Philips Hue lights, built to carry round the house or mount on the wall.</p>
  <button class="b pri" id="wcSetup">Connect my Hue Bridge</button><button class="b" id="wcDemo">Explore in demo mode</button></div>`);
  $('#wcSetup').onclick=()=>{closeModal();showTab('setup');};$('#wcDemo').onclick=()=>{closeModal();switchMode('demo');};}

/* ---------------- paint loop ---------------- */
function paint(t){
  if(curTab==='play'){$$('.xc').forEach(el=>{const e=+el.dataset.e,ex=S.executors[e],xr=RT.ex[e],n=ex.cues.length;let cur='',next='',bar=0;const on=xr.active&&!xr.off;
    if(ex.mode==='chase'){if(xr.active){const pos=chasePos(e,t),k=Math.floor(pos),idx=((k%n)+n)%n,c=ex.cues[idx];cur=`${idx+1}/${n} ${c?c.name||'':''}`;bar=pos-k;}
      next=`${xr.paused?'PAUSED · ':''}${Math.round(ex.sm?S.sm[ex.sm-1].bpm:ex.bpm)} bpm`;}
    else{if(xr.active){const c=ex.cues[xr.cueIdx];cur=c?`${fmtNum(c.num)} ${c.name||''}`:'';const F=xr.fade;if(F){const st=F.t0+F.delay;bar=F.dur<=0?1:clamp((t-st)/F.dur,0,1);}}
      const ni=xr.active?xr.cueIdx+1:0,nc=ex.cues[ni>=n?0:ni];next=nc?`Next: ${fmtNum(nc.num)} ${nc.name||''}`:'';}
    if(xr.off)bar=1-clamp((t-xr.off.t0)/Math.max(1,xr.off.dur),0,1);
    const k=[ex.label,ex.mode,cur,next,on,!!xr.off,n,xr.paused,e===RT.selExec].join('|');
    if(el._k!==k){el._k=k;$('.xl',el).textContent=ex.label||'Exec '+(e+1);$('.xm',el).textContent=n?(ex.mode==='chase'?'CHASER':'SEQ'):'EMPTY';
      const cc=$('.xcur',el);cc.textContent=xr.active?(xr.off?'fading out...':cur):(n?`Off · ${n} cue${n>1?'s':''}`:'No cues');cc.classList.toggle('off',!on);
      $('.xnext',el).textContent=next;el.classList.toggle('on',on);el.classList.toggle('offing',!!xr.off);el.classList.toggle('sel',e===RT.selExec);
      const b2=$('[data-x=b2]',el);b2.textContent=ex.mode==='chase'?(xr.paused?'RESUME':'PAUSE'):'BACK';b2.classList.toggle('on',ex.mode==='chase'&&xr.paused);}
    $('.xbar i',el).style.width=(bar*100)+'%';$('[data-x=flash]',el).classList.toggle('on',xr.flash);faders[e]&&faders[e]._paint();});}
  if(curTab==='lights'){const sel=new Set(RT.sel),fxOn=new Set();RT.pfx.forEach(x=>x.fixtures.forEach(f=>fxOn.add(+f)));
    for(const f in tileEls){const el=tileEls[f],L=RT.live[f]||{dim:0},lamp=lampCur(f,t),fx=fixById(f);
      const o=L.dim<=.4?0:.25+.75*L.dim/100,col=c2hex(L.c),lc=lamp.dim<=.4?'#000':cCss(lamp.c,lamp.dim),dt=isSwitch(fx)?(L.dim>.4?'ON':'OFF'):Math.round(L.dim)+'';
      if(el._o!==o){el.style.setProperty('--o',o);el._o=o;}if(el._c!==col){el.style.setProperty('--c',col);el._c=col;}if(el._l!==lc){el.style.setProperty('--l',lc);el._l=lc;}
      if(el._d!==dt){el.children[2].textContent=dt;el._d=dt;}
      const cls=`fx${sel.has(+f)?' sel':''}${RT.prog[f]?' prog':''}${fxOn.has(+f)?' hasfx':''}${fx?.reachable===false?' unr':''}`;if(el._cls!==cls){el.className=cls;el._cls=cls;}}
    paintWheel();const f0=RT.sel[0];if(f0!=null){const c=progCV(f0);$('#swatch').style.background=c2hex(c);$('#swatchTxt').textContent=cName(c);}else{$('#swatch').style.background='#000';$('#swatchTxt').textContent='';}
    $('#dimSlider')._paint();$('#hlBtn').classList.toggle('on',RT.highlight);
    $$('#fadeChips [data-fade]').forEach(c=>c.classList.toggle('on',+c.dataset.fade===RT.progFade));}
  if(curTab==='fx'){$$('.sm').forEach((el,i)=>{const b=S.sm[i].bpm,tx=b<10?b.toFixed(1):Math.round(b)+'';const s=$('.smv span',el);if(s.textContent!==tx)s.textContent=tx;$('.smled',el).classList.toggle('on',smPhase(i,t)%1<.15);});}
  if(curTab==='cues'){const e=RT.selExec,xr=RT.ex[e],ex=S.executors[e];
    $$('#cueList .cr').forEach(r=>{const i=+r.dataset.i;const isCur=xr.active&&!xr.off&&(ex.mode==='chase'?(((Math.floor(chasePos(e,t))%ex.cues.length)+ex.cues.length)%ex.cues.length)===i:xr.cueIdx===i);
      const F=xr.fade,fading=isCur&&ex.mode!=='chase'&&F&&t<F.t0+F.delay+F.dur;r.classList.toggle('cur',!!isCur);const m=isCur?(fading?'▷':'▶'):'';const cm=r.firstElementChild;if(cm.textContent!==m)cm.textContent=m;});
    $$('#xsel [data-xs]').forEach(c=>{const x=RT.ex[+c.dataset.xs];c.classList.toggle('live',x.active&&!x.off);});
    const b=$('[data-cq=back]'),bt=ex.mode==='chase'?(xr.paused?'RESUME':'PAUSE'):'BACK';if(b.textContent!==bt)b.textContent=bt;}
  $('#gmSlider')._paint();$('#boBtn').classList.toggle('on',RT.blackout);
  while(OUT.log.length&&OUT.log[0]<t-1000)OUT.log.shift();const ot=OUT.log.length+'/s';if($('#outm').textContent!==ot)$('#outm').textContent=ot;
  const d=new Date();if(d.getSeconds()!==clockSec){clockSec=d.getSeconds();const hm=`${pad(d.getHours())}:${pad(d.getMinutes())}`;$('#clock').textContent=hm;$('#sleepClock').textContent=hm;
    $('#lockBtn').innerHTML=svg(RT.locked?'lock':'unlock');$('#lockBtn').classList.toggle('on',!!RT.locked);$('#fsBtn').innerHTML=svg(isFs()?'exitfull':'full');}}
function frame(){const t=now();housekeep(t);const ev=evaluate(t,true);
  for(const fx of S.fixtures){const f=fx.id,o=ev[f];
    if(o){RT.live[f]=o;RT.wasCtl[f]=true;}
    else{if(RT.wasCtl[f]){RT.wasCtl[f]=false;if(!RT.blackout&&RT.live[f])RT.base[f]={dim:RT.live[f].dim,c:RT.live[f].c};}
      const b=RT.base[f]||{dim:0,c:ctC(366)};RT.live[f]={dim:RT.blackout?0:b.dim,c:b.c,rel:true};}}
  try{paint(t);}catch(e){console.error(e);}requestAnimationFrame(frame);}

/* ---------------- bindings ---------------- */
function bind(){
  $('.mx').onclick=closeModal;$('#modal').addEventListener('pointerdown',e=>{if(e.target.id==='modal')closeModal();});
  document.addEventListener('contextmenu',e=>{if(!/INPUT|TEXTAREA/.test(e.target.tagName))e.preventDefault();});
  document.addEventListener('pointerdown',()=>{lastAct=Date.now();applyWake();},true);
  document.addEventListener('visibilitychange',applyWake);
  $('#sleep').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();wakeUp();});
  $('#fsBtn').onclick=toggleFs;$('#lockBtn').onclick=lockTap;$('#boBtn').onclick=()=>{vib(30);setBlackout(!RT.blackout);};
  makeSlider($('#gmSlider'),{get:()=>RT.gm,set:v=>RT.gm=v,color:'var(--sel)'});
  $('#showName').onclick=()=>{if(!RT.locked)promptModal('Show name',S.name,v=>{S.name=v||S.name;touch();});};
  // play
  press($('#macroBar'),'[data-mac]',{tap:el=>{const m=slotOf(S.macros,el.dataset.mac);if(m)runMacro(m);},long:el=>editMacro(+el.dataset.mac)});
  press($('#execGrid'),'.xch',{tap:el=>{RT.selExec=+el.closest('.xc').dataset.e;renderCues();},long:el=>editExec(+el.closest('.xc').dataset.e)});
  // lights
  press($('#fixGrid'),'.fx,[data-room]',{tap:el=>{if(el.dataset.room){const fs=S.fixtures.filter(f=>(f.room||'Unassigned')===el.dataset.room).map(f=>f.id);
      const all=fs.every(f=>RT.sel.includes(f));setSel(all?RT.sel.filter(f=>!fs.includes(f)):[...RT.sel,...fs]);return;}toggleSel(+el.dataset.f);},
    long:el=>{if(el.dataset.f)setSel([+el.dataset.f]);}});
  press($('#selChips'),'.chip',{tap:el=>{const a=el.dataset.sc;
      if(el.dataset.g){const g=slotOf(S.groups,el.dataset.g);if(g)selectGroup(g,false);return;}
      if(a==='all')setSel(S.fixtures.map(f=>f.id));else if(a==='none')setSel([]);else if(a==='invert')invertSel();else if(a==='odd')selOddEven(true);else if(a==='even')selOddEven(false);
      else if(a==='newgroup'){if(!needSel())return;const s=S.groups.reduce((m,g)=>Math.max(m,g.slot),0)+1;promptModal('Name this group','Group '+s,v=>{S.groups.push({slot:s,name:v||'Group '+s,fixtures:[...RT.sel]});touch();});}},
    long:el=>{if(!el.dataset.g)return;const g=slotOf(S.groups,el.dataset.g);if(!g)return;
      choose(g.name,'Rename this group, replace its lights with the current selection, or delete it.',[['ren','Rename'],['set','Use selection','org'],['del','Delete','dng']],a=>{
        if(a==='ren')promptModal('Rename group',g.name,v=>{g.name=v||g.name;touch();});
        if(a==='set'){if(needSel()){g.fixtures=[...RT.sel];touch();msg('Group updated','ok');}}
        if(a==='del'){S.groups=S.groups.filter(x=>x!==g);touch();}});}});
  makeSlider($('#dimSlider'),{label:'BRIGHTNESS',get:()=>{const f=RT.sel[0];return f==null?0:progDimV(f)/100;},
    set:v=>{RT.sel.forEach(f=>setPDim(f,v*100));progTouched();},onStart:()=>{if(!needSel())return false;RT.oopsT=0;pushOops(true);}});
  $$('[data-dim]').forEach(b=>b.onclick=()=>{vib(8);setDimSel(+b.dataset.dim);});
  press($('#swatches'),'.sw',{tap:el=>{if(el.dataset.s==='new'){if(!needSel())return;const s=S.colours.reduce((m,c)=>Math.max(m,c.slot),0)+1;storeToPool('colours',s);return;}
      const c=slotOf(S.colours,el.dataset.s);if(c)applyColour(c.c);},long:el=>{if(el.dataset.s!=='new')editColour(+el.dataset.s);}});
  press($('#fadeChips'),'[data-fade]',{tap:el=>{RT.progFade=+el.dataset.fade;}});
  $('#hlBtn').onclick=()=>{if(!RT.highlight&&!needSel())return;RT.highlight=!RT.highlight;};
  $$('[data-tool]').forEach(b=>b.onclick=()=>{vib(8);const a=b.dataset.tool;
    if(a==='oops')oops();if(a==='clear')doClear();if(a==='knockout')knockout();if(a==='fxoff'){if(needSel()){pushOops();removeProgFx(RT.sel);progTouched();}}if(a==='store')storeDialog();});
  const wheel=$('#wheel');let wd=false;const wpick=e=>{const r=wheel.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,R=r.width/2-2;
    applyColour(hsC((Math.atan2(y,x)*180/Math.PI+360)%360,clamp(Math.hypot(x,y)/R*100,0,100)),true);};
  wheel.addEventListener('pointerdown',e=>{if(!needSel())return;wd=true;wheel.setPointerCapture(e.pointerId);RT.oopsT=0;wpick(e);});
  wheel.addEventListener('pointermove',e=>{if(wd)wpick(e);});wheel.addEventListener('pointerup',()=>wd=false);wheel.addEventListener('pointercancel',()=>wd=false);
  const ctb=$('#ctbar');let cd=false;const cpick=e=>{const r=ctb.getBoundingClientRect();applyColour(ctC(500-347*clamp((e.clientX-r.left)/r.width,0,1)),true);};
  ctb.addEventListener('pointerdown',e=>{if(!needSel())return;cd=true;ctb.setPointerCapture(e.pointerId);RT.oopsT=0;cpick(e);});
  ctb.addEventListener('pointermove',e=>{if(cd)cpick(e);});ctb.addEventListener('pointerup',()=>cd=false);ctb.addEventListener('pointercancel',()=>cd=false);
  // fx tab
  press($('#fxTiles'),'[data-fx]',{tap:el=>{if(el.dataset.fx==='new'){const s=S.effects.reduce((m,x)=>Math.max(m,x.slot),0)+1;editEffect(s);return;}toggleEffect(+el.dataset.fx);},
    long:el=>{if(el.dataset.fx!=='new')editEffect(+el.dataset.fx);}});
  press($('#sceneTiles'),'[data-scene]',{tap:el=>{const s=slotOf(S.scenes,el.dataset.scene);if(s)applyScene(s);},
    long:el=>{const s=slotOf(S.scenes,el.dataset.scene);if(!s)return;choose(s.name,'Rename or delete this scene.',[['ren','Rename'],['del','Delete','dng']],a=>{
      if(a==='ren')promptModal('Rename scene',s.name,v=>{s.name=v||s.name;touch();});if(a==='del'){S.scenes=S.scenes.filter(x=>x!==s);touch();}});}});
  press($('#macroTiles'),'[data-mac]',{tap:el=>{if(el.dataset.mac==='new'){editMacro(S.macros.reduce((m,x)=>Math.max(m,x.slot),0)+1);return;}const m=slotOf(S.macros,el.dataset.mac);if(m)runMacro(m);},
    long:el=>{if(el.dataset.mac!=='new')editMacro(+el.dataset.mac);}});
  press($('#sms'),'[data-smact]',{tap:el=>{const i=+el.closest('.sm').dataset.sm,a=el.dataset.smact,sm=S.sm[i];
    if(a==='half')sm.bpm=Math.max(.5,sm.bpm/2);if(a==='dbl')sm.bpm=Math.min(300,sm.bpm*2);if(a==='minus')sm.bpm=Math.max(.5,sm.bpm-(sm.bpm<20?.5:1));if(a==='plus')sm.bpm=Math.min(300,sm.bpm+(sm.bpm<20?.5:1));
    if(a==='tap'){const t=now(),T=RT.taps[i];if(T.length&&t-T[T.length-1]>2500)T.length=0;T.push(t);if(T.length>6)T.shift();
      if(T.length>=2){sm.bpm=clamp(Math.round(60000/((T[T.length-1]-T[0])/(T.length-1))*10)/10,1,300);RT.smPh[i]=Math.floor(smPhase(i,t));RT.smT=t;}}touch(false);}});
  // cues tab
  press($('#xsel'),'[data-xs]',{tap:el=>{RT.selExec=+el.dataset.xs;renderCues();},long:el=>editExec(+el.dataset.xs)});
  press($('#cueList'),'[data-cg],[data-ce]',{tap:el=>{const e=RT.selExec;if(el.dataset.cg!=null)execGo(e,+el.dataset.cg);else editCue(e,+el.dataset.ce);}});
  $$('[data-cq]').forEach(b=>b.onclick=()=>{vib(10);const e=RT.selExec,a=b.dataset.cq;
    if(a==='go')execGo(e);if(a==='back')execBack(e);if(a==='off')execOff(e);if(a==='cfg')editExec(e);
    if(a==='store'){storeCue(e,null);renderCues();}if(a==='update'){updateCue(e);renderCues();}});
  // setup
  $('#suIp').oninput=e=>{S.settings.ip=hostOf(e.target.value);touch(false);};$('#suUser').oninput=e=>{S.settings.user=cleanKey(e.target.value);touch(false);};$('#suTrust').onclick=trustBridge;
  $('#suDisc').onclick=discover;$('#suPair').onclick=pair;
  $('#suConn').onclick=()=>{if(MODE==='demo')switchMode('real');else connect();};
  $('#suDemo').onclick=()=>{if(MODE==='demo'){store.set('huedesk.demo','');}switchMode('demo');};
  $('#suName').oninput=e=>{S.name=e.target.value;$('#showName').textContent=S.name;touch(false);};
  $('#suRate').oninput=e=>{S.settings.rate=+e.target.value;$('#suRateV').textContent=S.settings.rate+'/s';touch(false);};
  $('#suGrp').onchange=e=>{S.settings.groupOpt=e.target.checked;touch(false);};
  $('#suExport').onclick=exportShow;$('#suImport').onclick=()=>$('#importFile').click();$('#suAgenda').onclick=openAgenda;
  $('#importFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{loadShowData(JSON.parse(r.result));msg('Show imported','ok');}catch(err){msg('Import failed: '+err.message,'err');}};r.readAsText(f);e.target.value='';};
  $('#suLoadUrl').onclick=async()=>{const u=$('#suUrl').value.trim();if(!u)return msg('Enter the file name, e.g. huedesk-show.json','warn');
    try{const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);loadShowData(await r.json());store.set('huedesk.tablet.showUrl',u);msg('Show loaded from server','ok');}catch(err){msg('Could not load '+u+': '+err.message,'err');}};
  $('#suUrl').value=store.get('huedesk.tablet.showUrl')||'';
  $('#suStarter').onclick=()=>choose('Rebuild starter cues?','Executors 1 to 5 will be replaced.',[['y','Rebuild','pri']],()=>{for(let e=0;e<NEX;e++)execOffNow(e);buildStarter(S);touch();msg('Starter cues built','ok');});
  $('#suGroups').onclick=()=>{autoGroups(S);touch();msg('Groups rebuilt from rooms','ok');};
  $('#suTour').onclick=()=>startTour(true);
  $('#kWake').onchange=e=>{K.wake=e.target.checked;saveK();applyWake();};
  $('#kHome').onchange=e=>{K.idleHome=+e.target.value;saveK();};$('#kDim').onchange=e=>{K.idleDim=+e.target.value;saveK();};
  $('#kHide').onchange=e=>{K.hideEmpty=e.target.checked;saveK();buildExecs();};
  $('#kLockFx').onchange=e=>{K.lockFx=e.target.checked;saveK();document.body.classList.toggle('playonly',!K.lockFx);};
  $('#kPin').onclick=()=>pinPad('Choose a 4-digit PIN',p1=>pinPad('Enter it again',p2=>{if(p1===p2){K.pin=p1;saveK();renderSetup();msg('PIN saved','ok');}else msg('The PINs did not match','err');}));
  $('#kLockNow').onclick=lockTap;$('#kFs').onclick=toggleFs;
  // tour
  $('#tourNext').onclick=()=>tourGo(1);$('#tourBack').onclick=()=>tourGo(-1);$('#tourSkip').onclick=endTour;
  $('#tourNo').onchange=e=>store.set(TOUR_DEMO_KEY,e.target.checked?'1':'0');
  window.addEventListener('resize',()=>{placeStep();});
  // hardware keyboard (optional)
  document.addEventListener('keydown',e=>{if(RT.tour){if(e.key==='Escape')endTour();if(e.key==='ArrowRight')tourGo(1);if(e.key==='ArrowLeft')tourGo(-1);return;}
    if(RT.modal){if(e.key==='Escape')closeModal();return;}if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;
    if(e.key===' '){e.preventDefault();execGo(RT.selExec);}if(e.key==='Escape')doClear();});
}

/* ---------------- init ---------------- */
function init(){MODE=store.get('huedesk.mode')==='demo'?'demo':'real';S=loadShow();
  RT.locked=store.get('huedesk.tablet.locked')==='1';document.body.classList.toggle('locked',RT.locked);document.body.classList.toggle('playonly',!K.lockFx);
  buildTabs();buildKeypad();drawWheelBase();bind();renderAll();showTab('play');
  OUT.lastT=now();RT.smT=now();startTicker(schedTick,20);setInterval(agendaTick,10000);setInterval(idleTick,5000);
  window.addEventListener('beforeunload',saveShow);document.addEventListener('visibilitychange',()=>{if(document.hidden)saveShow();});
  requestAnimationFrame(frame);applyWake();
  if(MODE==='demo'||(S.settings.ip&&S.settings.user))connect();else if(!RT.locked)openWelcome();}
init();
