(function(){
'use strict';

const firebaseConfig={apiKey:"AIzaSyD5L4tp6vnjgHOIM7aEWx3fd8D2KdOb6WI",authDomain:"boss-app-34bcd.firebaseapp.com",projectId:"boss-app-34bcd",storageBucket:"boss-app-34bcd.firebasestorage.app",messagingSenderId:"728632211313",appId:"1:728632211313:web:66f966b8b7ccf6cb3ee8d0",measurementId:"G-PN361HPV2J"};
const bosses=[{name:'龍王',limit:12},{name:'困拉',limit:6},{name:'炎魔',limit:6},{name:'普拉',limit:6}];
const bossOrder=['龍王','困拉','炎魔','普拉'];
const jobs={劍士:['黑騎','英雄','聖騎士'],弓箭手:['弩手','弓手'],盜賊:['標賊','刀賊'],海盜:['槍手','拳霸'],法師:['主教','冰雷','火毒']};
const ADMIN_EMAILS=['exl78000@gmail.com'];
const $=id=>document.getElementById(id);
const E={};
['installBtn','currentCycleText','cycleBtns','classGroupBtns','jobBtns','bossBtns','dateChecks','selectAllDates','submitSignup','playerName','myCharacterBox','myCharacterSelect','myCharacterHint','hasAlt','accountGroup','claimBox','claimStatus','claimCharacterBtn','adminCycle','adminBoss','adminDate','rosterCycle','rosterBossBtns','rosterTitle','rosterCount','rosterList','rosterGenerateTeams','rosterTeamResult','rosterCopyTeams','mySignupList','refreshMine','signupCount','signupList','allData','adminEventLog','adminEventCount','exportData','importData','clearData','syncStatus','toast','authStatus','authDetail','googleLoginBtn','googleLogoutBtn','googleLoginBtn2','googleLogoutBtn2'].forEach(id=>E[id]=$(id));

let db=null, auth=null, signupsRef=null, charactersRef=null, charactersUnsub=null, adminEventsRef=null, eventUnsub=null, state={signups:[],characters:[],adminEvents:[]};
let currentUser=null, myProfiles=[], profileUnsub=null;
let selectedCycle='', selectedBoss='龍王', selectedGroup='劍士', selectedJob='黑騎', selectedRosterBoss='龍王';
// v49：使用者手動切換王別後，不讓角色自動帶入/Google profile 同步把王別切回舊王，避免新增其他王報名看起來沒生效。
let manualBossTouched=false;
let lastProfileLoadedFor='';
let autoFillDateSet=null;
// v51：使用者手動修改職業/多角色/分身群組後，避免背景同步又把表單覆蓋回舊資料。
let manualProfileTouched=false;
let manualProfilePlayer='';
function markManualProfileTouched(){
  manualProfileTouched=true;
  manualProfilePlayer=norm(E.playerName?.value||'');
  lastProfileLoadedFor='';
}
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
function userMeta(){
  return currentUser?{
    uid:currentUser.uid,
    email:currentUser.email||'',
    name:currentUser.displayName||'',
    photoURL:currentUser.photoURL||''
  }:null;
}
function actorMeta(){
  return currentUser?userMeta():{name:'訪客'};
}
function eventTime(v){
  if(!v)return '';
  let d=null;
  if(typeof v.toDate==='function')d=v.toDate();
  else d=new Date(v);
  if(!d||Number.isNaN(d.getTime()))return '';
  const pad=n=>String(n).padStart(2,'0');
  return `${fmt(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
async function logAdminEvent(type,detail={}){
  if(!adminEventsRef||!isAdmin())return;
  try{
    await adminEventsRef.add({
      type,
      ...detail,
      createdAt:new Date().toISOString(),
      actor:actorMeta()
    });
  }catch(err){console.warn('admin event log failed',err);}
}
function renderAdminEventLog(){
  if(!E.adminEventLog)return;
  if(!isAdmin()){
    E.adminEventLog.innerHTML='<div class="empty">只有管理者可查看事件表</div>';
    if(E.adminEventCount)E.adminEventCount.textContent='0筆';
    return;
  }
  const events=state.adminEvents||[];
  if(E.adminEventCount)E.adminEventCount.textContent=`${events.length}筆`;
  E.adminEventLog.innerHTML=events.length?events.map(ev=>{
    const action=ev.type==='delete-player'?'刪除角色':ev.type==='unlink-player'?'解除綁定':html(ev.type||'管理操作');
    const actor=ev.actor?.email||ev.actor?.name||'管理者';
    const count=ev.count!=null?`｜${ev.count} 筆`:'';
    const extra=ev.bosses?`｜${html(ev.bosses)}`:'';
    return `<div class="item"><b>${action}｜${html(ev.player||'')}</b><small>${eventTime(ev.createdAt)}｜${html(actor)}${count}${extra}</small></div>`;
  }).join(''):'<div class="empty">尚無管理事件</div>';
}

function profileDocId(player){return encodeURIComponent(norm(player)).replace(/[.#$[\]/]/g,'_');}
function characterDocId(player){return profileDocId(player);}
function characterRecord(player){const key=norm(player);return (state.characters||[]).find(c=>norm(c.player)===key)||null;}
function characterOwnerUid(player){const c=characterRecord(player);return c&&c.ownerUid&&!c.unlinkedAt?c.ownerUid:'';}
function characterOwnerEmail(player){const c=characterRecord(player);return c&&c.ownerEmail&&!c.unlinkedAt?c.ownerEmail:'';}
function characterProfilePatch(player){return {player,group:selectedGroup,job:selectedJob,hasAlt:E.hasAlt.checked,accountGroup:E.hasAlt.checked?E.accountGroup.value.trim():'',updatedAt:new Date().toISOString(),updatedBy:userMeta()};}
async function upsertCharacterMaster(player,{claim=false,unlink=false}={}){
  if(!charactersRef||!player)return false;
  const data=characterProfilePatch(player);
  if(claim&&currentUser){data.ownerUid=currentUser.uid;data.ownerEmail=currentUser.email||'';data.claimedAt=new Date().toISOString();data.claimedBy=userMeta();data.unlinkedAt=firebase.firestore.FieldValue.delete();data.unlinkedBy=firebase.firestore.FieldValue.delete();}
  if(unlink){data.ownerUid='';data.ownerEmail='';data.unlinkedAt=new Date().toISOString();data.unlinkedBy=actorMeta();}
  await charactersRef.doc(characterDocId(player)).set(data,{merge:true});

  // v50：立即更新本機角色主檔快取，避免 Firestore onSnapshot 尚未回來時，
  // 再輸入同角色名稱仍自動帶入舊職業/舊分身群組。
  const cleanData={...data};
  ['unlinkedAt','unlinkedBy'].forEach(k=>{
    if(cleanData[k]&&typeof cleanData[k].isEqual==='function')delete cleanData[k];
  });
  const id=characterDocId(player);
  const idx=(state.characters||[]).findIndex(c=>c.id===id||norm(c.player)===norm(player));
  const local={id,...((idx>=0?state.characters[idx]:{})||{}),...cleanData};
  if(idx>=0)state.characters[idx]=local; else state.characters.push(local);
  lastProfileLoadedFor='';
  return true;
}
function profileFromForm(player){return {player,group:selectedGroup,job:selectedJob,hasAlt:E.hasAlt.checked,accountGroup:E.hasAlt.checked?E.accountGroup.value.trim():'',updatedAt:new Date().toISOString(),updatedBy:userMeta()};}
async function saveMyCharacterProfile(player){
  if(!currentUser||!db||!player)return;
  try{
    const data=profileFromForm(player);
    await db.collection('users').doc(currentUser.uid).collection('characters').doc(profileDocId(player)).set(data,{merge:true});

    // v50：同步更新 Google 個人角色紀錄快取，讓下拉與自動帶入立刻使用最新職業。
    const id=profileDocId(player);
    const idx=myProfiles.findIndex(p=>p.id===id||norm(p.player)===norm(player));
    const local={id,...((idx>=0?myProfiles[idx]:{})||{}),...data};
    if(idx>=0)myProfiles[idx]=local; else myProfiles.push(local);
    lastProfileLoadedFor='';
    renderMyCharacterSelect();
  }catch(err){console.warn('save profile failed',err);}
}
function subscribeProfiles(){
  if(profileUnsub){profileUnsub();profileUnsub=null;}
  myProfiles=[];
  if(!currentUser||!db){renderMyCharacterSelect();return;}
  profileUnsub=db.collection('users').doc(currentUser.uid).collection('characters').onSnapshot(snap=>{
    myProfiles=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.player||'').localeCompare(String(b.player||''),'zh-Hant'));
    tryAutoFillCurrentPlayer(true);
    renderMyCharacterSelect();
    renderClaimBox();
  },err=>console.warn('profiles load failed',err));
}
function renderMyCharacterSelect(){
  if(!E.myCharacterBox||!E.myCharacterSelect)return;
  const logged=!!currentUser;
  E.myCharacterBox.classList.toggle('hidden',!logged);
  if(!logged){E.myCharacterSelect.innerHTML='<option value="">Google 登入後可記錄角色</option>';return;}
  E.myCharacterSelect.innerHTML='<option value="">選擇已記錄角色</option>'+myProfiles.map(p=>`<option value="${html(p.player||'')}">${html(p.player||'未命名')}｜${html(p.group||'')}｜${html(p.job||'')}${p.hasAlt?`｜${html(p.accountGroup||'')}`:''}</option>`).join('');
  const now=E.playerName?.value?.trim();
  if(now&&myProfiles.some(p=>norm(p.player)===norm(now)))E.myCharacterSelect.value=now;
}

function isAdmin(){return !!(currentUser&&ADMIN_EMAILS.includes(String(currentUser.email||'').toLowerCase()));}
function activePageId(){return document.querySelector('.page.active')?.id||'signupPage';}
function setActivePage(pageId){
  document.querySelectorAll('.tab,.page').forEach(x=>x.classList.remove('active'));
  const tab=document.querySelector(`.tab[data-page="${pageId}"]`);
  const page=$(pageId);
  if(tab)tab.classList.add('active');
  if(page)page.classList.add('active');
}
function applyAdminAccess(){
  const admin=isAdmin();
  document.querySelectorAll('.tab[data-page="adminPage"],.tab[data-page="dataPage"]').forEach(el=>{
    el.classList.toggle('hidden',!admin);
    el.disabled=!admin;
  });
  ['adminPage','dataPage'].forEach(id=>{const page=$(id); if(page)page.classList.toggle('admin-locked',!admin);});
  if(!admin&&(activePageId()==='adminPage'||activePageId()==='dataPage'))setActivePage('signupPage');
}
function renderAuth(){
  const logged=!!currentUser;
  const admin=isAdmin();
  const label=logged?`已登入：${currentUser.displayName||currentUser.email||'Google 使用者'}${admin?'（管理者）':''}`:'未登入';
  if(E.authStatus)E.authStatus.textContent=label;
  if(E.authDetail)E.authDetail.textContent=logged?(admin?`已登入管理者 ${currentUser.email||''}。可訪問後台與資料頁。`:`已登入 ${currentUser.email||''}。一般玩家只能使用報名與名單頁。`):'未登入。可新增/修改未登入建立的角色；登入後可用「綁定到我的 Google 帳號」將未綁定角色歸入帳號。';
  [E.googleLoginBtn,E.googleLoginBtn2].forEach(b=>b&&b.classList.toggle('hidden',logged));
  [E.googleLogoutBtn,E.googleLogoutBtn2].forEach(b=>b&&b.classList.toggle('hidden',!logged));
  renderMyCharacterSelect();
  applyAdminAccess();
}

function signInGoogle(){
  if(!auth)return toast('Firebase Auth 尚未載入');
  const provider=new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err=>{console.error(err);toast('Google 登入失敗，請確認 Firebase 已啟用 Google 登入');});
}
function signOutGoogle(){if(auth)auth.signOut();}

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
    if(firebase.auth){
      auth=firebase.auth();
      auth.onAuthStateChanged(user=>{currentUser=user;subscribeProfiles();lastProfileLoadedFor='';tryAutoFillCurrentPlayer(true);renderAuth();renderAll();});
    }else{
      renderAuth();
    }
    signupsRef=db.collection('signups');
    charactersRef=db.collection('characters');
    adminEventsRef=db.collection('adminEvents');
    signupsRef.onSnapshot(snap=>{
      state.signups=snap.docs.map(d=>({id:d.id,...d.data()}));
      setStatus(`已同步 ${state.signups.length} 筆`,'sync-ok');
      tryAutoFillCurrentPlayer(true);
      renderAll();
    },err=>{console.error(err);setStatus('Firestore 連線失敗，請檢查規則','sync-bad');});
    if(charactersUnsub)charactersUnsub();
    charactersUnsub=charactersRef.onSnapshot(snap=>{
      state.characters=snap.docs.map(d=>({id:d.id,...d.data()}));
      tryAutoFillCurrentPlayer(true);
      renderAll();
    },err=>{console.warn('characters load failed',err);});
    if(eventUnsub)eventUnsub();
    eventUnsub=adminEventsRef.orderBy('createdAt','desc').limit(80).onSnapshot(snap=>{
      state.adminEvents=snap.docs.map(d=>({id:d.id,...d.data()}));
      renderAdminEventLog();
    },err=>{console.warn('admin events load failed',err);});
  }catch(err){console.error(err);setStatus('Firebase 初始化失敗','sync-bad');}
}
function signupOwnerUid(s){
  // v48：帳號權限只看 characters 角色主檔。
  // 報名資料 signups 裡的舊 ownerUid 一律忽略，避免「送出報名」或舊資料造成自動綁定假象。
  return characterOwnerUid(s?.player)||'';
}
function canEditSignup(s){
  if(isAdmin())return true;
  const owner=signupOwnerUid(s);
  if(owner)return !!(currentUser&&owner===currentUser.uid);
  return true; // 未登入建立或舊資料：輸入同角色名稱即可修改。
}
function playerLockedByOther(player){
  const key=norm(player);
  if(!key||isAdmin())return false;
  const masterOwner=characterOwnerUid(player);
  if(!masterOwner)return false;
  if(!currentUser)return true;
  return masterOwner!==currentUser.uid;
}
function requireLoginForWrite(){return true;}
function deniedEditToast(){toast('此角色資料已由其他 Google 帳號建立，只有本人或管理者可以修改');}
async function addSignup(item){
  if(!signupsRef){toast('Firebase 尚未連線');return false;}
  if(playerLockedByOther(item.player)){deniedEditToast();return false;}

  // v46：報名資料不再負責帳號綁定，帳號只綁在 characters 角色主檔。
  // 這樣已綁定角色新增其他王/日期時，不會被舊報名 ownerUid 卡住。
  delete item.guestOwnerToken;
  delete item.ownerUid;
  delete item.ownerEmail;

  item.createdBy=item.createdBy||actorMeta();
  item.updatedBy=actorMeta();
  await signupsRef.doc(docId(item)).set(item,{merge:true});
  const localIdx=state.signups.findIndex(s=>signupKey(s)===signupKey(item));
  if(localIdx>=0)state.signups[localIdx]={...state.signups[localIdx],...item}; else state.signups.push({...item});

  // v47：只建立/更新角色主檔資料，不自動綁定帳號。
  await upsertCharacterMaster(item.player,{claim:false});
  return true;
}
async function deleteSignupObj(s){
  if(!signupsRef||!s)return false;
  if(!canEditSignup(s)){deniedEditToast();return false;}
  await signupsRef.doc(s.id||docId(s)).delete();
  return true;
}
async function updateSignupObj(s,patch){
  if(!signupsRef||!s)return false;
  if(!canEditSignup(s)){deniedEditToast();return false;}
  const next={...patch,updatedAt:new Date().toISOString(),updatedBy:actorMeta()};

  // v34：已登入者修改「未歸入 Google 帳號」的角色時，自動歸入目前 Google 帳號。
  // 例：原本午餐是未登入建立；Google 登入後輸入午餐並送出，之後午餐就只允許本人/管理者修改。
  // v46：只更新報名內容；帳號綁定由角色主檔管理。
  next.ownerUid=firebase.firestore.FieldValue.delete();
  next.ownerEmail=firebase.firestore.FieldValue.delete();
  next.guestOwnerToken=firebase.firestore.FieldValue.delete();
  await signupsRef.doc(s.id||docId(s)).set(next,{merge:true});
  Object.assign(s,next);
  await upsertCharacterMaster(s.player,{claim:false});
  return true;
}

async function claimUnboundPlayerRecords(player, showToast=false){
  // v47：手動綁定角色主檔。送出報名不會呼叫這裡。
  // 管理者可以修改資料，但不能把已由其他 Google 帳號綁定的角色改綁到自己。
  if(!currentUser||!charactersRef)return 0;
  const key=norm(player);
  if(!key)return 0;

  const records=state.signups.filter(s=>norm(s.player)===key);
  const master=characterRecord(player);
  const masterOwner=master&&master.ownerUid&&!master.unlinkedAt?master.ownerUid:'';
  if(masterOwner && masterOwner!==currentUser.uid){
    if(showToast)toast('此角色已被其他 Google 帳號綁定，不能重新綁定');
    return 0;
  }

  // v48：舊 signups.ownerUid 不再視為角色綁定來源；只有角色主檔 ownerUid 會阻止重新綁定。
  await upsertCharacterMaster(player,{claim:true});
  if(showToast)toast(`已將「${player}」角色綁定到目前 Google 帳號`);
  return 1;
}

function init(){
  selectedCycle=cycles()[0].id;
  bindTabs();bindActions();renderSignup();renderAuth();renderAll();initFirebase();
  let deferred;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;E.installBtn?.classList.remove('hidden');});
  if(E.installBtn)E.installBtn.onclick=()=>deferred&&deferred.prompt();
}
function bindTabs(){document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{if((b.dataset.page==='adminPage'||b.dataset.page==='dataPage')&&!isAdmin()){toast('只有管理者可訪問後台與資料頁');return;}document.querySelectorAll('.tab,.page').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.page).classList.add('active');renderAll();}));}
function bindActions(){
  [E.googleLoginBtn,E.googleLoginBtn2].forEach(b=>b&&(b.onclick=signInGoogle));
  [E.googleLogoutBtn,E.googleLogoutBtn2].forEach(b=>b&&(b.onclick=signOutGoogle));
  E.hasAlt.onchange=()=>{markManualProfileTouched();E.accountGroup.classList.toggle('hidden',!E.hasAlt.checked);if(!E.hasAlt.checked)E.accountGroup.value='';};
  E.accountGroup.addEventListener('input',markManualProfileTouched);
  E.playerName.addEventListener('input',()=>{
    manualBossTouched=false;
    manualProfileTouched=false;
    manualProfilePlayer='';
    const loaded=autoFillProfileByName(true);
    renderClaimBox();
    if(loaded){renderSignup();toast('已自動帶入既有職業/分身資料');}
    else {renderMine();renderMyCharacterSelect();}
  });
  if(E.claimCharacterBtn)E.claimCharacterBtn.onclick=claimCurrentPlayerToGoogle;
  if(E.myCharacterSelect)E.myCharacterSelect.onchange=()=>{
    const name=E.myCharacterSelect.value;
    if(!name)return;
    E.playerName.value=name;
    manualBossTouched=false;
    manualProfileTouched=false;
    manualProfilePlayer='';
    lastProfileLoadedFor='';
    const loaded=autoFillProfileByName();
    renderSignup();
    toast(loaded?'已載入角色紀錄':'已選擇角色');
  };
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
  E.classGroupBtns.querySelectorAll('button').forEach(b=>b.onclick=()=>{markManualProfileTouched();selectedGroup=b.dataset.group;selectedJob=jobs[selectedGroup][0];renderSignup();});
  E.jobBtns.innerHTML=jobs[selectedGroup].map(j=>`<button class="choice ${j===selectedJob?'active':''}" data-job="${j}" type="button">${j}</button>`).join('');
  E.jobBtns.querySelectorAll('button').forEach(b=>b.onclick=()=>{markManualProfileTouched();selectedJob=b.dataset.job;renderSignup();});
  E.bossBtns.innerHTML=bosses.map(b=>`<button class="choice ${b.name===selectedBoss?'active':''}" data-boss="${b.name}" type="button">${b.name}<br><small>${b.limit}人</small></button>`).join('');
  E.bossBtns.querySelectorAll('button').forEach(b=>b.onclick=()=>{manualBossTouched=true;selectedBoss=b.dataset.boss;autoFillDateSet=null;renderSignup();});
  E.dateChecks.innerHTML=cycleDates(selectedCycle).map(d=>`<label class="choice dateChoice"><input type="checkbox" value="${d}"><span>${d}</span></label>`).join('');
  if(autoFillDateSet&&autoFillDateSet.cycle===selectedCycle&&autoFillDateSet.boss===selectedBoss){
    E.dateChecks.querySelectorAll('input').forEach(x=>x.checked=autoFillDateSet.dates.has(x.value));
    autoFillDateSet=null;
  }
  renderClaimBox();
  renderMine();
}
function fillCycleSelect(el){el.innerHTML=cycles().map(c=>`<option value="${c.id}" ${c.id===selectedCycle?'selected':''}>${c.id}</option>`).join('');}
function renderAll(){
  applyAdminAccess();
  fillCycleSelect(E.adminCycle);fillCycleSelect(E.rosterCycle);
  E.adminBoss.innerHTML=bosses.map(b=>`<option>${b.name}</option>`).join('');
  E.adminDate.innerHTML=['週期全部日期',...cycleDates(E.adminCycle.value||selectedCycle)].map(v=>`<option>${v}</option>`).join('');
  renderRoster();renderAdminList();renderAllData();renderAdminEventLog();renderMine();renderMyCharacterSelect();renderClaimBox();
}
function currentProfilePatch(){
  return {group:selectedGroup,job:selectedJob,hasAlt:E.hasAlt.checked,accountGroup:E.hasAlt.checked?E.accountGroup.value.trim():'',updatedAt:new Date().toISOString(),updatedBy:userMeta()};
}
function autoFillProfileByName(force=false){
  const name=E.playerName.value.trim();
  const key=norm(name);
  if(!key)return false;
  if(manualProfileTouched && key===manualProfilePlayer){
    return false;
  }
  if(!force&&key===lastProfileLoadedFor)return false;
  const matches=state.signups.filter(s=>norm(s.player)===key).sort((a,b)=>timeValue(b)-timeValue(a));
  const savedProfile=myProfiles.find(p=>norm(p.player)===key);
  const master=characterRecord(name);
  if(!matches.length&&!savedProfile&&!master)return false;

  // v45：職業/分身資訊優先使用角色主檔；日期/王別再使用目前週期報名資料。
  const currentMatches=matches.filter(s=>s.cycle===selectedCycle);
  const signupSource=currentMatches[0]||matches[0]||{};
  const s={...signupSource,...(savedProfile||{}),...(master||{})};

  // 若這筆資料屬於目前可選的兩週之一，也同步切到該週期。
  if(cycles().some(c=>c.id===s.cycle))selectedCycle=s.cycle;

  // 只有在剛輸入/選擇角色、尚未手動切換王別時，才自動帶入既有王別。
  // 已手動點選炎魔/龍王等時，保留目前王別，讓送出能新增該王報名。
  if(!manualBossTouched)selectedBoss=s.boss||selectedBoss;
  selectedGroup=s.group||selectedGroup;
  selectedJob=s.job||jobs[selectedGroup]?.[0]||selectedJob;
  E.hasAlt.checked=!!s.hasAlt;
  E.accountGroup.classList.toggle('hidden',!E.hasAlt.checked);
  E.accountGroup.value=s.hasAlt?(s.accountGroup||''):'';

  const sameBossDates=state.signups
    .filter(x=>norm(x.player)===key&&x.cycle===selectedCycle&&x.boss===selectedBoss)
    .map(x=>x.date);
  autoFillDateSet={cycle:selectedCycle,boss:selectedBoss,dates:new Set(sameBossDates)};

  lastProfileLoadedFor=key;
  return true;
}

function tryAutoFillCurrentPlayer(force=false){
  if(!E.playerName||!E.playerName.value.trim())return false;
  const loaded=autoFillProfileByName(force);
  if(loaded)renderSignup();
  renderClaimBox();
  return loaded;
}
function playerRecordsByName(player){
  const key=norm(player);
  return state.signups.filter(s=>norm(s.player)===key);
}
function renderClaimBox(){
  if(!E.claimBox||!E.claimStatus||!E.claimCharacterBtn)return;
  const name=E.playerName?.value?.trim()||'';
  const logged=!!currentUser;
  E.claimBox.classList.toggle('hidden',!logged||!name);
  if(!logged||!name)return;
  const records=playerRecordsByName(name);
  const masterOwner=characterOwnerUid(name);
  if(masterOwner && masterOwner!==currentUser.uid){
    E.claimStatus.textContent='此角色已被其他 Google 帳號綁定，不能重新綁定。';
    E.claimCharacterBtn.disabled=true;
  }else if(masterOwner===currentUser.uid){
    E.claimStatus.textContent=`此角色已綁定到目前 Google 帳號（共 ${records.length} 筆報名）。`;
    E.claimCharacterBtn.disabled=true;
  }else if(records.length){
    E.claimStatus.textContent=`此角色目前未綁定 Google。可按下按鈕，將「${name}」綁定到目前 Google 帳號。`;
    E.claimCharacterBtn.disabled=false;
  }else{
    E.claimStatus.textContent='此角色尚無報名資料。請先送出報名建立角色，再使用按鈕綁定。';
    E.claimCharacterBtn.disabled=true;
  }
}
async function claimCurrentPlayerToGoogle(){
  if(!currentUser)return toast('請先 Google 登入');
  const name=E.playerName.value.trim();
  if(!name)return toast('請輸入玩家名稱');
  if(playerLockedByOther(name)){deniedEditToast();renderClaimBox();return;}
  const count=await claimUnboundPlayerRecords(name,false);
  if(count>0){
    await saveMyCharacterProfile(name);
    toast(`已將「${name}」角色綁定到目前 Google 帳號`);
  }else{
    toast('沒有可綁定的資料，或角色已被其他帳號綁定');
  }
  renderClaimBox();
}

async function updateWholePlayerProfile(player, patch){
  if(!signupsRef||!player)return {updated:0,denied:0};
  const records=state.signups.filter(s=>norm(s.player)===norm(player));
  let updated=0,denied=0;
  for(const s of records){
    if(!canEditSignup(s)){denied++;continue;}
    const next={...patch,updatedAt:new Date().toISOString(),updatedBy:actorMeta()};
    // v46：職業/分身資料同步到所有報名；不在報名資料上寫入帳號綁定。
    next.ownerUid=firebase.firestore.FieldValue.delete();
    next.ownerEmail=firebase.firestore.FieldValue.delete();
    next.guestOwnerToken=firebase.firestore.FieldValue.delete();
    await signupsRef.doc(s.id||docId(s)).set(next,{merge:true});
    Object.assign(s,next);
    updated++;
  }
  if(!denied)await upsertCharacterMaster(player,{claim:false});
  return {updated,denied};
}

async function submitSignup(){
  const name=E.playerName.value.trim();
  const dates=[...E.dateChecks.querySelectorAll('input:checked')].map(x=>x.value);
  if(!name)return toast('請輸入玩家名稱');
  if(!requireLoginForWrite())return;
  if(E.hasAlt.checked&&!E.accountGroup.value.trim())return toast('請輸入分身群組名稱');
  if(playerLockedByOther(name)){deniedEditToast();return;}

  // v47：送出報名不自動綁定 Google；綁定僅由「綁定到我的 Google 帳號」按鈕執行。

  const submitCycle=selectedCycle;
  const submitBoss=selectedBoss;
  const patch=currentProfilePatch();

  // v43：角色資訊是角色層級。只要本人/管理者送出，就同步更新此角色全部既有報名的職業與分身群組。
  // 這樣綁定帳號後改職業，或改報不同王時，不會只改到部分日期/部分王。
  const allPlayerRecords=state.signups.filter(s=>norm(s.player)===norm(name));
  let profileUpdated=0;
  if(allPlayerRecords.length){
    const res=await updateWholePlayerProfile(name,patch);
    profileUpdated=res.updated;
    if(res.denied){deniedEditToast();return;}
  }

  // 沒有勾日期時：只更新角色既有報名與 Google 角色紀錄。
  if(!dates.length){
    await saveMyCharacterProfile(name);
    if(profileUpdated)return toast(`已更改 ${profileUpdated} 筆角色資料`);
    return toast(currentUser?'已儲存角色資料；若要報名請選擇日期':'請至少選一個日期');
  }

  const selectedSet=new Set(dates);
  const existingForBoss=state.signups.filter(s=>norm(s.player)===norm(name)&&s.cycle===submitCycle&&s.boss===submitBoss);
  let added=0,changed=0,removed=0;

  // 已報名過此王時，送出後以目前勾選日期為準：
  // 綠燈保留/更新，取消勾選的日期會自動取消。
  if(existingForBoss.length){
    for(const s of existingForBoss){
      if(!selectedSet.has(s.date)){if(await deleteSignupObj(s))removed++;}
    }
  }

  for(const date of dates){
    const item={cycle:submitCycle,boss:submitBoss,date,player:name,group:selectedGroup,job:selectedJob,hasAlt:E.hasAlt.checked,accountGroup:E.hasAlt.checked?E.accountGroup.value.trim():'',createdAt:new Date().toISOString(),createdBy:actorMeta(),updatedAt:new Date().toISOString(),updatedBy:actorMeta()};
    const existing=state.signups.find(s=>signupKey(s)===signupKey(item));
    if(existing){if(await updateSignupObj(existing,patch))changed++;continue;}
    item.id=docId(item);
    if(await addSignup(item))added++;
  }
  await saveMyCharacterProfile(name);
  E.dateChecks.querySelectorAll('input').forEach(x=>x.checked=false);E.selectAllDates.textContent='日期全選';
  const parts=[];
  if(added)parts.push(`新增 ${added} 筆`);
  if(changed||profileUpdated)parts.push(`已更改 ${Math.max(changed,profileUpdated)} 筆`);
  if(removed)parts.push(`已取消 ${removed} 筆`);
  lastProfileLoadedFor='';
  renderMyCharacterSelect();
  renderClaimBox();
  toast(parts.length?parts.join('，'):'沒有變更');
}
function findSignup(player,cycle,boss,date){return state.signups.find(s=>norm(s.player)===norm(player)&&s.cycle===cycle&&s.boss===boss&&s.date===date);}
async function toggleMineDate(boss,date){
  const name=E.playerName.value.trim(); if(!name)return toast('請輸入玩家名稱');
  if(!requireLoginForWrite())return;
  if(playerLockedByOther(name)){deniedEditToast();return;}
  // v47：點日期加入/取消也不自動綁定 Google。
  // 點綠/紅燈加入不同王/日期時，也先同步目前職業與分身設定到既有角色資料。
  if(state.signups.some(s=>norm(s.player)===norm(name))){await updateWholePlayerProfile(name,currentProfilePatch());}
  const exists=findSignup(name,selectedCycle,boss,date);
  if(exists){if(confirm(`取消 ${boss} ${date} 報名？`)){if(await deleteSignupObj(exists))toast('已取消報名');}}
  else{
    if(confirm(`加入 ${boss} ${date} 報名？`)){
      if(E.hasAlt.checked&&!E.accountGroup.value.trim())return toast('請輸入分身群組名稱');
      const item={cycle:selectedCycle,boss,date,player:name,group:selectedGroup,job:selectedJob,hasAlt:E.hasAlt.checked,accountGroup:E.hasAlt.checked?E.accountGroup.value.trim():'',createdAt:new Date().toISOString(),createdBy:actorMeta(),updatedAt:new Date().toISOString(),updatedBy:actorMeta()}; item.id=docId(item); await addSignup(item); await saveMyCharacterProfile(name); toast('已加入報名');
    }
  }
}
function settingSummaryFromForm(){return `${selectedGroup}｜${selectedJob}${E.hasAlt.checked?`｜分身群組 ${E.accountGroup.value.trim()||'未填'}`:'｜無分身群組'}`;}
function settingSummaryFromSignup(s){return `${s?.group||'未填'}｜${s?.job||'未填'}${s?.hasAlt?`｜分身群組 ${html(s.accountGroup||'未填')}`:'｜無分身群組'}`;}
async function applyCurrentSettingToMine(scopeBoss){
  const name=E.playerName.value.trim(); if(!name)return toast('請輸入玩家名稱');
  if(!requireLoginForWrite())return;
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
  E.mySignupList.innerHTML=`<div class="mine-tools"><div class="hint">已帶入此玩家既有資料。若要修改職業或分身群組，直接調整上方表單後按「送出報名」；未勾日期時會更新本週全部既有報名。Google 登入後，角色只有按「綁定到我的 Google 帳號」才會歸入帳號。</div></div>`+
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
  if(!isAdmin()){if(E.allData)E.allData.innerHTML='<div class="empty">只有管理者可查看資料頁</div>';return;}
  const arr=state.signups.slice().sort((a,b)=>String(a.player).localeCompare(String(b.player),'zh-Hant')||a.cycle.localeCompare(b.cycle)||a.boss.localeCompare(b.boss,'zh-Hant')||dateOrder(a.date,a.cycle)-dateOrder(b.date,b.cycle));
  if(!arr.length){E.allData.innerHTML='<div class="empty">尚無資料</div>';return;}
  const by=new Map();
  arr.forEach(s=>{const key=s.player||'未命名'; if(!by.has(key))by.set(key,[]); by.get(key).push(s);});
  E.allData.innerHTML=[...by.entries()].map(([player,list])=>{
    const first=list[0]||{};
    const locked=!!signupOwnerUid(first);
    const playerId=html(player);
    const masterEmail=characterOwnerEmail(player);
    const rows=list.map(s=>{
      return `<div class="item subitem"><b>${html(s.cycle)}｜${html(s.boss)}｜${html(s.date)}</b><small>${html(s.group||'')}｜${html(s.job||'')}${displayAccount(s)}｜報名 ${signupTime(s)}${s.createdBy&&s.createdBy.email?`｜Google ${html(s.createdBy.email)}`:''}</small></div>`;
    }).join('');
    const ownerText = locked ? `｜綁定 ${html(masterEmail||first.ownerEmail||first.createdBy?.email||'Google 帳號')}` : '｜未綁定帳號';
    return `<details class="data-player"><summary class="item data-summary"><div><b>${playerId}</b><small>${list.length} 筆｜${html(first.group||'')}｜${html(first.job||'')}${displayAccount(first)}${ownerText}</small></div><div class="summary-actions"><button class="danger small" type="button" onclick="event.preventDefault();event.stopPropagation();adminDeletePlayer('${playerId}')">刪除此角色</button></div></summary><div class="nested-list"><div class="item subitem"><button class="ghost small" type="button" onclick="adminUnlinkPlayer('${playerId}')" ${locked?'':'disabled'}>解除角色帳戶連結</button><small>${locked?'解除後此角色會變成未綁定，未登入者可用角色名稱修改。':'此角色目前未綁定 Google 帳號。'}</small></div>${rows}</div></details>`;
  }).join('');
}

async function adminDeleteSignupById(id){
  // v37 起資料頁不再提供單筆刪除，此函式保留給舊快取頁面避免錯誤。
  if(!isAdmin())return toast('只有管理者可刪除報名');
  if(!signupsRef)return toast('Firebase 尚未連線');
  const s=state.signups.find(x=>(x.id||docId(x))===id);
  const label=s?`${s.player}｜${s.boss}｜${s.date}`:id;
  if(!confirm(`確定刪除這筆報名？\n${label}`))return;
  await signupsRef.doc(id).delete();
  toast('已刪除單筆報名');
}

async function adminDeletePlayer(player){
  if(!isAdmin())return toast('只有管理者可刪除角色');
  if(!signupsRef)return toast('Firebase 尚未連線');
  const list=state.signups.filter(s=>norm(s.player)===norm(player));
  if(!list.length)return toast('找不到此角色報名資料');
  if(!confirm(`確定刪除角色「${player}」？\n將刪除此角色全部 ${list.length} 筆報名資料，無法復原。`))return;
  const batch=db.batch();
  list.forEach(s=>batch.delete(signupsRef.doc(s.id||docId(s))));
  await batch.commit();
  await logAdminEvent('delete-player',{player,count:list.length,bosses:[...new Set(list.map(s=>s.boss))].join('、')});
  toast('已刪除此角色全部報名');
}

async function adminUnlinkPlayer(player){
  if(!isAdmin())return toast('只有管理者可解除連結');
  if(!signupsRef)return toast('Firebase 尚未連線');
  const list=state.signups.filter(s=>norm(s.player)===norm(player));
  if(!list.length)return toast('找不到此角色報名資料');
  if(!confirm(`確定解除「${player}」的 Google 帳號連結？\n此角色所有報名都會變成未綁定。`))return;
  const batch=db.batch();
  list.forEach(s=>{
    batch.update(signupsRef.doc(s.id||docId(s)),{
      ownerUid:'',
      ownerEmail:'',
      claimedAt:'',
      claimedBy:null,
      unlinkedAt:new Date().toISOString(),
      unlinkedBy:actorMeta(),
      updatedAt:new Date().toISOString(),
      updatedBy:actorMeta()
    });
  });
  await upsertCharacterMaster(player,{unlink:true});
  await batch.commit();
  await logAdminEvent('unlink-player',{player,count:list.length,bosses:[...new Set(list.map(s=>s.boss))].join('、'),previousOwner:list[0]?.ownerEmail||list[0]?.createdBy?.email||''});
  toast('已解除角色帳戶連結');
}



// ===== Queue algorithm helpers rebuilt in v33 =====
function sameAltInTeam(team,cand){
  const ak=accountKey(cand); if(!ak)return false;
  return team.some(m=>accountKey(m)&&accountKey(m)===ak);
}
function canAddToTeam(team,cand,boss){
  if(!cand||team.some(m=>identity(m)===identity(cand)))return false;
  if(sameAltInTeam(team,cand))return false;
  const limit=bossLimit(boss); if(team.length>=limit)return false;
  const mageCount=team.filter(isMage).length;
  if((boss==='困拉'||boss==='炎魔')&&isMage(cand)&&mageCount>=2)return false;
  return true;
}
function usageCanUse(m,date,boss,usage){
  if(!m)return false;
  if(usage&&usage.players&&usage.players.has(identity(m)))return false;
  const ak=accountKey(m);
  if(!ak)return true;
  const g=usage.groups.get(`${date}|${ak}`)||{lock:false,pap:0};
  if(boss==='普拉')return !g.lock && g.pap<2;
  return !g.lock && !g.pap;
}
function reqUnits(boss){
  if(boss==='龍王')return [
    {label:'黑騎',key:'dk1',fn:isDK,hard:true},
    {label:'黑騎',key:'dk2',fn:isDK,hard:true},
    {label:'弩手',key:'xbow',fn:m=>m.job==='弩手',fallback:isArcher,hard:true,groupLabel:'弓箭手'},
    {label:'弓手',key:'bow',fn:m=>m.job==='弓手',fallback:isArcher,hard:true,groupLabel:'弓箭手'},
    {label:'拳霸',key:'bucc',fn:isBucc,hard:true}
  ];
  if(boss==='困拉')return [
    {label:'黑騎',key:'dk',fn:isDK,hard:true},
    {label:'弓手',key:'bow',fn:m=>m.job==='弓手',fallback:m=>m.job==='弩手',hard:true,groupLabel:'弓箭手'},
    {label:'主教',key:'bishop',fn:m=>m.job==='主教',fallback:isMage,hard:true,groupLabel:'法師'},
    {label:'冰雷/火毒',key:'mage2',fn:m=>m.job==='冰雷'||m.job==='火毒',fallback:isMage,hard:true,groupLabel:'法師'}
  ];
  if(boss==='炎魔')return [
    {label:'黑騎',key:'dk',fn:isDK,hard:true},
    {label:'弩手',key:'xbow',fn:m=>m.job==='弩手',fallback:m=>m.job==='弓手',hard:true,groupLabel:'弓箭手'},
    {label:'主教',key:'bishop',fn:m=>m.job==='主教',fallback:isMage,hard:true,groupLabel:'法師'}
  ];
  if(boss==='普拉')return [
    {label:'法師',key:'mage',fn:isMage,hard:false,soft:true},
    {label:'弓箭手',key:'archer',fn:isArcher,hard:false,soft:true}
  ];
  return [];
}
function reqStatus(team,boss){
  if(boss==='龍王'){
    const dk=team.filter(isDK).length, ar=team.filter(isArcher).length, bu=team.filter(isBucc).length;
    return [
      {label:'黑騎',count:2,have:Math.min(dk,2),missing:Math.max(0,2-dk)},
      {label:'弓箭手',count:2,have:Math.min(ar,2),missing:Math.max(0,2-ar)},
      {label:'拳霸',count:1,have:Math.min(bu,1),missing:Math.max(0,1-bu)}
    ];
  }
  if(boss==='困拉'){
    const dk=team.filter(isDK).length, ar=team.filter(isArcher).length, ma=team.filter(isMage).length;
    return [
      {label:'黑騎',count:1,have:Math.min(dk,1),missing:Math.max(0,1-dk)},
      {label:'弓箭手',count:1,have:Math.min(ar,1),missing:Math.max(0,1-ar)},
      {label:'法師',count:2,have:Math.min(ma,2),missing:Math.max(0,2-ma)}
    ];
  }
  if(boss==='炎魔'){
    const dk=team.filter(isDK).length, ar=team.filter(isArcher).length, ma=team.filter(isMage).length;
    return [
      {label:'黑騎',count:1,have:Math.min(dk,1),missing:Math.max(0,1-dk)},
      {label:'弓箭手',count:1,have:Math.min(ar,1),missing:Math.max(0,1-ar)},
      {label:'法師',count:1,have:Math.min(ma,1),missing:Math.max(0,1-ma)}
    ];
  }
  if(boss==='普拉'){
    const ma=team.filter(isMage).length, ar=team.filter(isArcher).length;
    return [
      {label:'法師',count:1,have:Math.min(ma,1),missing:Math.max(0,1-ma),soft:true},
      {label:'弓箭手',count:1,have:Math.min(ar,1),missing:Math.max(0,1-ar),soft:true}
    ];
  }
  return [];
}
function complete(team,boss){
  if(team.length<bossLimit(boss))return false;
  return reqStatus(team,boss).filter(r=>!r.soft).every(r=>r.missing===0);
}
function unformedReason(available,boss,team){
  const reasons=[];
  const limit=bossLimit(boss);
  if(team.length<limit)reasons.push(`人數不足 ${team.length}/${limit}`);
  reqStatus(team,boss).filter(r=>!r.soft&&r.missing>0).forEach(r=>reasons.push(`缺少${r.label} ${r.missing}`));
  return reasons;
}
function pickCandidate(pool,team,boss,pred){
  const candidates=pool.filter(x=>pred(x)&&canAddToTeam(team,x,boss)).sort(byTime);
  if(!candidates.length)return null;
  const chosen=candidates[0];
  pool.splice(pool.indexOf(chosen),1);
  team.push(chosen);
  return chosen;
}
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
function canUseMageForFill(pool,team,boss,cand){
  if(!isMage(cand))return true;
  const mageCount=team.filter(isMage).length;
  if(boss==='困拉'||boss==='炎魔')return mageCount<2;
  if(boss==='普拉'){
    if(mageCount<2)return true;
    // 普拉：只有其他條件都篩完，只剩法師可選時，才選第 3 位以上法師。
    return !pool.some(x=>x!==cand&&!isMage(x)&&canAddToTeam(team,x,boss));
  }
  return true;
}
function fillTeam(pool,team,boss){
  const limit=bossLimit(boss);
  while(team.length<limit){
    const candidates=pool.filter(x=>canAddToTeam(team,x,boss)&&canUseMageForFill(pool,team,boss,x));
    if(!candidates.length)break;
    const jobCounts={}; team.forEach(m=>{jobCounts[m.job]=(jobCounts[m.job]||0)+1;});
    candidates.sort((a,b)=>{
      const ca=jobCounts[a.job]||0, cb=jobCounts[b.job]||0;
      return ca-cb || outputPriority(boss,a)-outputPriority(boss,b) || byTime(a,b);
    });
    const chosen=candidates[0];
    pool.splice(pool.indexOf(chosen),1);
    team.push(chosen);
  }
}
function buildTeam(available,boss){
  const pool=available.slice().sort(byTime);
  const team=[];
  // 先滿足必要/優先職業；同分身群組內如果有必要職業，會在這裡先被選入，而不是先選輸出角。
  for(const unit of reqUnits(boss)){
    let picked=pickCandidate(pool,team,boss,unit.fn);
    if(!picked&&unit.fallback)picked=pickCandidate(pool,team,boss,unit.fallback);
  }
  fillTeam(pool,team,boss);
  return team;
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
  const chtml=conflicts.length?`<div class="conflict-box"><b>多角色提醒：同天多角色</b>${conflicts.map(([k,v])=>`<div>${html(v[0].accountGroup)}：${v.map(x=>html(x.player)+'('+x.boss+')').join('、')}</div>`).join('')}</div>`:'';
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
function slotHTML(m,idx,orange){return `<div class="slot"><b>${idx}</b><div>${html(m.player)}${orange?'<span class="alt-text-label">（多角色）</span>':''}<div class="job">${m.group}｜${m.job}${displayAccount(m)}｜報名 ${signupTime(m)}</div></div><span>${tag(m)}</span></div>`;}
async function copyTeams(){
  if(!lastTeams)return toast('請先自動編排');
  const txt=(lastTeams.formed||[]).map((f,i)=>`${f.boss} ${f.date} 第${i+1}隊\n${f.team.map((m,n)=>`${n+1}. ${m.player}｜${m.job}`).join('\n')}`).join('\n\n');
  await navigator.clipboard.writeText(txt||'沒有成團'); toast('已複製隊伍');
}
function exportJson(){if(!isAdmin())return toast('只有管理者可匯出資料');const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='boss-signups.json';a.click();URL.revokeObjectURL(a.href);}
function importJson(e){if(!isAdmin())return toast('只有管理者可匯入資料');const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=async()=>{try{const data=JSON.parse(r.result);const arr=data.signups||[];for(const s of arr){s.id=s.id||docId(s);await addSignup(s);}toast('匯入完成');}catch{toast('匯入失敗');}};r.readAsText(file);}
async function clearAll(){if(!isAdmin())return toast('只有管理者可清除資料');if(!signupsRef)return toast('Firebase 尚未連線');if(!confirm('確定清除全部報名？'))return;const snap=await signupsRef.get();const batch=db.batch();snap.docs.forEach(d=>batch.delete(d.ref));await batch.commit();toast('已清除');}

window.adminDeleteSignupById=adminDeleteSignupById;
window.adminDeletePlayer=adminDeletePlayer;
window.adminUnlinkPlayer=adminUnlinkPlayer;
window.addEventListener('DOMContentLoaded',init);
})();
