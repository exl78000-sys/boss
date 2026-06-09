(function(){
'use strict';

const firebaseConfig={apiKey:"AIzaSyD5L4tp6vnjgHOIM7aEWx3fd8D2KdOb6WI",authDomain:"boss-app-34bcd.firebaseapp.com",projectId:"boss-app-34bcd",storageBucket:"boss-app-34bcd.firebasestorage.app",messagingSenderId:"728632211313",appId:"1:728632211313:web:66f966b8b7ccf6cb3ee8d0",measurementId:"G-PN361HPV2J"};
const bosses=[{name:'龍王',limit:12},{name:'困拉',limit:6},{name:'炎魔',limit:6},{name:'普拉',limit:6}];
const bossOrder=['龍王','困拉','炎魔','普拉'];
const jobs={劍士:['黑騎','英雄','聖騎士'],弓箭手:['弩手','弓手'],盜賊:['標賊','刀賊'],海盜:['槍手','拳霸'],法師:['主教','冰雷','火毒']};
const $=id=>document.getElementById(id);
const E={};
['installBtn','currentCycleText','cycleBtns','classGroupBtns','jobBtns','bossBtns','dateChecks','selectAllDates','submitSignup','playerName','hasAlt','accountGroup','adminCycle','adminBoss','adminDate','rosterCycle','rosterBossBtns','rosterTitle','rosterCount','rosterList','rosterGenerateTeams','rosterTeamResult','rosterCopyTeams','mySignupList','refreshMine','signupCount','signupList','allData','exportData','importData','clearData','syncStatus','toast'].forEach(id=>E[id]=$(id));

let db=null, signupsRef=null, state={signups:[]};
let selectedCycle='', selectedBoss='龍王', selectedGroup='劍士', selectedJob='黑騎', selectedRosterBoss='龍王';
let lastProfileLoadedFor='';
let lastTeams=null, lastMode='';

function norm(s){return String(s||'').trim().toLowerCase();}
function html(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function fmt(d){return `${d.getMonth()+1}/${d.getDate()}`;}
function dow(d){return '日一二三四五六'[d.getDay()];}
function dateLabel(d){return `${fmt(d)} ${dow(d)}`;}
function cycles(){const now=new Date();const th=addDays(now,(4-now.getDay()+7)%7);return [0,7].map(o=>{const s=addDays(th,o),e=addDays(s,6);return {id:`${fmt(s)}-${fmt(e)}`,label:`${fmt(s)} - ${fmt(e)}`,dates:Array.from({length:7},(_,i)=>addDays(s,i))};});}
function cycleDates(cycleId){const c=cycles().find(x=>x.id===cycleId)||cycles()[0];return c.dates.map(dateLabel);}
function dateOrder(label,cycleId=selectedCycle){return cycleDates(cycleId).indexOf(label);}
function toast(msg){if(!E.toast)return alert(msg);E.toast.textContent=msg;E.toast.classList.remove('hidden');setTimeout(()=>E.toast.classList.add('hidden'),2200);}
function setStatus(msg,cls='sync-warn'){if(E.syncStatus){E.syncStatus.textContent='同步狀態：'+msg;E.syncStatus.className='hint '+cls;}}
function signupKey(s){return `${norm(s.player)}|${s.cycle}|${s.boss}|${s.date}`;}
function docId(s){return encodeURIComponent(signupKey(s)).replace(/[.#$[\]/]/g,'_');}
function timeValue(s){const t=new Date(s.createdAt||0).getTime();return Number.isFinite(t)?t:0;}
function signupTime(s){const d=new Date(s.createdAt||0);if(!Number.isFinite(d.getTime())||d.getTime()===0)return '舊資料';const p=n=>String(n).padStart(2,'0');return `${fmt(d)} ${p(d.getHours())}:${p(d.getMinutes())}`;}
function byTime(a,b){return timeValue(a)-timeValue(b)||String(a.player).localeCompare(String(b.player),'zh-Hant');}
function accountKey(s){return s&&s.hasAlt&&s.accountGroup?norm(s.accountGroup):'';}
function displayAccount(s){return accountKey(s)?`｜分身群組 ${html(s.accountGroup)}`:'';}
function identity(s){return norm(s.player);}
function bossLimit(boss){return bosses.find(b=>b.name===boss)?.limit||6;}
function isDK(s){return s.job==='黑騎';}
function isBucc(s){return s.job==='拳霸';}
function isArcher(s){return s.group==='弓箭手';}
function isMage(s){return s.group==='法師';}
function tag(s){if(s.job==='黑騎')return '黑騎';if(s.job==='拳霸')return '拳';if(s.group==='弓箭手')return '弓';if(s.group==='法師')return '法';return '輸出';}

function initFirebase(){
  try{
    if(!window.firebase||!firebase.firestore){setStatus('Firebase SDK 未載入，請重新整理','sync-bad');return;}
    if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);
    db=firebase.firestore();
    signupsRef=db.collection('signups');
    signupsRef.onSnapshot(snap=>{
      state.signups=snap.docs.map(d=>({id:d.id,...d.data()}));
      setStatus(`已同步 ${state.signups.length} 筆`,'sync-ok');
      renderAll();
    },err=>{console.error(err);setStatus('Firestore 連線失敗，請檢查規則','sync-bad');});
  }catch(err){console.error(err);setStatus('Firebase 初始化失敗','sync-bad');}
}
async function addSignup(item){if(!signupsRef){toast('Firebase 尚未連線');return false;}await signupsRef.doc(docId(item)).set(item);return true;}
async function deleteSignupObj(s){if(!signupsRef||!s)return;await signupsRef.doc(s.id||docId(s)).delete();}
async function updateSignupObj(s,patch){if(!signupsRef||!s)return;await signupsRef.doc(s.id||docId(s)).update(patch);}

function init(){
  selectedCycle=cycles()[0].id;
  bindTabs();bindActions();renderSignup();renderAll();initFirebase();
  let deferred;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;E.installBtn?.classList.remove('hidden');});
  if(E.installBtn)E.installBtn.onclick=()=>deferred&&deferred.prompt();
}
function bindTabs(){document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab,.page').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.page).classList.add('active');renderAll();}));}
function bindActions(){
  E.hasAlt.onchange=()=>{E.accountGroup.classList.toggle('hidden',!E.hasAlt.checked);if(!E.hasAlt.checked)E.accountGroup.value='';};
  E.playerName.addEventListener('input',()=>{
    const loaded=autoFillProfileByName();
    if(loaded){renderSignup();toast('已自動帶入既有職業/分身資料');}
    else renderMine();
  });
  E.refreshMine.onclick=renderMine;
  E.selectAllDates.onclick=()=>{const checks=[...E.dateChecks.querySelectorAll('input')];const on=checks.some(x=>!x.checked);checks.forEach(x=>x.checked=on);E.selectAllDates.textContent=on?'取消全選':'日期全選';};
  E.submitSignup.onclick=submitSignup;
  E.rosterGenerateTeams.onclick=generateRosterTeams;
  E.rosterCopyTeams.onclick=copyTeams;
  E.exportData.onclick=exportJson;
  E.importData.onchange=importJson;
  E.clearData.onclick=clearAll;
  [E.adminCycle,E.adminBoss,E.adminDate].forEach(el=>el.onchange=renderAdminList);
  E.rosterCycle.onchange=()=>{lastTeams=null;renderRoster();};
}
function renderSignup(){
  E.currentCycleText.textContent=`週期：${selectedCycle}`;
  E.cycleBtns.innerHTML=cycles().map(c=>`<button class="choice ${c.id===selectedCycle?'active':''}" data-cycle="${c.id}" type="button">${c.label}</button>`).join('');
  E.cycleBtns.querySelectorAll('button').forEach(b=>b.onclick=()=>{selectedCycle=b.dataset.cycle;renderSignup();renderAll();});
  E.classGroupBtns.innerHTML=Object.keys(jobs).map(g=>`<button class="choice ${g===selectedGroup?'active':''}" data-group="${g}" type="button">${g}</button>`).join('');
  E.classGroupBtns.querySelectorAll('button').forEach(b=>b.onclick=()=>{selectedGroup=b.dataset.group;selectedJob=jobs[selectedGroup][0];renderSignup();});
  E.jobBtns.innerHTML=jobs[selectedGroup].map(j=>`<button class="choice ${j===selectedJob?'active':''}" data-job="${j}" type="button">${j}</button>`).join('');
  E.jobBtns.querySelectorAll('button').forEach(b=>b.onclick=()=>{selectedJob=b.dataset.job;renderSignup();});
  E.bossBtns.innerHTML=bosses.map(b=>`<button class="choice ${b.name===selectedBoss?'active':''}" data-boss="${b.name}" type="button">${b.name}<br><small>${b.limit}人</small></button>`).join('');
  E.bossBtns.querySelectorAll('button').forEach(b=>b.onclick=()=>{selectedBoss=b.dataset.boss;renderSignup();});
  E.dateChecks.innerHTML=cycleDates(selectedCycle).map(d=>`<label class="choice dateChoice"><input type="checkbox" value="${d}"><span>${d}</span></label>`).join('');
  renderMine();
}
function fillCycleSelect(el){el.innerHTML=cycles().map(c=>`<option value="${c.id}" ${c.id===selectedCycle?'selected':''}>${c.id}</option>`).join('');}
function renderAll(){
  fillCycleSelect(E.adminCycle);fillCycleSelect(E.rosterCycle);
  E.adminBoss.innerHTML=bosses.map(b=>`<option>${b.name}</option>`).join('');
  E.adminDate.innerHTML=['週期全部日期',...cycleDates(E.adminCycle.value||selectedCycle)].map(v=>`<option>${v}</option>`).join('');
  renderRoster();renderAdminList();renderAllData();renderMine();
}
function currentProfilePatch(){
  return {group:selectedGroup,job:selectedJob,hasAlt:E.hasAlt.checked,accountGroup:E.hasAlt.checked?E.accountGroup.value.trim():''};
}
function autoFillProfileByName(){
  const name=E.playerName.value.trim();
  const key=norm(name);
  if(!key||key===lastProfileLoadedFor)return false;
  const matches=state.signups.filter(s=>norm(s.player)===key).sort((a,b)=>timeValue(b)-timeValue(a));
  if(!matches.length)return false;
  const s=matches[0];
  selectedGroup=s.group||selectedGroup;
  selectedJob=s.job||jobs[selectedGroup]?.[0]||selectedJob;
  E.hasAlt.checked=!!s.hasAlt;
  E.accountGroup.classList.toggle('hidden',!E.hasAlt.checked);
  E.accountGroup.value=s.hasAlt?(s.accountGroup||''):'';
  lastProfileLoadedFor=key;
  return true;
}
async function submitSignup(){
  const name=E.playerName.value.trim();
  const dates=[...E.dateChecks.querySelectorAll('input:checked')].map(x=>x.value);
  if(!name)return toast('請輸入玩家名稱');
  if(E.hasAlt.checked&&!E.accountGroup.value.trim())return toast('請輸入分身群組名稱');
  const patch=currentProfilePatch();

  // 沒有勾日期時，若這個玩家本週已報名，按送出就更新既有報名資料。
  if(!dates.length){
    const targets=state.signups.filter(s=>norm(s.player)===norm(name)&&s.cycle===selectedCycle);
    if(!targets.length)return toast('請至少選一個日期');
    await Promise.all(targets.map(s=>updateSignupObj(s,patch)));
    toast(`已更改 ${targets.length} 筆報名資料`);
    return;
  }

  let added=0,changed=0;
  for(const date of dates){
    const item={cycle:selectedCycle,boss:selectedBoss,date,player:name,group:selectedGroup,job:selectedJob,hasAlt:E.hasAlt.checked,accountGroup:E.hasAlt.checked?E.accountGroup.value.trim():'',createdAt:new Date().toISOString()};
    const existing=state.signups.find(s=>signupKey(s)===signupKey(item));
    if(existing){await updateSignupObj(existing,patch);changed++;continue;}
    item.id=docId(item);
    await addSignup(item);added++;
  }
  E.dateChecks.querySelectorAll('input').forEach(x=>x.checked=false);E.selectAllDates.textContent='日期全選';
  if(added&&changed)toast(`報名成功 ${added} 筆，已更改 ${changed} 筆`);
  else if(added)toast(`報名成功：${added} 筆`);
  else toast(`已更改 ${changed} 筆報名資料`);
}
function findSignup(player,cycle,boss,date){return state.signups.find(s=>norm(s.player)===norm(player)&&s.cycle===cycle&&s.boss===boss&&s.date===date);}
async function toggleMineDate(boss,date){
  const name=E.playerName.value.trim(); if(!name)return toast('請輸入玩家名稱');
  const exists=findSignup(name,selectedCycle,boss,date);
  if(exists){if(confirm(`取消 ${boss} ${date} 報名？`)){await deleteSignupObj(exists);toast('已取消報名');}}
  else{
    if(confirm(`加入 ${boss} ${date} 報名？`)){
      if(E.hasAlt.checked&&!E.accountGroup.value.trim())return toast('請輸入分身群組名稱');
      const item={cycle:selectedCycle,boss,date,player:name,group:selectedGroup,job:selectedJob,hasAlt:E.hasAlt.checked,accountGroup:E.hasAlt.checked?E.accountGroup.value.trim():'',createdAt:new Date().toISOString()}; item.id=docId(item); await addSignup(item); toast('已加入報名');
    }
  }
}
function settingSummaryFromForm(){return `${selectedGroup}｜${selectedJob}${E.hasAlt.checked?`｜分身群組 ${E.accountGroup.value.trim()||'未填'}`:'｜無分身群組'}`;}
function settingSummaryFromSignup(s){return `${s?.group||'未填'}｜${s?.job||'未填'}${s?.hasAlt?`｜分身群組 ${html(s.accountGroup||'未填')}`:'｜無分身群組'}`;}
async function applyCurrentSettingToMine(scopeBoss){
  const name=E.playerName.value.trim(); if(!name)return toast('請輸入玩家名稱');
  if(E.hasAlt.checked&&!E.accountGroup.value.trim())return toast('請輸入分身群組名稱');
  const targets=state.signups.filter(s=>norm(s.player)===norm(name)&&s.cycle===selectedCycle&&(!scopeBoss||s.boss===scopeBoss));
  if(!targets.length)return toast('沒有可更新的報名');
  const label=scopeBoss?`${scopeBoss} ${targets.length} 筆`:`本週全部 ${targets.length} 筆`;
  if(!confirm(`將目前上方選擇的職業/分身設定套用到 ${label}？

目前設定：${settingSummaryFromForm()}`))return;
  const patch={group:selectedGroup,job:selectedJob,hasAlt:E.hasAlt.checked,accountGroup:E.hasAlt.checked?E.accountGroup.value.trim():''};
  await Promise.all(targets.map(s=>updateSignupObj(s,patch)));
  toast(`已更新 ${targets.length} 筆資料`);
}
function loadSettingFromSignupId(id){
  const s=state.signups.find(x=>(x.id||docId(x))===id); if(!s)return;
  selectedGroup=s.group||selectedGroup; selectedJob=s.job||jobs[selectedGroup]?.[0]||selectedJob;
  E.hasAlt.checked=!!s.hasAlt; E.accountGroup.classList.toggle('hidden',!E.hasAlt.checked); E.accountGroup.value=s.hasAlt?(s.accountGroup||''):'';
  renderSignup(); toast('已載入職業/分身設定到上方表單');
}
function renderMine(){
  const name=E.playerName?.value.trim();
  if(!name){E.mySignupList.innerHTML='<div class="empty">輸入玩家名稱後可查看報名</div>';return;}
  const dates=cycleDates(selectedCycle);
  const my=state.signups.filter(s=>norm(s.player)===norm(name)&&s.cycle===selectedCycle);
  const bossesWith=[...new Set(my.map(s=>s.boss))];
  if(!bossesWith.length){E.mySignupList.innerHTML='<div class="empty">這個週期目前沒有報名</div>';return;}
  E.mySignupList.innerHTML=`<div class="mine-tools"><div class="hint">已帶入此玩家既有資料。若要修改職業或分身群組，直接調整上方表單後按「送出報名」；未勾日期時會更新本週全部既有報名。</div></div>`+
    bossesWith.map(boss=>{const bossItems=my.filter(s=>s.boss===boss).sort(byTime);const first=bossItems[0];return `<div class="item"><div class="row between"><b>${html(name)}｜${boss}｜${selectedCycle}</b></div><small>目前：${settingSummaryFromSignup(first)}</small><div class="mine-days">${dates.map(d=>{const yes=!!findSignup(name,selectedCycle,boss,d);return `<button class="day-dot ${yes?'yes':'no'}" type="button" data-boss="${boss}" data-date="${d}"><span>${d.replace(' ','')}</span><b>${yes?'●':'×'}</b></button>`;}).join('')}</div></div>`}).join('');
  E.mySignupList.querySelectorAll('.day-dot').forEach(b=>b.onclick=()=>toggleMineDate(b.dataset.boss,b.dataset.date));
}
function renderRoster(){
  const cycle=E.rosterCycle.value||selectedCycle;
  const rb=[...bosses.map(b=>b.name),'週王'];
  E.rosterBossBtns.innerHTML=rb.map(n=>`<button class="choice ${n===selectedRosterBoss?'active':''}" data-boss="${n}" type="button">${n}</button>`).join('');
  E.rosterBossBtns.querySelectorAll('button').forEach(b=>b.onclick=()=>{selectedRosterBoss=b.dataset.boss;lastTeams=null;renderRoster();});
  if(selectedRosterBoss==='週王')renderWeeklyRoster(cycle); else renderBossRoster(cycle,selectedRosterBoss);
  if(lastTeams)renderTeams(lastTeams,E.rosterTeamResult,lastMode); else E.rosterTeamResult.innerHTML='尚未編排',E.rosterTeamResult.classList.add('empty');
}
function renderBossRoster(cycle,boss){
  const dates=cycleDates(cycle); const arr=state.signups.filter(s=>s.cycle===cycle&&s.boss===boss);
  const map=new Map(); arr.forEach(s=>{const k=norm(s.player);if(!map.has(k))map.set(k,{...s,dates:new Set(),first:s.createdAt});const p=map.get(k);p.dates.add(s.date);if(timeValue(s)<timeValue({createdAt:p.first}))p.first=s.createdAt;});
  const players=[...map.values()].sort((a,b)=>b.dates.size-a.dates.size||byTime(a,b));
  E.rosterTitle.textContent=`${boss} 報名狀況`; E.rosterCount.textContent=`${players.length}人 / ${arr.length}筆`;
  E.rosterList.innerHTML=players.length?players.map(p=>`<div class="roster-player"><div class="roster-head"><b>${html(p.player)}</b><small>${p.job}｜可打 ${p.dates.size} 天｜首次 ${signupTime({createdAt:p.first})}${displayAccount(p)}</small></div><div class="availability-grid">${dates.map(d=>`<div class="availability ${p.dates.has(d)?'yes':'no'}"><span>${d.replace(' ','')}</span><b>${p.dates.has(d)?'●':'×'}</b></div>`).join('')}</div></div>`).join(''):'<div class="empty">目前沒有人報名</div>';
}
function renderWeeklyRoster(cycle){
  const arr=state.signups.filter(s=>s.cycle===cycle);
  E.rosterTitle.textContent='週王報名狀況'; E.rosterCount.textContent=`${new Set(arr.map(s=>norm(s.player))).size}人 / ${arr.length}筆`;
  const byBoss=bossOrder.map(b=>`${b} ${arr.filter(s=>s.boss===b).length}`).join('｜');
  E.rosterList.innerHTML=arr.length?`<div class="item"><b>${cycle}</b><small>${byBoss}</small></div>`:'<div class="empty">目前沒有人報名</div>';
}
function renderAdminList(){
  const cycle=E.adminCycle.value||selectedCycle,boss=E.adminBoss.value||'龍王',date=E.adminDate.value||'週期全部日期';
  const arr=state.signups.filter(s=>s.cycle===cycle&&s.boss===boss&&(date==='週期全部日期'||s.date===date)).sort(byTime);
  E.signupCount.textContent=`${arr.length}筆`;
  E.signupList.innerHTML=arr.length?arr.map(s=>`<div class="item"><b>${html(s.player)}</b><small>${s.job}｜${s.boss}｜${s.date}｜報名 ${signupTime(s)}${displayAccount(s)}</small></div>`).join(''):'<div class="empty">目前沒有人報名</div>';
}
function renderAllData(){
  E.allData.innerHTML=state.signups.length?state.signups.slice().sort((a,b)=>timeValue(b)-timeValue(a)).map(s=>`<div class="item"><b>${html(s.player)}｜${s.job}</b><small>${s.cycle}｜${s.boss}｜${s.date}｜報名 ${signupTime(s)}${displayAccount(s)}</small></div>`).join(''):'<div class="empty">尚無資料</div>';
}

function reqSlots(boss){
  if(boss==='龍王')return [{label:'黑騎',fn:isDK,count:2,prefer:['黑騎']},{label:'弓箭手',fn:isArcher,count:2,prefer:['弩手','弓手']},{label:'拳霸',fn:isBucc,count:1,prefer:['拳霸']}];
  if(boss==='困拉')return [{label:'黑騎',fn:isDK,count:1,prefer:['黑騎']},{label:'弓箭手',fn:isArcher,count:1,prefer:['弓手','弩手']},{label:'法師',fn:isMage,count:2,prefer:['主教','冰雷|火毒']}];
  if(boss==='炎魔')return [{label:'黑騎',fn:isDK,count:1,prefer:['黑騎']},{label:'弓箭手',fn:isArcher,count:1,prefer:['弩手','弓手']},{label:'法師',fn:isMage,count:1,prefer:['主教','冰雷|火毒']}];
  if(boss==='普拉')return [{label:'法師',fn:isMage,count:1,prefer:['主教|冰雷|火毒'],soft:true},{label:'弓箭手',fn:isArcher,count:1,prefer:['弩手|弓手'],soft:true}];
  return [];
}
function memberCanJoinTeam(team,m){const ak=accountKey(m);if(!ak)return !team.some(x=>identity(x)===identity(m));return !team.some(x=>accountKey(x)===ak||identity(x)===identity(m));}
function pickOne(pool,team,predicate){const i=pool.findIndex(x=>predicate(x)&&memberCanJoinTeam(team,x));return i>=0?pool.splice(i,1)[0]:null;}
function pickByJobs(pool,team,jobspec,baseFn){
  const opts=jobspec.split('|');
  return pickOne(pool,team,x=>(!baseFn||baseFn(x))&&opts.includes(x.job));
}
function fillRequirement(team,pool,slot){
  for(let i=0;i<slot.count;i++){
    let m=null;
    for(const pref of slot.prefer||[]){m=pickByJobs(pool,team,pref,slot.fn);if(m)break;}
    if(!m)m=pickOne(pool,team,slot.fn);
    if(m)team.push(m);
  }
}
function jobCount(team,job){return team.filter(x=>x.job===job).length;}
function outputPriority(boss,x){
  if(boss==='龍王'){if(x.group==='劍士'||x.job==='刀賊'||x.job==='拳霸')return 0;if(x.group==='弓箭手')return 1;if(x.group==='法師')return 2;if(x.job==='槍手'||x.job==='標賊')return 3;return 4;}
  if(boss==='困拉'){if(x.job==='槍手'||x.job==='弓手')return 0;if(x.group==='盜賊'||x.group==='劍士'||x.job==='拳霸')return 1;if(x.group==='法師')return 2;return 3;}
  if(boss==='炎魔'){if(x.job==='弩手'||x.job==='槍手')return 0;if(x.group==='劍士'||x.job==='標賊'||x.job==='弓手')return 1;if(x.group==='法師')return 2;return 3;}
  if(boss==='普拉'){if(x.group==='法師')return 0;if(x.group==='弓箭手')return 1;return 2;}return 9;
}
function mageLimitBoss(boss){return ['困拉','炎魔','普拉'].includes(boss);}
function mageCountIn(team){return team.filter(isMage).length;}
function candidateAllowedByMageCap(team,m,boss){
  // 困拉、炎魔、普拉：法師上限 2 位。
  // 若已經有 2 位法師，只有在其他可選職業都篩完、剩下法師時，才允許第 3 位法師。
  if(!mageLimitBoss(boss))return true;
  if(!isMage(m))return true;
  return mageCountIn(team)<2;
}
function fillTeam(team,pool,boss,limit){
  while(team.length<limit){
    const base=pool.filter(x=>memberCanJoinTeam(team,x));
    if(!base.length)break;
    let candidates=base.filter(x=>candidateAllowedByMageCap(team,x,boss));
    // 若剩餘可用角色全是法師，才放寬法師上限，讓隊伍可補滿或列出更接近成團的未成團隊伍。
    if(!candidates.length && base.every(isMage))candidates=base;
    if(!candidates.length)break;
    candidates.sort((a,b)=>{
      const ac=jobCount(team,a.job),bc=jobCount(team,b.job);
      if(ac!==bc)return ac-bc;
      const ap=outputPriority(boss,a),bp=outputPriority(boss,b);
      if(ap!==bp)return ap-bp;
      return byTime(a,b);
    });
    const m=candidates[0]; pool.splice(pool.indexOf(m),1); team.push(m);
  }
}
function reqUnits(boss){
  // 需求以「單一位置」展開，避免同一分身群組的輸出角色先卡掉必要職業。
  // 例如同群組有刀賊與弓手時，若隊伍缺弓箭手，會優先選弓手而不是刀賊。
  if(boss==='龍王')return [
    {label:'黑騎',fn:isDK,prefer:['黑騎']},
    {label:'黑騎',fn:isDK,prefer:['黑騎']},
    {label:'弓箭手',fn:isArcher,prefer:['弩手','弓手']},
    {label:'弓箭手',fn:isArcher,prefer:['弓手','弩手']},
    {label:'拳霸',fn:isBucc,prefer:['拳霸']}
  ];
  if(boss==='困拉')return [
    {label:'黑騎',fn:isDK,prefer:['黑騎']},
    {label:'弓箭手',fn:isArcher,prefer:['弓手','弩手']},
    {label:'法師',fn:isMage,prefer:['主教','冰雷|火毒']},
    {label:'法師',fn:isMage,prefer:['冰雷|火毒','主教']}
  ];
  if(boss==='炎魔')return [
    {label:'黑騎',fn:isDK,prefer:['黑騎']},
    {label:'弓箭手',fn:isArcher,prefer:['弩手','弓手']},
    {label:'法師',fn:isMage,prefer:['主教','冰雷|火毒']}
  ];
  return [];
}
function prefIndex(unit,m){
  if(!unit.fn(m))return 999;
  for(let i=0;i<(unit.prefer||[]).length;i++){
    const opts=unit.prefer[i].split('|');
    if(opts.includes(m.job))return i;
  }
  return (unit.prefer||[]).length+1;
}
function assignmentScore(team,units){
  // 分數越大越好：先比必要職業完成數，再比職業細部優先，再比職業多樣性，最後比報名時間。
  let pref=0,time=0;
  team.forEach((m,i)=>{pref+=100-prefIndex(units[i],m)*20; time-=timeValue(m)/1000000000000;});
  const diversity=new Set(team.map(x=>x.job)).size;
  return team.length*100000 + pref*100 + diversity*10 + time;
}
function buildRequirementTeam(pool,boss){
  const units=reqUnits(boss);
  if(!units.length)return [];
  let best=[];
  let bestScore=-Infinity;
  const candidateLists=units.map(unit=>pool.filter(unit.fn).sort((a,b)=>prefIndex(unit,a)-prefIndex(unit,b)||byTime(a,b)).slice(0,18));
  function dfs(idx,chosen){
    if(idx>=units.length){
      const sc=assignmentScore(chosen,units);
      if(sc>bestScore){bestScore=sc;best=chosen.slice();}
      return;
    }
    // 先嘗試能滿足此必要位置的角色。
    for(const m of candidateLists[idx]){
      if(chosen.includes(m))continue;
      if(!memberCanJoinTeam(chosen,m))continue;
      chosen.push(m);
      dfs(idx+1,chosen);
      chosen.pop();
    }
    // 允許不足，讓未成團區仍能顯示「接近成團」的隊伍與缺少項目。
    dfs(idx+1,chosen);
  }
  dfs(0,[]);
  return best;
}
function fillSoftPreference(team,pool,boss){
  if(boss!=='普拉')return;
  // 普拉法師、弓箭手平等，優先但非必需。
  const soft=[{fn:isMage},{fn:isArcher}];
  soft.forEach(s=>{const m=pickOne(pool,team,s.fn);if(m)team.push(m);});
}
function buildTeam(available,boss){
  const pool=available.slice().sort(byTime); const team=[]; const limit=bossLimit(boss);
  const reqTeam=buildRequirementTeam(pool,boss);
  reqTeam.forEach(m=>{const i=pool.indexOf(m); if(i>=0){team.push(m); pool.splice(i,1);}});
  fillSoftPreference(team,pool,boss);
  fillTeam(team,pool,boss,limit);
  return team;
}
function reqStatus(team,boss){return reqSlots(boss).map(r=>{const have=team.filter(r.fn).length;return {...r,have,missing:Math.max(0,r.count-have)};});}
function complete(team,boss){return team.length===bossLimit(boss)&&reqStatus(team,boss).filter(r=>!r.soft).every(r=>r.missing===0);}
function unformedReason(members,boss,team=buildTeam(members,boss)){
  const reasons=[]; const limit=bossLimit(boss); if(team.length<limit)reasons.push(`人數不足（${team.length}/${limit}）`);
  reqStatus(team,boss).filter(r=>!r.soft&&r.missing>0).forEach(r=>reasons.push(`缺少${r.label} ${r.missing}`));
  return reasons.length?reasons:['條件不足'];
}
function usageCanUse(m,date,boss,usage){
  if(usage.players.has(identity(m)))return false;
  const ak=accountKey(m); if(!ak)return true;
  const g=usage.groups.get(`${date}|${ak}`); if(!g)return true;
  if(boss==='普拉')return !g.lock && g.pap<2;
  return false;
}
function markUse(m,date,boss,usage){
  usage.players.add(identity(m));
  const ak=accountKey(m); if(!ak)return;
  const key=`${date}|${ak}`; const g=usage.groups.get(key)||{lock:false,pap:0};
  if(boss==='普拉')g.pap++; else g.lock=true;
  usage.groups.set(key,g);
}
function useEligibleForDisplay(m,date,boss,usage,previewUsed){
  if(previewUsed&&previewUsed.has(identity(m)))return false;
  return usageCanUse(m,date,boss,usage);
}
function findBestCompleteTeam(cycle,boss,usage){
  const candidates=[];
  for(const date of cycleDates(cycle)){
    const all=state.signups.filter(s=>s.cycle===cycle&&s.boss===boss&&s.date===date);
    const available=all.filter(s=>usageCanUse(s,date,boss,usage));
    if(!available.length)continue;
    const team=buildTeam(available,boss);
    if(complete(team,boss))candidates.push({date,boss,team,total:all.length,available:available.length});
  }
  if(!candidates.length)return null;
  // 最大成團數優先：完整團通常等於上限；同分時取該日期可用人最多、原報名最多，再取較早日期。
  candidates.sort((a,b)=>b.team.length-a.team.length||b.available-a.available||b.total-a.total||dateOrder(a.date,cycle)-dateOrder(b.date,cycle));
  return candidates[0];
}
function buildSingleBossTeams(cycle,boss){
  const usage={players:new Set(),groups:new Map()};
  const formed=[];
  while(true){
    const best=findBestCompleteTeam(cycle,boss,usage);
    if(!best)break;
    best.team.forEach(m=>markUse(m,best.date,boss,usage));
    formed.push({date:best.date,boss,team:best.team,total:best.total});
  }
  const unformed=buildUpcomingUnformed(cycle,[boss],usage);
  return {formed,unformed};
}
function buildWeekBossTeams(cycle){
  const usage={players:new Set(),groups:new Map()};
  const formed=[];
  for(const boss of bossOrder){
    while(true){
      const best=findBestCompleteTeam(cycle,boss,usage);
      if(!best)break;
      best.team.forEach(m=>markUse(m,best.date,boss,usage));
      formed.push({date:best.date,boss,team:best.team,total:best.total});
    }
  }
  const unformed=buildUpcomingUnformed(cycle,bossOrder,usage);
  return {formed,unformed};
}
function buildUpcomingUnformed(cycle,bossList,usage){
  // 只列出「即將成團」的候補隊伍，不再把每個日期的重複候選全部列出。
  // 顯示用的 previewUsed 會避免同一角色在未成團區重複出現。
  const previewUsed=new Set();
  const result=[];
  for(const boss of bossList){
    let safety=0;
    while(safety++<30){
      const partials=[];
      for(const date of cycleDates(cycle)){
        const all=state.signups.filter(s=>s.cycle===cycle&&s.boss===boss&&s.date===date);
        const available=all.filter(s=>useEligibleForDisplay(s,date,boss,usage,previewUsed));
        if(!available.length)continue;
        const team=buildTeam(available,boss);
        if(!team.length)continue;
        if(complete(team,boss))continue;
        partials.push({date,boss,members:team,total:all.length,available:available.length,reasons:unformedReason(available,boss,team)});
      }
      if(!partials.length)break;
      partials.sort((a,b)=>b.members.length-a.members.length||b.available-a.available||b.total-a.total||dateOrder(a.date,cycle)-dateOrder(b.date,cycle));
      const best=partials[0];
      best.members.forEach(m=>previewUsed.add(identity(m)));
      result.push(best);
    }
  }
  return result;
}
function generateRosterTeams(){
  const cycle=E.rosterCycle.value||selectedCycle;
  lastMode=selectedRosterBoss==='週王'?'weekBoss':'boss';
  lastTeams=selectedRosterBoss==='週王'?buildWeekBossTeams(cycle):buildSingleBossTeams(cycle,selectedRosterBoss);
  renderTeams(lastTeams,E.rosterTeamResult,lastMode);
}
function conflictGroups(data){
  const map=new Map();
  (data.formed||[]).forEach(f=>f.team.forEach(m=>{const ak=accountKey(m);if(!ak)return;const k=`${f.date}|${ak}`;if(!map.has(k))map.set(k,[]);map.get(k).push({...m,boss:f.boss,date:f.date});}));
  return [...map.entries()].filter(([k,v])=>v.length>1);
}
function renderTeams(data,target,mode){
  target.classList.remove('empty');
  if(!data||(!(data.formed||[]).length&&!(data.unformed||[]).length)){target.innerHTML='<div class="empty">目前沒有可編排的隊伍</div>';return;}
  const conflicts=conflictGroups(data);
  const chtml=conflicts.length?`<div class="conflict-box"><b>橘燈提醒：分身同天多角色</b>${conflicts.map(([k,v])=>`<div>${html(v[0].accountGroup)}：${v.map(x=>html(x.player)+'('+x.boss+')').join('、')}</div>`).join('')}</div>`:'';
  const formed=(data.formed||[]).map((f,i)=>teamHTML(f.team,i,f.date,f.boss,conflicts)).join('');
  const unformed=(data.unformed||[]).length?`<div class="unformed-block"><h2>未成團 / 即將成團隊伍</h2>${data.unformed.map((u,i)=>unformedHTML(u,i)).join('')}</div>`:'';
  target.innerHTML=chtml+formed+unformed;
}
function teamLetter(i){return String.fromCharCode(65+(i%26));}
function missingPeopleText(u){const limit=bossLimit(u.boss);return `缺少 ${Math.max(0,limit-u.members.length)} 位` + (u.members.length?`（${u.members.length}/${limit}）`:`（0/${limit}）`);}
function unformedHTML(u,i){
  return `<div class="unformed-card"><h3>${teamLetter(i)}團 未成團｜${u.boss}｜${u.date}</h3><div class="missing-line">${missingPeopleText(u)}${u.reasons&&u.reasons.length?'｜'+u.reasons.map(html).join('、'):''}</div>${u.members.map((m,idx)=>slotHTML(m,idx+1,false)).join('')}</div>`;
}
function isConflict(m,date,conflicts){const ak=accountKey(m);if(!ak)return false;return conflicts.some(([k,v])=>k===`${date}|${ak}`&&v.length>1);}
function teamHTML(team,i,date,boss,conflicts){
  const req=reqStatus(team,boss), missing=req.filter(r=>r.missing>0&&!r.soft);
  return `<div class="team ${missing.length?'team-warning':''}"><h3>${boss} ${date} 第 ${i+1} 隊｜${team.length}人</h3><div class="req-line">${req.map(r=>`${r.label} ${r.have}/${r.count}${r.missing&&!r.soft?' 缺'+r.missing:''}`).join('｜')}</div>${missing.length?`<div class="missing-line">缺少：${missing.map(r=>`${r.label} ${r.missing}`).join('、')}</div>`:''}${team.map((m,idx)=>slotHTML(m,idx+1,isConflict(m,date,conflicts))).join('')}</div>`;
}
function slotHTML(m,idx,orange){return `<div class="slot"><b>${idx}</b><div>${orange?'<span class="orange">● </span>':''}${html(m.player)}<div class="job">${m.group}｜${m.job}${displayAccount(m)}｜報名 ${signupTime(m)}</div></div><span>${tag(m)}</span></div>`;}
async function copyTeams(){
  if(!lastTeams)return toast('請先自動編排');
  const txt=(lastTeams.formed||[]).map((f,i)=>`${f.boss} ${f.date} 第${i+1}隊\n${f.team.map((m,n)=>`${n+1}. ${m.player}｜${m.job}`).join('\n')}`).join('\n\n');
  await navigator.clipboard.writeText(txt||'沒有成團'); toast('已複製隊伍');
}
function exportJson(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='boss-signups.json';a.click();URL.revokeObjectURL(a.href);}
function importJson(e){const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=async()=>{try{const data=JSON.parse(r.result);const arr=data.signups||[];for(const s of arr){s.id=s.id||docId(s);await addSignup(s);}toast('匯入完成');}catch{toast('匯入失敗');}};r.readAsText(file);}
async function clearAll(){if(!signupsRef)return toast('Firebase 尚未連線');if(!confirm('確定清除全部報名？'))return;const snap=await signupsRef.get();const batch=db.batch();snap.docs.forEach(d=>batch.delete(d.ref));await batch.commit();toast('已清除');}

window.addEventListener('DOMContentLoaded',init);
})();
