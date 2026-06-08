import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, getDocs, writeBatch, onSnapshot, serverTimestamp, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5L4tp6vnjgHOIM7aEWx3fd8D2KdOb6WI",
  authDomain: "boss-app-34bcd.firebaseapp.com",
  projectId: "boss-app-34bcd",
  storageBucket: "boss-app-34bcd.firebasestorage.app",
  messagingSenderId: "728632211313",
  appId: "1:728632211313:web:66f966b8b7ccf6cb3ee8d0",
  measurementId: "G-PN361HPV2J"
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const signupsCol = collection(db, 'signups');
try{ enableIndexedDbPersistence(db).catch(()=>{}); }catch{}

const $=id=>document.getElementById(id);
const installBtn=$('installBtn'), currentCycleText=$('currentCycleText'), cycleBtns=$('cycleBtns'), classGroupBtns=$('classGroupBtns'), jobBtns=$('jobBtns'), bossBtns=$('bossBtns'), dateChecks=$('dateChecks'), selectAllDates=$('selectAllDates'), submitSignup=$('submitSignup'), playerName=$('playerName'), hasAlt=$('hasAlt'), accountGroup=$('accountGroup');
const adminCycle=$('adminCycle'), adminBoss=$('adminBoss'), adminDate=$('adminDate'), rosterCycle=$('rosterCycle'), rosterBossBtns=$('rosterBossBtns'), rosterTitle=$('rosterTitle'), rosterCount=$('rosterCount'), rosterList=$('rosterList'), rosterGenerateTeams=$('rosterGenerateTeams'), rosterTeamResult=$('rosterTeamResult'), rosterCopyTeams=$('rosterCopyTeams');
const mySignupList=$('mySignupList'), refreshMine=$('refreshMine'), signupCount=$('signupCount'), signupList=$('signupList'), generateTeams=$('generateTeams'), teamResult=$('teamResult'), copyTeams=$('copyTeams');
const allData=$('allData'), exportData=$('exportData'), importData=$('importData'), clearData=$('clearData');

const bosses=[{name:'龍王',limit:12},{name:'困拉',limit:6},{name:'炎魔',limit:6},{name:'普拉',limit:6}];
const jobs={劍士:['黑騎','英雄','聖騎士'],弓箭手:['弩手','弓手'],盜賊:['標賊','刀賊'],海盜:['槍手','拳霸'],法師:['主教','冰雷','火毒']};
const KEY='bossSignupApp.v10.cloud';
const OLD_KEY='bossSignupApp.v1';
let state={signups:[]};let selectedCycle='';let selectedBoss='龍王';let selectedGroup='劍士';let selectedJob='黑騎';let selectedRosterBoss='龍王';let lastTeams=[];let lastTeamMode='date';let lastTeamsContext={boss:'龍王',date:'週期全部日期',cycle:''};

function load(){ return {signups:[]}; }
function setSyncStatus(msg,cls='sync-warn'){
  const el=document.querySelector('#syncStatus');
  if(!el)return;
  el.textContent='同步狀態：'+msg;
  el.className='hint '+cls;
}
function docIdForSignup(s){return encodeURIComponent(signupKey(s)).replace(/\//g,'_')}
function signupFromDoc(d){const x=d.data();return {...x,id:d.id,createdAt:x.createdAtText||x.createdAt||''}}
function startCloudSync(){
  setSyncStatus('連線中','sync-warn');
  onSnapshot(signupsCol,(snap)=>{
    state={signups:snap.docs.map(signupFromDoc)};
    setSyncStatus('已同步 '+state.signups.length+' 筆','sync-ok');
    renderAll();
  },(err)=>{
    console.error(err);
    setSyncStatus('連線失敗，請確認 Firestore 已建立且規則允許讀寫','sync-bad');
    toast('Firebase 連線失敗');
  });
}
function save(){renderAll()}

function fmt(d){return `${d.getMonth()+1}/${d.getDate()}`}
function signupTime(s){
  if(!s.createdAt)return '舊資料';
  const d=new Date(s.createdAt);
  if(Number.isNaN(d.getTime()))return '舊資料';
  const pad=n=>String(n).padStart(2,'0');
  return `${fmt(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function timeValue(s){
  const t=s?.createdAt?new Date(s.createdAt).getTime():0;
  return Number.isNaN(t)?0:t;
}
function dow(d){return '日一二三四五六'[d.getDay()]}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function cycles(){const now=new Date();const thursday=addDays(now,(4-now.getDay()+7)%7);return [0,7].map(offset=>{const s=addDays(thursday,offset),e=addDays(s,6);return {id:`${fmt(s)}-${fmt(e)}`,label:`${fmt(s)} - ${fmt(e)}`,dates:Array.from({length:7},(_,i)=>addDays(s,i))}})}
function toast(msg){const t=document.querySelector('#toast');t.textContent=msg;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),2200)}
function norm(s){return String(s||'').trim().toLowerCase()}
function accountKey(s){return s&&s.hasAlt&&s.accountGroup?norm(s.accountGroup):''}
function displayAccount(s){return s&&s.hasAlt&&s.accountGroup?`｜分身群組 ${s.accountGroup}`:''}
function signupKey(s){return `${norm(s.player)}|${s.cycle}|${s.boss}|${s.date}`}
function init(){selectedCycle=cycles()[0].id;bindTabs();renderSignup();renderAll();startCloudSync();let deferred;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;installBtn.classList.remove('hidden')});installBtn.onclick=()=>deferred?.prompt();hasAlt.onchange=()=>{accountGroup.classList.toggle('hidden',!hasAlt.checked);if(!hasAlt.checked)accountGroup.value='';};}
function bindTabs(){document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab,.page').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelector('#'+b.dataset.page).classList.add('active');renderAll()})}
function renderSignup(){
  currentCycleText.textContent=`週期：${selectedCycle}`;
  cycleBtns.innerHTML=cycles().map(c=>`<button class="choice ${c.id===selectedCycle?'active':''}" data-cycle="${c.id}">${c.label}</button>`).join('');
  cycleBtns.querySelectorAll('button').forEach(b=>b.onclick=()=>{selectedCycle=b.dataset.cycle;renderSignup();renderAll()});
  renderClassButtons();
  bossBtns.innerHTML=bosses.map(b=>`<button class="choice ${b.name===selectedBoss?'active':''}" data-boss="${b.name}">${b.name}<br><small>${b.limit}人</small></button>`).join('');
  bossBtns.querySelectorAll('button').forEach(b=>b.onclick=()=>{selectedBoss=b.dataset.boss;renderSignup()});
  renderDates();renderMine();
}
function renderClassButtons(){
  classGroupBtns.innerHTML=Object.keys(jobs).map(g=>`<button class="choice ${g===selectedGroup?'active':''}" data-group="${g}" type="button">${g}</button>`).join('');
  classGroupBtns.querySelectorAll('button').forEach(b=>b.onclick=()=>{selectedGroup=b.dataset.group;selectedJob=jobs[selectedGroup][0];renderClassButtons()});
  jobBtns.innerHTML=jobs[selectedGroup].map(j=>`<button class="choice ${j===selectedJob?'active':''}" data-job="${j}" type="button">${j}</button>`).join('');
  jobBtns.querySelectorAll('button').forEach(b=>b.onclick=()=>{selectedJob=b.dataset.job;renderClassButtons()});
}
function renderDates(){const c=cycles().find(x=>x.id===selectedCycle);dateChecks.innerHTML=c.dates.map(d=>`<label class="choice dateChoice"><input type="checkbox" value="${fmt(d)} ${dow(d)}"><span>${fmt(d)} ${dow(d)}</span></label>`).join('')}
selectAllDates.onclick=()=>{const checks=[...dateChecks.querySelectorAll('input')];const shouldCheck=checks.some(x=>!x.checked);checks.forEach(x=>x.checked=shouldCheck);selectAllDates.textContent=shouldCheck?'取消全選':'日期全選'};
submitSignup.onclick=async()=>{
  const name=playerName.value.trim();
  const dates=[...dateChecks.querySelectorAll('input:checked')].map(x=>x.value);
  if(!name)return toast('請輸入玩家名稱');
  if(hasAlt.checked&&!accountGroup.value.trim())return toast('請輸入分身群組名稱');
  if(!dates.length)return toast('請至少選一個日期');
  let added=0,dupes=[];
  for(const date of dates){
    const item={id:'',cycle:selectedCycle,boss:selectedBoss,date,player:name,group:selectedGroup,job:selectedJob,hasAlt:!!hasAlt.checked,accountGroup:hasAlt.checked?accountGroup.value.trim():'',createdAt:new Date().toISOString()};
    const id=docIdForSignup(item); item.id=id;
    if(state.signups.some(s=>signupKey(s)===signupKey(item))){dupes.push(date);continue;}
    await setDoc(doc(db,'signups',id),{...item,createdAtText:item.createdAt,createdAtServer:serverTimestamp()});
    added++;
  }
  dateChecks.querySelectorAll('input').forEach(x=>x.checked=false);selectAllDates.textContent='日期全選';
  if(added&&dupes.length)toast(`新增 ${added} 筆，已略過重複：${dupes.join('、')}`);
  else if(added)toast(`報名成功：${added} 筆`);
  else toast('沒有新增，這些日期已經報名過');
};
function fillCycleSelect(el){const cs=cycles();const current=el.value||selectedCycle;el.innerHTML=cs.map(c=>`<option ${c.id===current?'selected':''}>${c.id}</option>`).join('');if(!el.value)el.value=selectedCycle}
function renderAll(){const cs=cycles();fillCycleSelect(adminCycle);fillCycleSelect(rosterCycle);adminBoss.innerHTML=bosses.map(b=>`<option>${b.name}</option>`).join('');if(!adminBoss.value)adminBoss.value='龍王';const c=cs.find(x=>x.id===adminCycle.value)||cs[0];adminDate.innerHTML=['週期全部日期',...c.dates.map(d=>`${fmt(d)} ${dow(d)}`)].map(v=>`<option>${v}</option>`).join('');renderSignupList();renderAllData();renderRoster();renderMine()}
[adminCycle,adminBoss,adminDate].forEach(el=>el.onchange=()=>{lastTeams=[];renderSignupList();teamResult.innerHTML='尚未編排';teamResult.classList.add('empty')});
rosterCycle.onchange=()=>{lastTeams=[];rosterTeamResult.innerHTML='尚未編排';rosterTeamResult.classList.add('empty');renderRoster()};

function renderRoster(){
  rosterBossBtns.innerHTML=bosses.map(b=>`<button class="choice ${b.name===selectedRosterBoss?'active':''}" data-boss="${b.name}" type="button">${b.name}</button>`).join('');
  rosterBossBtns.querySelectorAll('button').forEach(b=>b.onclick=()=>{selectedRosterBoss=b.dataset.boss;lastTeams=[];rosterTeamResult.innerHTML='尚未編排';rosterTeamResult.classList.add('empty');renderRoster()});
  const cycleId=rosterCycle.value;
  const c=cycles().find(x=>x.id===cycleId)||cycles()[0];
  const dateLabels=c.dates.map(d=>`${fmt(d)} ${dow(d)}`);
  const arr=state.signups.filter(s=>s.cycle===cycleId&&s.boss===selectedRosterBoss);
  const byPlayer=new Map();
  arr.forEach(s=>{
    const key=norm(s.player);
    if(!byPlayer.has(key))byPlayer.set(key,{player:s.player,job:s.job,group:s.group,hasAlt:s.hasAlt,accountGroup:s.accountGroup,dates:new Set(),firstTime:s.createdAt});
    const p=byPlayer.get(key);
    p.dates.add(s.date);
    if(timeValue(s)&&(!p.firstTime||timeValue(s)<new Date(p.firstTime).getTime()))p.firstTime=s.createdAt;
  });
  const players=[...byPlayer.values()].sort((a,b)=>b.dates.size-a.dates.size||a.player.localeCompare(b.player,'zh-Hant'));
  rosterTitle.textContent=`${selectedRosterBoss} 報名狀況`;
  rosterCount.textContent=`${players.length}人 / ${arr.length}筆`;
  rosterList.innerHTML=players.length?players.map(p=>`
    <div class="roster-player">
      <div class="roster-head"><b>${p.player}</b><small>${p.job}${displayAccount(p)}｜可打 ${p.dates.size} 天｜首次 ${signupTime({createdAt:p.firstTime})}</small></div>
      <div class="availability-grid">
        ${dateLabels.map(d=>`<div class="availability ${p.dates.has(d)?'yes':'no'}"><span>${d.replace(' ','')}</span><b>${p.dates.has(d)?'●':'×'}</b></div>`).join('')}
      </div>
    </div>`).join(''):'<div class="empty">目前沒有人報名</div>';
}
function dateOrderForCycle(label,cycleId){const c=cycles().find(x=>x.id===cycleId);return c?c.dates.map(d=>`${fmt(d)} ${dow(d)}`).indexOf(label):999}
function renderMine(){
  const name=playerName.value.trim();
  const key=norm(name);
  if(!key){mySignupList.innerHTML='<div class="empty">輸入玩家名稱後可查看報名</div>';return}
  const cycleId=selectedCycle;
  const c=cycles().find(x=>x.id===cycleId)||cycles()[0];
  const dateLabels=c.dates.map(d=>`${fmt(d)} ${dow(d)}`);
  const rows=bosses.map(boss=>{
    const arr=state.signups.filter(s=>norm(s.player)===key&&s.cycle===cycleId&&s.boss===boss.name);
    return {boss:boss.name,dates:new Set(arr.map(s=>s.date)),count:arr.length};
  }).filter(row=>row.count>0);
  if(!rows.length){
    mySignupList.innerHTML='<div class="empty">目前沒有這個玩家在本週期的報名</div>';
    return;
  }
  mySignupList.innerHTML=rows.map(row=>`
    <div class="roster-player my-row">
      <div class="roster-head"><b>${name}｜${row.boss}｜${cycleId}</b><small>${row.count} 筆，點日期可加入或取消</small></div>
      <div class="availability-grid mine-grid">
        ${dateLabels.map(d=>`<button type="button" class="availability mine-date ${row.dates.has(d)?'yes':'no'}" data-boss="${row.boss}" data-date="${d}"><span>${d.replace(' ','')}</span><b>${row.dates.has(d)?'●':'×'}</b></button>`).join('')}
      </div>
    </div>`).join('');
  mySignupList.querySelectorAll('.mine-date').forEach(btn=>btn.onclick=()=>toggleMineDate(btn.dataset.boss,btn.dataset.date));
}
async function toggleMineDate(boss,date){
  const name=playerName.value.trim();
  if(!name)return toast('請輸入玩家名稱');
  if(hasAlt.checked&&!accountGroup.value.trim())return toast('請輸入分身群組名稱');
  const existing=state.signups.find(s=>norm(s.player)===norm(name)&&s.cycle===selectedCycle&&s.boss===boss&&s.date===date);
  if(existing){
    if(!confirm(`確認取消 ${name}｜${boss}｜${date}？`))return;
    await deleteDoc(doc(db,'signups',existing.id));
    toast('已取消報名');
    return;
  }
  if(!confirm(`確認加入 ${name}｜${boss}｜${date}？`))return;
  const item={id:'',cycle:selectedCycle,boss,date,player:name,group:selectedGroup,job:selectedJob,hasAlt:!!hasAlt.checked,accountGroup:hasAlt.checked?accountGroup.value.trim():'',createdAt:new Date().toISOString()};
  const id=docIdForSignup(item); item.id=id;
  await setDoc(doc(db,'signups',id),{...item,createdAtText:item.createdAt,createdAtServer:serverTimestamp()});
  toast('已加入報名');
}
async function deleteSignup(id){
  await deleteDoc(doc(db,'signups',id));
  toast('已取消報名');
}
refreshMine.onclick=renderMine;
playerName.addEventListener('input',renderMine);

function filtered(cycle=adminCycle.value,boss=adminBoss.value,date=adminDate.value){return state.signups.filter(s=>s.cycle===cycle&&s.boss===boss&&(date==='週期全部日期'||s.date===date))}
function renderSignupList(){const arr=filtered().sort((a,b)=>timeValue(a)-timeValue(b));signupCount.textContent=`${arr.length}筆`;signupList.innerHTML=arr.length?arr.map(s=>`<div class="item"><b>${s.player}</b><small>${s.job}${displayAccount(s)}｜${s.boss}｜${s.date}｜報名 ${signupTime(s)}</small></div>`).join(''):'<div class="empty">目前沒有人報名</div>'}
function hasJobInfo(x){return !!(x&&x.group&&x.job)}
function isArcher(x){return x.group==='弓箭手'}
function isMage(x){return x.group==='法師'}
function isDarkKnight(x){return x.job==='黑騎'}
function isBucc(x){return x.job==='拳霸'}
function bySignupTime(a,b){return timeValue(a)-timeValue(b)||String(a.player).localeCompare(String(b.player),'zh-Hant')}
function outputPriority(boss,x){
  if(boss==='龍王'){
    if(x.group==='劍士'||x.job==='刀賊'||x.job==='拳霸')return 0;
    if(x.group==='弓箭手')return 1;
    if(x.group==='法師')return 2;
    if(x.job==='槍手'||x.job==='標賊')return 3;
    return 4;
  }
  if(boss==='困拉'){
    if(x.job==='槍手'||x.job==='弓手')return 0;
    if(x.group==='盜賊'||x.group==='劍士'||x.job==='拳霸')return 1;
    if(x.group==='法師')return 2;
    return 3;
  }
  if(boss==='炎魔'){
    if(x.job==='弩手'||x.job==='槍手')return 0;
    if(x.group==='劍士'||x.job==='標賊'||x.job==='弓手')return 1;
    if(x.group==='法師')return 2;
    return 3;
  }
  if(boss==='普拉'){
    if(x.group==='法師')return 0;
    if(x.group==='弓箭手')return 1;
    return 2;
  }
  return 9;
}
function sortOutputPool(pool,boss){
  pool.sort((a,b)=>outputPriority(boss,a)-outputPriority(boss,b)||bySignupTime(a,b));
}
function canJoinTeam(team,m){
  const k=accountKey(m);
  if(!k)return true;
  return !team.some(x=>accountKey(x)===k);
}
function takeFromBucket(bucket,team){
  const i=bucket.findIndex(m=>canJoinTeam(team,m));
  return i>=0?bucket.splice(i,1)[0]:null;
}
function fillOutputBalanced(team,pool,boss,limit){
  // 輸出位輪流挑選：優先1一位 → 優先2一位 → 優先3一位 → 再回優先1。
  // 同一隊內不可放入相同分身群組；若會衝突，保留給下一隊。
  const ranks=[...new Set(pool.map(x=>outputPriority(boss,x)))].sort((a,b)=>a-b);
  const buckets=new Map();
  ranks.forEach(r=>buckets.set(r,[]));
  pool.sort(bySignupTime).forEach(x=>buckets.get(outputPriority(boss,x)).push(x));
  pool.length=0;
  while(team.length<limit){
    let picked=false;
    for(const r of ranks){
      const bucket=buckets.get(r)||[];
      if(team.length>=limit)break;
      const m=takeFromBucket(bucket,team);
      if(m){team.push(m);picked=true;}
    }
    if(!picked)break;
  }
  // 剩餘未排入者放回 pool，讓下一隊繼續使用。
  ranks.forEach(r=>{const bucket=buckets.get(r)||[];while(bucket.length)pool.push(bucket.shift())});
}
function bossRequirements(boss){
  if(boss==='龍王')return [{label:'黑騎',count:2,fn:isDarkKnight,hard:true},{label:'弓箭手',count:2,fn:isArcher,hard:true},{label:'拳霸',count:1,fn:isBucc,hard:true}];
  if(boss==='困拉')return [{label:'黑騎',count:1,fn:isDarkKnight,hard:true},{label:'弓箭手',count:1,fn:isArcher,hard:true},{label:'法師',count:2,fn:isMage,hard:true}];
  if(boss==='炎魔')return [{label:'黑騎',count:1,fn:isDarkKnight,hard:true},{label:'弓箭手',count:1,fn:isArcher,hard:true},{label:'法師',count:1,fn:isMage,hard:true}];
  if(boss==='普拉')return [{label:'法師',count:1,fn:isMage,hard:false},{label:'弓箭手',count:1,fn:isArcher,hard:false}];
  return [];
}
function requirementStatus(team,boss){
  const reqs=bossRequirements(boss);
  return reqs.map(r=>{const have=team.filter(r.fn).length;return {...r,have,missing:Math.max(0,r.count-have)}});
}
function canSatisfyHard(pool,boss){
  return bossRequirements(boss).filter(r=>r.hard).every(r=>pool.filter(r.fn).length>=r.count);
}
function pick(pool,fn,team=[]){const i=pool.findIndex(m=>fn(m)&&canJoinTeam(team,m));return i>=0?pool.splice(i,1)[0]:null}
function pushPick(team,pool,fn){const m=pick(pool,fn,team);if(m)team.push(m)}
function buildTeamsForDate(arr,boss){
  // 只使用有職業資料的報名；先滿足必須/優先職業，不足仍產生隊伍並顯示缺少項目；同一隊內避開相同分身群組。
  let pool=[...arr].filter(hasJobInfo).sort(bySignupTime);
  const limit=bosses.find(b=>b.name===boss)?.limit||6;
  if(!pool.length)return [];
  const teams=[];
  let safety=0;
  while(pool.length&&safety++<50){
    const team=[];
    bossRequirements(boss).forEach(r=>{
      for(let i=0;i<r.count;i++)pushPick(team,pool,r.fn);
    });
    fillOutputBalanced(team,pool,boss,limit);
    if(team.length)teams.push(team);
  }
  return teams;
}
function buildWeeklyTeams(cycle=adminCycle.value,boss=adminBoss.value){
  const base=state.signups.filter(s=>s.cycle===cycle&&s.boss===boss);
  const byDate={};base.forEach(s=>{(byDate[s.date]??=[]).push(s)});
  const dates=Object.keys(byDate).sort((a,b)=>byDate[b].length-byDate[a].length||dateOrder(a,cycle)-dateOrder(b,cycle));
  const used=new Set();
  const result=[];
  dates.forEach(date=>{
    const arr=byDate[date].filter(s=>!used.has(norm(s.player)));
    const teams=buildTeamsForDate(arr,boss);
    teams.forEach(team=>team.forEach(m=>used.add(norm(m.player))));
    if(teams.length)result.push({date,teams,total:byDate[date].length,arranged:arr.length});
  });
  return result;
}
function dateOrder(label,cycleId=adminCycle.value){const c=cycles().find(x=>x.id===cycleId);return c?c.dates.map(d=>`${fmt(d)} ${dow(d)}`).indexOf(label):999}
generateTeams.onclick=()=>{
  lastTeamMode=adminDate.value==='週期全部日期'?'week':'date';
  lastTeamsContext={boss:adminBoss.value,date:adminDate.value,cycle:adminCycle.value};
  lastTeams=lastTeamMode==='week'?buildWeeklyTeams(adminCycle.value,adminBoss.value):buildTeamsForDate(filtered(adminCycle.value,adminBoss.value,adminDate.value),adminBoss.value);
  renderTeams(lastTeams,teamResult,lastTeamsContext)
};
rosterGenerateTeams.onclick=()=>{
  lastTeamMode='week';
  lastTeamsContext={boss:selectedRosterBoss,date:'週期全部日期',cycle:rosterCycle.value};
  lastTeams=buildWeeklyTeams(rosterCycle.value,selectedRosterBoss);
  renderTeams(lastTeams,rosterTeamResult,lastTeamsContext);
};

function collectConflicts(data,ctx=lastTeamsContext){
  const byDate=new Map();
  if(lastTeamMode==='week'){
    data.forEach(day=>{
      const list=[]; day.teams.forEach(team=>team.forEach(m=>list.push(m)));
      byDate.set(day.date,list);
    });
  }else{
    const list=[]; data.forEach(team=>team.forEach(m=>list.push(m)));
    byDate.set(ctx.date,list);
  }
  const conflictMap=new Map();
  byDate.forEach((members,date)=>{
    const groups=new Map();
    members.forEach(m=>{const k=accountKey(m); if(!k)return; if(!groups.has(k))groups.set(k,[]); groups.get(k).push(m);});
    const bad=[...groups.entries()].filter(([k,v])=>v.length>1);
    if(bad.length)conflictMap.set(date,new Map(bad));
  });
  return conflictMap;
}
function conflictSummary(conflicts){
  if(!conflicts.size)return '';
  let totalChars=0,totalGroups=0,lines=[];
  conflicts.forEach((groups,date)=>{
    groups.forEach((members,key)=>{
      totalGroups++; totalChars+=members.length;
      lines.push(`${date}：${members[0].accountGroup} 同一天 ${members.length} 隻（${members.map(m=>m.player).join('、')}）`);
    });
  });
  return `<div class="conflict-summary">⚠ 分身群組衝突提醒：${totalGroups} 組 / ${totalChars} 角色<br>${lines.join('<br>')}</div>`;
}
function isConflictMember(m,date,conflicts){const k=accountKey(m);return !!(k&&conflicts.get(date)?.has(k));}
function renderTeams(data,target=teamResult,ctx=lastTeamsContext){
  target.classList.remove('empty');
  if(!data.length){target.innerHTML='<div class="empty">目前沒有可編排的隊伍</div>';return}
  const conflicts=collectConflicts(data,ctx);
  const summary=conflictSummary(conflicts);
  if(lastTeamMode==='week'){
    target.innerHTML=summary+data.map(day=>`<div class="day-block"><h2>${day.date}｜原報名 ${day.total} 筆｜可排 ${day.arranged} 人</h2>${day.teams.map((team,i)=>teamHTML(team,i,day.date,conflicts,ctx)).join('')}</div>`).join('');
  }else{
    target.innerHTML=summary+data.map((team,i)=>teamHTML(team,i,ctx.date,conflicts,ctx)).join('');
  }
}
function teamHTML(team,i,date,conflicts=new Map(),ctx=lastTeamsContext){
  const req=requirementStatus(team,ctx.boss);
  const missing=req.filter(r=>r.missing>0);
  const reqText=req.length?`<div class="req-line">${req.map(r=>`${r.label} ${r.have}/${r.count}${r.missing?' 缺'+r.missing:''}`).join('｜')}</div>`:'';
  const missingText=missing.length?`<div class="missing-line">缺少：${missing.map(r=>`${r.label} ${r.missing}`).join('、')}</div>`:'';
  return `<div class="team ${missing.length?'team-warning':''}"><h3>${ctx.boss} ${date} 第 ${i+1} 隊｜${team.length}人</h3>${reqText}${missingText}${team.map((m,idx)=>{const c=isConflictMember(m,date,conflicts);return `<div class="slot ${c?'conflict':''}"><b>${idx+1}</b><div>${c?'<span class="conflict-dot">●</span>':''}${m.player}<div class="job">${m.group}｜${m.job}${displayAccount(m)}｜報名 ${signupTime(m)}</div></div><span>${tag(m)}</span></div>`}).join('')}</div>`
}
function tag(m){if(m.job==='黑騎')return '黑騎';if(m.job==='拳霸')return '拳';if(m.group==='弓箭手')return '弓';if(m.group==='法師')return '法';return '輸出'}
async function copyCurrentTeams(){
  if(!lastTeams.length)return toast('請先自動編排');
  const boss=lastTeamsContext.boss;
  const date=lastTeamsContext.date;
  let txt='';
  if(lastTeamMode==='week') txt=lastTeams.map(day=>day.teams.map((team,i)=>`${boss} ${day.date} 第${i+1}隊\n`+team.map((m,idx)=>`${idx+1}. ${m.player}｜${m.job}`).join('\n')).join('\n\n')).join('\n\n');
  else txt=lastTeams.map((team,i)=>`${boss} ${date} 第${i+1}隊\n`+team.map((m,idx)=>`${idx+1}. ${m.player}｜${m.job}`).join('\n')).join('\n\n');
  await navigator.clipboard.writeText(txt);toast('已複製隊伍')
}
copyTeams.onclick=copyCurrentTeams;
rosterCopyTeams.onclick=copyCurrentTeams;
function renderAllData(){allData.innerHTML=state.signups.length?state.signups.slice().reverse().map(s=>`<div class="item"><b>${s.player}｜${s.job}${displayAccount(s)}</b><small>${s.cycle}｜${s.boss}｜${s.date}｜報名 ${signupTime(s)}</small></div>`).join(''):'<div class="empty">尚無資料</div>'}
exportData.onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='boss-signups-cloud.json';a.click();URL.revokeObjectURL(a.href)};
importData.onchange=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=async()=>{try{const data=JSON.parse(r.result);const arr=Array.isArray(data)?data:(data.signups||[]);const batch=writeBatch(db);arr.forEach(x=>{const item={...x,id:x.id||docIdForSignup(x),createdAt:x.createdAt||x.createdAtText||new Date().toISOString()};batch.set(doc(db,'signups',item.id),{...item,createdAtText:item.createdAt,createdAtServer:serverTimestamp()});});await batch.commit();toast('匯入成功')}catch(err){console.error(err);toast('匯入失敗')}};r.readAsText(file)};
clearData.onclick=async()=>{if(confirm('確定清除 Firebase 全部報名？')){const snap=await getDocs(signupsCol);const batch=writeBatch(db);snap.docs.forEach(d=>batch.delete(d.ref));await batch.commit();toast('已清除')}};
init();
