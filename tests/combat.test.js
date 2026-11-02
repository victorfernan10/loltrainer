import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Combat,attackRange,inAttackRange,selectAttackMoveTarget} from '../src/combat.js';
import {settingsKey} from '../src/training.js';

function setup(options={}){const combat=new Combat({attackSpeed:2,targets:[{id:'near',position:{x:0,z:200}},{id:'far',position:{x:300,z:300}}],...options}),position={x:0,z:0},target={...position};return {combat,position,target,tick(seconds,allowStart=true){for(let t=0;t<seconds-1e-8;t+=.005)combat.update(.005,position,target,335,{allowStart});}};}

test('level ranges and edge-to-edge reach use each body radius once',()=>{
  assert.deepEqual([1,5,6,15,16,18].map(attackRange),[150,150,525,525,625,625]);
  const target={alive:true,radius:65,position:{x:280,z:0}};
  assert.equal(inAttackRange({x:0,z:0},target,150),true);target.position.x=280.01;assert.equal(inAttackRange({x:0,z:0},target,150),false);
});
test('cursor and champion priority choose different valid targets',()=>{
  const {combat,position}=setup(),cursor={x:300,z:300};
  assert.equal(selectAttackMoveTarget(position,cursor,combat.targets,525,'cursor').id,'far');
  assert.equal(selectAttackMoveTarget(position,cursor,combat.targets,525,'champion').id,'near');
});
test('a ready first attack only waits its windup, not an entire attack cooldown',()=>{
  const s=setup();s.combat.attackTarget('near');s.tick(.12);assert.equal(s.combat.released,1);assert.ok(s.combat.readyAt>.4);
});
test('repeated commands for the same target preserve the current windup',()=>{
  const s=setup();s.combat.attackMove({x:0,z:200},s.position);s.tick(.01);const first=s.combat.windup.releaseAt;
  for(let i=0;i<16;i++){s.combat.attackMove({x:0,z:200},s.position);s.tick(.005);assert.equal(s.combat.windup.releaseAt,first);}
  s.tick(.15);assert.equal(s.combat.hits,1);assert.equal(s.combat.cancelled,0);assert.equal(s.combat.started,1);
});
test('changing the selected target during preparation cancels only that attack',()=>{
  const s=setup();s.combat.attackMove({x:0,z:200},s.position);s.tick(.01);s.combat.attackMove({x:300,z:300},s.position);s.tick(.01);
  assert.equal(s.combat.cancelled,1);assert.equal(s.combat.windup.targetId,'far');s.tick(.4);assert.equal(s.combat.hits,1);
});
test('champion priority does not retarget on cursor jitter',()=>{
  const s=setup({priority:'champion'});s.combat.attackMove({x:0,z:200},s.position);s.tick(.01);s.combat.attackMove({x:300,z:300},s.position);s.tick(.2);
  assert.equal(s.combat.cancelled,0);assert.equal(s.combat.hits,1);assert.equal(s.combat.targets[0].health,540);
});
test('move then attack-move in the same frame honors the most recent order',()=>{
  const s=setup();s.combat.move({x:50,z:50});s.combat.attackMove({x:50,z:50},s.position);s.tick(.01);
  assert.deepEqual(s.position,{x:0,z:0});assert.ok(s.combat.windup);s.tick(.2);assert.equal(s.combat.hits,1);
});
test('movement before release cancels damage and does not consume a full cooldown',()=>{
  const s=setup();s.combat.attackTarget('near');s.tick(.01);s.combat.move({x:100,z:0});s.tick(.2);assert.equal(s.combat.cancelled,1);assert.equal(s.combat.hits,0);
  s.combat.attackTarget('near');s.tick(.2);assert.equal(s.combat.hits,1);
});
test('movement after release keeps the projectile and preserves attack cooldown',()=>{
  const s=setup();s.combat.attackTarget('far');s.tick(.12);const readyAt=s.combat.readyAt;
  assert.equal(s.combat.bolts.length,1);s.combat.move({x:-100,z:0});s.tick(.2);assert.equal(s.combat.hits,1);assert.equal(s.combat.cancelled,0);assert.ok(s.position.x<0);
  s.combat.attackTarget('near');s.tick(.1);assert.equal(s.combat.started,1);assert.equal(s.combat.readyAt,readyAt);s.tick(.2);assert.equal(s.combat.started,2);
});
test('the actor never translates while preparing an attack',()=>{
  const s=setup();s.combat.attackTarget('near');s.tick(.01);const start={...s.position};s.tick(.08);assert.deepEqual(s.position,start);
});
test('attack-move acquires an enemy after moving into range',()=>{
  const s=setup({level:1});s.position.z=-300;s.combat.attackMove({x:0,z:600},s.position);s.tick(1);
  assert.ok(s.position.z>-300);assert.ok(s.combat.started>0);
});
test('pause freezes windup and outgoing projectiles',()=>{
  const s=setup();s.combat.attackTarget('far');s.tick(.12);const snapshot=JSON.stringify(s.combat);s.combat.update(0,s.position,s.target,335);assert.equal(JSON.stringify(s.combat),snapshot);
});
test('ending a session drains a started attack but never starts another',()=>{
  const s=setup();s.combat.attackTarget('near');s.tick(.01);s.combat.endAttacks();s.tick(1,false);assert.equal(s.combat.hits,1);assert.equal(s.combat.started,1);assert.equal(s.combat.pending,false);
});
test('target defeat and respawn reset health without resetting the session score',()=>{
  const s=setup();s.combat.targets[0].health=60;s.combat.attackTarget('near');s.tick(.3);assert.equal(s.combat.kills,1);assert.equal(s.combat.targets[0].alive,false);
  s.combat.stop();s.tick(1.3);assert.equal(s.combat.targets[0].alive,true);assert.equal(s.combat.targets[0].health,600);assert.equal(s.combat.damage,60);
});
test('zero health prevents new attacks',()=>{
  const s=setup();s.combat.takeDamage(1000);s.combat.attackTarget('near');s.tick(1);assert.equal(s.combat.started,0);
});
test('combat history comparisons include level, attack speed and targeting settings',()=>{
  const config={drill:'combat',skills:[],level:6,attackSpeed:1.5,attackPriority:'cursor',bindLeft:true,combatHazards:true};
  for(const change of [{level:16},{attackSpeed:2.5},{attackPriority:'champion'},{bindLeft:false},{combatHazards:false}])assert.notEqual(settingsKey(config),settingsKey({...config,...change}));
});

test('E resets recovery once and empowers the next released attack, including after a cancellation',()=>{
  const s=setup();s.combat.attackTarget('near');s.tick(.22);assert.equal(s.combat.hits,1);
  assert.equal(s.combat.castE(),true);assert.equal(s.combat.castE(),false);assert.equal(s.combat.resets,1);
  s.tick(.01);s.combat.move({x:20,z:0});assert.equal(s.combat.empowered,true);
  s.combat.attackTarget('near');s.tick(.23);assert.equal(s.combat.damage,180);assert.equal(s.combat.empowered,false);
});
test('W heals to the cap and boosts movement for two seconds without resetting an attack',()=>{
  const s=setup();s.combat.playerHealth=970;s.combat.attackTarget('near');s.tick(.01);const windup=s.combat.windup;
  assert.equal(s.combat.castW(),true);assert.equal(s.combat.castW(),false);assert.equal(s.combat.playerHealth,1000);assert.equal(s.combat.windup,windup);
  s.combat.move({x:1000,z:0});s.tick(1);assert.ok(Math.abs(s.position.x-435.5)<.01);s.tick(1.1);assert.equal(s.combat.speedMultiplier,1);
});
test('circuit rotates after two releases and credits projectiles using the release-time mark',()=>{
  const s=setup({circuit:true});s.combat.attackTarget('near');s.tick(.8);
  assert.equal(s.combat.completedMarks,1);assert.equal(s.combat.markedId,'far');assert.equal(s.combat.priorityHits,2);
  s.combat.stop();s.tick(3.6);assert.equal(s.combat.missedMarks,1);assert.equal(s.combat.markedId,'near');
});
test('kite metric requires actual displacement between released attacks, not extra clicks',()=>{
  const s=setup();s.combat.attackTarget('near');s.tick(.2);s.combat.move({x:80,z:0});s.tick(.25);s.combat.attackTarget('near');s.tick(.35);
  assert.equal(s.combat.kiteSteps,1);assert.equal(s.combat.kiteOpportunities,1);
  s.tick(.5);assert.equal(s.combat.kiteSteps,1);assert.equal(s.combat.kiteOpportunities,2);
});
test('raw APM counts repeated orders while distinct APM ignores identical attack orders',()=>{
  const s=setup();for(let i=0;i<10;i++)s.combat.attackTarget('near');
  const report=s.combat.summary(10);assert.equal(report.apm,60);assert.equal(report.changedApm,6);
});
test('pause also freezes abilities and priority deadlines, and defeats prevent casts',()=>{
  const s=setup({circuit:true});s.combat.castW();s.combat.castE();const before=JSON.stringify(s.combat);s.combat.update(0,s.position,s.target,335);assert.equal(JSON.stringify(s.combat),before);
  s.combat.takeDamage(1000);s.tick(11);assert.equal(s.combat.castE(),false);assert.equal(s.combat.castW(),false);
});
