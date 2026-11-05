import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {missions,worlds} from './dist/data.js';
import {art,crystal,robotScene} from './dist/art.js';
let listeners={},timers=[],clock=1000000,storage={},html='';
const app={set innerHTML(v){html=v;},get innerHTML(){return html;}};
class FakeDate extends Date { static now(){return clock;} }
const context=vm.createContext({console,missions,worlds,art,crystal,robotScene,Date:FakeDate,matchMedia:()=>({matches:false}),localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},document:{querySelector:q=>q==='#app'?app:null,body:{classList:{toggle(){}}},addEventListener:(k,fn)=>listeners[k]=fn},setInterval:f=>timers.push(f),setTimeout,window:{}});
vm.runInContext(readFileSync('dist/game.js','utf8').replace(/^import .*;\r?\n/gm,''),context);
const run=code=>vm.runInContext(code,context);
const snap=()=>JSON.parse(run('JSON.stringify(s)'));
async function click(action,i=0,value='') { await listeners.click({target:{closest:()=>({disabled:false,dataset:{action,i:String(i),value}})}}); }
assert.equal(missions.length,33);assert.equal(new Set(missions.map(m=>m.id)).size,33);
assert.deepEqual(worlds.map(w=>missions.filter(m=>m.world===worlds.indexOf(w)).length),[7,9,12,5]);
assert.ok(html.includes('Начать путешествие'));
assert.equal((html.match(/data-action="start"/g)||[]).length,1);
assert.ok(!html.includes('CONTINUE GAME'));
await click('start');assert.equal(snap().route,'story');
for(let i=0;i<3;i++)await click('story-next');assert.equal(snap().route,'map');
await click('world',3);assert.equal(snap().route,'map','Castle must be locked');
await click('world',0);assert.equal(snap().index,0);
await click('choose',1);assert.equal(snap().done.length,0);assert.match(html,/Try again/);
for(let index=0;index<missions.length;index++){
 const m=missions[index];assert.equal(snap().index,index,`route ${m.id}`);
 assert.match(html,new RegExp(m.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 if(m.type==='choice'){
  if(m.visual==='stars')assert.equal((html.match(/aria-label="Star \d+"/g)||[]).length,20);
  if(m.visual==='countRobots'){
   assert.equal((html.match(/aria-label="robot \d+"/g)||[]).length,15);
   assert.equal((html.match(/src="assets\/game\/counting\/blue_robot_\d.webp"/g)||[]).length,7);
   assert.equal((html.match(/src="assets\/game\/counting\/orange_robot_\d.webp"/g)||[]).length,8);
  }
  if(m.visual==='countAnimals'){assert.equal((html.match(/aria-label="cat \d+"/g)||[]).length,4);assert.equal((html.match(/aria-label="dog \d+"/g)||[]).length,6);}
  await click('choose',m.byIndex?m.correctAnswer:m.options.indexOf(m.correctAnswer));
 }else if(['reveal','sequenceReveal'].includes(m.type)){
  for(let i=0;i<m.options.length;i++){await click('reveal',i);if(m.type==='sequenceReveal'&&i<2)await click('reveal-next');}
 }else if(m.type==='multi'){
  await click('choose',0);await click('check');assert.equal(snap().task.solved,false,`incomplete ${m.id}`);
  await click('reset');for(const v of m.correctAnswer)await click('choose',m.options.indexOf(v));await click('check');
 }else if(m.type==='box'){
  await click('box',(m.correctAnswer+1)%3);assert.equal(snap().task.solved,false);await click('box',m.correctAnswer);
 }else if(m.type==='difference'){
  await click('miss-diff');assert.equal(snap().task.found.length,0);
  await click('diff',0);await click('diff',0);assert.equal(snap().task.found.length,1);
  await click('diff',1);await click('diff',2);
 }else if(m.type==='memory'){
  await click('memory');
  assert.equal((html.match(/class="memory-object"/g)||[]).length,m.options.length);
  if(m.id==='C05'){assert.match(html,/colour-memory-grid/);assert.match(html,/assets\/game\/props\/apple.webp/);}
  clock+=14999;timers.forEach(f=>f());assert.equal(snap().task.memory,'look');
  if(m.id==='C05'){await click('pause-memory');clock+=2000;timers.forEach(f=>f());assert.equal(snap().task.memory,'look');await click('pause-memory');}
  clock+=1;timers.forEach(f=>f());assert.equal(snap().task.memory,'recall');
  for(const q of m.questions)await click('choose',q.options.indexOf(q.answer));
 }else if(m.type==='riddles'){
  for(const a of m.correctAnswer)await click('choose',m.options.indexOf(a));
 }else if(m.type==='sort'||m.type==='match'){
  for(let i=0;i<4;i++){
   const item=m.type==='sort'?m.correctAnswer[i]:m.options[m.correctAnswer.indexOf(m.targets[i])];
   if(i===2){const n=m.options.indexOf(item);listeners.dragstart({target:{closest:()=>({dataset:{drag:String(n)}})},dataTransfer:{setData(){}}});listeners.drop({preventDefault(){},target:{closest:()=>({dataset:{drop:String(i)}})}});}else{await click('pick',m.options.indexOf(item));await click('place',i);}
  }await click('check');
 }else if(m.type==='math'){
  for(const answer of m.correctAnswer){for(const digit of answer)await click('key',0,digit);await click('unlock');}
 }else if(m.type==='code'){
  assert.equal((html.match(/class="art /g)||[]).length,9,'Exactly nine final shapes');
  for(const digit of '000')await click('key',0,digit);await click('unlock');assert.equal(snap().task.solved,false);
  await click('key',0,'CLEAR');for(const digit of '3249')await click('key',0,digit);assert.equal(snap().task.code,'324','Only three digits');await click('unlock');
 }
 assert.equal(snap().task.solved,true,`${m.id} must solve`);
 assert.equal(run('xp()'),(index+1)*10,`${m.id} XP`);
 if(index===0){await click('reset');await click('choose',0);assert.equal(run('xp()'),10,'No duplicate XP');assert.match(html,/XP ALREADY EARNED/);}
 await click('next');
 if([6,15,27].includes(index)){
  assert.equal(snap().route,'reward');assert.equal(snap().crystals.length,[6,15,27].indexOf(index)+1);
  await click('map');await click('world',m.world+1);
 }
 console.log(`PASS ${m.id}: ${m.type}`);
}
assert.equal(snap().route,'victory');assert.equal(run('xp()'),330);assert.equal(snap().crystals.length,3);
await click('goodbye');for(let i=0;i<3;i++)await click('bye-check',i);assert.match(html,/GAME COMPLETE!/);assert.equal(run('xp()'),330);
assert.equal(JSON.parse(storage['secret-game-world-v1']).done.length,33);
await click('home');await click('continue');assert.equal(snap().route,'goodbye','Continue resumes saved scene');
await click('new');assert.match(html,/Start a new adventure/);await click('close');assert.equal(run('xp()'),330,'Cancel preserves progress');
run('s=fresh();enter(6)');await click('teacher');await click('skip');assert.equal(snap().route,'reward');assert.equal(snap().crystals.length,1);assert.equal(run('xp()'),0,'Skip awards no XP');
await click('map');await click('world',1);assert.equal(snap().index,7,'Skip permits next world');
run('enter(10)');await click('pick',0);await click('place',0);await click('map');await click('world',1);assert.equal(snap().task.slots[0],'16','Map preserves task state');
for(const f of ['index.html','game.js','data.js','art.js','style.css','asset-theme.css'])assert.ok(existsSync(`dist/${f}`));
for(const m of missions.filter(m=>m.puzzle)){
 assert.ok(existsSync(`dist/assets/game/puzzles/${m.puzzle}.webp`));
 assert.equal(m.hotspots.length,3);
 for(const [x,y,w,h] of m.hotspots){assert.ok(x>=0&&y>=0&&x+w<=100&&y+h<=100);}
}
for(const name of ['dog','cat','cow','hen','sheep','horse','hamster','parrot','tiger','monkey','elephant','giraffe','zebra','lion','dolphin','whale','shark','octopus']){
 const markup=art(name);assert.match(markup,/<img /);assert.match(markup,/assets\/animals\//);
 const path=markup.match(/src="([^"]+)"/)[1];assert.ok(existsSync(`dist/${path}`));
}
await click('home');await click('start');assert.notEqual(snap().route,'start','Single start button resumes saved game');
for(const w of worlds)assert.ok(existsSync(`dist/assets/${w.asset}.webp`));
for(const name of ['frog','flamingo','bear','crab','apple','water','sun','carrot','sea','house','farm','jungle',...Array.from({length:5},(_,i)=>`blue_robot_${i+1}`),...Array.from({length:5},(_,i)=>`orange_robot_${i+1}`)]){
 const markup=art(name);assert.match(markup,/<img /);const path=markup.match(/src="([^"]+)"/)[1];assert.ok(existsSync(`dist/${path}`));
}
console.log('PASS: 33 missions, 330 XP, 3 crystals, memory deadlines, wrong answers, repeat scoring, skips, persistence, map resume, goodbye, drag-and-drop/click matching, and final lock.');
