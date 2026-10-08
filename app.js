/* Тетрадь слов — карточки для английских слов.
   Данные: courses.json (список курсов) + файл слов каждого курса.
   Прогресс детей хранится в localStorage на их устройстве. */
(function(){
'use strict';

/* ================= helpers ================= */
var $=function(s,r){return (r||document).querySelector(s)};
function h(tag,attrs){
  var el=document.createElement(tag),a=attrs||{};
  for(var k in a){var v=a[k]; if(v==null||v===false) continue;
    if(k==='class') el.className=v;
    else if(k.slice(0,2)==='on') el.addEventListener(k.slice(2),v);
    else if(k==='svg') el.innerHTML=v;
    else if(k==='value') el.value=v;
    else if(k==='checked') el.checked=!!v;
    else el.setAttribute(k,v===true?'':v);}
  for(var i=2;i<arguments.length;i++) add(el,arguments[i]);
  return el;
}
function add(el,k){if(k==null||k===false)return;if(Array.isArray(k)){k.forEach(function(x){add(el,x)});return}el.append(k instanceof Node?k:document.createTextNode(String(k)))}
var ICON={
  close:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  sound:'<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 9a4 4 0 010 6M19 6.5a8 8 0 010 11"/></svg>',
  learn:'<svg viewBox="0 0 24 24"><rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 4h12a2 2 0 012 2v11"/></svg>',
  stats:'<svg viewBox="0 0 24 24"><path d="M5 20V11M11 20V5M17 20v-6M3 20h18"/></svg>',
  words:'<svg viewBox="0 0 24 24"><path d="M4 6h16M4 11h16M4 16h10M4 21h6"/></svg>',
  edit:'<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
  trash:'<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  star:'<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  ext:'<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>'
};
function icon(n){return h('span',{class:'ic','aria-hidden':'true',svg:ICON[n]})}
var NOTOPIC='Без темы';
function topicOf(w){return (w.topic&&String(w.topic).trim())||NOTOPIC}
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}
function uid(p){return (p||'w')+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function plural(n,a,b,c){var m=n%10,mm=n%100;if(m===1&&mm!==11)return a;if(m>=2&&m<=4&&(mm<10||mm>=20))return b;return c}
function nw(n){return n+' '+plural(n,'слово','слова','слов')}
function clone(x){return JSON.parse(JSON.stringify(x))}
function norm(s){return String(s).toLowerCase().replace(/ё/g,'е').replace(/[’‘`´]/g,"'").replace(/[.!?()"«»,]/g,'').replace(/\s+/g,' ').trim()}
function variants(s){var v=[norm(s)];String(s).split(/[,;\/]/).forEach(function(x){x=norm(x);if(x)v.push(x)});
  v.slice().forEach(function(x){if(x.indexOf('to ')===0)v.push(x.slice(3))});return v}
function matches(input,correct){var a=norm(input);if(!a)return false;var v=variants(String(correct).replace(/\([^)]*\)/g,''));
  return v.indexOf(a)>=0||v.indexOf(a.indexOf('to ')===0?a.slice(3):a)>=0}

/* ================= dates ================= */
function ymd(d){var m=d.getMonth()+1,dd=d.getDate();return d.getFullYear()+'-'+(m<10?'0':'')+m+'-'+(dd<10?'0':'')+dd}
function today(){return ymd(new Date())}
function addDays(s,n){var p=s.split('-');var d=new Date(+p[0],+p[1]-1,+p[2]);d.setDate(d.getDate()+n);return ymd(d)}

/* ================= course data ================= */
var COURSES=[];          // [{id,title,file,links:[],dict}]
var DATA={};             // id -> {words,sentences,current}
var LOADED={};           // id -> serialized text as loaded (to detect changes)
var LOADED_COURSES='';   // serialized courses.json as loaded ('' = file missing)
var loadProblems=[];
function emptyData(){return {words:[],sentences:[],current:[]}}
function normData(raw){var d=raw&&typeof raw==='object'?raw:{};
  return {words:Array.isArray(d.words)?d.words:[],sentences:Array.isArray(d.sentences)?d.sentences:[],current:Array.isArray(d.current)?d.current:[]}}
function normCourse(c,i){return {id:String(c.id||('course'+i)),title:String(c.title||c.id||'Курс'),file:String(c.file||'words.json'),
  links:Array.isArray(c.links)?c.links:['cambridge'],dict:c.dict==='full'?'full':'essential'}}
function courseJson(d){
  return '{"v":2,\n"current":'+JSON.stringify(d.current||[])+',\n"words":[\n'+(d.words||[]).map(function(w){return JSON.stringify(w)}).join(',\n')+
    '\n],\n"sentences":[\n'+(d.sentences||[]).map(function(s){return JSON.stringify(s)}).join(',\n')+'\n]}\n';
}
function coursesJson(list){return '{"v":1,"courses":[\n'+list.map(function(c){return JSON.stringify(c)}).join(',\n')+'\n]}\n'}
function tagData(cid,d){d.words.forEach(function(x){Object.defineProperty(x,'_c',{value:cid,configurable:true})});
  d.sentences.forEach(function(x){Object.defineProperty(x,'_c',{value:cid,configurable:true})});return d}
function courseById(id){for(var i=0;i<COURSES.length;i++)if(COURSES[i].id===id)return COURSES[i];return null}
function fetchJson(path){return fetch(path,{cache:'no-cache'}).then(function(r){if(r.status===404)return null;if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})}

/* ================= local progress (per device) ================= */
var KEY='wordcards.v1',storageOk=true;
function loadStore(){try{var s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&Array.isArray(s.profiles)){s.progress=s.progress||{};s.prefs=s.prefs||{};return s}}catch(e){storageOk=false}
  return {profiles:[],current:null,progress:{},prefs:{}}}
var store=loadStore();
try{localStorage.setItem(KEY+'.t','1');localStorage.removeItem(KEY+'.t')}catch(e){storageOk=false}
function save(){try{localStorage.setItem(KEY,JSON.stringify(store));storageOk=true}catch(e){storageOk=false}}
var COLORS=['#2b48c8','#d0457a','#16875a','#d9821b','#7a4fd6','#0f8fa3'];
function curProfile(){for(var i=0;i<store.profiles.length;i++)if(store.profiles[i].id===store.current)return store.profiles[i];return null}
function prog(pid){pid=pid||store.current;var p=store.progress[pid];if(!p){p=store.progress[pid]={w:{},days:{}}}return p}
function addProfile(name,color,courses){var p={id:'p'+Date.now().toString(36),name:name.slice(0,20),color:color,courses:courses,accent:'uk'};
  store.profiles.push(p);store.current=p.id;save();return p}
function profCourses(prof){
  var ids=(prof&&Array.isArray(prof.courses)?prof.courses:[]).filter(function(id){return courseById(id)});
  if(!ids.length&&COURSES.length) ids=[COURSES[0].id];
  return ids;
}
function accentOf(prof){return prof&&prof.accent==='us'?'us':'uk'}

/* Spaced repetition. Boxes 0..5; box >= 3 counts as learned.
   A word answered right on the very first try jumps ahead, so a stronger student
   skips what she already knows. */
var INTERVALS=[0,1,2,4,7,14];
function grade(item,ok,objective,pid){
  var p=prog(pid),t=today(),s=p.w[item.id],first=!s;
  s=s||{b:0,r:0,x:0};
  if(ok){s.r++;s.b=first?(objective?3:2):Math.min(5,s.b+1)}else{s.x++;s.b=Math.max(0,s.b-2)}
  s.due=addDays(t,ok?INTERVALS[s.b]:0);s.last=t;p.w[item.id]=s;
  var d=p.days[t]||(p.days[t]={r:0,x:0});if(ok)d.r++;else d.x++;save();
}
function counts(list,pid){var p=prog(pid),l=0,s=0,n=0;list.forEach(function(w){var x=p.w[w.id];if(!x)n++;else if(x.b>=3)l++;else s++});return {l:l,s:s,n:n,t:list.length}}
function act(x){return x&&(x.r+x.x)>0}
function streak(pid){var p=prog(pid),d=today(),n=0;if(!act(p.days[d]))d=addDays(d,-1);while(act(p.days[d])){n++;d=addDays(d,-1)}return n}

/* ================= pool & topics for a profile ================= */
function poolFor(prof){
  var words=[],sents=[];
  profCourses(prof).forEach(function(cid){var d=DATA[cid];if(!d)return;words=words.concat(d.words);sents=sents.concat(d.sentences)});
  return {words:words,sents:sents};
}
function tkey(x){return x._c+'\u0001'+topicOf(x)}
function topicsFor(P,prof){
  var map={},order=[],multi=profCourses(prof).length>1;
  function put(x,kind){var k=tkey(x),t=map[k];
    if(!t){var c=courseById(x._c);t=map[k]={key:k,cid:x._c,name:topicOf(x),course:multi&&c?c.title:'',words:[],sents:[],
      current:!!(DATA[x._c]&&DATA[x._c].current.indexOf(topicOf(x))>=0)};order.push(t)}
    t[kind].push(x)}
  P.words.forEach(function(w){put(w,'words')});P.sents.forEach(function(s){put(s,'sents')});
  return order;
}
function topicState(t,pid){var items=t.words.length?t.words:t.sents,c=counts(items,pid);
  return {c:c,passed:c.t>0&&c.l/c.t>=0.8,started:c.l+c.s>0}}

/* ================= sentences ================= */
function parseSent(s){
  var m=/\[([^\]]+)\]/.exec(s.s||'');
  var parts=m?m[1].split('/').map(function(x){return x.trim()}).filter(Boolean):[];
  var answer=parts[0]||'';
  var full=String(s.s||'').replace(/\[([^\]]+)\]/,function(a,b){return b.split('/')[0].trim()}).replace(/\s+/g,' ').trim();
  var pre=m?String(s.s).slice(0,m.index):'',post=m?String(s.s).slice(m.index+m[0].length):'';
  return {hasGap:!!m,answer:answer,opts:parts.length>1?parts:null,full:full,pre:pre,post:post};
}
function gapOptions(s,ps,words){
  if(ps.opts) return shuffle(ps.opts.slice());
  var group=topicOf(s).split(' · ')[0],seen={};seen[norm(ps.answer)]=1;
  var multi=/\s/.test(ps.answer);
  var cand=words.filter(function(w){return w._c===s._c&&topicOf(w).split(' · ')[0]===group&&(/\s/.test(w.en.trim())===multi)});
  var aw=norm(ps.answer).split(' ');
  function tooClose(x){if(!multi)return false;var xw=norm(x).split(' ');return xw.filter(function(t){return aw.indexOf(t)>=0}).length>=2}
  var picks=[];
  shuffle(cand.slice()).forEach(function(w){var k=norm(w.en);if(picks.length<3&&!seen[k]&&!tooClose(w.en)){seen[k]=1;picks.push(w.en.trim())}});
  if(!picks.length) return null;
  var cap=/^[A-Z]/.test(ps.answer);
  picks=picks.map(function(x){return cap?x.charAt(0).toUpperCase()+x.slice(1):(x==='I'?x:x.charAt(0).toLowerCase()+x.slice(1))});
  return shuffle([ps.answer].concat(picks));
}

/* ================= pronunciation ================= */
var canSpeak=('speechSynthesis' in window)&&typeof SpeechSynthesisUtterance!=='undefined';
var audioCache={};      // word -> {uk,us} | null | 'loading'
function audioKey(t){var x=String(t).toLowerCase().replace(/\([^)]*\)/g,'').trim();if(x.indexOf('to ')===0)x=x.slice(3).trim();return /^[a-z'-]+$/.test(x)?x:null}
function prefetchAudio(text){
  var k=audioKey(text);if(!k||audioCache[k]!==undefined)return;
  audioCache[k]='loading';
  var ctl=typeof AbortController!=='undefined'?new AbortController():null;
  var timer=setTimeout(function(){if(ctl)ctl.abort()},4000);
  fetch('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(k),ctl?{signal:ctl.signal}:{}).then(function(r){return r.ok?r.json():null}).then(function(j){
    clearTimeout(timer);var out={};
    (Array.isArray(j)?j:[]).forEach(function(e){(e.phonetics||[]).forEach(function(p){var a=p&&p.audio;if(!a)return;
      if(/-us\.mp3$/.test(a)&&!out.us)out.us=a;else if(/-uk\.mp3$/.test(a)&&!out.uk)out.uk=a;else if(!out.any)out.any=a})});
    audioCache[k]=(out.us||out.uk||out.any)?out:null;
  }).catch(function(){clearTimeout(timer);audioCache[k]=null});
}
var voiceCache={};
function pickVoice(lang){
  if(voiceCache[lang]!==undefined)return voiceCache[lang];
  var vs=(window.speechSynthesis.getVoices()||[]).filter(function(v){return v.lang&&v.lang.replace('_','-').toLowerCase().indexOf(lang.toLowerCase())===0});
  var best=null,score=-1;
  vs.forEach(function(v){var s=0,n=v.name||'';if(/google|natural|neural|premium|enhanced/i.test(n))s+=3;if(/samantha|daniel|serena|karen|aria|jenny|libby|sonia/i.test(n))s+=2;if(v.localService)s+=1;if(s>score){score=s;best=v}});
  if(vs.length)voiceCache[lang]=best;return best;
}
if(canSpeak&&window.speechSynthesis.addEventListener)window.speechSynthesis.addEventListener('voiceschanged',function(){voiceCache={}});
function tts(text,acc){if(!canSpeak)return;try{window.speechSynthesis.cancel();var lang=acc==='us'?'en-US':'en-GB';
  var u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=.85;var v=pickVoice(lang);if(v)u.voice=v;window.speechSynthesis.speak(u)}catch(e){}}
function speak(text){
  var acc=accentOf(curProfile()),k=audioKey(text),a=k&&audioCache[k];
  if(a&&typeof a==='object'){var url=a[acc]||a.uk||a.us||a.any;
    try{var au=new Audio(url);au.play().catch(function(){tts(text,acc)});return}catch(e){}}
  tts(text,acc);
}
function speakBtn(text){prefetchAudio(text);
  return (canSpeak||audioKey(text))?h('button',{class:'iconbtn','aria-label':'Послушать',onclick:function(e){e.stopPropagation();speak(text)}},icon('sound')):null}
function cleanWord(t){var x=String(t).replace(/\([^)]*\)/g,'').trim();if(/^to\s/i.test(x))x=x.slice(3);return x.trim()}
function dictLinks(w){
  var c=courseById(w._c),links=c?c.links:['cambridge'],acc=accentOf(curProfile()),x=cleanWord(w.en),out=[];
  if(!x)return null;
  if(links.indexOf('cambridge')>=0){
    var book=c&&c.dict==='full'?'english':(acc==='us'?'essential-american-english':'essential-british-english');
    var slug=x.toLowerCase().replace(/[^a-z0-9' -]/g,'').trim().replace(/\s+/g,'-');
    out.push(h('a',{class:'dlink',href:'https://dictionary.cambridge.org/dictionary/'+book+'/'+encodeURIComponent(slug),target:'_blank',rel:'noopener'},'Cambridge',icon('ext')));
  }
  if(links.indexOf('youglish')>=0)
    out.push(h('a',{class:'dlink',href:'https://youglish.com/pronounce/'+encodeURIComponent(x)+'/english/'+acc,target:'_blank',rel:'noopener'},'YouGlish',icon('ext')));
  return out.length?h('div',{class:'dlinks'},out):null;
}

/* ================= ui state ================= */
var pref=store.prefs;
var ui={tab:'learn',topics:new Set(Array.isArray(pref.topics)?pref.topics:[]),mode:pref.mode||'cards',dir:pref.dir||'en',count:pref.count||10,
  sheet:null,session:null,confirmDel:null,confirmReset:false};
function savePrefs(){store.prefs={topics:Array.from(ui.topics),mode:ui.mode,dir:ui.dir,count:ui.count};save()}
var canWrite=false;
var app=$('#app');
var P={words:[],sents:[]};

function render(){
  var prof=curProfile();
  app.replaceChildren();
  if(!prof){app.append(renderOnboard());return}
  P=poolFor(prof);
  app.append(renderHeader(prof));
  var main=h('main',{class:'view wrap'});
  if(!storageOk) main.append(h('div',{class:'notice warn'},'Этот браузер не даёт сохранять прогресс. Статистика пропадёт после закрытия страницы.'));
  if(ui.tab==='stats') add(main,renderStats(prof));
  else if(ui.tab==='words'&&canWrite) add(main,renderEditor());
  else add(main,renderLearn(prof));
  app.append(main,renderNav());
  if(ui.sheet==='profiles') app.append(renderProfileSheet());
  if(ui.session){app.append(renderSessionShell());renderSessionBody()}
}
function brand(){return h('div',{class:'brand'},h('span',{class:'brand-mark'},'Aa'),h('span',null,'Тетрадь слов'))}
function ava(p){return h('span',{class:'ava',style:'background:'+p.color},p.name.charAt(0).toUpperCase())}
function renderHeader(prof){
  return h('header',{class:'top'},h('div',{class:'wrap'},brand(),
    h('button',{class:'chip-prof','aria-label':'Профиль и настройки',onclick:function(){ui.sheet='profiles';ui.confirmDel=null;render()}},ava(prof),h('span',null,prof.name))));
}
function renderNav(){
  var tabs=[['learn','Учить','learn'],['stats','Статистика','stats']];
  if(canWrite) tabs.push(['words','Слова','words']);
  return h('nav',{class:'tabs','aria-label':'Разделы'},h('div',{class:'wrap'},tabs.map(function(t){
    return h('button',{'aria-current':ui.tab===t[0]?'page':null,onclick:function(){ui.tab=t[0];render();window.scrollTo(0,0)}},icon(t[2]),t[1]);
  })));
}

/* ================= onboarding & profiles ================= */
function courseChips(selected,onToggle){
  return h('div',{class:'chips',role:'group','aria-label':'Курсы'},COURSES.map(function(c){
    return h('button',{class:'chip','aria-pressed':String(selected.indexOf(c.id)>=0),onclick:function(){onToggle(c.id)}},c.title)}));
}
function renderOnboard(){
  var color=COLORS[store.profiles.length%COLORS.length],chosen=COURSES.length?[COURSES[0].id]:[];
  var inp=h('input',{id:'ob-name',class:'field',maxlength:'20',placeholder:'Например, Маша',autocomplete:'off','aria-label':'Имя'});
  var err=h('div',{class:'err',hidden:true});
  var sw=h('div',{class:'swatches',role:'group','aria-label':'Цвет'});
  COLORS.forEach(function(c){sw.append(h('button',{class:'sw',style:'background:'+c,'aria-label':'Цвет','aria-pressed':String(c===color),onclick:function(){color=c;
    Array.prototype.forEach.call(sw.children,function(b){b.setAttribute('aria-pressed',String(b===this))},this)}}))});
  var chipsBox=h('div');
  function drawChips(){chipsBox.replaceChildren(courseChips(chosen,function(id){var i=chosen.indexOf(id);if(i>=0)chosen.splice(i,1);else chosen.push(id);drawChips()}))}
  drawChips();
  function go(){var n=inp.value.trim();
    if(!n){err.textContent='Напиши своё имя';err.hidden=false;inp.focus();return}
    if(COURSES.length>1&&!chosen.length){err.textContent='Выбери хотя бы один курс';err.hidden=false;return}
    addProfile(n,color,chosen.slice());ui.tab='learn';ui.topics.clear();render()}
  inp.addEventListener('keydown',function(e){if(e.key==='Enter')go()});
  var list=null;
  if(store.profiles.length){list=h('div',{class:'sec'},h('div',{class:'label'},'Уже есть'),h('div',{class:'plist'},store.profiles.map(function(p){
    return h('button',{class:'pitem',onclick:function(){store.current=p.id;save();render()}},ava(p),h('span',{class:'pn'},p.name))})))}
  return h('div',{class:'wrap ob'},h('div',null,brand()),
    h('h1',null,'Привет! Как тебя зовут?'),
    h('p',{class:'lead'},'Имя нужно, чтобы считать твои выученные слова. Если на этом телефоне занимается кто-то ещё, у каждого будет своя статистика.'),
    h('div',{class:'sec'},inp),
    COURSES.length>1?h('div',{class:'sec'},h('div',{class:'label'},'Что ты учишь'),chipsBox,h('p',{class:'hint',style:'margin:0'},'Можно выбрать несколько.')):null,
    h('div',{class:'sec'},h('div',{class:'label'},'Твой цвет'),sw),
    err,
    h('button',{class:'btn primary big',onclick:go},'Начать'),list);
}
function renderProfileSheet(){
  var cur=curProfile();
  var inp=h('input',{id:'pf-new',class:'field',maxlength:'20',placeholder:'Имя',autocomplete:'off','aria-label':'Новое имя'});
  function addNew(){var n=inp.value.trim();if(!n){inp.focus();return}
    addProfile(n,COLORS[store.profiles.length%COLORS.length],COURSES.length?[COURSES[0].id]:[]);ui.topics.clear();render()}
  inp.addEventListener('keydown',function(e){if(e.key==='Enter')addNew()});
  var items=store.profiles.map(function(p){
    if(ui.confirmDel===p.id) return h('div',{class:'confirm'},h('span',{style:'flex:1;min-width:0'},'Удалить «'+p.name+'» и всю статистику?'),
      h('button',{class:'btn small bad',onclick:function(){store.profiles=store.profiles.filter(function(x){return x.id!==p.id});delete store.progress[p.id];
        if(store.current===p.id)store.current=store.profiles[0]?store.profiles[0].id:null;ui.confirmDel=null;save();if(!store.current)ui.sheet=null;render()}},'Удалить'),
      h('button',{class:'btn small ghost',onclick:function(){ui.confirmDel=null;render()}},'Отмена'));
    return h('div',{style:'display:flex;gap:8px;align-items:center'},
      h('button',{class:'pitem'+(p.id===cur.id?' cur':''),onclick:function(){store.current=p.id;save();ui.topics.clear();render()}},ava(p),h('span',{class:'pn'},p.name),p.id===cur.id?h('span',{class:'hint'},'сейчас'):null),
      h('button',{class:'iconbtn','aria-label':'Удалить '+p.name,onclick:function(){ui.confirmDel=p.id;render()}},icon('trash')));
  });
  var mine=profCourses(cur);
  var settings=h('div',{class:'sec panel'},h('div',{class:'label'},'Настройки: '+cur.name),
    COURSES.length>1?[h('div',{class:'hint'},'Курсы'),courseChips(mine,function(id){var arr=profCourses(cur).slice(),i=arr.indexOf(id);
      if(i>=0){if(arr.length===1)return;arr.splice(i,1)}else arr.push(id);cur.courses=arr;ui.topics.clear();save();render()})]:null,
    h('div',{class:'hint'},'Произношение'),
    h('div',{class:'seg'},[['uk','Британское'],['us','Американское']].map(function(a){
      return h('button',{'aria-pressed':String(accentOf(cur)===a[0]),onclick:function(){cur.accent=a[0];save();render()}},a[1])})));
  var scrim=h('div',{class:'scrim',onclick:function(e){if(e.target===scrim){ui.sheet=null;render()}}},
    h('div',{class:'sheet',role:'dialog','aria-label':'Профиль'},
      h('div',{class:'sheet-h'},h('h2',null,'Кто занимается?'),h('button',{class:'iconbtn','aria-label':'Закрыть',onclick:function(){ui.sheet=null;render()}},icon('close'))),
      h('div',{class:'plist'},items),settings,
      h('div',{class:'sec'},h('div',{class:'label'},'Добавить профиль'),h('div',{style:'display:flex;gap:8px'},inp,h('button',{class:'btn primary',onclick:addNew},'Добавить'))),
      h('p',{class:'hint'},'Профили и статистика хранятся на этом устройстве.')));
  return scrim;
}

/* ================= learn screen ================= */
function planToday(){
  var p=prog(),t=today(),T=topicsFor(P,curProfile());
  var st={};T.forEach(function(x){st[x.key]=topicState(x)});
  var focus=T.filter(function(x){return !st[x.key].passed&&(x.current||st[x.key].started)});
  if(!focus.some(function(x){return x.current})){
    var cur=T.filter(function(x){return x.current&&!st[x.key].passed});
    focus=cur.concat(focus.filter(function(x){return cur.indexOf(x)<0}));
  }
  if(!focus.length) focus=T.filter(function(x){return !st[x.key].passed}).slice(0,2);
  var fk=new Set(focus.map(function(x){return x.key}));
  function box(x){return p.w[x.id].b}
  var dueW=P.words.filter(function(w){var s=p.w[w.id];return s&&s.due<=t}).sort(function(a,b){return box(a)-box(b)}).slice(0,6);
  var dueS=P.sents.filter(function(s){var x=p.w[s.id];return x&&x.due<=t}).slice(0,6);
  var newW=shuffle(P.words.filter(function(w){return !p.w[w.id]&&fk.has(tkey(w))}));
  if(newW.length<4){var more=P.words.filter(function(w){return !p.w[w.id]&&!fk.has(tkey(w))&&!st[tkey(w)].passed});newW=newW.concat(more.slice(0,6))}
  var newS=shuffle(P.sents.filter(function(s){return !p.w[s.id]&&fk.has(tkey(s))}));
  var words=dueW.concat(newW.slice(0,Math.max(4,10-dueW.length))).slice(0,10);
  var sents=dueS.concat(newS).slice(0,Math.max(3,10-words.length));
  var items=words.map(function(w){return autoWordItem(w)}).concat(sents.map(function(s){return autoSentItem(s)}).filter(Boolean));
  var nNew=words.filter(function(w){return !p.w[w.id]}).length+sents.filter(function(s){return !p.w[s.id]}).length;
  return {items:shuffle(items),nNew:nNew,nDue:items.length-nNew};
}
function autoWordItem(w){var s=prog().w[w.id];
  if(!s) return {k:'w',x:w,mode:'cards',dir:'en'};
  if(s.b>=3) return {k:'w',x:w,mode:'write',dir:'ru'};
  return {k:'w',x:w,mode:'test',dir:Math.random()<.5?'en':'ru'};
}
function autoSentItem(s){var ps=parseSent(s),canPuzzle=!!s.ru&&ps.full.split(' ').length>1;
  if(ps.hasGap&&canPuzzle) return {k:'s',x:s,mode:Math.random()<.5?'gap':'puzzle'};
  if(ps.hasGap) return {k:'s',x:s,mode:'gap'};
  if(canPuzzle) return {k:'s',x:s,mode:'puzzle'};
  return null;
}
function renderLearn(prof){
  if(!P.words.length&&!P.sents.length){
    return [h('div',{class:'panel empty'},h('h2',null,'Слов пока нет'),
      h('p',{class:'lead'},canWrite?'Добавьте слова на вкладке «Слова», и здесь появятся карточки.':'Попроси родителей добавить слова из учебника.'),
      canWrite?h('button',{class:'btn primary',style:'margin-top:14px',onclick:function(){ui.tab='words';render()}},'Добавить слова'):null)];
  }
  var p=prog(),t=today(),td=p.days[t]||{r:0,x:0},st=streak();
  var due=P.words.concat(P.sents).filter(function(w){var s=p.w[w.id];return s&&s.due<=t}).length;
  var out=[];
  out.push(h('div',null,h('h1',{class:'hello'},'Привет, '+prof.name+'!'),
    h('p',{class:'lead'},due?'Есть слова, которые пора повторить.':'Нажми «Занятие на сегодня» или выбери тему.')));
  out.push(h('div',{class:'today'},
    h('span',{class:'pill'},'Сегодня ',h('b',null,td.r+td.x),' '+plural(td.r+td.x,'ответ','ответа','ответов')),
    h('span',{class:'pill'},'Серия ',h('b',null,st),' '+plural(st,'день','дня','дней')),
    due?h('span',{class:'pill due'},'Повторить ',h('b',null,due)):null));

  var plan=planToday();
  out.push(h('button',{class:'today-btn',disabled:!plan.items.length,onclick:function(){startSession(planToday().items)}},
    h('b',null,'Занятие на сегодня'),
    h('span',null,plan.items.length?(plan.nDue?plan.nDue+' на повторение':'')+(plan.nDue&&plan.nNew?' · ':'')+(plan.nNew?plan.nNew+' '+plural(plan.nNew,'новое','новых','новых'):''):'Всё выучено! Загляни завтра')));

  // topics
  var T=topicsFor(P,prof),st2={};T.forEach(function(x){st2[x.key]=topicState(x)});
  var keys=new Set(T.map(function(x){return x.key}));ui.topics.forEach(function(k){if(!keys.has(k))ui.topics.delete(k)});
  var focus=T.filter(function(x){return !st2[x.key].passed&&(x.current||st2[x.key].started)});
  var passed=T.filter(function(x){return st2[x.key].passed});
  var rest=T.filter(function(x){return !st2[x.key].passed&&focus.indexOf(x)<0});
  if(!focus.length){focus=rest.slice(0,3);rest=rest.slice(3)}
  function grid(list){var g=h('div',{class:'topics'});list.forEach(function(x){g.append(topicBtn(x,st2[x.key]))});return g}
  out.push(h('section',{class:'sec'},h('div',{class:'label'},'Сейчас учим'),grid(focus)));
  if(rest.length) out.push(fold('rest','Другие темы · '+rest.length,grid(rest)));
  if(passed.length) out.push(fold('passed','Пройдено · '+passed.length,grid(passed)));

  // custom training
  var sel=T.filter(function(x){return ui.topics.has(x.key)});
  var src=sel.length?sel:T;
  var selWords=[],selSents=[];src.forEach(function(x){selWords=selWords.concat(x.words);selSents=selSents.concat(x.sents)});
  var sentOk=selSents.filter(function(s){return autoSentItem(s)}).length>0;
  var modes=[['cards','Карточки','Переверни и проверь себя'],['test','Тест','Выбери перевод из 4'],['write','Диктант','Напиши по-английски']];
  if(sentOk){modes.push(['gap','Пропуск','Вставь слово в предложение']);modes.push(['puzzle','Пазл','Собери предложение'])}
  if(!sentOk&&(ui.mode==='gap'||ui.mode==='puzzle'))ui.mode='cards';
  var isSent=ui.mode==='gap'||ui.mode==='puzzle';
  var dirs=[['en','EN → RU'],['ru','RU → EN'],['mix','Вперемешку']];
  var cnts=[[10,'10'],[20,'20'],[30,'30'],['all','Все']];
  var avail=isSent?selSents.filter(function(s){var it=autoSentItem(s);return it&&(ui.mode==='gap'?parseSent(s).hasGap:!!s.ru)}).length:selWords.length;
  var n=ui.count==='all'?avail:Math.min(ui.count,avail);
  var tooFew=ui.mode==='test'&&distinct(selWords.length?selWords:P.words)<2;
  out.push(h('section',{class:'sec panel',id:'custom'},
    h('div',{class:'label'},'Своя тренировка'),
    h('p',{class:'hint',style:'margin:0'},sel.length?'Выбрано тем: '+sel.length+'. Нажми на тему ещё раз, чтобы убрать.':'Нажми на темы выше, чтобы выбрать. Без выбора — все темы.'),
    h('div',{class:'modes'},modes.map(function(m){return h('button',{class:'mode','aria-pressed':String(ui.mode===m[0]),onclick:function(){ui.mode=m[0];savePrefs();render()}},h('b',null,m[1]),h('small',null,m[2]))})),
    h('div',{class:'row2'},
      (ui.mode==='cards'||ui.mode==='test')?h('div',{class:'sec'},h('div',{class:'label'},'Направление'),h('div',{class:'seg'},dirs.map(function(d){return h('button',{'aria-pressed':String(ui.dir===d[0]),onclick:function(){ui.dir=d[0];savePrefs();render()}},d[1])}))):h('div'),
      h('div',{class:'sec'},h('div',{class:'label'},'Сколько'),h('div',{class:'seg'},cnts.map(function(c){return h('button',{'aria-pressed':String(ui.count===c[0]),onclick:function(){ui.count=c[0];savePrefs();render()}},c[1])})))),
    h('button',{class:'btn primary big',disabled:!n||tooFew,onclick:function(){startSession(buildCustom(selWords,selSents,n))}},'Начать · '+n),
    tooFew?h('p',{class:'hint',style:'margin:0'},'Для теста нужно хотя бы два разных слова.'):null,
    sel.length&&selWords.length?h('button',{class:'btn ghost',onclick:function(){startSession(shuffle(selWords.slice()).map(function(w){return {k:'w',x:w,mode:'test',dir:'en'}}))}},'Уже знаю эти темы — быстрая проверка'):null));
  return out;
}
var foldOpen={};
function fold(id,title,body){
  var d=h('details',{class:'fold',open:foldOpen[id]?true:null},h('summary',null,h('span',null,title),h('span',{class:'hint'},'показать')),body);
  d.addEventListener('toggle',function(){foldOpen[id]=d.open});return d;
}
function distinct(list){var s={};list.forEach(function(w){s[w.ru]=1});return Object.keys(s).length}
function topicBtn(t,st){
  var c=st.c,lp=c.t?c.l/c.t*100:0,sp=c.t?c.s/c.t*100:0;
  var isEx=t.words.some(function(w){return w.ex});
  return h('button',{class:'topic','aria-pressed':String(ui.topics.has(t.key)),onclick:function(){
      if(ui.topics.has(t.key))ui.topics.delete(t.key);else ui.topics.add(t.key);savePrefs();render();
      var cst=$('#custom');if(cst&&ui.topics.size===1)cst.scrollIntoView({behavior:'smooth',block:'nearest'})}},
    (t.current||isEx||t.course)?h('span',{class:'tagrow'},t.current?h('span',{class:'tag cur'},'сейчас в школе'):null,isEx?h('span',{class:'tag'},'пример'):null,t.course?h('span',{class:'tag mute'},t.course):null):null,
    h('span',{class:'tn'},t.name),
    h('span',{class:'meter','aria-hidden':'true'},h('i',{class:'m-l',style:'width:'+lp+'%'}),h('i',{class:'m-s',style:'width:'+sp+'%'})),
    h('span',{class:'tm'},h('span',null,'выучено '+c.l+' из '+c.t),t.sents.length?h('span',null,'+'+t.sents.length+' предл.'):null));
}
function buildCustom(words,sents,n){
  var p=prog(),t=today();
  if(ui.mode==='gap'||ui.mode==='puzzle'){
    var ok=sents.filter(function(s){var ps=parseSent(s);return ui.mode==='gap'?ps.hasGap:(!!s.ru&&ps.full.split(' ').length>1)});
    return orderByNeed(ok).slice(0,n).map(function(s){return {k:'s',x:s,mode:ui.mode}});
  }
  return shuffle(orderByNeed(words).slice(0,n)).map(function(w){
    var dir=ui.mode==='write'?'ru':ui.dir==='mix'?(Math.random()<.5?'en':'ru'):ui.dir;return {k:'w',x:w,mode:ui.mode,dir:dir}});
  function orderByNeed(list){var due=[],fresh=[],rest=[];
    list.forEach(function(w){var s=p.w[w.id];if(!s)fresh.push(w);else if(s.due<=t)due.push(w);else rest.push(w)});
    var byBox=function(a,b){return p.w[a.id].b-p.w[b.id].b};
    return shuffle(due).sort(byBox).concat(shuffle(fresh),shuffle(rest).sort(byBox))}
}

/* ================= session ================= */
function startSession(items){
  if(!items||!items.length)return;
  ui.session={items:items,i:0,results:[],state:'q'};
  document.body.classList.add('lock');render();
}
function endSession(){ui.session=null;document.body.classList.remove('lock');render()}
function renderSessionShell(){
  return h('div',{class:'session',role:'dialog','aria-label':'Тренировка'},
    h('div',{class:'s-top'},
      h('button',{class:'iconbtn','aria-label':'Закончить',onclick:endSession},icon('close')),
      h('div',{class:'s-prog','aria-hidden':'true'},h('i',{id:'sbar',style:'width:0%'})),
      h('div',{class:'s-count',id:'scount'})),
    h('div',{class:'s-body',id:'sbody'}));
}
function renderSessionBody(){
  var s=ui.session,body=$('#sbody');if(!s||!body)return;
  var total=s.items.length;
  $('#sbar').style.width=(Math.min(s.i,total)/total*100)+'%';
  $('#scount').textContent=Math.min(s.i+1,total)+' / '+total;
  body.replaceChildren();body.scrollTop=0;
  if(s.i>=total){$('#scount').textContent=total+' / '+total;body.append(renderSummary());return}
  var it=s.items[s.i],x=it.x;
  var spk=h('span',{id:'spk'});
  body.append(h('div',{class:'s-tools'},h('span',{class:'s-topic'},topicOf(x)),spk));
  var after=h('div',{id:'after',class:'sec'});
  var ctx={it:it,body:body,after:after,
    setSpeak:function(text){var b=speakBtn(text);spk.replaceChildren();if(b)spk.append(b)},
    record:function(ok){grade(x,ok,it.mode!=='cards');s.results.push({it:it,ok:ok})},
    reveal:function(){ // after answer: pronunciation + dictionary links
      if(it.k==='w'){ctx.setSpeak(x.en);var dl=dictLinks(x);if(dl)after.append(dl)}
      else ctx.setSpeak(parseSent(x).full);
    },
    next:function(){if(ui.session!==s)return;s.i++;s.state='q';renderSessionBody()}};
  ({cards:itemCards,test:itemTest,write:itemWrite,gap:itemGap,puzzle:itemPuzzle})[it.mode](ctx,s);
}
function nextBtn(ctx){var b=h('button',{class:'btn primary',id:'nextbtn',onclick:ctx.next},'Дальше');return b}

function itemCards(ctx,s){
  var w=ctx.it.x,dir=ctx.it.dir,front=dir==='en'?w.en:w.ru,back=dir==='en'?w.ru:w.en;
  if(dir==='en')ctx.setSpeak(w.en);else prefetchAudio(w.en);
  var card=h('button',{class:'card',id:'card','aria-label':'Карточка: '+front+'. Нажми, чтобы перевернуть',onclick:flip},
    h('div',{class:'inner'},
      h('div',{class:'face front'},h('span',{class:'lang'},dir==='en'?'English':'Русский'),h('span',{class:'word'},front),h('span',{class:'tap'},'Нажми, чтобы перевернуть')),
      h('div',{class:'face back'},h('span',{class:'lang'},dir==='en'?'Русский':'English'),h('span',{class:'word'},back),h('span',{class:'sub'},front))));
  var acts=h('div',{class:'acts one',id:'acts'},h('button',{class:'btn primary',onclick:flip},'Показать перевод'));
  ctx.body.append(card,acts,ctx.after);
  function flip(){
    if(s.state!=='q'){$('#card').classList.toggle('flipped');return}
    s.state='a';$('#card').classList.add('flipped');ctx.reveal();
    acts.className='acts';acts.replaceChildren(
      h('button',{class:'btn bad',onclick:function(){ctx.record(false);ctx.next()}},'Не помню'),
      h('button',{class:'btn good',onclick:function(){ctx.record(true);ctx.next()}},'Помню'));
    acts.lastChild.focus({preventScroll:true});
  }
}
function itemTest(ctx,s){
  var w=ctx.it.x,dir=ctx.it.dir,key=dir==='en'?'ru':'en',front=dir==='en'?w.en:w.ru;
  if(dir==='en')ctx.setSpeak(w.en);else prefetchAudio(w.en);
  var pool=P.words.length>1?P.words:[w];
  var same=pool.filter(function(o){return o.id!==w.id&&tkey(o)===tkey(w)&&norm(o[key])!==norm(w[key])});
  var other=pool.filter(function(o){return o.id!==w.id&&tkey(o)!==tkey(w)&&norm(o[key])!==norm(w[key])});
  var picks=[],seen={};seen[norm(w[key])]=1;
  shuffle(same).concat(shuffle(other)).forEach(function(o){if(picks.length<3&&!seen[norm(o[key])]){seen[norm(o[key])]=1;picks.push(o)}});
  var opts=shuffle([w].concat(picks));
  ctx.body.append(h('div',{class:'prompt'},h('span',{class:'lang'},dir==='en'?'Как перевести?':'Как по-английски?'),h('span',{class:'word'},front)));
  var box=h('div',{class:'opts'}),next=h('div',{class:'acts one',id:'acts'});
  opts.forEach(function(o,idx){box.append(h('button',{class:'opt','data-k':String(idx+1),onclick:function(){
    if(s.state!=='q')return;s.state='a';var ok=o.id===w.id;
    Array.prototype.forEach.call(box.children,function(b,j){b.disabled=true;if(opts[j].id===w.id)b.classList.add('ok')});
    if(!ok)this.classList.add('no');
    ctx.record(ok);ctx.reveal();next.append(nextBtn(ctx));$('#nextbtn').focus({preventScroll:true});
  }},o[key]))});
  ctx.body.append(box,next,ctx.after);
}
function itemWrite(ctx,s){
  var w=ctx.it.x;prefetchAudio(w.en);
  ctx.body.append(h('div',{class:'prompt'},h('span',{class:'lang'},'Напиши по-английски'),h('span',{class:'word'},w.ru)));
  var inp=h('input',{id:'wr-in',class:'field write-field',autocomplete:'off',autocapitalize:'off',autocorrect:'off',spellcheck:'false',enterkeyhint:'done',placeholder:'…','aria-label':'Ответ'});
  var res=h('div');
  var acts=h('div',{class:'acts',id:'acts'},
    h('button',{class:'btn ghost',onclick:function(){check(true)}},'Не знаю'),
    h('button',{class:'btn primary',onclick:function(){check(false)}},'Проверить'));
  inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();if(s.state==='q')check(false);else ctx.next()}});
  ctx.body.append(inp,res,acts,ctx.after);
  setTimeout(function(){if($('#wr-in'))$('#wr-in').focus()},60);
  function check(giveUp){
    if(s.state!=='q')return;var val=inp.value;
    if(!giveUp&&!norm(val)){inp.focus();return}
    s.state='a';var ok=!giveUp&&matches(val,w.en);ctx.record(ok);inp.readOnly=true;
    res.replaceChildren(ok?h('div',{class:'result ok'},'Верно!',h('span',{class:'big'},w.en)):
      h('div',{class:'result no'},giveUp?'Правильный ответ':'Почти. Правильно так:',h('span',{class:'big'},w.en),(!giveUp&&norm(val))?h('span',null,'Твой ответ: ',h('s',null,val)):null));
    ctx.reveal();acts.className='acts one';acts.replaceChildren(nextBtn(ctx));$('#nextbtn').focus({preventScroll:true});
  }
}
function itemGap(ctx,s){
  var x=ctx.it.x,ps=parseSent(x),opts=gapOptions(x,ps,P.words);
  var blank=h('span',{class:'blank'},' ');
  ctx.body.append(h('div',{class:'prompt'},h('span',{class:'lang'},'Вставь слово'),
    h('span',{class:'gap-sent'},ps.pre,blank,ps.post),x.ru?h('span',{class:'sub'},x.ru):null));
  var next=h('div',{class:'acts one',id:'acts'});
  function finish(ok,given){
    s.state='a';ctx.record(ok);blank.textContent=ps.answer;blank.classList.add(ok?'ok':'no');
    if(!ok&&given)ctx.after.append(h('div',{class:'result no'},'Правильно: '+ps.full,h('span',null,'Твой ответ: ',h('s',null,given))));
    ctx.reveal();next.replaceChildren(nextBtn(ctx));$('#nextbtn').focus({preventScroll:true});
  }
  if(opts){
    var box=h('div',{class:'opts'});
    opts.forEach(function(o,idx){box.append(h('button',{class:'opt','data-k':String(idx+1),onclick:function(){
      if(s.state!=='q')return;var ok=norm(o)===norm(ps.answer);
      Array.prototype.forEach.call(box.children,function(b,j){b.disabled=true;if(norm(opts[j])===norm(ps.answer))b.classList.add('ok')});
      if(!ok)this.classList.add('no');finish(ok,null);
    }},o))});
    ctx.body.append(box,next,ctx.after);
  }else{
    var inp=h('input',{id:'gap-in',class:'field write-field',autocomplete:'off',autocapitalize:'off',autocorrect:'off',spellcheck:'false',enterkeyhint:'done','aria-label':'Слово'});
    var go=function(){if(s.state!=='q'){ctx.next();return}if(!norm(inp.value)){inp.focus();return}inp.readOnly=true;finish(norm(inp.value)===norm(ps.answer),inp.value)};
    inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();go()}});
    next.className='acts one';next.append(h('button',{class:'btn primary',onclick:go},'Проверить'));
    ctx.body.append(inp,next,ctx.after);setTimeout(function(){if($('#gap-in'))$('#gap-in').focus()},60);
  }
}
function itemPuzzle(ctx,s){
  var x=ctx.it.x,ps=parseSent(x),tokens=ps.full.split(' ');
  var order=tokens.map(function(_,i){return i});
  for(var tries=0;tries<6;tries++){shuffle(order);if(order.some(function(v,i){return v!==i}))break}
  var placed=[];
  ctx.body.append(h('div',{class:'prompt'},h('span',{class:'lang'},'Собери предложение'),h('span',{class:'word',style:'font-size:clamp(1.2rem,5.5vw,1.7rem)'},x.ru||'')));
  var ans=h('div',{class:'pans','aria-label':'Ответ'}),bank=h('div',{class:'pbank'});
  var acts=h('div',{class:'acts one',id:'acts'});
  function draw(){
    ans.replaceChildren();bank.replaceChildren();
    if(!placed.length)ans.append(h('span',{class:'hint'},'Нажимай на слова по порядку'));
    placed.forEach(function(ti,pi){ans.append(h('button',{class:'ptile',disabled:s.state!=='q',onclick:function(){placed.splice(pi,1);draw()}},tokens[ti]))});
    order.forEach(function(ti){var used=placed.indexOf(ti)>=0;
      bank.append(h('button',{class:'ptile'+(used?' used':''),disabled:used||s.state!=='q','aria-hidden':used?'true':null,onclick:function(){placed.push(ti);draw();if(placed.length===tokens.length)check()}},tokens[ti]))});
  }
  function check(){
    var got=placed.map(function(i){return tokens[i]}).join(' ');
    var ok=norm(got)===norm(ps.full);
    s.state='a';ctx.record(ok);ans.classList.add(ok?'ok':'no');draw();
    if(!ok)ctx.after.append(h('div',{class:'result no'},'Правильно так:',h('span',{class:'big'},ps.full)));
    else ctx.after.append(h('div',{class:'result ok'},'Верно!'));
    ctx.reveal();acts.replaceChildren(nextBtn(ctx));$('#nextbtn').focus({preventScroll:true});
  }
  acts.append(h('button',{class:'btn ghost',onclick:function(){if(s.state==='q'){placed=[];draw()}}},'Сбросить'));
  draw();ctx.body.append(ans,bank,acts,ctx.after);
}
function renderSummary(){
  var s=ui.session,r=s.results,right=r.filter(function(x){return x.ok}).length,total=r.length,pct=total?right/total:0;
  var msg=pct===1?'Идеально!':pct>=.8?'Отлично!':pct>=.5?'Хорошо, ещё чуть-чуть':'Давай повторим ещё раз';
  var seen={},wrong=[];r.forEach(function(x){if(!x.ok&&!seen[x.it.x.id]){seen[x.it.x.id]=1;wrong.push(x.it)}});
  return h('div',{class:'sum'},
    h('div',{class:'score'},h('div',{class:'n'},right+' / '+total),h('div',{class:'msg'},msg)),
    wrong.length?h('div',{class:'panel sec'},h('div',{class:'label'},'Над этим поработать'),h('div',{class:'mist'},wrong.map(function(it){
      return it.k==='w'?h('div',null,h('span',null,it.x.en),h('span',null,it.x.ru)):h('div',null,h('span',null,parseSent(it.x).full),h('span',null,it.x.ru||''))}))):null,
    wrong.length?h('button',{class:'btn primary big',onclick:function(){startSession(shuffle(wrong.map(function(it){return Object.assign({},it)})))}},'Повторить ошибки'):null,
    h('button',{class:'btn '+(wrong.length?'ghost':'primary')+' big',onclick:function(){startSession(planToday().items)}},'Ещё занятие'),
    h('button',{class:'btn ghost',onclick:endSession},'Готово'));
}
document.addEventListener('keydown',function(e){
  var s=ui.session;if(!s||s.i>=s.items.length)return;
  var tg=e.target&&e.target.tagName;
  if(tg==='INPUT'||tg==='TEXTAREA')return;
  if(tg==='BUTTON'&&(e.key==='Enter'||e.key===' '))return; // the focused button handles it natively
  var m=s.items[s.i].mode;
  if(m==='cards'){
    if((e.key===' '||e.key==='Enter')&&s.state==='q'){e.preventDefault();$('#acts button').click()}
    else if(s.state==='a'&&(e.key==='ArrowLeft'||e.key==='1')){var b=$('#acts .bad');if(b)b.click()}
    else if(s.state==='a'&&(e.key==='ArrowRight'||e.key==='2')){var g=$('#acts .good');if(g)g.click()}
  }else if(m==='test'||m==='gap'){var o=$('.opt[data-k="'+e.key+'"]');if(o&&s.state==='q')o.click()}
  if(s.state==='a'&&e.key==='Enter'&&m!=='cards'){var n=$('#nextbtn');if(n){e.preventDefault();n.click()}}
});

/* ================= stats ================= */
function renderStats(prof){
  var p=prog(),c=counts(P.words),t=today(),out=[];
  out.push(h('div',null,h('h1',{class:'hello'},'Статистика'),h('p',{class:'lead'},prof.name+' · '+nw(c.t)+(P.sents.length?' и '+P.sents.length+' '+plural(P.sents.length,'предложение','предложения','предложений'):''))));
  var tot=c.t||1;
  out.push(h('section',{class:'sec'},
    h('div',{class:'tiles'},
      h('div',{class:'tile l'},h('span',{class:'n'},c.l),h('span',{class:'t'},'выучено')),
      h('div',{class:'tile s'},h('span',{class:'n'},c.s),h('span',{class:'t'},'в процессе')),
      h('div',{class:'tile'},h('span',{class:'n'},c.n),h('span',{class:'t'},'новые'))),
    h('div',{class:'bigbar','aria-hidden':'true'},h('i',{style:'width:'+(c.l/tot*100)+'%;background:var(--good)'}),h('i',{style:'width:'+(c.s/tot*100)+'%;background:var(--accent);opacity:.55'})),
    h('p',{class:'hint',style:'margin:0'},'Слово считается выученным, когда его вспомнили правильно несколько раз с перерывами в несколько дней. Если ответить верно с первого раза, слово сразу засчитается.')));
  var r7=0,x7=0;for(var i=0;i<7;i++){var d=p.days[addDays(t,-i)];if(d){r7+=d.r;x7+=d.x}}
  var td=p.days[t]||{r:0,x:0},st=streak();
  out.push(h('div',{class:'panel facts'},
    h('div',{class:'fact'},h('b',null,st),h('span',null,'серия, '+plural(st,'день','дня','дней'))),
    h('div',{class:'fact'},h('b',null,td.r+td.x),h('span',null,'ответов сегодня')),
    h('div',{class:'fact'},h('b',null,(r7+x7)?Math.round(r7/(r7+x7)*100)+'%':'—'),h('span',null,'верно за 7 дней'))));
  out.push(h('section',{class:'sec panel'},h('div',{class:'label'},'Последние 14 дней'),chart(p,t),
    h('div',{class:'legend'},h('span',null,h('i',{style:'background:var(--good)'}),'верно'),h('span',null,h('i',{style:'background:var(--bad)'}),'ошибки'))));
  var T=topicsFor(P,prof);
  if(T.length) out.push(h('section',{class:'sec'},h('div',{class:'label'},'По темам'),h('div',{class:'panel',style:'padding-block:8px'},T.map(function(x){
    var cc=topicState(x).c;
    return h('div',{class:'trow'},h('span',{class:'tn'},x.name+(x.course?' · '+x.course:'')),h('span',{class:'tc'},cc.l+' из '+cc.t),
      h('span',{class:'meter'},h('i',{class:'m-l',style:'width:'+(cc.t?cc.l/cc.t*100:0)+'%'}),h('i',{class:'m-s',style:'width:'+(cc.t?cc.s/cc.t*100:0)+'%'})));
  }))));
  var hard=P.words.filter(function(w){var s=p.w[w.id];return s&&s.x>0}).sort(function(a,b){var A=p.w[a.id],B=p.w[b.id];return (B.x/(B.r+B.x))-(A.x/(A.r+A.x))||B.x-A.x}).slice(0,8);
  if(hard.length) out.push(h('section',{class:'sec'},h('div',{class:'label'},'Трудные слова'),h('div',{class:'panel hard',style:'padding-block:6px'},hard.map(function(w){
    return h('div',null,h('b',null,w.en),h('span',null,w.ru),h('em',null,'ошибок: '+p.w[w.id].x))}))));
  if(store.profiles.length>1){
    out.push(h('section',{class:'sec'},h('div',{class:'label'},'Все на этом устройстве'),h('div',{class:'panel scroll-x'},h('table',{class:'ptable'},
      h('thead',null,h('tr',null,h('th',null,'Имя'),h('th',null,'Выучено'),h('th',null,'Сегодня'),h('th',null,'Серия'))),
      h('tbody',null,store.profiles.map(function(pr){var cc=counts(poolFor(pr).words,pr.id),dd=prog(pr.id).days[t]||{r:0,x:0};
        return h('tr',null,h('td',null,pr.name),h('td',null,cc.l),h('td',null,dd.r+dd.x),h('td',null,streak(pr.id)))}))))));
  }
  out.push(ui.confirmReset?h('div',{class:'confirm'},h('span',{style:'flex:1;min-width:0'},'Обнулить статистику '+prof.name+'?'),
      h('button',{class:'btn small bad',onclick:function(){store.progress[prof.id]={w:{},days:{}};save();ui.confirmReset=false;render()}},'Обнулить'),
      h('button',{class:'btn small ghost',onclick:function(){ui.confirmReset=false;render()}},'Отмена')):
    h('div',{style:'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap'},
      h('p',{class:'hint',style:'margin:0'},'Статистика хранится на этом устройстве.'),
      h('button',{class:'btn small ghost',onclick:function(){ui.confirmReset=true;render()}},'Обнулить')));
  return out;
}
function chart(p,t){
  var days=[],max=0;for(var i=13;i>=0;i--){var k=addDays(t,-i),d=p.days[k]||{r:0,x:0};days.push({k:k,r:d.r,x:d.x});max=Math.max(max,d.r+d.x)}
  var W=336,H=150,L=28,B=20,T=8,cw=(W-L)/14,ch=H-B-T,top=max<=10?10:Math.ceil(max/10)*10,NS='http://www.w3.org/2000/svg';
  function s(tag,a,txt){var e=document.createElementNS(NS,tag);for(var k in a)e.setAttribute(k,a[k]);if(txt!=null)e.textContent=txt;return e}
  var svg=s('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-label':'Ответы по дням за 14 дней'});
  [0,top/2,top].forEach(function(v){var y=T+ch-(v/top)*ch;svg.append(s('line',{x1:L,x2:W,y1:y,y2:y,class:'gl'}));svg.append(s('text',{x:L-6,y:y+3,'text-anchor':'end',class:'ax'},v))});
  days.forEach(function(d,i){var x=L+i*cw+cw*.18,bw=cw*.64,hr=d.r/top*ch,hx=d.x/top*ch,y0=T+ch;
    if(d.r)svg.append(s('rect',{x:x,y:y0-hr,width:bw,height:hr,rx:2,class:'br'}));
    if(d.x)svg.append(s('rect',{x:x,y:y0-hr-hx,width:bw,height:hx,rx:2,class:'bx'}));
    if(i%2===1||i===13)svg.append(s('text',{x:x+bw/2,y:H-6,'text-anchor':'middle',class:'ax'},+d.k.slice(8)));
  });
  return h('div',{class:'chart'},svg);
}

/* ================= editor (admin, localhost or #admin) ================= */
var ed={draft:null,cid:null,q:'',editing:null,confirmTopic:null,saving:false,msg:'',courseForm:null,lastTopic:''};
var DRAFT_KEY='wordcards.draft2';
function snapshot(){var data={};COURSES.forEach(function(c){data[c.id]=clone(DATA[c.id]||emptyData())});return {courses:clone(COURSES),data:data}}
function draft(){if(!ed.draft)ed.draft=snapshot();return ed.draft}
function dD(cid){var d=draft();if(!d.data[cid])d.data[cid]=emptyData();return d.data[cid]}
function dirtyFiles(){
  if(!ed.draft)return [];var out=[],d=ed.draft;
  var cj=coursesJson(d.courses);if(cj!==LOADED_COURSES)out.push({path:'courses.json',text:cj});
  d.courses.forEach(function(c){var t=courseJson(d.data[c.id]||emptyData());if(t!==LOADED[c.id])out.push({path:c.file,text:t})});
  return out;
}
function changed(){try{localStorage.setItem(DRAFT_KEY,JSON.stringify(ed.draft))}catch(e){}}
function clearDraft(){try{localStorage.removeItem(DRAFT_KEY)}catch(e){}}
function applyDraft(){
  var d=ed.draft;COURSES=d.courses.map(normCourse);DATA={};
  COURSES.forEach(function(c){DATA[c.id]=tagData(c.id,normData(clone(d.data[c.id]||emptyData())));LOADED[c.id]=courseJson(DATA[c.id])});
  LOADED_COURSES=coursesJson(COURSES);ed.draft=null;clearDraft();
}
function parseInput(text,defTopic){
  var words=[],sents=[],bad=[],topic=defTopic;
  text.split(/\r?\n/).forEach(function(raw){
    var line=raw.trim();if(!line)return;
    if(line.charAt(0)==='#'){topic=line.replace(/^#+\s*/,'').trim()||defTopic;return}
    line=line.replace(/^\d+[.)]\s+/,'');
    var parts=line.split(/\s*(?:\t|\s[—–-]\s|\s=\s)\s*/).filter(Boolean);
    if(parts.length<2&&!/\[[^\]]+\]/.test(line)){
      parts=line.split(/\s*(?:[—–]|=|;)\s*/).filter(Boolean);
      if(parts.length<2){bad.push(line);return}
    }
    var en=parts[0],ru=parts.slice(1).join(', ');
    if(/[а-яё]/i.test(en)&&ru&&!/[а-яё]/i.test(ru)){var t=en;en=ru;ru=t}
    if(/\[[^\]]+\]/.test(en)||/[.!?]$/.test(en)) sents.push({s:en,ru:ru||'',topic:topic});
    else if(ru) words.push({en:en,ru:ru,topic:topic});
    else bad.push(line);
  });
  return {words:words,sents:sents,bad:bad};
}
function renderEditor(){
  var d=draft();
  if(!ed.cid||!d.courses.some(function(c){return c.id===ed.cid}))ed.cid=d.courses[0]?d.courses[0].id:null;
  var files=dirtyFiles(),dirty=files.length>0,out=[];
  out.push(h('div',null,h('h1',{class:'hello'},'Слова'),h('p',{class:'lead'},'Добавьте слова и предложения, затем «Сохранить». Файлы запишутся в папку проекта — останется commit и push.')));
  out.push(h('div',{class:'savebar'+(dirty?' dirty':'')},
    h('span',{class:'st'},h('span',{class:'dot'}),ed.saving?'Сохраняю…':dirty?'Не сохранено: '+files.map(function(f){return f.path}).join(', '):'Всё сохранено в файлы'),
    dirty?h('div',{style:'display:flex;gap:8px'},
      h('button',{class:'btn small ghost',disabled:ed.saving,onclick:function(){ed.draft=null;ed.editing=null;ed.courseForm=null;clearDraft();render()}},'Отменить'),
      h('button',{class:'btn small primary',disabled:ed.saving,onclick:saveAll},canDir?'Сохранить':'Скачать файлы')):null));
  if(ed.msg) out.push(h('div',{class:'notice warn'},ed.msg));
  if(loadProblems.length) out.push(h('div',{class:'notice warn'},'Не удалось прочитать: '+loadProblems.join(', ')+'. Проверьте запятые в файле.'));
  if(canDir) out.push(h('div',{style:'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap'},
    h('span',{class:'hint'},dirHandle?'Папка проекта: '+dirHandle.name:'При первом сохранении выберите папку проекта — ту, где лежит index.html.'),
    dirHandle?h('button',{class:'btn small ghost',onclick:function(){pickDir().then(render).catch(function(){})}},'Сменить папку'):null));
  else out.push(h('p',{class:'hint',style:'margin:0'},'В этом браузере файлы скачаются в «Загрузки». Чтобы сохранять сразу в папку проекта, откройте страницу в Chrome или Edge.'));

  // courses
  var chips=h('div',{class:'chips'},d.courses.map(function(c){
    return h('button',{class:'chip','aria-pressed':String(c.id===ed.cid),onclick:function(){ed.cid=c.id;ed.courseForm=null;ed.confirmTopic=null;render()}},c.title)}),
    h('button',{class:'chip add',onclick:function(){ed.courseForm={isNew:true,title:'',links:['cambridge'],dict:'essential'};render()}},'+ Курс'));
  var cur=d.courses.filter(function(c){return c.id===ed.cid})[0];
  var courseSec=h('section',{class:'sec'},h('div',{class:'label'},'Курс'),chips);
  if(ed.courseForm) courseSec.append(courseFormEl());
  else if(cur) courseSec.append(h('div',{style:'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap'},
    h('span',{class:'hint'},'Файл: '+cur.file+' · ссылки: '+(cur.links.length?cur.links.map(function(l){return l==='youglish'?'YouGlish':'Cambridge'}).join(', '):'нет')+' · словарь: '+(cur.dict==='full'?'полный':'простой')),
    h('button',{class:'btn small ghost',onclick:function(){ed.courseForm={isNew:false,title:cur.title,links:cur.links.slice(),dict:cur.dict};render()}},'Настроить')));
  out.push(courseSec);
  if(!cur){out.push(h('p',{class:'hint'},'Создайте первый курс.'));return out}
  var cd=dD(cur.id);

  // add form
  var topics=topicNames(cd);
  var dl=h('datalist',{id:'topic-list'},topics.map(function(t){return h('option',{value:t})}));
  var tIn=h('input',{id:'add-topic',class:'field',list:'topic-list',placeholder:'Тема, например Unit 3 · Food',autocomplete:'off',value:ed.lastTopic||'','aria-label':'Тема'});
  var ta=h('textarea',{id:'add-words',class:'field',placeholder:'apple — яблоко\nto be hungry — быть голодным\n[She/Her/He] is my sister. — Она моя сестра.\nThis is my bag. — Это моя сумка.','aria-label':'Слова и предложения'});
  var HINT='Слово: «apple — яблоко». Предложение с пропуском: слово в [скобках], варианты через «/». Предложение с точкой в конце без скобок станет пазлом. Строка «# Тема» меняет тему для строк ниже.';
  var info=h('div',{class:'hint'},HINT);
  var addBtn=h('button',{class:'btn primary',disabled:true,onclick:doAdd},'Добавить');
  ta.addEventListener('input',function(){var r=parseInput(ta.value,tIn.value.trim()||NOTOPIC),n=r.words.length+r.sents.length;
    addBtn.disabled=!n;addBtn.textContent=n?'Добавить: '+(r.words.length?nw(r.words.length):'')+(r.words.length&&r.sents.length?' и ':'')+(r.sents.length?r.sents.length+' '+plural(r.sents.length,'предложение','предложения','предложений'):''):'Добавить';
    info.textContent=r.bad.length?'Не понял строку: «'+r.bad[0]+'». Нужен разделитель: тире с пробелами, = или табуляция.':HINT;
    info.className=r.bad.length?'err':'hint'});
  function doAdd(){
    var def=tIn.value.trim()||NOTOPIC,r=parseInput(ta.value,def),dup=0,added=0;
    var have={};cd.words.forEach(function(w){have[topicOf(w)+'|'+norm(w.en)]=1});cd.sentences.forEach(function(s){have['s|'+topicOf(s)+'|'+norm(s.s)]=1});
    r.words.forEach(function(x){var k=x.topic+'|'+norm(x.en);if(have[k]){dup++;return}have[k]=1;cd.words.push({id:uid('w'),en:x.en,ru:x.ru,topic:x.topic});added++});
    r.sents.forEach(function(x){var k='s|'+x.topic+'|'+norm(x.s);if(have[k]){dup++;return}have[k]=1;var o={id:uid('s'),s:x.s,topic:x.topic};if(x.ru)o.ru=x.ru;cd.sentences.push(o);added++});
    ed.lastTopic=tIn.value.trim();changed();render();
    toast('Добавлено: '+added+(dup?' · повторы пропущены: '+dup:'')+'. Не забудьте «Сохранить».');
  }
  out.push(h('section',{class:'sec panel addgrid'},h('div',{class:'label'},'Добавить в «'+cur.title+'»'),dl,tIn,ta,info,addBtn));
  if(cd.words.some(function(w){return w.ex})||cd.sentences.some(function(s){return s.ex}))
    out.push(h('div',{class:'notice'},h('span',null,'В курсе есть примерные слова.'),
      h('button',{class:'btn small ghost',onclick:function(){cd.words=cd.words.filter(function(w){return !w.ex});cd.sentences=cd.sentences.filter(function(s){return !s.ex});changed();render()}},'Убрать примеры')));
  var q=h('input',{id:'w-search',class:'field',type:'search',placeholder:'Найти слово или предложение',autocomplete:'off',value:ed.q,'aria-label':'Поиск'});
  var list=h('div',{id:'wlist',class:'sec'});
  q.addEventListener('input',function(){ed.q=q.value;fillList(list,cd)});
  out.push(h('section',{class:'sec'},h('div',{class:'label'},'Словарь курса'),
    h('p',{class:'hint',style:'margin:0'},'Звёздочка — тема, которую сейчас проходят. Она будет первой в «Занятии на сегодня».'),q,list));
  fillList(list,cd);
  return out;
}
function topicNames(cd){var seen={},out=[];cd.words.concat(cd.sentences).forEach(function(x){var t=topicOf(x);if(!seen[t]){seen[t]=1;out.push(t)}});return out}
function courseFormEl(){
  var f=ed.courseForm,d=draft();
  var tIn=h('input',{id:'cf-title',class:'field',value:f.title,placeholder:'Название, например 10 класс',maxlength:'40','aria-label':'Название курса'});
  tIn.addEventListener('input',function(){f.title=tIn.value});
  function linkChk(id,label){return h('label',{class:'check'},h('input',{type:'checkbox',checked:f.links.indexOf(id)>=0,onchange:function(e){var i=f.links.indexOf(id);if(e.target.checked&&i<0)f.links.push(id);if(!e.target.checked&&i>=0)f.links.splice(i,1)}}),label)}
  var seg=h('div',{class:'seg'},[['essential','Простой'],['full','Полный']].map(function(o){return h('button',{'aria-pressed':String(f.dict===o[0]),onclick:function(){f.dict=o[0];render()}},o[1])}));
  return h('div',{class:'panel sec'},
    h('div',{class:'label'},f.isNew?'Новый курс':'Настройки курса'),tIn,
    h('div',{class:'hint'},'Кнопки после ответа'),
    linkChk('cambridge','Cambridge — озвучка носителем и примеры'),
    linkChk('youglish','YouGlish — слово в настоящих видео'),
    h('div',{class:'hint'},'Словарь Cambridge: простой (Essential, для младших) или полный (с британской и американской озвучкой)'),seg,
    h('div',{style:'display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap'},
      h('button',{class:'btn small ghost',onclick:function(){ed.courseForm=null;render()}},'Отмена'),
      h('button',{class:'btn small primary',onclick:function(){
        var title=f.title.trim();if(!title){tIn.focus();return}
        if(f.isNew){
          var base=title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'course',id=base,n=2;
          while(d.courses.some(function(c){return c.id===id}))id=base+'-'+(n++);
          if(id==='course'){id='course-'+(d.courses.length+1);while(d.courses.some(function(c){return c.id===id}))id+='x'}
          d.courses.push({id:id,title:title,file:'words/'+id+'.json',links:f.links.slice(),dict:f.dict});d.data[id]=emptyData();ed.cid=id;
        }else{var c=d.courses.filter(function(c){return c.id===ed.cid})[0];if(c){c.title=title;c.links=f.links.slice();c.dict=f.dict}}
        ed.courseForm=null;changed();render();
      }},f.isNew?'Создать':'Готово')));
}
function gapMark(s){var m=/\[([^\]]+)\]/.exec(s);if(!m)return [s];return [s.slice(0,m.index),h('mark',null,m[1]),s.slice(m.index+m[0].length)]}
function fillList(list,cd){
  var q=norm(ed.q);list.replaceChildren();
  function hit(x){return !q||norm(x.en||x.s||'').indexOf(q)>=0||norm(x.ru||'').indexOf(q)>=0||norm(topicOf(x)).indexOf(q)>=0}
  var W=cd.words.filter(hit),S=cd.sentences.filter(hit);
  if(!W.length&&!S.length){list.append(h('p',{class:'hint'},q?'Ничего не нашлось.':'Курс пуст. Добавьте первые слова выше.'));return}
  topicNames({words:W,sentences:S}).forEach(function(tn){
    var ws=W.filter(function(w){return topicOf(w)===tn}),ss=S.filter(function(s){return topicOf(s)===tn});
    var isCur=cd.current.indexOf(tn)>=0;
    var g=h('div',{class:'group panel',style:'padding-block:6px'});
    if(ed.confirmTopic===tn) g.append(h('div',{class:'confirm',style:'margin:6px 0'},h('span',{style:'flex:1;min-width:0'},'Удалить тему «'+tn+'» целиком?'),
      h('button',{class:'btn small bad',onclick:function(){cd.words=cd.words.filter(function(w){return topicOf(w)!==tn});cd.sentences=cd.sentences.filter(function(s){return topicOf(s)!==tn});
        cd.current=cd.current.filter(function(c){return c!==tn});ed.confirmTopic=null;changed();render()}},'Удалить'),
      h('button',{class:'btn small ghost',onclick:function(){ed.confirmTopic=null;fillList(list,cd)}},'Отмена')));
    else g.append(h('div',{class:'group-h'},h('h3',null,tn),h('div',{style:'display:flex;align-items:center;gap:6px'},
      h('span',{class:'gc'},ws.length+(ss.length?' + '+ss.length+' пр.':'')),
      h('button',{class:'iconbtn starbtn','aria-pressed':String(isCur),'aria-label':(isCur?'Убрать из текущих: ':'Сделать текущей: ')+tn,style:'width:38px;height:38px',
        onclick:function(){if(isCur)cd.current=cd.current.filter(function(c){return c!==tn});else cd.current.push(tn);changed();render()}},icon('star')),
      h('button',{class:'iconbtn','aria-label':'Удалить тему '+tn,style:'width:38px;height:38px',onclick:function(){ed.confirmTopic=tn;fillList(list,cd)}},icon('trash')))));
    ws.forEach(function(w){
      if(ed.editing===w.id){
        var e1=h('input',{class:'field',value:w.en,'aria-label':'По-английски',id:'e-en'}),e2=h('input',{class:'field',value:w.ru,'aria-label':'Перевод',id:'e-ru'}),e3=h('input',{class:'field',value:topicOf(w),list:'topic-list','aria-label':'Тема',id:'e-tp'});
        g.append(h('div',{class:'wedit'},e1,e2,h('div',{class:'full'},e3,
          h('button',{class:'btn small ghost',onclick:function(){ed.editing=null;fillList(list,cd)}},'Отмена'),
          h('button',{class:'btn small primary',onclick:function(){var en=e1.value.trim(),ru=e2.value.trim();if(!en||!ru)return;w.en=en;w.ru=ru;w.topic=e3.value.trim()||NOTOPIC;delete w.ex;ed.editing=null;changed();render()}},'Готово'))));
      } else g.append(h('div',{class:'wrow'},h('span',{class:'en'},w.en),h('span',{class:'ru'},w.ru),h('span',{class:'ra'},
        h('button',{'aria-label':'Изменить '+w.en,svg:ICON.edit,onclick:function(){ed.editing=w.id;fillList(list,cd);var f=$('#e-en');if(f)f.focus()}}),
        h('button',{'aria-label':'Удалить '+w.en,svg:ICON.trash,onclick:function(){cd.words=cd.words.filter(function(x){return x.id!==w.id});changed();render()}}))));
    });
    ss.forEach(function(s){
      if(ed.editing===s.id){
        var e1=h('input',{class:'field',value:s.s,'aria-label':'Предложение',id:'e-en'}),e2=h('input',{class:'field',value:s.ru||'','aria-label':'Перевод',id:'e-ru'});
        g.append(h('div',{class:'wedit'},e1,e2,h('div',{class:'full'},
          h('button',{class:'btn small ghost',onclick:function(){ed.editing=null;fillList(list,cd)}},'Отмена'),
          h('button',{class:'btn small primary',onclick:function(){var v=e1.value.trim();if(!v)return;s.s=v;if(e2.value.trim())s.ru=e2.value.trim();else delete s.ru;delete s.ex;ed.editing=null;changed();render()}},'Готово'))));
      } else g.append(h('div',{class:'srow'},h('span',{class:'s'},gapMark(s.s)),h('span',{class:'r'},s.ru||'без перевода — только пропуск'),h('span',{class:'ra'},
        h('button',{'aria-label':'Изменить предложение',svg:ICON.edit,onclick:function(){ed.editing=s.id;fillList(list,cd);var f=$('#e-en');if(f)f.focus()}}),
        h('button',{'aria-label':'Удалить предложение',svg:ICON.trash,onclick:function(){cd.sentences=cd.sentences.filter(function(x){return x.id!==s.id});changed();render()}}))));
    });
    list.append(g);
  });
}

/* ---------- writing files into the project folder ----------
   Chrome/Edge: pick the project folder once (remembered), files are written directly.
   Other browsers: changed files are downloaded instead. */
var canDir=typeof window.showDirectoryPicker==='function';
var dirHandle=null;
function idb(mode,fn){return new Promise(function(res,rej){try{var r=indexedDB.open('wordcards',1);
  r.onupgradeneeded=function(){r.result.createObjectStore('kv')};r.onerror=function(){rej(r.error)};
  r.onsuccess=function(){var tx=r.result.transaction('kv',mode),q=fn(tx.objectStore('kv'));tx.oncomplete=function(){res(q&&q.result)};tx.onerror=function(){rej(tx.error)}}}catch(e){rej(e)}})}
function loadDir(){return idb('readonly',function(s){return s.get('project-dir')}).then(function(x){dirHandle=x||null}).catch(function(){})}
async function pickDir(){
  var d=await window.showDirectoryPicker({id:'wordcards',mode:'readwrite'});
  try{await d.getFileHandle('index.html')}catch(e){throw {name:'WrongFolder'}}
  dirHandle=d;await idb('readwrite',function(s){s.put(d,'project-dir')}).catch(function(){});
}
async function writePath(path,text){
  var parts=path.split('/'),name=parts.pop(),dir=dirHandle;
  for(var i=0;i<parts.length;i++)dir=await dir.getDirectoryHandle(parts[i],{create:true});
  var fh=await dir.getFileHandle(name,{create:true}),w=await fh.createWritable();await w.write(text);await w.close();
}
async function saveAll(){
  if(ed.saving)return;var files=dirtyFiles();if(!files.length)return;
  if(!canDir){downloadFiles(files);return}
  ed.saving=true;ed.msg='';render();
  try{
    if(!dirHandle)await pickDir();
    var perm=await dirHandle.queryPermission({mode:'readwrite'});
    if(perm!=='granted')perm=await dirHandle.requestPermission({mode:'readwrite'});
    if(perm!=='granted')throw {name:'NotAllowedError'};
    for(var i=0;i<files.length;i++)await writePath(files[i].path,files[i].text);
    applyDraft();ed.saving=false;render();toast('Записано: '+files.map(function(f){return f.path}).join(', ')+'. Теперь commit и push.');
  }catch(e){
    ed.saving=false;
    if(e&&e.name==='AbortError'){render();return}
    ed.msg=e&&e.name==='WrongFolder'?'В выбранной папке нет index.html. Выберите папку проекта, где лежит сайт.':
      e&&e.name==='NotAllowedError'?'Браузер не дал записать файлы. Нажмите «Сохранить» ещё раз и разрешите доступ.':'Не получилось записать файлы. Нажмите «Сменить папку» и выберите папку проекта.';
    render();
  }
}
function downloadFiles(files){
  files.forEach(function(f,i){setTimeout(function(){
    var a=document.createElement('a'),url=URL.createObjectURL(new Blob([f.text],{type:'application/json'}));
    a.href=url;a.download=f.path.split('/').pop();document.body.append(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},4000)},i*400)});
  ed.msg='Скачано: '+files.map(function(f){return f.path.split('/').pop()}).join(', ')+'. Разложите по местам в папке проекта: '+files.map(function(f){return f.path}).join(', ')+'.';
  applyDraft();render();
}
var toastT;
function toast(msg){var old=$('.toast');if(old)old.remove();var t=h('div',{class:'toast',role:'status'},msg);document.body.append(t);clearTimeout(toastT);toastT=setTimeout(function(){t.remove()},3500)}

/* ================= boot ================= */
function isAdmin(){var hn=location.hostname;return /^#admin$/i.test(location.hash)||hn==='localhost'||hn==='127.0.0.1'}
canWrite=isAdmin();
window.addEventListener('hashchange',function(){var c=isAdmin();if(c!==canWrite){canWrite=c;if(!c&&ui.tab==='words')ui.tab='learn';if(!ui.session)render()}});
function bootScreen(msg){app.replaceChildren(h('div',{class:'wrap ob'},brand(),msg))}
async function boot(){
  if(location.protocol==='file:'){
    bootScreen(h('div',{class:'panel'},h('h2',{class:'bh'},'Откройте через PhpStorm'),
      h('p',{class:'lead'},'Если открыть index.html двойным кликом, браузер не даёт странице прочитать файлы со словами. Откройте index.html в PhpStorm и нажмите значок браузера справа вверху. Адрес начнётся с localhost.')));
    return;
  }
  bootScreen(h('p',{class:'lead'},'Загружаю слова…'));
  try{
    var cj=await fetchJson('courses.json');
    if(cj&&Array.isArray(cj.courses)&&cj.courses.length){COURSES=cj.courses.map(normCourse);LOADED_COURSES=coursesJson(COURSES)}
    else{COURSES=[normCourse({id:'main',title:'Мой курс',file:'words.json'},0)];LOADED_COURSES=''}
    await Promise.all(COURSES.map(function(c){
      return fetchJson(c.file).then(function(raw){DATA[c.id]=tagData(c.id,normData(raw));LOADED[c.id]=raw?courseJson(DATA[c.id]):null})
        .catch(function(){loadProblems.push(c.file);DATA[c.id]=emptyData();LOADED[c.id]=null});
    }));
    if(canWrite){await loadDir();
      try{var s=localStorage.getItem(DRAFT_KEY);if(s){ed.draft=JSON.parse(s);if(!dirtyFiles().length){ed.draft=null;clearDraft()}}}catch(e){}}
    render();
  }catch(e){
    bootScreen(h('div',{class:'panel'},h('h2',{class:'bh'},'Не получилось загрузить слова'),
      h('p',{class:'lead'},'Проверьте интернет и обновите страницу.'),
      canWrite?h('p',{class:'hint'},'Для взрослых: проверьте courses.json — нет ли лишней или пропущенной запятой.'):null,
      h('button',{class:'btn primary',style:'margin-top:12px',onclick:function(){location.reload()}},'Обновить')));
  }
}
boot();
})();
