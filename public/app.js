// Front-end SPA that calls /api/brief for AI-summarized items
const REQUIRED_SECTIONS = [
  { id: 'News', icon: '📰' },
  { id: 'Weather', icon: '☁️' },
  { id: 'Sports', icon: '🏈' },
  { id: 'Business', icon: '💼' },
  { id: 'Arts', icon: '🎭' },
];
const SEED_FRIENDS = ["You (Reader)","John Henry","Linda Henry","Dhiraj Nayar","Nancy Barnes","James Dao","Rick Berke","Anthony Bonfiglio","Tom Brown","Kaitlyn Johnston","Matt Karolian","Dan Krockmalnic","Angus Macaulay","Michelle Micone","Lynne Montesanto","Josh Russell","Rodrigo Tajonar","Chris Vogel","Chris Zeien"];
const STORAGE = { lastOpen:'bc.lastOpen', streak:'bc.streak', minutesByDate:'bc.minutesByDate', mastery:'bc.mastery', friends:'bc.friends', sections:'bc.sections', achievements:'bc.achievements' };
let FEED = { dailyGoalMinutes: 10, stories: [] };
let state = { index: 0, autoplay: true, timer: null };
const $ = s=>document.querySelector(s);
const todayKey = ()=>new Date().toISOString().slice(0,10);
const getLS=(k,f)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):f}catch{return f}};
const setLS=(k,v)=>localStorage.setItem(k, JSON.stringify(v));

function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1400); }
function ringPercent(mins, goal){ const C=2*Math.PI*52; const pct=Math.max(0,Math.min(1,mins/Math.max(1,goal))); $('#ringFg').setAttribute('stroke-dasharray',`${pct*C} ${C}`); }
function bumpStreakIfNewDay(){ const last=getLS(STORAGE.lastOpen,null), key=todayKey(); if(last===key) return getLS(STORAGE.streak,0); const y=new Date(); y.setDate(y.getDate()-1); const streak=(last===y.toISOString().slice(0,10))?getLS(STORAGE.streak,0)+1:1; setLS(STORAGE.lastOpen,key); setLS(STORAGE.streak,streak); celebrate(); return streak; }
function minutesToday(){ return (getLS(STORAGE.minutesByDate,{})[todayKey()]||0); }
function addMinutes(mins){ const map=getLS(STORAGE.minutesByDate,{}); const k=todayKey(); map[k]=(map[k]||0)+mins; setLS(STORAGE.minutesByDate,map); $('#minutesToday').textContent=map[k]; ringPercent(map[k], FEED.dailyGoalMinutes); }
function incMastery(topic){ const m=getLS(STORAGE.mastery,{}); m[topic]=(m[topic]||0)+1; setLS(STORAGE.mastery,m); return m[topic]; }
function markSectionComplete(sectionId){ const key=todayKey(); const m=getLS(STORAGE.sections,{}); m[key]=m[key]||{}; if(!m[key][sectionId]){ m[key][sectionId]=true; setLS(STORAGE.sections,m); renderPunchcard(); } }
function renderPunchcard(){ const w=$('#punchcard'); w.innerHTML=''; REQUIRED_SECTIONS.forEach(s=>{ const filled=(getLS(STORAGE.sections,{})[todayKey()]||{})[s.id]; const d=document.createElement('div'); d.className='punch-slot'+(filled?' filled':''); d.innerHTML=`<span class="emoji">${s.icon}</span> ${s.id}`; w.appendChild(d); }); }
function seedFriendsIfNeeded(){ const have=getLS(STORAGE.friends,null); if(have) return have; setLS(STORAGE.friends, SEED_FRIENDS.map(n=>({name:n, self:n.startsWith('You')}))); return getLS(STORAGE.friends,[]); }
function computeScore(f){ const minutes=minutesToday(); const streak=getLS(STORAGE.streak,0); const mastery=Object.values(getLS(STORAGE.mastery,{})).reduce((a,b)=>a+b,0); const base=minutes+2*streak+mastery; if(f.self) return base+3; const seed=[...f.name].reduce((a,c)=>a+c.charCodeAt(0),0); return base+(seed%10); }
function renderLeaderboard(){ const list=seedFriendsIfNeeded(); const scored=list.map(f=>({...f,score:computeScore(f)})).sort((a,b)=>b.score-a.score); const ol=$('#leaderboard'); ol.innerHTML=''; scored.forEach((f,i)=>{ const li=document.createElement('li'); li.innerHTML=`<span>${i+1}. ${f.name}${f.self?' (you)':''}</span><strong>${f.score}</strong>`; ol.appendChild(li); }); }
function microFeedback(msg){ const el=$('#microFeedback'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),900); }
function celebrate(big=false){ const layer=document.getElementById('eggOverlay'); layer.innerHTML=''; layer.classList.add('show'); const N=big?120:60; for(let i=0;i<N;i++){ const d=document.createElement('div'); d.className='egg'; d.style.left=Math.random()*100+'vw'; d.style.top='-12px'; d.style.animationDelay=(Math.random()*0.5)+'s'; layer.appendChild(d);} setTimeout(()=>{ layer.classList.remove('show'); layer.innerHTML=''; },2000); }

function renderStoryList(){ const list=$('#storyList'); list.innerHTML=''; FEED.stories.forEach((s,i)=>{ const a=document.createElement('a'); a.href='#'; a.className='story-item'+(i===state.index?' active':''); a.onclick=(e)=>{e.preventDefault(); openIndex(i,true);}; a.innerHTML=`<div class="title">${s.title}</div><div class="meta">${s.topic} • ${s.durationSec} sec</div>`; list.appendChild(a); }); }
function openIndex(i, stopTimer=false){ state.index=Math.max(0,Math.min(FEED.stories.length-1,i)); const s=FEED.stories[state.index]; $('#storyTitle').textContent=s.title; $('#storyUrl').href=s.url; $('#storyTopic').textContent=s.topic; $('#storyDuration').textContent=Math.max(1,Math.round((s.durationSec||20)/60)); $('#storySummary').textContent=s.summary; renderStoryList(); if(stopTimer&&state.timer){clearInterval(state.timer);state.timer=null;} startTimerFor(s); }
function startTimerFor(story){ if(state.timer){clearInterval(state.timer);state.timer=null;} let remain=story.durationSec||20; state.timer=setInterval(()=>{ remain--; if(remain<=0){ clearInterval(state.timer); state.timer=null; completeCurrent(story); if(state.autoplay) next(); } },1000); }
function completeCurrent(story){ addMinutes(Math.round((story.durationSec||20)/60)); const lvl=incMastery(story.topic); markSectionComplete(story.section||story.topic||'News'); microFeedback(`✓ ${story.topic} +1 (Lv ${1+Math.floor(lvl/5)})`); }
function next(){ openIndex(state.index+1); } function prev(){ openIndex(state.index-1,true); }

async function loadBrief(){
  const token = (window.getIdToken ? await window.getIdToken() : null);
  const res = await fetch('/api/brief?limit=12', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const data = await res.json();
  FEED = data;
  $('#goal').textContent = FEED.dailyGoalMinutes || 10;
  renderStoryList();
  openIndex(0);
}

async function init(){
  const streak=bumpStreakIfNewDay(); document.getElementById('streakCount').textContent=streak; document.getElementById('minutesToday').textContent=minutesToday(); ringPercent(minutesToday(), 10);
  renderPunchcard(); renderLeaderboard();
  document.getElementById('btnNext').onclick=next; document.getElementById('btnPrev').onclick=prev; document.getElementById('btnComplete').onclick=()=>completeCurrent(FEED.stories[state.index]); document.getElementById('autoplay').onchange=(e)=>state.autoplay=!!e.target.checked;
  document.getElementById('btnLeaderboard').onclick=()=>document.getElementById('leaderboardModal').showModal();
  document.getElementById('btnAchievements').onclick=()=>document.getElementById('achievementsModal').showModal();
  await loadBrief();
}
document.addEventListener('DOMContentLoaded', init);
