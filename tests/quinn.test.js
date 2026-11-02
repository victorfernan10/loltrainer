import {test} from 'node:test';
import assert from 'node:assert/strict';
import {QuinnCombat,firstContact} from '../src/quinn-combat.js';
import {QUINN as S,quinnRanks,quinnHarrierDamage,quinnHarrierCooldown} from '../src/quinn-data.js';
const point=(x=0,z=0)=>({x,z});
function fixture(options={}){
  const c=new QuinnCombat({level:6,attackSpeed:1,unlimitedMana:false,random:()=>.99,targets:[{id:'enemy',position:point(0,500),maxHealth:3000}],...options}),p=point(),to=point();
  return {c,p,to,tick(t,fps=120){for(let left=t;left>1e-8;){const dt=Math.min(1/fps,left);c.update(dt,p,to,330);left-=dt;}}};
}
test('Quinn ranks, fixed AA range and original resource curves are independent of difficulty',()=>{
  assert.equal(quinnRanks(1).E,1);assert.deepEqual(quinnRanks(18),{Q:5,W:5,E:5,R:3});
  const {c}=fixture();assert.equal(c.range,525);assert.equal(c.profile.moveSpeed,330);
  assert.equal(quinnHarrierDamage(1),15);assert.equal(quinnHarrierDamage(18),120);assert.ok(quinnHarrierCooldown(1)<quinnHarrierCooldown(0));
});
test('targeted E rejects empty cursor, unavailable targets and out-of-range targets without spending mana',()=>{
  const {c,p}=fixture(),mana=c.mana;
  assert.equal(c.castAbility('E',point(0,500),p),false);assert.equal(c.mana,mana);assert.equal(c.cooldowns.E,0);
  c.target('enemy').position.z=900;assert.equal(c.castAbility('E',point(0,900),p,'enemy'),false);assert.equal(c.mana,mana);
});
test('Vault contacts the target, marks, knocks it back and then returns before resuming movement',()=>{
  const e=fixture(),enemy=e.c.target('enemy');e.c.passiveReadyAt=999;
  assert.equal(e.c.castAbility('E',enemy.position,e.p,enemy.id),true);e.tick(.21);
  assert.equal(e.c.dash.phase,'rebound');assert.equal(e.c.drainEvents().filter(e=>e.type==='vault-impact').length,1);assert.ok(enemy.stunUntil>e.c.time);assert.ok(enemy.quinnMarkUntil>e.c.time);
  e.c.move(point(-400,0));e.tick(.3);assert.equal(e.c.dash,null);assert.ok(e.p.x<0);assert.equal(e.c.vaults,1);assert.ok(e.c.cooldowns.E>e.c.time);
});
test('E contact against an approaching W is continuous and independent of rendering frequency',()=>{
  const times=[];
  for(const fps of [20,60,144]){
    const e=fixture(),v=e.c.target('enemy');e.tick(.1,fps);
    v.vaultDash={id:4,origin:point(0,500),end:point(),startedAt:.1,until:.1+500/1450,speed:1450};
    e.c.castAbility('E',v.position,e.p,v.id);e.tick(.3,fps);
    const hit=e.c.drainEvents().find(e=>e.type==='vault-impact');assert.ok(hit);assert.ok(hit.time<v.vaultDash.until);times.push(hit.time);
  }
  assert.ok(Math.max(...times)-Math.min(...times)<.001);
  assert.equal(firstContact(point(-100,0),point(100,0),point(100,0),point(-100,0),20),.45);
});
test('Q waits for its cast, hits the first collision, applies nearsight and does not pierce to distant targets',()=>{
  const e=fixture({targets:[{id:'front',position:point(0,400),maxHealth:3000},{id:'rear',position:point(0,900),maxHealth:3000}]});e.c.passiveReadyAt=999;
  e.c.castAbility('Q',point(0,1000),e.p);e.tick(.24);assert.equal(e.c.skillProjectiles.length,0);e.tick(.5);
  assert.ok(e.c.target('front').health<3000);assert.equal(e.c.target('rear').health,3000);assert.ok(e.c.target('front').nearsightUntil>e.c.time);assert.equal(e.c.skillProjectiles.length,0);
});
test('Harrier triggers once per mark on attack impact and grants learned W buffs',()=>{
  const {c}=fixture(),v=c.target('enemy');c.mark(v);const hp=v.health;c.damageTarget(v,60);assert.equal(c.harrierProcs,1);assert.equal(v.health,hp-Math.round(60+quinnHarrierDamage(6)));assert.ok(c.speedMultiplier>1);
  c.damageTarget(v,60);assert.equal(c.harrierProcs,1);assert.equal(c.heightenedUntil,2);
});
test('crit doubles the basic hit but does not double Harrier bonus',()=>{
  const {c}=fixture({critChance:100}),v=c.target('enemy');c.mark(v);c.damageTarget(v,60);assert.equal(v.health,3000-Math.round(120+quinnHarrierDamage(6)));
});
test('W costs no mana, reveals range for two seconds, and can be used during Valor flight',()=>{
  const e=fixture(),mana=e.c.mana;e.c.valor=true;e.c.castAbility('W',e.p,e.p);assert.equal(e.c.mana,mana);assert.equal(e.c.valor,true);assert.equal(e.c.target('enemy').revealedUntil,2);assert.ok(e.c.cooldowns.W>20);
});
test('R channels, movement interrupts, then flight recast damages and marks targets',()=>{
  const e=fixture();e.c.castAbility('R',e.p,e.p);e.tick(.5);assert.equal(e.c.valor,false);e.c.move(point(20));assert.equal(e.c.casting,null);
  e.tick(3);e.c.castAbility('R',e.p,e.p);e.tick(2.1);assert.equal(e.c.valor,true);assert.ok(e.c.speedMultiplier>1);
  const before=e.c.target('enemy').health;e.c.castAbility('R',e.p,e.p);assert.equal(e.c.valor,false);assert.equal(e.c.skystrikes,1);assert.equal(e.c.target('enemy').health,before-S.R.damage[0]);assert.ok(e.c.target('enemy').quinnMarkUntil>e.c.time);
});
test('damage interrupts R channel and temporarily removes flight movement bonus',()=>{
  const e=fixture();e.c.castAbility('R',e.p,e.p);e.tick(.5);e.c.takeDamage(10);assert.equal(e.c.casting,null);
  e.c.valor=true;const fast=e.c.speedMultiplier;e.c.takeDamage(10);assert.equal(e.c.valor,true);assert.ok(e.c.speedMultiplier<fast);e.tick(3.1);assert.equal(e.c.speedMultiplier,fast);
});
test('pause freezes dash, cooldowns and mana; reset for practice is explicit, not normal E behavior',()=>{
  const e=fixture();e.c.castAbility('E',point(0,500),e.p,'enemy');e.tick(.1);const snapshot=JSON.stringify([e.p,e.c.dash,e.c.time,e.c.cooldowns,e.c.mana]);e.c.update(0,e.p,e.to,330);assert.equal(JSON.stringify([e.p,e.c.dash,e.c.time,e.c.cooldowns,e.c.mana]),snapshot);
  e.tick(.5);assert.equal(e.c.castAbility('E',e.c.target('enemy').position,e.p,'enemy'),false);e.c.resetVaultPractice();assert.equal(e.c.cooldowns.E,e.c.time);assert.equal(e.c.mana,e.c.maxMana);
});
test('ending a block drains an active vault without an automatic follow-up attack',()=>{
  const e=fixture();e.c.castAbility('E',point(0,500),e.p,'enemy');e.c.endAttacks();e.tick(1);assert.equal(e.c.pending,false);assert.equal(e.c.started,0);
});
test('overlapping-target E still has a valid knockback and a full rebound',()=>{
  const e=fixture();e.c.target('enemy').position={...e.p};e.c.castAbility('E',e.p,e.p,'enemy');e.tick(.4);
  assert.ok(Math.hypot(e.p.x,e.p.z)>500);assert.ok(Number.isFinite(e.p.z));
});
test('another ability cancels R channel, and Skystrike recast is ready while flying',()=>{
  const e=fixture();e.c.castAbility('R',e.p,e.p);e.tick(.2);e.c.castAbility('Q',point(0,1000),e.p);assert.equal(e.c.casting.key,'Q');assert.equal(e.c.valor,false);
  e.c.valor=true;assert.equal(e.c.abilityState('R').ready,true);assert.equal(e.c.abilityState('R').remaining,0);
});
