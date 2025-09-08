// app.js (module)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getDatabase, ref, set, get, update, onValue } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

// ---------- CONFIG ----------
const firebaseConfig = {
  apiKey: "AIzaSyDdlvPMWThdEUk2D92Tg_mQSHbGO4LG2AE",
  authDomain: "nusa-7a52a.firebaseapp.com",
  databaseURL: "https://nusa-7a52a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "nusa-7a52a",
  storageBucket: "nusa-7a52a.firebasestorage.app",
  messagingSenderId: "72016839114",
  appId: "1:72016839114:web:0bc8978a826619f7ad8f33",
  measurementId: "G-HBZN4WGKWX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ---------- PARAMETERS ----------
const REWARDS = [100,150,250];
const LIMITS = [20,20,15];
const COOLDOWN_MS = 4*60*1000; // 4 menit

// ---------- UTILS ----------
const $ = s => document.querySelector(s);
const show = id => document.getElementById(id).classList.remove('hidden');
const hide = id => document.getElementById(id).classList.add('hidden');
const nowServer = () => Date.now(); // using client but serverTimeOffset could be used if needed
const cycleKey = () => { const t = nowServer() + (7*60*60*1000) - (6*60*60*1000); return new Date(t).toISOString().slice(0,10); };

// ---------- UI ELEMENTS ----------
const loaderBar = $('#loaderBar');
const authSection = $('#auth');
const splash = $('#splash');
const warn = $('#warning');
const continueWarnBtn = $('#continueWarn');
const registerBtn = $('#registerBtn');
const authMsg = $('#authMsg');

const balanceEl = $('#balance');
const uidShort = $('#uidShort');
const btns = [$('#btn1'),$('#btn2'),$('#btn3')];
const cds = [$('#cd1'),$('#cd2'),$('#cd3')];
const pbs = [$('#pb1'),$('#pb2'),$('#pb3')];
const limitsLbl = [$('#limit1'),$('#limit2'),$('#limit3')];
const historyList = $('#historyList');

const page1 = $('#page1');
const page2 = $('#page2');
const page1Continue = $('#page1Continue');
const page2Reward = $('#page2Reward');
const lettersWrap = $('#letters');
const adContainer = $('#adContainer');

// ---------- SPLASH -> AUTH ----------
setTimeout(()=>{ hide('splash'); show('auth'); }, 1200);

// ---------- AUTH HANDLERS ----------
registerBtn.addEventListener('click', async ()=>{
  const email = $('#email').value.trim();
  const pass = $('#password').value.trim();
  authMsg.textContent = '';
  if(!email || !pass){ authMsg.textContent = 'Email & password harus diisi'; return; }
  try{
    await signInWithEmailAndPassword(auth,email,pass);
  }catch(e){
    try{ await createUserWithEmailAndPassword(auth,email,pass); }
    catch(err){ authMsg.textContent = err.message || 'Gagal mendaftar'; }
  }
});

onAuthStateChanged(auth, async user => {
  if(!user) return;
  // ensure user record exists
  const uRef = ref(db, `users/${user.uid}`);
  const snap = await get(uRef);
  if(!snap.exists()){
    await set(uRef, { createdAt: nowServer(), balance:0, banned:false, usage:{}, history:[], limits:{1:20,2:20,3:15}, cooldowns:{1:0,2:0,3:0}, lastReset: new Date().toISOString() });
  }
  uidShort.textContent = `UID: ${user.uid.slice(0,6)}…${user.uid.slice(-4)}`;
  hide('auth'); show('warning');
  countdownButton(continueWarnBtn,5,()=>{ enableButton(continueWarnBtn,'Continue'); });
  continueWarnBtn.onclick = async ()=>{ hide('warning'); show('app'); bindDashboard(user.uid); };
});

// ---------- DASHBOARD BIND ----------
async function bindDashboard(uid){
  const uRef = ref(db, `users/${uid}`);
  onValue(uRef, snap => {
    const data = snap.val() || {};
    balanceEl.textContent = formatCurrency(data.balance || 0);
    const key = cycleKey();
    const usage = data.usage || {};
    const today = usage[key] || { counts:[0,0,0], last:[0,0,0] };
    for(let i=0;i<3;i++){
      const count = (today.counts && today.counts[i]) || 0;
      limitsLbl[i].textContent = `${count}/${LIMITS[i]}`;
      pbs[i].style.width = `${Math.min(100, Math.round(count*100/LIMITS[i]))}%`;
      applyCooldownUI(btns[i], cds[i], today.last?.[i]);
      if(!btns[i].dataset.bound){ btns[i].dataset.bound='1'; btns[i].addEventListener('click', ()=>startAd(uid,i)); }
    }
    // history
    const hist = data.history || [];
    historyList.innerHTML = '';
    hist.slice(-20).reverse().forEach(it => { const li = document.createElement('li'); li.textContent = `${new Date(it.time).toLocaleString()} • +${it.reward}`; historyList.appendChild(li); });
  });
}

function formatCurrency(n){ return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0); }

// ---------- COOLDOWN & UI ----------
function applyCooldownUI(btn,label,lastTs){
  const rem = cooldownRemaining(lastTs);
  if(rem>0){ btn.disabled=true; btn.classList.add('btn-disabled'); label.textContent = `Cooldown: ${formatMMSS(rem)}`; timerLoop(btn,label,lastTs); }
  else { btn.disabled=false; btn.classList.remove('btn-disabled'); label.textContent=''; }
}
function timerLoop(btn,label,lastTs){ const t=setInterval(()=>{ const rem=cooldownRemaining(lastTs); if(rem<=0){ clearInterval(t); btn.disabled=false; btn.classList.remove('btn-disabled'); label.textContent=''; } else label.textContent = `Cooldown: ${formatMMSS(rem)}`; },1000); }
function cooldownRemaining(lastTs){ if(!lastTs) return 0; const passed = nowServer() - lastTs; return Math.max(0, COOLDOWN_MS - passed); }
function formatMMSS(ms){ const s=Math.ceil(ms/1000), m=Math.floor(s/60), r=s%60; return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`; }

function countdownButton(btn,sec,done){ let left=sec; const base=btn.textContent.replace(/\(.*\)/,'').trim(); const tick=()=>{ btn.textContent = `${base} (${left})`; if(left<=0) return done(); left--; setTimeout(tick,1000); }; tick(); }
function enableButton(btn,txt){ btn.textContent=txt; btn.disabled=false; btn.classList.remove('bg-base-700'); }

// ---------- AD FLOWS (dynamic load) ----------
function loadScript(src, attrs={}, containerId='adContainer'){ const cont=document.getElementById(containerId); cont.classList.remove('hidden'); cont.innerHTML=''; const s=document.createElement('script'); s.src=src; s.async=true; Object.entries(attrs).forEach(([k,v])=> s.setAttribute(k,v)); cont.appendChild(s); return s; }

async function startAd(uid, idx){
  // idx 0 -> Monetag, 1 -> Onclicka, 2 -> Super (two-step handled separately)
  if(idx===2){ startSuperBonusFlow(uid); return; }
  // check limits & cooldown from DB
  const dayKey = cycleKey(); const uRef = ref(db, `users/${uid}`); const snap = await get(uRef); const data = snap.val() || {};
  const usage = data.usage || {}; const today = usage[dayKey] || { counts:[0,0,0], last:[0,0,0] };
  if((today.counts[idx]||0) >= LIMITS[idx]){ alert('Sudah mencapai batas harian.'); return; }
  if(cooldownRemaining(today.last?.[idx]||0) > 0){ alert('Masih cooldown.'); return; }

  // load ad dynamically
  if(idx===0){ // Monetag
    loadScript('//libtl.com/sdk.js', {'data-zone':'9779635','data-sdk':'show_9779635'}, 'adContainer');
    // try to wait for SDK, fallback after timeout
    await new Promise(res=> setTimeout(res, 8000));
    if(window.show_9779635) await window.show_9779635();
  } else if(idx===1){ // Onclicka
    loadScript('https://js.onclckmn.com/static/onclicka.js', {}, 'adContainer');
    await new Promise(res=> setTimeout(res, 9000));
  }

  // commit reward (atomic-ish via transaction recommended; simple update below)
  await commitReward(uid, idx);
  // hide ads
  document.getElementById('adContainer').classList.add('hidden');
}

async function commitReward(uid, idx){ const uRef = ref(db, `users/${uid}`); const snap = await get(uRef); const userData = snap.val() || {}; if(userData.banned) return; const key=cycleKey(); userData.usage = userData.usage || {}; userData.usage[key] = userData.usage[key] || { counts:[0,0,0], last:[0,0,0] }; userData.usage[key].counts[idx] = (userData.usage[key].counts[idx]||0) + 1; userData.usage[key].last[idx] = nowServer(); userData.balance = (userData.balance||0) + REWARDS[idx]; userData.history = userData.history || []; userData.history.push({ time: nowServer(), reward: REWARDS[idx], type: idx }); await update(ref(db, `users/${uid}`), userData); }

// ---------- SUPER BONUS (2-step) ----------
function startSuperBonusFlow(uid){ hide('app'); show('page1'); loadScript('https://js.onclckmn.com/static/onclicka.js', {'data-admpid':'369301'}, 'page1Ads'); // inject letters
  if(lettersWrap && !lettersWrap.dataset.done){ const letters = Array.from({length:26},(_,i)=>String.fromCharCode(65+i)); letters.forEach(ch=>{ const d=document.createElement('div'); d.className='az'; d.textContent=ch; lettersWrap.appendChild(d); }); lettersWrap.dataset.done='1'; }
  // wait for scroll bottom -> enable button
  page1Continue.disabled=true; page1Continue.classList.add('btn-disabled');
  const onScroll = () => { const bottom = (window.scrollY + window.innerHeight) >= document.body.scrollHeight - 20; if(bottom && page1Continue.disabled){ countdownButton(page1Continue,5,()=>{ enableButton(page1Continue,'Continue'); page1Continue.disabled=false; page1Continue.classList.remove('btn-disabled'); }); window.removeEventListener('scroll', onScroll); } };
  window.addEventListener('scroll', onScroll);
  page1Continue.onclick = ()=>{ hide('page1'); show('page2'); page2Sequence(uid); };
}

function page2Sequence(uid){ // inject ClickAdila
  loadScript('https://js.wpadmngr.com/static/adManager.js', {'data-admpid':'369167'}, 'page2Ads'); const in1=document.createElement('div'); in1.setAttribute('data-inpage-id','1463186'); document.getElementById('page2Ads').appendChild(in1); const in2=document.createElement('div'); in2.setAttribute('data-inpage-id','1463187'); document.getElementById('page2Ads').appendChild(in2); const bn=document.createElement('div'); bn.setAttribute('data-banner-id','1463188'); document.getElementById('page2Ads').appendChild(bn);
  page2Reward.disabled=true; page2Reward.classList.add('btn-disabled'); countdownButton(page2Reward,7,()=>{ enableButton(page2Reward,'Terima Reward'); page2Reward.disabled=false; page2Reward.classList.remove('btn-disabled'); });
  page2Reward.onclick = async ()=>{ await commitReward(uid,2); hide('page2'); show('app'); document.getElementById('adContainer').classList.add('hidden'); };
}

// ---------- COMPACT HELPERS ----------
function countdownButton(btn,sec,done){ let left=sec; const base=btn.textContent.replace(/\(.*\)/,'').trim(); btn.textContent=`${base} (${left})`; const t=setInterval(()=>{ left--; btn.textContent=`${base} (${left})`; if(left<=0){ clearInterval(t); done(); } },1000); }

// ---------- END ----------