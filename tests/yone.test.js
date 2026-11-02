import {test} from 'node:test';
import assert from 'node:assert/strict';
import {YoneEncounter} from '../src/yone-encounter.js';
import {yoneQCooldown,yoneQCast} from '../src/yone-data.js';
import {Combat} from '../src/combat.js';
import {settingsKey} from '../src/training.js';

function setup(options={}){
  const target={id:'yone',position:{x:0,z:0},alive:true,health:1800,maxHealth:1800,generation:0},enemy=new YoneEncounter({target,random:()=>.5,bonusAS:80,...options}),p={x:0,z:0};
  const tick=(seconds,opts={})=>{for(let t=0;t<seconds-1e-8;t+=.01)enemy.update(.01,p,{x:0,z:0},opts);};
  const active=()=>{enemy.update(.81,p);tick(.26);};return {enemy,target,p,tick,active};
}
test('Yone Q speed is AS-based and capped, independent of pressure setting',()=>{
  assert.equal(yoneQCooldown(0),4);assert.ok(Math.abs(yoneQCooldown(.8)-2.08)<1e-8);assert.ok(Math.abs(yoneQCooldown(1.2)-4/3)<1e-8);assert.equal(yoneQCast(1.2),.175);
  assert.equal(setup({difficulty:1}).enemy.qCooldown,setup({difficulty:3}).enemy.qCooldown);
});
test('E separates the body, accelerates pursuit and returns to its origin after five seconds',()=>{
  const {enemy,p,active,tick}=setup({initialStacks:0});active();const anchor={...enemy.anchor};assert.equal(enemy.spirit,true);assert.ok(Math.hypot(enemy.position.x-anchor.x,enemy.position.z-anchor.z)>299);
  const early=enemy.moveSpeed;p.z=1000;tick(2);assert.ok(enemy.moveSpeed>early);tick(4);assert.equal(enemy.phase,'waiting');assert.ok(Math.hypot(enemy.position.x-anchor.x,enemy.position.z-anchor.z)<.001);
});
test('Q commits aim and stops movement until release, rather than tracking sidesteps',()=>{
  const {enemy,p,active,tick}=setup({initialStacks:0});active();enemy.drainEvents();enemy.cast('Q',p,{x:0,z:0});const origin={...enemy.position},direction={...enemy.action.direction};p.x=500;tick(.3);
  assert.deepEqual(enemy.position,origin);assert.deepEqual(enemy.drainEvents().find(e=>e.type==='telegraph').action.direction,direction);assert.equal(enemy.stats.Q.hits,0);
});
test('Q stacks only on hits; two hits arm Q3, which consumes stacks on cast',()=>{
  const {enemy,p,active,tick}=setup({initialStacks:0});active();enemy.cast('Q',p,{x:0,z:0});tick(.25);assert.equal(enemy.qStacks,1);tick(.16);enemy.cast('Q',p,{x:0,z:0});tick(.25);assert.equal(enemy.qStacks,2);tick(.16);enemy.cast('Q3',p,{x:0,z:0});assert.equal(enemy.qStacks,0);
});
test('Q3 body and projectile share a single hit, and the airborne timer expires',()=>{
  const {enemy,active,tick}=setup();active();tick(1);assert.equal(enemy.stats.Q3.hits,1);assert.equal(enemy.events.filter(e=>e.type==='damage'&&e.kind==='Q3').length,1);tick(1);assert.ok(enemy.time>enemy.playerLockedUntil);
});
test('E repeats only stored damage once, with the declared rank-3 coefficient',()=>{
  const {enemy,active,tick}=setup();active();enemy.recordedDamage=100;enemy.beginReturn();tick(1);const repeat=enemy.drainEvents().filter(e=>e.type==='damage'&&e.kind==='E');assert.equal(repeat.length,1);assert.equal(repeat[0].amount,30);tick(.5);assert.equal(enemy.drainEvents().filter(e=>e.kind==='E').length,0);
});
test('full preset has W and R whereas focused preset only uses E Q and AA',()=>{
  const focused=setup({pattern:'eq'}),full=setup({pattern:'full'});focused.tick(6.8);full.tick(6.8);assert.equal(focused.enemy.stats.W.casts+focused.enemy.stats.R.casts,0);assert.ok(full.enemy.stats.W.casts+full.enemy.stats.R.casts>0);
});
test('AA windup does not reset if the player repeatedly leaves and enters range',()=>{
  const {enemy,p,active,tick}=setup({initialStacks:0});active();enemy.action=null;enemy.qReadyAt=99;Object.assign(p,{x:enemy.position.x,z:enemy.position.z+200});tick(.01);const id=enemy.action.id;assert.equal(enemy.phase,'attack');
  for(let i=0;i<10;i++){p.z=enemy.position.z+(i%2?500:200);tick(.01);assert.equal(enemy.action.id,id);}assert.equal(enemy.stats.AA.casts,1);
});
test('root prevents chasing and E return until it expires; pause freezes all state',()=>{
  const {enemy,target,p,active,tick}=setup({initialStacks:0});active();enemy.qReadyAt=99;enemy.attackReadyAt=99;target.rootUntil=enemy.time+2;p.z=2000;const pos={...enemy.position};tick(.2);assert.deepEqual(enemy.position,pos);
  enemy.spiritUntil=enemy.time;tick(.3);assert.notEqual(enemy.phase,'e-return');const state=JSON.stringify(enemy);enemy.update(0,p);assert.equal(JSON.stringify(enemy),state);tick(2);assert.equal(enemy.phase,'waiting');
});
test('death cancels the next cast and regeneration is controlled by a new encounter',()=>{
  const {enemy,target,active,tick}=setup();active();target.alive=false;tick(.01);assert.equal(enemy.phase,'waiting');assert.equal(target.respawnAt,Infinity);tick(2.6);assert.equal(target.alive,true);assert.equal(target.health,1800);
});
test('finishing drains E and projectiles without spawning another round',()=>{const {enemy,active,tick}=setup();active();enemy.stop();tick(3,{allowStart:false});assert.equal(enemy.pending,false);assert.equal(enemy.rounds,1);});
test('Yone shield absorbs damage and history separates enemy speed/telegraph settings',()=>{
  const c=new Combat({targets:[{id:'yone',position:{x:0,z:0},maxHealth:1800}]});c.target('yone').shield=120;c.damageTarget(c.target('yone'),150);assert.equal(c.target('yone').health,1770);assert.equal(c.damage,30);
  const config={drill:'yone',skills:['yoneQ']};assert.notEqual(settingsKey(config),settingsKey({...config,yoneBonusAS:120}));assert.notEqual(settingsKey(config),settingsKey({...config,yoneTelegraphs:false}));
});

test('stun interrupts an unreleased Q, blocks attacks and delays E return until recovery',()=>{
  const {enemy,target,p,active,tick}=setup({initialStacks:0});active();enemy.cast('Q',p,{x:0,z:0});
  target.stunUntil=enemy.time+1.25;const pos={...enemy.position},hits=enemy.stats.Q.hits;
  enemy.spiritUntil=enemy.time+.1;tick(.6);
  assert.equal(enemy.action,null);assert.equal(enemy.phase,'stunned');assert.deepEqual(enemy.position,pos);assert.equal(enemy.stats.Q.hits,hits);
  tick(1);assert.ok(['waiting','e-return'].includes(enemy.phase));
});

test('Syndra slow applies only after CC, and a new encounter clears crowd control',()=>{
  const {enemy,target,active,tick}=setup();active();const normal=enemy.moveSpeed;
  target.slowStartsAt=enemy.time+.3;target.slowUntil=enemy.time+1.8;target.slowAmount=.7;
  assert.equal(enemy.moveSpeed,normal);tick(.4);assert.ok(enemy.moveSpeed<normal*.5);
  target.stunUntil=999;target.displacement={};enemy.startRound({x:0,z:0});
  assert.equal(target.stunUntil,0);assert.equal(target.slowUntil,0);assert.equal(target.displacement,undefined);
});
