import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SyndraCombat} from '../src/syndra-combat.js';
import {LaneEncounter,laneTargets} from '../src/lane-encounter.js';
import {seededRandom,settingsKey} from '../src/training.js';
function setup(difficulty=3){const combat=new SyndraCombat({level:6,targets:laneTargets()}),lane=new LaneEncounter({combat,difficulty,random:seededRandom(42)}),p={x:0,z:0},target={...p};return {combat,lane,p,tick(seconds){for(let t=0;t<seconds-1e-8;t+=1/120){combat.update(1/120,p,target,330,{allowStart:false});lane.observe(combat.drainEvents());lane.update(1/120,p);}}};}
function isolate(env){for(const m of env.lane.minions){m.readyAt=999;m.action=null;}env.lane.position.x=0;env.lane.position.z=-880;env.lane.nextDecision=999;env.lane.goal={...env.lane.position};}

test('lane creates seven minions per side with the requested composition',()=>{
  const {lane,combat}=setup();for(const team of ['blue','red']){const m=lane.minions.filter(m=>m.team===team);assert.equal(m.length,7);assert.equal(m.filter(m=>m.kind==='melee').length,3);assert.equal(m.filter(m=>m.kind==='caster').length,3);assert.equal(m.filter(m=>m.kind==='siege').length,1);}assert.equal(combat.targets.length,8);
});
test('opponent waits for lethal HP, commits without moving, then damages at missile arrival',()=>{
  const e=setup();isolate(e);const m=e.lane.minion('lane-blue-0');Object.assign(m.position,{x:0,z:-300});m.health=63;e.tick(.2);assert.equal(e.lane.action,null);
  m.health=62;e.tick(.01);assert.ok(e.lane.action);const position={...e.lane.position};e.tick(.2);assert.deepEqual(e.lane.position,position);assert.equal(m.health,62);e.tick(.12);assert.equal(m.health,62);assert.equal(e.lane.projectiles.filter(p=>p.source==='enemy').length,1);e.tick(.4);assert.equal(m.alive,false);assert.equal(e.lane.lastHits,1);
});
test('incoming lethal troop projectile prevents a doomed last-hit attempt',()=>{
  const e=setup();isolate(e);const m=e.lane.minion('lane-blue-0');Object.assign(m.position,{x:0,z:-300});m.health=40;e.lane.launch({x:0,z:-320},m,50,'minion');e.tick(.01);assert.equal(e.lane.action,null);e.tick(.1);assert.equal(e.lane.lastHits,0);assert.equal(e.lane.missed,1);
});
test('identical Q is dodged while free but lands during committed farming windup',()=>{
  function run(committed){const e=setup();isolate(e);const m=e.lane.minion('lane-blue-0');Object.assign(m.position,{x:0,z:-300});if(committed){m.health=62;e.tick(.01);assert.ok(e.lane.action);}else e.lane.attackReadyAt=999;
    assert.equal(e.combat.castAbility('Q',{...e.lane.position},e.p),true);e.lane.observe(e.combat.drainEvents());e.tick(.7);return e;
  }
  const free=run(false),locked=run(true);assert.equal(free.lane.target.health,3000);assert.ok(locked.lane.target.health<3000);assert.equal(locked.lane.summary().timedHits,1);assert.equal(free.lane.summary().timedHits,0);
});
test('natural waves damage troops, produce last hits and renew without player input',()=>{
  const e=setup(2);e.tick(70);const s=e.lane.summary();assert.ok(s.waves>=2);assert.ok(s.lastHits>=5);assert.ok(s.windows>=s.lastHits);assert.ok(e.lane.minions.every(m=>m.health>=0));
});
test('pause freezes all lane clocks, farm actions and projectiles',()=>{
  const e=setup();e.tick(6);const before=JSON.stringify([e.lane.time,e.lane.minions,e.lane.projectiles,e.lane.action]);e.lane.update(0,e.p);assert.equal(JSON.stringify([e.lane.time,e.lane.minions,e.lane.projectiles,e.lane.action]),before);
});
test('ending drains committed farm without scheduling new waves or attacks',()=>{
  const e=setup();isolate(e);const m=e.lane.minion('lane-blue-0');Object.assign(m.position,{x:0,z:-300});m.health=60;e.tick(.01);e.lane.stop();e.tick(5);assert.equal(e.lane.lastHits,1);assert.equal(e.lane.contested,1);assert.equal(e.lane.pending,false);assert.equal(e.lane.wave,1);
});
test('Syndra R cannot target lane minions and they do not grant champion passive procs',()=>{
  const e=setup(),m=e.combat.target('lane-red-0');assert.equal(e.combat.castAbility('R',m.position,e.p,m.id),false);e.combat.passiveHit(m,{id:100});e.combat.passiveHit(m,{id:101});assert.equal(e.combat.passiveProcs,0);
});
test('history keeps coached and unaided lane practice separate',()=>{
  const c={drill:'lane',skills:[]};assert.notEqual(settingsKey(c),settingsKey({...c,laneCoach:false}));
});

test('third red minion death immediately restores both complete waves with new generations',()=>{
  const e=setup(),red=e.lane.minions.filter(m=>m.team==='red'),blue=e.lane.minions.filter(m=>m.team==='blue');
  const generation=red[0].generation;blue[0].health=30;e.lane.damageMinion(red[0],999,'player');e.lane.damageMinion(red[1],999,'minion');e.tick(.01);assert.equal(e.lane.wave,1);
  e.lane.beginAttack(blue[0]);e.lane.launch(e.lane.position,blue[0],62,'enemy');e.lane.damageMinion(red[2],999,'player');e.tick(.01);
  assert.equal(e.lane.wave,2);assert.equal(e.lane.action,null);assert.equal(e.lane.projectiles.length,0);
  for(const m of e.lane.minions){assert.equal(m.alive,true);assert.equal(m.health,m.maxHealth);assert.equal(m.generation,generation+1);}
  e.tick(.01);assert.equal(e.lane.wave,2);
});

test('three blue deaths do not trigger the enemy-minion reset, and stopping suppresses renewal',()=>{
  const e=setup();for(const m of e.lane.minions.filter(m=>m.team==='blue').slice(0,3))e.lane.damageMinion(m,999,'minion');e.tick(.01);assert.equal(e.lane.wave,1);
  e.lane.stop();for(const m of e.lane.minions.filter(m=>m.team==='red').slice(0,3))e.lane.damageMinion(m,999,'player');e.tick(.1);assert.equal(e.lane.wave,1);
});
