import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MovementObserver,trainingConfig,engagementPlan} from '../src/training-rules.js';
import {TrainingSession,seededRandom,settingsKey} from '../src/training.js';
import {MatchupEncounter} from '../src/matchup-encounter.js';
import {LaneEncounter,laneTargets} from '../src/lane-encounter.js';
import {SyndraCombat} from '../src/syndra-combat.js';
import {dodgeSkills} from '../src/dodge-simulation.js';

test('advanced profile enforces unaided practice without changing Yone equipment',()=>{
  const c=trainingConfig({trainingProfile:'advanced',skills:[],difficulty:3,yoneBonusAS:66,yoneTelegraphs:true,laneCoach:true,unlimitedMana:true});
  assert.equal(c.unlimitedMana,false);assert.equal(c.laneCoach,false);assert.equal(c.yoneTelegraphs,false);assert.equal(c.yoneBonusAS,66);
  assert.notEqual(settingsKey(c),settingsKey({...c,trainingProfile:'assisted'}));
});
test('prediction cannot see a recent reversal, and a blink cannot produce extreme lead',()=>{
  const observer=new MovementObserver(),origin={x:0,z:-500},skill=dodgeSkills.ezrealQ;
  for(let i=0;i<=20;i++)observer.record(i*.01,{x:i*3,z:0});
  const before=observer.aim(.2,origin,skill,{reaction:.1});
  observer.record(.21,{x:-1000,z:0});
  assert.deepEqual(observer.aim(.2,origin,skill,{reaction:.1}),before);
  assert.ok(before.x>30);
  const after=observer.aim(.4,origin,skill,{reaction:.1});assert.ok(Math.abs(after.x)<=1000);
});
test('approach distance and hesitation vary deterministically, within bounds',()=>{
  const a=seededRandom(7),b=seededRandom(7),plans=Array.from({length:20},()=>engagementPlan(a,3,true));
  assert.deepEqual(plans,Array.from({length:20},()=>engagementPlan(b,3,true)));
  assert.ok(new Set(plans.map(p=>Math.floor(p.distance))).size>10);
  assert.ok(plans.every(p=>p.distance>=390&&p.distance<=670&&p.delay>=.12&&p.delay<=.52));
});
test('safe misses do not inflate threat accuracy; attack spam is not a lateral reaction',()=>{
  const s=new TrainingSession({drill:'precision',skills:['ezrealQ'],duration:60,seed:2,closeRadius:150});
  const add=(x)=>s.beginShot({skill:dodgeSkills.ezrealQ,origin:{x:0,z:0},endpoint:{x:0,z:1200},direction:{x:0,z:1},position:{x,z:500},target:{x,z:500},velocity:{x:0,z:0},radius:125});
  const safe=add(400);s.resolve(safe,false,{x:400,z:500});
  const danger=add(0);s.tick(.1);s.command({x:0,z:500},{x:0,z:700},'attack');s.command({x:0,z:500},{x:0,z:600});
  assert.equal(danger.firstDodgeAt,null);s.tick(.15);s.command({x:0,z:500},{x:150,z:500});s.resolve(danger,true,{x:100,z:500});
  assert.equal(s.summary().accuracy,50);assert.equal(s.summary().threatAccuracy,0);assert.equal(s.summary().threats,1);assert.equal(s.summary().lateralCommandMs,250);
  assert.equal(s.summary().assessmentReady,false);
  const persisted=JSON.parse(JSON.stringify(s.report()));assert.equal(persisted.shots[1].parameters.speed,2000);assert.equal(persisted.shots[1].warning,.25);
});
test('advanced Ahri combo order is randomized, instead of determined by round parity',()=>{
  const e=new MatchupEncounter({champion:'ahri',advanced:true,random:seededRandom(12)}),orders=[];
  for(let i=0;i<12;i++){e.startRound({x:0,z:0});orders.push(e.queue.join(','));}
  assert.equal(new Set(orders).size,2);assert.ok(orders.some((s,i)=>i>0&&s===orders[i-1]));
});
test('advanced matchup keeps committed casts stationary and spell speeds unchanged',()=>{
  const e=new MatchupEncounter({champion:'locke',advanced:true,difficulty:3,random:seededRandom(4)});
  e.position={x:0,z:500};e.phase='idle';e.observer.record(0,{x:0,z:0});const a=e.cast('lockeQ1',{x:0,z:0});
  const before={...e.position};e.update(.1,{x:200,z:0});assert.deepEqual(e.position,before);assert.equal(a.skill.warning,.25);assert.equal(a.skill.speed,1650);assert.deepEqual(a.direction,{x:0,z:-1});
});
function laneFixture(){
  const combat=new SyndraCombat({level:6,targets:laneTargets()}),lane=new LaneEncounter({combat,advanced:true,difficulty:3,random:seededRandom(3)}),player={x:0,z:0};
  Object.assign(lane.position,{x:0,z:-500});lane.nextDecision=999;lane.goal={...lane.position};
  for(const m of lane.minions){m.readyAt=999;m.action=null;}
  return {combat,lane,player,tick(seconds){for(let t=0;t<seconds;t+=.005)lane.update(.005,player);}};
}
test('advanced lane trades use windup, no movement during attack, travel time and shared cooldown',()=>{
  const e=laneFixture();e.tick(.01);assert.equal(e.lane.action.targetId,'player');assert.equal(e.lane.moveSpeed,340);
  assert.ok(e.lane.minions.every(m=>m.moveSpeed===350));
  const p={...e.lane.position},hp=e.combat.playerHealth;e.tick(.2);assert.deepEqual(e.lane.position,p);assert.equal(e.combat.playerHealth,hp);
  e.tick(.11);assert.equal(e.combat.playerHealth,hp);assert.equal(e.lane.projectiles.length,1);
  e.tick(.4);assert.equal(e.combat.playerHealth,hp-62);assert.equal(e.lane.summary().tradeHits,1);assert.equal(e.lane.trades,1);assert.equal(e.lane.contested,0);
});
test('advanced lane prioritizes lethal farm and does not autoattack from outside range',()=>{
  const e=laneFixture(),m=e.lane.minion('lane-blue-0');m.health=62;e.tick(.01);assert.equal(e.lane.action.targetId,m.id);assert.equal(e.lane.trades,0);
  const far=laneFixture();far.player.z=300;far.tick(.1);assert.equal(far.lane.action,null);
});
test('leaving attack range before release prevents the lane trade projectile',()=>{
  const e=laneFixture();e.tick(.01);e.player.z=400;e.tick(.4);assert.equal(e.lane.projectiles.length,0);assert.equal(e.lane.tradeHits,0);
});
