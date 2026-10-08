(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)};
function h(tag,attrs){
  var el=document.createElement(tag),a=attrs||{};
  for(var k in a){var v=a[k]; if(v==null||v===false) continue;
    if(k==='class') el.className=v;
    else if(k.slice(0,2)==='on') el.addEventListener(k.slice(2),v);
    else if(k==='svg') el.innerHTML=v;
    else if(k==='value') el.value=v;
    else el.setAttribute(k,v===true?'':v);}
  for(var i=2;i<arguments.length;i++) add(el,arguments[i]);
  return el;
}
function add(el,k){ if(k==null||k===false) return; if(Array.isArray(k)){k.forEach(function(x){add(el,x)});return;} el.append(k instanceof Node?k:document.createTextNode(String(k))); }
var ICON={
  close:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  sound:'<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 9a4 4 0 010 6M19 6.5a8 8 0 010 11"/></svg>',
  learn:'<svg viewBox="0 0 24 24"><rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 4h12a2 2 0 012 2v11"/></svg>',
  stats:'<svg viewBox="0 0 24 24"><path d="M5 20V11M11 20V5M17 20v-6M3 20h18"/></svg>',
  words:'<svg viewBox="0 0 24 24"><path d="M4 6h16M4 11h16M4 16h10M4 21h6"/></svg>',
  edit:'<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
  trash:'<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>'
};
function icon(n){return h('span',{class:'ic','aria-hidden':'true',svg:ICON[n]})}

/* ---------- data ---------- */
var WORDS=[]; /* loaded from words.json at boot */
var NOTOPIC='Без темы';
function topicOf(w){return (w.topic&&String(w.topic).trim())||NOTOPIC}
function topicList(list){var seen={},out=[];list.forEach(function(w){var t=topicOf(w);if(!seen[t]){seen[t]=1;out.push(t)}});return out}
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}
function uid(){return 'w'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}

/* ---------- dates ---------- */
function ymd(d){var m=d.getMonth()+1,dd=d.getDate();return d.getFullYear()+'-'+(m<10?'0':'')+m+'-'+(dd<10?'0':'')+dd}
function today(){return ymd(new Date())}
function addDays(s,n){var p=s.split('-');var d=new Date(+p[0],+p[1]-1,+p[2]);d.setDate(d.getDate()+n);return ymd(d)}

/* ---------- local progress (per device) ---------- */
var KEY='wordcards.v1',storageOk=true;
function loadStore(){try{var s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&Array.isArray(s.profiles)){s.progress=s.progress||{};s.prefs=s.prefs||{};return s}}catch(e){storageOk=false}
  return {profiles:[],current:null,progress:{},prefs:{}}}
var store=loadStore();
try{localStorage.setItem(KEY+'.t','1');localStorage.removeItem(KEY+'.t')}catch(e){storageOk=false}
function save(){try{localStorage.setItem(KEY,JSON.stringify(store));storageOk=true}catch(e){storageOk=false}}
var COLORS=['#2b48c8','#d0457a','#16875a','#d9821b','#7a4fd6','#0f8fa3'];
function curProfile(){for(var i=0;i<store.profiles.length;i++) if(store.profiles[i].id===store.current) return store.profiles[i];return null}
function prog(pid){pid=pid||store.current;var p=store.progress[pid];if(!p){p=store.progress[pid]={w:{},days:{}}}return p}
function addProfile(name,color){var p={id:'p'+Date.now().toString(36),name:name.slice(0,20),color:color};store.profiles.push(p);store.current=p.id;save();return p}
var INTERVALS=[0,1,2,4,7,14];
function grade(w,ok){var p=prog(),t=today();var s=p.w[w.id]||{b:0,r:0,x:0};
  if(ok){s.r++;s.b=Math.min(5,s.b+1)}else{s.x++;s.b=Math.max(0,s.b-2)}
  s.due=addDays(t,ok?INTERVALS[s.b]:0);s.last=t;p.w[w.id]=s;
  var d=p.days[t]||(p.days[t]={r:0,x:0});if(ok)d.r++;else d.x++;save()}
function counts(list,pid){var p=prog(pid),l=0,s=0,n=0;list.forEach(function(w){var x=p.w[w.id];if(!x)n++;else if(x.b>=3)l++;else s++});return {l:l,s:s,n:n,t:list.length}}
function streak(pid){var p=prog(pid),t=today(),n=0,d=t;
  if(!act(p.days[d])) d=addDays(d,-1);
  while(act(p.days[d])){n++;d=addDays(d,-1)} return n}
function act(x){return x&&(x.r+x.x)>0}
function plural(n,a,b,c){var m=n%10,mm=n%100;if(m===1&&mm!==11)return a;if(m>=2&&m<=4&&(mm<10||mm>=20))return b;return c}

/* ---------- ui state ---------- */
var pref=store.prefs;
var ui={tab:'learn',topics:new Set(Array.isArray(pref.topics)?pref.topics:[]),mode:pref.mode||'cards',dir:pref.dir||'en',count:pref.count||10,sheet:null,session:null,confirmDel:null,confirmReset:false};
function savePrefs(){store.prefs={topics:Array.from(ui.topics),mode:ui.mode,dir:ui.dir,count:ui.count};save()}
var canWrite=false;
var app=$('#app');

function render(){
  var prof=curProfile();
  app.replaceChildren();
  if(!prof){app.append(renderOnboard());return}
  app.append(renderHeader(prof));
  var main=h('main',{class:'view wrap'});
  if(!storageOk) main.append(h('div',{class:'notice warn'},'Этот браузер не даёт сохранять прогресс. Статистика пропадёт после закрытия страницы.'));
  if(ui.tab==='stats') add(main,renderStats(prof));
  else if(ui.tab==='words'&&canWrite) add(main,renderWords());
  else add(main,renderLearn(prof));
  app.append(main,renderNav());
  if(ui.sheet==='profiles') app.append(renderProfileSheet());
  if(ui.session){app.append(renderSessionShell());renderSessionBody()}
}

function renderHeader(prof){
  return h('header',{class:'top'},h('div',{class:'wrap'},
    h('div',{class:'brand'},h('span',{class:'brand-mark'},'Aa'),h('span',null,'Тетрадь слов')),
    h('button',{class:'chip-prof','aria-label':'Сменить профиль',onclick:function(){ui.sheet='profiles';ui.confirmDel=null;render()}},
      h('span',{class:'ava',style:'background:'+prof.color},prof.name.charAt(0).toUpperCase()),h('span',null,prof.name))));
}
function renderNav(){
  var tabs=[['learn','Учить','learn'],['stats','Статистика','stats']];
  if(canWrite) tabs.push(['words','Слова','words']);
  return h('nav',{class:'tabs','aria-label':'Разделы'},h('div',{class:'wrap'},tabs.map(function(t){
    return h('button',{'aria-current':ui.tab===t[0]?'page':null,onclick:function(){ui.tab=t[0];render();window.scrollTo(0,0)}},icon(t[2]),t[1]);
  })));
}

/* ---------- onboarding & profiles ---------- */
function renderOnboard(){
  var color=COLORS[store.profiles.length%COLORS.length];
  var inp=h('input',{id:'ob-name',class:'field',maxlength:'20',placeholder:'Например, Маша',autocomplete:'off','aria-label':'Имя'});
  var err=h('div',{class:'err',hidden:true},'Напиши своё имя');
  var sw=h('div',{class:'swatches',role:'group','aria-label':'Цвет'});
  COLORS.forEach(function(c){sw.append(h('button',{class:'sw',style:'background:'+c,'aria-label':'Цвет','aria-pressed':String(c===color),onclick:function(){color=c;Array.prototype.forEach.call(sw.children,function(b){b.setAttribute('aria-pressed',String(b.style.background===this.style.background))},this)}}))});
  function go(){var n=inp.value.trim();if(!n){err.hidden=false;inp.focus();return}addProfile(n,color);ui.tab='learn';render()}
  inp.addEventListener('keydown',function(e){if(e.key==='Enter')go()});
  var list=null;
  if(store.profiles.length){list=h('div',{class:'sec'},h('div',{class:'label'},'Уже есть'),h('div',{class:'plist'},store.profiles.map(function(p){
    return h('button',{class:'pitem',onclick:function(){store.current=p.id;save();render()}},h('span',{class:'ava',style:'background:'+p.color},p.name.charAt(0).toUpperCase()),h('span',{class:'pn'},p.name));})))}
  return h('div',{class:'wrap ob'},
    h('div',null,h('div',{class:'brand'},h('span',{class:'brand-mark'},'Aa'),h('span',null,'Тетрадь слов'))),
    h('h1',null,'Привет! Как тебя зовут?'),
    h('p',{class:'lead'},'Имя нужно, чтобы считать твои выученные слова. Если на этом телефоне занимается кто-то ещё, у каждого будет своя статистика.'),
    h('div',{class:'sec'},inp,err),
    h('div',{class:'sec'},h('div',{class:'label'},'Твой цвет'),sw),
    h('button',{class:'btn primary big',onclick:go},'Начать'),
    list);
}
function renderProfileSheet(){
  var cur=store.current;
  var inp=h('input',{id:'pf-new',class:'field',maxlength:'20',placeholder:'Имя подруги или друга',autocomplete:'off','aria-label':'Новое имя'});
  function addNew(){var n=inp.value.trim();if(!n){inp.focus();return}addProfile(n,COLORS[store.profiles.length%COLORS.length]);ui.sheet=null;render()}
  inp.addEventListener('keydown',function(e){if(e.key==='Enter')addNew()});
  var items=store.profiles.map(function(p){
    if(ui.confirmDel===p.id) return h('div',{class:'confirm'},h('span',{style:'flex:1;min-width:0'},'Удалить «'+p.name+'» и всю статистику?'),
      h('button',{class:'btn small bad',onclick:function(){store.profiles=store.profiles.filter(function(x){return x.id!==p.id});delete store.progress[p.id];if(store.current===p.id)store.current=store.profiles[0]?store.profiles[0].id:null;ui.confirmDel=null;save();if(!store.current)ui.sheet=null;render()}},'Удалить'),
      h('button',{class:'btn small ghost',onclick:function(){ui.confirmDel=null;render()}},'Отмена'));
    return h('div',{style:'display:flex;gap:8px;align-items:center'},
      h('button',{class:'pitem'+(p.id===cur?' cur':''),onclick:function(){store.current=p.id;save();ui.sheet=null;render()}},
        h('span',{class:'ava',style:'background:'+p.color},p.name.charAt(0).toUpperCase()),h('span',{class:'pn'},p.name),p.id===cur?h('span',{class:'hint'},'сейчас'):null),
      h('button',{class:'iconbtn','aria-label':'Удалить '+p.name,onclick:function(){ui.confirmDel=p.id;render()}},icon('trash')));
  });
  var scrim=h('div',{class:'scrim',onclick:function(e){if(e.target===scrim){ui.sheet=null;render()}}},
    h('div',{class:'sheet',role:'dialog','aria-label':'Кто занимается'},
      h('div',{class:'sheet-h'},h('h2',null,'Кто занимается?'),h('button',{class:'iconbtn','aria-label':'Закрыть',onclick:function(){ui.sheet=null;render()}},icon('close'))),
      h('div',{class:'plist'},items),
      h('div',{class:'sec'},h('div',{class:'label'},'Добавить профиль'),h('div',{style:'display:flex;gap:8px'},inp,h('button',{class:'btn primary',onclick:addNew},'Добавить'))),
      h('p',{class:'hint'},'Профили и статистика хранятся на этом устройстве.')));
  return scrim;
}

/* ---------- learn ---------- */
function poolWords(){if(!ui.topics.size)return WORDS;return WORDS.filter(function(w){return ui.topics.has(topicOf(w))})}
function renderLearn(prof){
  if(!WORDS.length){
    return [h('div',{class:'panel empty'},h('h2',null,'Слов пока нет'),
      h('p',{class:'lead'},canWrite?'Добавьте слова из учебника на вкладке «Слова», и здесь появятся карточки.':'Попроси родителей добавить слова из учебника.'),
      canWrite?h('button',{class:'btn primary',style:'margin-top:14px',onclick:function(){ui.tab='words';render()}},'Добавить слова'):null)];
  }
  var all=topicList(WORDS);
  ui.topics.forEach(function(t){if(all.indexOf(t)<0)ui.topics.delete(t)});
  var p=prog(),t=today(),td=p.days[t]||{r:0,x:0};
  var due=WORDS.filter(function(w){var s=p.w[w.id];return s&&s.due<=t}).length;
  var st=streak();
  var out=[];
  out.push(h('div',null,h('h1',{class:'hello'},'Привет, '+prof.name+'!'),
    h('p',{class:'lead'},due?'Есть слова, которые пора повторить.':'Выбери тему и начинай.')));
  out.push(h('div',{class:'today'},
    h('span',{class:'pill'},'Сегодня ',h('b',null,td.r+td.x),' '+plural(td.r+td.x,'карточка','карточки','карточек')),
    h('span',{class:'pill'},'Серия ',h('b',null,st),' '+plural(st,'день','дня','дней')),
    due?h('span',{class:'pill due'},'Повторить ',h('b',null,due)):null));

  var grid=h('div',{class:'topics'});
  var allBtn=topicBtn('Все темы',WORDS,!ui.topics.size,function(){ui.topics.clear();savePrefs();render()});
  grid.append(allBtn);
  all.forEach(function(tn){var list=WORDS.filter(function(w){return topicOf(w)===tn});
    grid.append(topicBtn(tn,list,ui.topics.has(tn),function(){if(ui.topics.has(tn))ui.topics.delete(tn);else ui.topics.add(tn);savePrefs();render()},list.some(function(w){return w.ex})))});
  out.push(h('section',{class:'sec'},h('div',{class:'label'},'Темы · можно выбрать несколько'),grid));

  var modes=[['cards','Карточки','Переверни и проверь себя'],['test','Тест','Выбери перевод из 4'],['write','Диктант','Напиши слово по-английски']];
  out.push(h('section',{class:'sec'},h('div',{class:'label'},'Как учим'),h('div',{class:'modes'},modes.map(function(m){
    return h('button',{class:'mode','aria-pressed':String(ui.mode===m[0]),onclick:function(){ui.mode=m[0];savePrefs();render()}},h('b',null,m[1]),h('small',null,m[2]));}))));

  var dirs=[['en','EN → RU'],['ru','RU → EN'],['mix','Вперемешку']];
  var cnts=[[10,'10'],[20,'20'],[30,'30'],['all','Все']];
  out.push(h('div',{class:'row2'},
    ui.mode==='write'?h('section',{class:'sec'},h('div',{class:'label'},'Направление'),h('p',{class:'hint',style:'margin:0;padding:10px 0'},'В диктанте видишь русское слово и пишешь английское.')):
    h('section',{class:'sec'},h('div',{class:'label'},'Направление'),h('div',{class:'seg'},dirs.map(function(d){return h('button',{'aria-pressed':String(ui.dir===d[0]),onclick:function(){ui.dir=d[0];savePrefs();render()}},d[1])}))),
    h('section',{class:'sec'},h('div',{class:'label'},'Сколько слов'),h('div',{class:'seg'},cnts.map(function(c){return h('button',{'aria-pressed':String(ui.count===c[0]),onclick:function(){ui.count=c[0];savePrefs();render()}},c[1])})))));

  var pool=poolWords();var n=ui.count==='all'?pool.length:Math.min(ui.count,pool.length);
  var tooFew=ui.mode==='test'&&distinctAnswers(pool.length?pool:WORDS)<2;
  out.push(h('button',{class:'btn primary big',disabled:!n||tooFew,onclick:function(){startSession(buildQueue(pool,n))}},'Начать · '+n+' '+plural(n,'слово','слова','слов')));
  if(tooFew) out.push(h('p',{class:'hint'},'Для теста нужно хотя бы два разных слова.'));
  return out;
}
function distinctAnswers(list){var s={};list.forEach(function(w){s[w.ru]=1});return Object.keys(s).length}
function topicBtn(name,list,on,fn,isEx){
  var c=counts(list),lp=c.t?c.l/c.t*100:0,sp=c.t?c.s/c.t*100:0;
  return h('button',{class:'topic','aria-pressed':String(on),onclick:fn},
    isEx?h('span',{class:'tag'},'пример'):null,
    h('span',{class:'tn'},name),
    h('span',{class:'meter','aria-hidden':'true'},h('i',{class:'m-l',style:'width:'+lp+'%'}),h('i',{class:'m-s',style:'width:'+sp+'%'})),
    h('span',{class:'tm'},h('span',null,c.l+' из '+c.t),h('span',null,c.t+' '+plural(c.t,'слово','слова','слов'))));
}
function buildQueue(words,n){
  var p=prog(),t=today(),due=[],fresh=[],rest=[];
  words.forEach(function(w){var s=p.w[w.id];if(!s)fresh.push(w);else if(s.due<=t)due.push(w);else rest.push(w)});
  var byBox=function(a,b){return p.w[a.id].b-p.w[b.id].b};
  shuffle(due).sort(byBox);shuffle(fresh);shuffle(rest).sort(byBox);
  return shuffle(due.concat(fresh,rest).slice(0,n));
}

/* ---------- session ---------- */
function startSession(queue){
  if(!queue.length) return;
  ui.session={queue:queue,i:0,mode:ui.mode,results:[],state:'q',
    dirs:queue.map(function(){return ui.mode==='write'?'ru':ui.dir==='mix'?(Math.random()<.5?'en':'ru'):ui.dir})};
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
var canSpeak=('speechSynthesis' in window)&&typeof SpeechSynthesisUtterance!=='undefined';
function speak(text){if(!canSpeak)return;try{window.speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(text);u.lang='en-GB';u.rate=.85;window.speechSynthesis.speak(u)}catch(e){}}
function speakBtn(text){return canSpeak?h('button',{class:'iconbtn','aria-label':'Послушать',onclick:function(e){e.stopPropagation();speak(text)}},icon('sound')):h('span')}
function norm(s){return String(s).toLowerCase().replace(/ё/g,'е').replace(/[’‘`´]/g,"'").replace(/[.!?()"«»]/g,'').replace(/\s+/g,' ').trim()}
function variants(s){var v=[norm(s)];String(s).split(/[,;\/]/).forEach(function(x){x=norm(x);if(x)v.push(x)});
  v.slice().forEach(function(x){if(x.indexOf('to ')===0)v.push(x.slice(3));});return v}
function matches(input,correct){var a=norm(input);if(!a)return false;var v=variants(correct);
  return v.indexOf(a)>=0||v.indexOf(a.indexOf('to ')===0?a.slice(3):a)>=0}

function renderSessionBody(){
  var s=ui.session,body=$('#sbody');if(!s||!body)return;
  var total=s.queue.length;
  $('#sbar').style.width=(Math.min(s.i,total)/total*100)+'%';
  $('#scount').textContent=Math.min(s.i+1,total)+' / '+total;
  body.replaceChildren();
  if(s.i>=total){$('#scount').textContent=total+' / '+total;body.append(renderSummary());return}
  var w=s.queue[s.i],dir=s.dirs[s.i];
  var front=dir==='en'?w.en:w.ru,back=dir==='en'?w.ru:w.en;
  var tools=h('div',{class:'s-tools'},h('span',{class:'s-topic'},topicOf(w)),h('span',{id:'spk'}));
  body.append(tools);
  var spk=$('#spk',body);
  if(dir==='en') spk.replaceWith(speakBtn(w.en));
  if(s.mode==='cards'){
    var card=h('button',{class:'card',id:'card','aria-label':'Карточка: '+front+'. Нажми, чтобы перевернуть',onclick:flip},
      h('div',{class:'inner'},
        h('div',{class:'face front'},h('span',{class:'lang'},dir==='en'?'English':'Русский'),h('span',{class:'word'},front),h('span',{class:'tap'},'Нажми, чтобы перевернуть')),
        h('div',{class:'face back'},h('span',{class:'lang'},dir==='en'?'Русский':'English'),h('span',{class:'word'},back),h('span',{class:'sub'},front))));
    var acts=h('div',{class:'acts one',id:'acts'},h('button',{class:'btn primary',onclick:flip},'Показать перевод'));
    body.append(card,acts);
    function flip(){
      if(s.state!=='q'){ $('#card').classList.toggle('flipped');return }
      s.state='a';$('#card').classList.add('flipped');
      if(dir==='ru'){var t=$('.s-tools span:last-child',body);if(t)t.replaceWith(speakBtn(w.en))}
      var a=$('#acts');a.className='acts';a.replaceChildren(
        h('button',{class:'btn bad',onclick:function(){answer(false)}},'Не помню'),
        h('button',{class:'btn good',onclick:function(){answer(true)}},'Помню'));
      a.lastChild.focus({preventScroll:true});
    }
  } else if(s.mode==='test'){
    var key=dir==='en'?'ru':'en';
    var same=WORDS.filter(function(x){return x.id!==w.id&&topicOf(x)===topicOf(w)&&norm(x[key])!==norm(w[key])});
    var other=WORDS.filter(function(x){return x.id!==w.id&&topicOf(x)!==topicOf(w)&&norm(x[key])!==norm(w[key])});
    var picks=[],seen={};seen[norm(w[key])]=1;
    shuffle(same).concat(shuffle(other)).forEach(function(x){if(picks.length<3&&!seen[norm(x[key])]){seen[norm(x[key])]=1;picks.push(x)}});
    var opts=shuffle([w].concat(picks));
    body.append(h('div',{class:'prompt'},h('span',{class:'lang'},dir==='en'?'Как перевести?':'Как по-английски?'),h('span',{class:'word'},front)));
    var box=h('div',{class:'opts'});
    var next=h('div',{class:'acts one',id:'acts'});
    opts.forEach(function(o,idx){box.append(h('button',{class:'opt','data-k':String(idx+1),onclick:function(){
      if(s.state!=='q')return;s.state='a';var ok=o.id===w.id;
      Array.prototype.forEach.call(box.children,function(b,j){b.disabled=true;if(opts[j].id===w.id)b.classList.add('ok')});
      if(!ok)this.classList.add('no');
      record(ok);
      if(dir==='ru'){var t=$('.s-tools span:last-child',body);if(t)t.replaceWith(speakBtn(w.en))}
      if(ok){setTimeout(function(){if(ui.session===s&&s.queue[s.i]===w)advance()},750)}
      else{next.append(h('button',{class:'btn primary',id:'nextbtn',onclick:advance},'Дальше'));$('#nextbtn').focus({preventScroll:true})}
    }},o[key]))});
    body.append(box,next);
  } else {
    body.append(h('div',{class:'prompt'},h('span',{class:'lang'},'Напиши по-английски'),h('span',{class:'word'},w.ru)));
    var inp=h('input',{id:'wr-in',class:'field write-field',autocomplete:'off',autocapitalize:'off',autocorrect:'off',spellcheck:'false',enterkeyhint:'done',placeholder:'…','aria-label':'Ответ'});
    var res=h('div',{id:'wr-res'});
    var acts2=h('div',{class:'acts',id:'acts'},
      h('button',{class:'btn ghost',onclick:function(){check(true)}},'Не знаю'),
      h('button',{class:'btn primary',onclick:function(){check(false)}},'Проверить'));
    inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();if(s.state==='q')check(false);else advance()}});
    body.append(inp,res,acts2);
    setTimeout(function(){if($('#wr-in'))$('#wr-in').focus()},60);
    function check(giveUp){
      if(s.state!=='q')return;var val=inp.value;
      if(!giveUp&&!norm(val)){inp.focus();return}
      s.state='a';var ok=!giveUp&&matches(val,w.en);record(ok);inp.readOnly=true;
      res.replaceChildren(ok?h('div',{class:'result ok'},'Верно!',h('span',{class:'big'},w.en)):
        h('div',{class:'result no'},giveUp?'Правильный ответ':'Почти. Правильно так:',h('span',{class:'big'},w.en),(!giveUp&&norm(val))?h('span',null,'Ты написала: ',h('s',null,val)):null));
      var t=$('.s-tools span:last-child',body);if(t)t.replaceWith(speakBtn(w.en));
      acts2.className='acts one';acts2.replaceChildren(h('button',{class:'btn primary',id:'nextbtn',onclick:advance},'Дальше'));
      $('#nextbtn').focus({preventScroll:true});
    }
  }
  function record(ok){grade(w,ok);s.results.push({w:w,ok:ok})}
  function answer(ok){record(ok);advance()}
  function advance(){if(ui.session!==s)return;s.i++;s.state='q';renderSessionBody()}
}
function renderSummary(){
  var s=ui.session,r=s.results,right=r.filter(function(x){return x.ok}).length,total=r.length;
  var pct=total?right/total:0;
  var msg=pct===1?'Идеально!':pct>=.8?'Отлично!':pct>=.5?'Хорошо, ещё чуть-чуть':'Давай повторим ещё раз';
  var wrongMap={},wrong=[];r.forEach(function(x){if(!x.ok&&!wrongMap[x.w.id]){wrongMap[x.w.id]=1;wrong.push(x.w)}});
  return h('div',{class:'sum'},
    h('div',{class:'score'},h('div',{class:'n'},right+' / '+total),h('div',{class:'msg'},msg)),
    wrong.length?h('div',{class:'panel sec'},h('div',{class:'label'},'Над этим поработать'),h('div',{class:'mist'},wrong.map(function(w){return h('div',null,h('span',null,w.en),h('span',null,w.ru))}))):null,
    wrong.length?h('button',{class:'btn primary big',onclick:function(){startSession(shuffle(wrong.slice()))}},'Повторить ошибки'):null,
    h('button',{class:'btn '+(wrong.length?'ghost':'primary')+' big',onclick:function(){var pool=poolWords();startSession(buildQueue(pool,ui.count==='all'?pool.length:Math.min(ui.count,pool.length)))}},'Ещё тренировка'),
    h('button',{class:'btn ghost',onclick:endSession},'Готово'));
}
document.addEventListener('keydown',function(e){
  var s=ui.session;if(!s||s.i>=s.queue.length)return;
  if(e.target&&e.target.tagName==='INPUT')return;
  if(s.mode==='cards'){
    if((e.key===' '||e.key==='Enter')&&s.state==='q'){e.preventDefault();$('#acts button').click()}
    else if(s.state==='a'&&(e.key==='ArrowLeft'||e.key==='1')){$('#acts .bad').click()}
    else if(s.state==='a'&&(e.key==='ArrowRight'||e.key==='2')){$('#acts .good').click()}
  } else if(s.mode==='test'){
    var b=$('.opt[data-k="'+e.key+'"]');if(b&&s.state==='q')b.click();
  }
});

/* ---------- stats ---------- */
function renderStats(prof){
  var p=prog(),c=counts(WORDS),t=today(),out=[];
  out.push(h('div',null,h('h1',{class:'hello'},'Статистика'),h('p',{class:'lead'},prof.name+' · '+c.t+' '+plural(c.t,'слово','слова','слов')+' в словаре')));
  var tot=c.t||1;
  out.push(h('section',{class:'sec'},
    h('div',{class:'tiles'},
      h('div',{class:'tile l'},h('span',{class:'n'},c.l),h('span',{class:'t'},'выучено')),
      h('div',{class:'tile s'},h('span',{class:'n'},c.s),h('span',{class:'t'},'в процессе')),
      h('div',{class:'tile'},h('span',{class:'n'},c.n),h('span',{class:'t'},'ещё не видела'))),
    h('div',{class:'bigbar','aria-hidden':'true'},h('i',{style:'width:'+(c.l/tot*100)+'%;background:var(--good)'}),h('i',{style:'width:'+(c.s/tot*100)+'%;background:var(--accent);opacity:.55'})),
    h('p',{class:'hint',style:'margin:0'},'Слово считается выученным, когда его вспомнили правильно 3 раза подряд с перерывами в несколько дней.')));
  var r7=0,x7=0;for(var i=0;i<7;i++){var d=p.days[addDays(t,-i)];if(d){r7+=d.r;x7+=d.x}}
  var td=p.days[t]||{r:0,x:0},st=streak();
  out.push(h('div',{class:'panel facts'},
    h('div',{class:'fact'},h('b',null,st),h('span',null,'серия, '+plural(st,'день','дня','дней'))),
    h('div',{class:'fact'},h('b',null,td.r+td.x),h('span',null,'карточек сегодня')),
    h('div',{class:'fact'},h('b',null,(r7+x7)?Math.round(r7/(r7+x7)*100)+'%':'—'),h('span',null,'верно за 7 дней'))));
  out.push(h('section',{class:'sec panel'},h('div',{class:'label'},'Последние 14 дней'),chart(p,t),
    h('div',{class:'legend'},h('span',null,h('i',{style:'background:var(--good)'}),'верно'),h('span',null,h('i',{style:'background:var(--bad)'}),'ошибки'))));
  var tl=topicList(WORDS);
  if(tl.length) out.push(h('section',{class:'sec'},h('div',{class:'label'},'По темам'),h('div',{class:'panel',style:'padding-block:8px'},tl.map(function(tn){
    var list=WORDS.filter(function(w){return topicOf(w)===tn}),cc=counts(list);
    return h('div',{class:'trow'},h('span',{class:'tn'},tn),h('span',{class:'tc'},cc.l+' из '+cc.t),
      h('span',{class:'meter'},h('i',{class:'m-l',style:'width:'+(cc.l/cc.t*100)+'%'}),h('i',{class:'m-s',style:'width:'+(cc.s/cc.t*100)+'%'})));
  }))));
  var hard=WORDS.filter(function(w){var s=p.w[w.id];return s&&s.x>0}).sort(function(a,b){var A=p.w[a.id],B=p.w[b.id];return (B.x/(B.r+B.x))-(A.x/(A.r+A.x))||B.x-A.x}).slice(0,8);
  if(hard.length) out.push(h('section',{class:'sec'},h('div',{class:'label'},'Трудные слова'),h('div',{class:'panel hard',style:'padding-block:6px'},hard.map(function(w){
    return h('div',null,h('b',null,w.en),h('span',null,w.ru),h('em',null,'ошибок: '+p.w[w.id].x))}))));
  if(store.profiles.length>1){
    out.push(h('section',{class:'sec'},h('div',{class:'label'},'Все на этом устройстве'),h('div',{class:'panel scroll-x'},h('table',{class:'ptable'},
      h('thead',null,h('tr',null,h('th',null,'Имя'),h('th',null,'Выучено'),h('th',null,'Сегодня'),h('th',null,'Серия'))),
      h('tbody',null,store.profiles.map(function(pr){var cc=counts(WORDS,pr.id),dd=prog(pr.id).days[t]||{r:0,x:0};
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
  var W=336,H=150,L=28,B=20,T=8,cw=(W-L)/14,ch=H-B-T;
  var top=max<=10?10:Math.ceil(max/10)*10;
  var NS='http://www.w3.org/2000/svg';
  function s(tag,a,txt){var e=document.createElementNS(NS,tag);for(var k in a)e.setAttribute(k,a[k]);if(txt!=null)e.textContent=txt;return e}
  var svg=s('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-label':'Карточки по дням за 14 дней'});
  [0,top/2,top].forEach(function(v){var y=T+ch-(v/top)*ch;svg.append(s('line',{x1:L,x2:W,y1:y,y2:y,class:'gl'}));svg.append(s('text',{x:L-6,y:y+3,'text-anchor':'end',class:'ax'},v))});
  days.forEach(function(d,i){var x=L+i*cw+cw*.18,bw=cw*.64;
    var hr=d.r/top*ch,hx=d.x/top*ch,y0=T+ch;
    if(d.r) svg.append(s('rect',{x:x,y:y0-hr,width:bw,height:hr,rx:2,class:'br'}));
    if(d.x) svg.append(s('rect',{x:x,y:y0-hr-hx,width:bw,height:hx,rx:2,class:'bx'}));
    if(i%2===1||i===13) svg.append(s('text',{x:x+bw/2,y:H-6,'text-anchor':'middle',class:'ax'},+d.k.slice(8)));
  });
  return h('div',{class:'chart'},svg);
}

/* ---------- word editor (owner only) ---------- */
var ed={draft:null,q:'',editing:null,confirmTopic:null,saving:false,ro:false,msg:''};
function draft(){if(!ed.draft)ed.draft=WORDS.map(function(w){return Object.assign({},w)});return ed.draft}
function isDirty(){return ed.draft&&JSON.stringify(ed.draft)!==JSON.stringify(WORDS)}
function changed(){try{localStorage.setItem('wordcards.draft',JSON.stringify(ed.draft))}catch(e){}}
function clearDraft(){try{localStorage.removeItem('wordcards.draft')}catch(e){}}
function parseLines(text){
  var out=[],bad=[];
  text.split(/\r?\n/).forEach(function(raw){var line=raw.trim().replace(/^\d+[.)]\s*/,'');if(!line)return;
    var parts=line.split(/\s*(?:\t|\s[—–-]\s|[—–]|=|;)\s*/).filter(function(x){return x});
    if(parts.length<2){bad.push(raw.trim());return}
    var en=parts[0],ru=parts.slice(1).join(', ');
    if(/[а-яё]/i.test(en)&&!/[а-яё]/i.test(ru)){var t=en;en=ru;ru=t}
    out.push({en:en,ru:ru})});
  return {ok:out,bad:bad};
}
function renderWords(){
  var d=draft(),out=[],dirty=isDirty();
  out.push(h('div',null,h('h1',{class:'hello'},'Слова'),h('p',{class:'lead'},
    'Добавьте слова и нажмите «Сохранить» — они запишутся в words.json. Потом commit и push, и у детей появятся новые слова.')));
  var bar=h('div',{class:'savebar'+(dirty?' dirty':'')},
    h('span',{class:'st'},h('span',{class:'dot'}),ed.saving?'Сохраняю…':dirty?'Не сохранено в words.json':'Все '+d.length+' '+plural(d.length,'слово','слова','слов')+' в words.json'),
    dirty?h('div',{style:'display:flex;gap:8px'},
      h('button',{class:'btn small ghost',disabled:ed.saving,onclick:function(){ed.draft=null;ed.editing=null;clearDraft();render()}},'Отменить'),
      h('button',{class:'btn small primary',disabled:ed.saving,onclick:saveWords},canPickFile?'Сохранить':'Скачать words.json')):null);
  out.push(bar);
  if(ed.msg) out.push(h('div',{class:'notice warn'},ed.msg));
  if(canPickFile) out.push(h('div',{style:'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap'},
    h('span',{class:'hint'},fileHandle?'Сохраняю в: '+fileHandle.name:'При первом сохранении выберите words.json в папке проекта.'),
    fileHandle?h('button',{class:'btn small ghost',onclick:changeFile},'Выбрать другой файл'):null));
  else out.push(h('p',{class:'hint',style:'margin:0'},'В этом браузере файл скачается в «Загрузки». Чтобы сохранять сразу в папку проекта, откройте страницу в Chrome или Edge.'));

  var topics=topicList(d);
  var dl=h('datalist',{id:'topic-list'},topics.map(function(t){return h('option',{value:t})}));
  var tIn=h('input',{id:'add-topic',class:'field',list:'topic-list',placeholder:'Например, Unit 3 · Food',autocomplete:'off',value:ed.lastTopic||'','aria-label':'Тема'});
  var ta=h('textarea',{id:'add-words',class:'field',placeholder:'apple — яблоко\nbanana - банан\nto be hungry = быть голодным','aria-label':'Слова'});
  var info=h('div',{class:'hint',id:'add-info'},'Каждое слово с новой строки: английское, тире, перевод. Несколько переводов — через запятую.');
  var addBtn=h('button',{class:'btn primary',disabled:true,onclick:doAdd},'Добавить');
  ta.addEventListener('input',function(){var r=parseLines(ta.value);addBtn.disabled=!r.ok.length;addBtn.textContent=r.ok.length?'Добавить '+r.ok.length+' '+plural(r.ok.length,'слово','слова','слов'):'Добавить';
    info.textContent=r.bad.length?'Не понял строку: «'+r.bad[0]+'». Нужен разделитель: тире, = или табуляция.':r.ok.length?'Распознано: '+r.ok.map(function(x){return x.en+' → '+x.ru}).slice(0,3).join('; ')+(r.ok.length>3?' …':''):'Каждое слово с новой строки: английское, тире, перевод. Несколько переводов — через запятую.';
    info.className=r.bad.length?'err':'hint'});
  function doAdd(){
    var r=parseLines(ta.value),topic=tIn.value.trim()||NOTOPIC,dup=0,added=0;
    var have={};d.forEach(function(w){have[topicOf(w)+'|'+norm(w.en)]=1});
    r.ok.forEach(function(x){var k=topic+'|'+norm(x.en);if(have[k]){dup++;return}have[k]=1;d.push({id:uid(),en:x.en,ru:x.ru,topic:topic});added++});
    ed.lastTopic=topic;changed();render();
    toast('Добавлено: '+added+(dup?' · повторы пропущены: '+dup:'')+'. Не забудьте нажать «Сохранить».');
  }
  out.push(h('section',{class:'sec panel addgrid'},h('div',{class:'label'},'Добавить слова'),dl,tIn,ta,info,addBtn));
  if(d.some(function(w){return w.ex})) out.push(h('div',{class:'notice'},h('span',null,'Сейчас в словаре есть примерные слова.'),
    h('button',{class:'btn small ghost',onclick:function(){ed.draft=d.filter(function(w){return !w.ex});changed();render()}},'Убрать примеры')));
  var q=h('input',{id:'w-search',class:'field',type:'search',placeholder:'Найти слово',autocomplete:'off',value:ed.q,'aria-label':'Поиск'});
  var list=h('div',{id:'wlist',class:'sec'});
  q.addEventListener('input',function(){ed.q=q.value;fillList(list)});
  out.push(h('section',{class:'sec'},h('div',{class:'label'},'Словарь'),q,list));
  fillList(list);
  return out;
}
function fillList(list){
  var d=draft(),q=norm(ed.q);list.replaceChildren();
  var shown=q?d.filter(function(w){return norm(w.en).indexOf(q)>=0||norm(w.ru).indexOf(q)>=0||norm(topicOf(w)).indexOf(q)>=0}):d;
  if(!shown.length){list.append(h('p',{class:'hint'},q?'Ничего не нашлось.':'Словарь пуст. Добавьте первые слова выше.'));return}
  topicList(shown).forEach(function(tn){
    var ws=shown.filter(function(w){return topicOf(w)===tn});
    var g=h('div',{class:'group panel',style:'padding-block:6px'});
    if(ed.confirmTopic===tn) g.append(h('div',{class:'confirm',style:'margin:6px 0'},h('span',{style:'flex:1;min-width:0'},'Удалить тему «'+tn+'» и все её слова?'),
      h('button',{class:'btn small bad',onclick:function(){ed.draft=d.filter(function(w){return topicOf(w)!==tn});ed.confirmTopic=null;changed();render()}},'Удалить'),
      h('button',{class:'btn small ghost',onclick:function(){ed.confirmTopic=null;fillList(list)}},'Отмена')));
    else g.append(h('div',{class:'group-h'},h('h3',null,tn),h('div',{style:'display:flex;align-items:center;gap:6px'},h('span',{class:'gc'},ws.length+' '+plural(ws.length,'слово','слова','слов')),
      h('button',{class:'iconbtn','aria-label':'Удалить тему '+tn,style:'width:38px;height:38px',onclick:function(){ed.confirmTopic=tn;fillList(list)}},icon('trash')))));
    ws.forEach(function(w){
      if(ed.editing===w.id){
        var e1=h('input',{class:'field',value:w.en,'aria-label':'По-английски',id:'e-en'}),e2=h('input',{class:'field',value:w.ru,'aria-label':'Перевод',id:'e-ru'}),e3=h('input',{class:'field',value:topicOf(w),list:'topic-list','aria-label':'Тема',id:'e-tp'});
        g.append(h('div',{class:'wedit'},e1,e2,h('div',{class:'full'},e3,
          h('button',{class:'btn small ghost',onclick:function(){ed.editing=null;fillList(list)}},'Отмена'),
          h('button',{class:'btn small primary',onclick:function(){var en=e1.value.trim(),ru=e2.value.trim();if(!en||!ru)return;w.en=en;w.ru=ru;w.topic=e3.value.trim()||NOTOPIC;delete w.ex;ed.editing=null;changed();render()}},'Готово'))));
      } else g.append(h('div',{class:'wrow'},h('span',{class:'en'},w.en),h('span',{class:'ru'},w.ru),h('span',{class:'ra'},
        h('button',{'aria-label':'Изменить '+w.en,svg:ICON.edit,onclick:function(){ed.editing=w.id;fillList(list);var f=$('#e-en');if(f)f.focus()}}),
        h('button',{'aria-label':'Удалить '+w.en,svg:ICON.trash,onclick:function(){ed.draft=d.filter(function(x){return x.id!==w.id});changed();render()}}))));
    });
    list.append(g);
  });
}
/* ---------- saving words.json ----------
   Chrome/Edge: writes straight into words.json in the repo folder (picked once, remembered).
   Other browsers: downloads words.json — put it into the repo folder instead of the old one. */
var canPickFile=typeof window.showSaveFilePicker==='function';
var fileHandle=null;
function idb(mode,fn){return new Promise(function(res,rej){try{var r=indexedDB.open('wordcards',1);
  r.onupgradeneeded=function(){r.result.createObjectStore('kv')};
  r.onerror=function(){rej(r.error)};
  r.onsuccess=function(){var tx=r.result.transaction('kv',mode),q=fn(tx.objectStore('kv'));tx.oncomplete=function(){res(q&&q.result)};tx.onerror=function(){rej(tx.error)}}}catch(e){rej(e)}})}
function loadHandle(){return idb('readonly',function(s){return s.get('words-file')}).then(function(h){fileHandle=h||null}).catch(function(){})}
function storeHandle(h){fileHandle=h;return idb('readwrite',function(s){s.put(h,'words-file')}).catch(function(){})}
function wordsJson(words){
  return '{"v":1,"words":[\n'+words.map(function(w){return JSON.stringify(w)}).join(',\n')+'\n]}\n';
}
function afterSave(msg){WORDS=ed.draft.map(function(w){return Object.assign({},w)});ed.draft=null;clearDraft();ed.saving=false;ed.msg='';render();toast(msg)}
function pickFile(){
  return window.showSaveFilePicker({suggestedName:'words.json',types:[{description:'Словарь',accept:{'application/json':['.json']}}]}).then(storeHandle);
}
function writeFile(text){
  return fileHandle.queryPermission({mode:'readwrite'}).then(function(p){
    return p==='granted'?p:fileHandle.requestPermission({mode:'readwrite'});
  }).then(function(p){
    if(p!=='granted') throw {name:'NotAllowedError'};
    return fileHandle.createWritable();
  }).then(function(w){return w.write(text).then(function(){return w.close()})});
}
function saveWords(){
  if(ed.saving)return;
  var text=wordsJson(ed.draft);
  if(!canPickFile){downloadJson(text);return}
  ed.saving=true;ed.msg='';render();
  (fileHandle?Promise.resolve():pickFile()).then(function(){return writeFile(text)}).then(function(){
    afterSave('Записано в '+fileHandle.name+'. Теперь commit и push.');
  }).catch(function(e){
    ed.saving=false;
    if(e&&e.name==='AbortError'){render();return}
    ed.msg=e&&e.name==='NotAllowedError'?'Браузер не дал записать файл. Нажмите «Сохранить» ещё раз и разрешите доступ.':'Не получилось записать файл. Нажмите «Выбрать другой файл» и укажите words.json в папке проекта.';
    render();
  });
}
function changeFile(){
  if(!canPickFile)return;
  pickFile().then(function(){render();toast('Буду сохранять в '+fileHandle.name)}).catch(function(){});
}
function downloadJson(text){
  try{
    var blob=new Blob([text],{type:'application/json'});
    var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='words.json';
    document.body.append(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href)},4000);
    afterSave('words.json скачан. Положите его в папку проекта вместо старого.');
  }catch(e){ed.msg='Не получилось скачать файл. Попробуйте Chrome или Edge.';render()}
}
var toastT;
function toast(msg){var old=$('.toast');if(old)old.remove();var t=h('div',{class:'toast',role:'status'},msg);document.body.append(t);clearTimeout(toastT);toastT=setTimeout(function(){t.remove()},3200)}

/* ---------- boot ---------- */
function isAdmin(){var hn=location.hostname;return /^#admin$/i.test(location.hash)||hn==='localhost'||hn==='127.0.0.1'}
canWrite=isAdmin();
window.addEventListener('hashchange',function(){var c=isAdmin();if(c!==canWrite){canWrite=c;if(!c&&ui.tab==='words')ui.tab='learn';if(!ui.session)render()}});
function boot(msg){
  app.replaceChildren(h('div',{class:'wrap ob'},h('div',{class:'brand'},h('span',{class:'brand-mark'},'Aa'),h('span',null,'Тетрадь слов')),msg));
}
if(location.protocol==='file:'){
  boot(h('div',{class:'panel'},h('h2',{style:'font-family:var(--f-display);margin-bottom:8px'},'Откройте через PhpStorm'),
    h('p',{class:'lead'},'Если открыть index.html двойным кликом, браузер не даёт странице прочитать words.json. Откройте index.html в PhpStorm и нажмите значок браузера справа вверху. Адрес начнётся с localhost.')));
}else{
  boot(h('p',{class:'lead'},'Загружаю слова…'));
  Promise.all([
    fetch('words.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json()}),
    loadHandle()
  ]).then(function(r){
    WORDS=Array.isArray(r[0]&&r[0].words)?r[0].words:[];
    try{var s=localStorage.getItem('wordcards.draft');
      if(s){if(s===JSON.stringify(WORDS))localStorage.removeItem('wordcards.draft');else ed.draft=JSON.parse(s)}}catch(e){}
    render();
  }).catch(function(){
    boot(h('div',{class:'panel'},h('h2',{style:'font-family:var(--f-display);margin-bottom:8px'},'Не получилось загрузить слова'),
      h('p',{class:'lead'},'Проверьте интернет и обновите страницу.'),
      canWrite?h('p',{class:'hint'},'Для взрослых: проверьте, что words.json лежит рядом с index.html и в нём нет ошибки (лишней или пропущенной запятой).'):null,
      h('button',{class:'btn primary',style:'margin-top:12px',onclick:function(){location.reload()}},'Обновить')));
  });
}
})();
