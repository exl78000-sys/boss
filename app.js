const bosses=[{name:'龍王',limit:12},{name:'困拉',limit:6},{name:'炎魔',limit:6},{name:'普拉',limit:6}];
const jobs={劍士:['黑騎','英雄','聖騎士'],弓箭手:['弩手','弓手'],盜賊:['標賊','刀賊'],海盜:['槍手','拳霸'],法師:['主教','冰雷','火毒']};
const KEY='bossSignupApp.v9';
const OLD_KEY='bossSignupApp.v1';
let state=load();let selectedCycle='';let selectedBoss='龍王';let selectedGroup='劍士';let selectedJob='黑騎';let selectedRosterBoss='龍王';let lastTeams=[];let lastTeamMode='date';

function load(){
  try{
    const keys=[KEY,'bossSignupApp.v8','bossSignupApp.v7','bossSignupApp.v6','bossSignupApp.v3','bossSignupApp.v2',OLD_KEY];
    for(const k of keys){
      const raw=localStorage.getItem(k);
      if(raw) return JSON.parse(raw)||{signups:[]};
    }
    return {signups:[]};
  }catch{return{signups:[]}}
}
function save(){localStorage.setItem(KEY,JSON.stringify(state));renderAll()}
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
function signupKey(s){return `${norm(s.player)}|${s.cycle}|${s.boss}|${s.date}`}
function init(){selectedCycle=cycles()[0].id;bindTabs();renderSignup();renderAll();let deferred;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;installBtn.classList.remove('hidden')});installBtn.onclick=()=>deferred?.prompt()}
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
submitSignup.onclick=()=>{
  const name=playerName.value.trim();
  const dates=[...dateChecks.querySelectorAll('input:checked')].map(x=>x.value);
  if(!name)return toast('請輸入玩家名稱');
  if(!dates.length)return toast('請至少選一個日期');
  let added=0,dupes=[];
  dates.forEach(date=>{
    const item={id:crypto.randomUUID(),cycle:selectedCycle,boss:selectedBoss,date,player:name,group:selectedGroup,job:selectedJob,createdAt:new Date().toISOString()};
    if(state.signups.some(s=>signupKey(s)===signupKey(item))){dupes.push(date);return;}
    state.signups.push(item);added++;
  });
  save();dateChecks.querySelectorAll('input').forEach(x=>x.checked=false);selectAllDates.textContent='日期全選';
  if(added&&dupes.length)toast(`新增 ${added} 筆，已略過重複：${dupes.join('、')}`);
  else if(added)toast(`報名成功：${added} 筆`);
  else toast('沒有新增，這些日期已經報名過');
};
function fillCycleSelect(el){const cs=cycles();el.innerHTML=cs.map(c=>`<option ${c.id===selectedCycle?'selected':''}>${c.id}</option>`).join('')}
function renderAll(){const cs=cycles();fillCycleSelect(adminCycle);fillCycleSelect(rosterCycle);adminBoss.innerHTML=bosses.map(b=>`<option>${b.name}</option>`).join('');if(!adminBoss.value)adminBoss.value='龍王';const c=cs.find(x=>x.id===adminCycle.value)||cs[0];adminDate.innerHTML=['週期全部日期',...c.dates.map(d=>`${fmt(d)} ${dow(d)}`)].map(v=>`<option>${v}</option>`).join('');renderSignupList();renderAllData();renderRoster();renderMine()}
[adminCycle,adminBoss,adminDate].forEach(el=>el.onchange=()=>{lastTeams=[];renderSignupList();teamResult.innerHTML='尚未編排';teamResult.classList.add('empty')});
rosterCycle.onchange=renderRoster;

function renderRoster(){
  rosterBossBtns.innerHTML=bosses.map(b=>`<button class="choice ${b.name===selectedRosterBoss?'active':''}" data-boss="${b.name}" type="button">${b.name}</button>`).join('');
  rosterBossBtns.querySelectorAll('button').forEach(b=>b.onclick=()=>{selectedRosterBoss=b.dataset.boss;renderRoster()});
  const cycleId=rosterCycle.value;
  const c=cycles().find(x=>x.id===cycleId)||cycles()[0];
  const dateLabels=c.dates.map(d=>`${fmt(d)} ${dow(d)}`);
  const arr=state.signups.filter(s=>s.cycle===cycleId&&s.boss===selectedRosterBoss);
  const byPlayer=new Map();
  arr.forEach(s=>{
    const key=norm(s.player);
    if(!byPlayer.has(key))byPlayer.set(key,{player:s.player,job:s.job,group:s.group,dates:new Set(),firstTime:s.createdAt});
    const p=byPlayer.get(key);
    p.dates.add(s.date);
    if(timeValue(s)&&(!p.firstTime||timeValue(s)<new Date(p.firstTime).getTime()))p.firstTime=s.createdAt;
  });
  const players=[...byPlayer.values()].sort((a,b)=>b.dates.size-a.dates.size||a.player.localeCompare(b.player,'zh-Hant'));
  rosterTitle.textContent=`${selectedRosterBoss} 報名狀況`;
  rosterCount.textContent=`${players.length}人 / ${arr.length}筆`;
  rosterList.innerHTML=players.length?players.map(p=>`
    <div class="roster-player">
      <div class="roster-head"><b>${p.player}</b><small>${p.job}｜可打 ${p.dates.size} 天｜首次 ${signupTime({createdAt:p.firstTime})}</small></div>
      <div class="availability-grid">
        ${dateLabels.map(d=>`<div class="availability ${p.dates.has(d)?'yes':'no'}"><span>${d.replace(' ','')}</span><b>${p.dates.has(d)?'●':'×'}</b></div>`).join('')}
      </div>
    </div>`).join(''):'<div class="empty">目前沒有人報名</div>';
}
function dateOrderForCycle(label,cycleId){const c=cycles().find(x=>x.id===cycleId);return c?c.dates.map(d=>`${fmt(d)} ${dow(d)}`).indexOf(label):999}
function renderMine(){
  const name=norm(playerName?.value);
  if(!name){mySignupList.innerHTML='<div class="empty">輸入玩家名稱後可查看/取消報名</div>';return}
  const arr=state.signups.filter(s=>norm(s.player)===name).sort((a,b)=>a.cycle.localeCompare(b.cycle)||a.boss.localeCompare(b.boss,'zh-Hant')||dateOrderForCycle(a.date,a.cycle)-dateOrderForCycle(b.date,b.cycle));
  mySignupList.innerHTML=arr.length?arr.map(s=>`<div class="item"><b>${s.cycle}｜${s.boss}｜${s.date}</b><small>${s.player}｜${s.job}｜報名 ${signupTime(s)}</small><button class="danger small mt" onclick="deleteSignup('${s.id}')">取消報名</button></div>`).join(''):'<div class="empty">查無這個玩家名稱的報名</div>';
}
function deleteSignup(id){
  const before=state.signups.length;
  state.signups=state.signups.filter(s=>s.id!==id);
  if(state.signups.length!==before){save();toast('已取消報名')}
}
refreshMine.onclick=renderMine;
playerName.addEventListener('input',renderMine);

function filtered(){return state.signups.filter(s=>s.cycle===adminCycle.value&&s.boss===adminBoss.value&&(adminDate.value==='週期全部日期'||s.date===adminDate.value))}
function renderSignupList(){const arr=filtered().sort((a,b)=>timeValue(a)-timeValue(b));signupCount.textContent=`${arr.length}筆`;signupList.innerHTML=arr.length?arr.map(s=>`<div class="item"><b>${s.player}</b><small>${s.job}｜${s.boss}｜${s.date}｜報名 ${signupTime(s)}</small></div>`).join(''):'<div class="empty">目前沒有人報名</div>'}
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
function fillOutputBalanced(team,pool,boss,limit){
  // 輸出位改成輪流挑選：優先1一位 → 優先2一位 → 優先3一位 → 再回優先1，避免同一順位/職業一次塞滿。
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
      if(bucket.length){team.push(bucket.shift());picked=true;}
    }
    if(!picked)break;
  }
  // 剩餘未排入者放回 pool，讓下一隊繼續使用，同樣保留輪流挑選後的相對順序。
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
function pick(pool,fn){const i=pool.findIndex(fn);return i>=0?pool.splice(i,1)[0]:null}
function pushPick(team,pool,fn){const m=pick(pool,fn);if(m)team.push(m)}
function buildTeamsForDate(arr,boss){
  // 只使用有職業資料的報名；先滿足必須/優先職業，不足仍產生隊伍並顯示缺少項目。
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
function buildWeeklyTeams(){
  const base=state.signups.filter(s=>s.cycle===adminCycle.value&&s.boss===adminBoss.value);
  const byDate={};base.forEach(s=>{(byDate[s.date]??=[]).push(s)});
  const dates=Object.keys(byDate).sort((a,b)=>byDate[b].length-byDate[a].length||dateOrder(a)-dateOrder(b));
  const used=new Set();
  const result=[];
  dates.forEach(date=>{
    const arr=byDate[date].filter(s=>!used.has(norm(s.player)));
    const teams=buildTeamsForDate(arr,adminBoss.value);
    teams.forEach(team=>team.forEach(m=>used.add(norm(m.player))));
    if(teams.length)result.push({date,teams,total:byDate[date].length,arranged:arr.length});
  });
  return result;
}
function dateOrder(label){const c=cycles().find(x=>x.id===adminCycle.value);return c?c.dates.map(d=>`${fmt(d)} ${dow(d)}`).indexOf(label):999}
generateTeams.onclick=()=>{
  lastTeamMode=adminDate.value==='週期全部日期'?'week':'date';
  lastTeams=lastTeamMode==='week'?buildWeeklyTeams():buildTeamsForDate(filtered(),adminBoss.value);
  renderTeams(lastTeams)
};
function renderTeams(data){
  teamResult.classList.remove('empty');
  if(!data.length){teamResult.innerHTML='<div class="empty">目前沒有可編排的隊伍</div>';return}
  if(lastTeamMode==='week'){
    teamResult.innerHTML=data.map(day=>`<div class="day-block"><h2>${day.date}｜原報名 ${day.total} 筆｜可排 ${day.arranged} 人</h2>${day.teams.map((team,i)=>teamHTML(team,i,day.date)).join('')}</div>`).join('');
  }else{
    teamResult.innerHTML=data.map((team,i)=>teamHTML(team,i,adminDate.value)).join('');
  }
}
function teamHTML(team,i,date){
  const req=requirementStatus(team,adminBoss.value);
  const missing=req.filter(r=>r.missing>0);
  const reqText=req.length?`<div class="req-line">${req.map(r=>`${r.label} ${r.have}/${r.count}${r.missing?' 缺'+r.missing:''}`).join('｜')}</div>`:'';
  const missingText=missing.length?`<div class="missing-line">缺少：${missing.map(r=>`${r.label} ${r.missing}`).join('、')}</div>`:'';
  return `<div class="team ${missing.length?'team-warning':''}"><h3>${adminBoss.value} ${date} 第 ${i+1} 隊｜${team.length}人</h3>${reqText}${missingText}${team.map((m,idx)=>`<div class="slot"><b>${idx+1}</b><div>${m.player}<div class="job">${m.group}｜${m.job}｜報名 ${signupTime(m)}</div></div><span>${tag(m)}</span></div>`).join('')}</div>`
}
function tag(m){if(m.job==='黑騎')return '黑騎';if(m.job==='拳霸')return '拳';if(m.group==='弓箭手')return '弓';if(m.group==='法師')return '法';return '輸出'}
copyTeams.onclick=async()=>{
  if(!lastTeams.length)return toast('請先自動編排');
  let txt='';
  if(lastTeamMode==='week') txt=lastTeams.map(day=>day.teams.map((team,i)=>`${adminBoss.value} ${day.date} 第${i+1}隊\n`+team.map((m,idx)=>`${idx+1}. ${m.player}｜${m.job}`).join('\n')).join('\n\n')).join('\n\n');
  else txt=lastTeams.map((team,i)=>`${adminBoss.value} ${adminDate.value} 第${i+1}隊\n`+team.map((m,idx)=>`${idx+1}. ${m.player}｜${m.job}`).join('\n')).join('\n\n');
  await navigator.clipboard.writeText(txt);toast('已複製隊伍')
};
function renderAllData(){allData.innerHTML=state.signups.length?state.signups.slice().reverse().map(s=>`<div class="item"><b>${s.player}｜${s.job}</b><small>${s.cycle}｜${s.boss}｜${s.date}｜報名 ${signupTime(s)}</small></div>`).join(''):'<div class="empty">尚無資料</div>'}
exportData.onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='boss-signups.json';a.click();URL.revokeObjectURL(a.href)};
importData.onchange=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);save();toast('匯入成功')}catch{toast('匯入失敗')}};r.readAsText(file)};
clearData.onclick=()=>{if(confirm('確定清除全部報名？')){state={signups:[]};save();toast('已清除')}};
init();
