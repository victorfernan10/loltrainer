import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LeBlancCombat,leblancRanks} from '../src/leblanc-combat.js';

function setup(options={}){
  const c=new LeBlancCombat({targets:[{id:'a',position:{x:400,z:0}},{id:'b',position:{x:650,z:300}}],...options}),p={x:0,z:0},dest={...p};
  const tick=(seconds,opts={})=>{for(let t=0;t<seconds-1e-9;t+=.01)c.update(Math.min(.01,seconds-t),p,dest,340,opts);};
  const cast=(key,point=c.target('a').position,id='a')=>c.castAbility(key,point,p,id);
  return {c,p,dest,tick,cast};
}
test('automatic ranks respect champion level and never borrow Kayle skills',()=>{
  assert.deepEqual(leblancRanks(6),{Q:1,W:3,E:1,R:1});assert.deepEqual(leblancRanks(16),{Q:5,W:5,E:3,R:3});
  const {c,cast}=setup({level:1});assert.equal(cast('Q'),false);assert.equal(cast('R'),false);assert.equal(c.castE(),false);assert.equal(c.castW(),false);assert.equal(cast('W'),true);
});
test('Q needs an actual live target and rejects out-of-range casts without spending cooldown or mana',()=>{
  const {c,p,cast}=setup({unlimitedMana:false});assert.equal(cast('Q',{x:0,z:0},null),false);p.x=-301;assert.equal(cast('Q'),false);assert.equal(c.cooldowns.Q,0);assert.equal(c.mana,c.maxMana);
});
test('Q marks only on impact; autos do not consume marks; E does',()=>{
  const {c,tick,cast}=setup();cast('Q');tick(.25);assert.equal(c.damage,0);tick(.21);assert.equal(c.damage,65);
  c.attackTarget('a');tick(.5);c.stop();assert.equal(c.damage,125);assert.equal(c.target('a').sigils.length,1);
  cast('E');tick(.5);assert.equal(c.damage,240);assert.equal(c.markDetonations,1);assert.equal(c.hits,1);
  tick(1.51);assert.equal(c.damage,320);assert.equal(c.roots,1);assert.ok(c.target('a').rootUntil>c.time);
});
test('expired marks do not detonate',()=>{const {c,tick,cast}=setup();cast('Q');tick(4.1);cast('E');tick(.6);assert.equal(c.damage,115);assert.equal(c.markDetonations,0);});
test('Q R E combo detonates both sigils, copies the last basic spell and counts no fake AA hits',()=>{
  const {c,tick,cast}=setup();cast('Q');tick(.46);cast('R');tick(.46);assert.equal(c.damage,200);assert.equal(c.lastBasic,'Q');assert.equal(c.cooldowns.R>c.time,true);
  cast('E');tick(2.2);assert.equal(c.damage,470);assert.equal(c.markDetonations,2);assert.equal(c.roots,1);assert.equal(c.hits,0);assert.equal(c.skillCasts,3);assert.equal(c.lastBasic,'E');
});
test('W clamps travel to 600, deals AoE at arrival and has a free return',()=>{
  const {c,p,tick,cast}=setup({unlimitedMana:false});const mana=c.mana;cast('W',{x:1000,z:0});assert.equal(c.damage,0);tick(.2);assert.ok(p.x>0&&p.x<600);tick(.22);assert.equal(p.x,600);assert.equal(c.damage,155);assert.ok(c.mana<mana-75);
  tick(.21);const remaining=c.cooldowns.W;c.move({x:900,z:0});tick(.05);assert.ok(p.x>600);cast('W');assert.equal(p.x,0);assert.equal(c.returns,1);assert.equal(c.cooldowns.W,remaining);assert.equal(c.order.type,'stop');assert.equal(c.lastBasic,'W');
});
test('W and RW retain independent anchors, including after casting a different basic spell',()=>{
  const {c,p,tick,cast}=setup();cast('W',{x:300,z:0});tick(.42);cast('R',{x:600,z:0});tick(.42);
  assert.equal(c.anchors.W.position.x,0);assert.equal(c.anchors.R.position.x,300);
  cast('E',{x:0,z:1000});tick(.3);assert.equal(c.lastBasic,'E');cast('R');assert.equal(p.x,300);assert.ok(c.anchors.W);assert.equal(c.anchors.R,undefined);cast('W');assert.equal(p.x,0);
});
test('E hits only the first circle on the swept path, even across a large update',()=>{
  const {c,p,dest,cast}=setup({targets:[{id:'a',position:{x:600,z:0}},{id:'b',position:{x:300,z:0}}]});cast('E');c.update(.25,p,dest,340);c.update(.4,p,dest,340);
  assert.equal(c.target('b').health,550);assert.equal(c.target('a').health,600);assert.equal(c.tethers[0].targetId,'b');
});
test('a missed E cannot hit off-axis targets and disappears at its maximum range',()=>{
  const {c,tick,cast}=setup();cast('E',{x:0,z:900});tick(1);assert.equal(c.damage,0);assert.equal(c.skillProjectiles.length,0);assert.equal(c.tethers.length,0);
});
test('breaking E cancels delayed damage/root and reconnecting does not restore the chain',()=>{
  const {c,p,tick,cast}=setup();cast('E');tick(.5);assert.equal(c.damage,50);p.x=-500;tick(.02);p.x=0;tick(2);assert.equal(c.damage,50);assert.equal(c.roots,0);assert.equal(c.tethers.length,0);
});
test('RE uses R damage values and preserves the independent E cooldown',()=>{
  const {c,tick,cast}=setup();cast('E');tick(.6);const cd=c.cooldowns.E;cast('R');tick(2.2);assert.equal(c.damage,340);assert.equal(c.roots,2);assert.equal(c.cooldowns.E,cd);
});
test('rapid inputs buffer the next cast once, prevent attacks/movement during casts, and resume a move order afterwards',()=>{
  const {c,p,tick,cast}=setup();cast('Q');c.move({x:0,z:500});cast('E');tick(.2);assert.equal(p.z,0);assert.equal(c.skillCasts,1);tick(.06);assert.equal(c.skillCasts,2);assert.equal(c.casting.ability,'E');
  c.move({x:0,z:500});tick(.2);assert.equal(p.z,0);tick(.15);assert.ok(p.z>0);assert.equal(c.started,0);
});
test('S clears a buffered spell without corrupting the already committed cast',()=>{
  const {c,tick,cast}=setup();cast('Q');cast('E');c.stop();tick(1);assert.equal(c.skillCasts,1);assert.equal(c.damage,65);assert.equal(c.queued,null);
});
test('pause freezes cast, mana, dash and return window; draining finishes launched effects only',()=>{
  const {c,p,dest,tick,cast}=setup({unlimitedMana:false});cast('W');const before=JSON.stringify(c);c.update(0,p,dest,340);assert.equal(JSON.stringify(c),before);
  c.endAttacks();tick(2,{allowStart:false});assert.equal(c.pending,false);assert.equal(cast('E'),false);assert.equal(c.skillCasts,1);
});
test('death cancels casts, dashes and tethers, and a respawn never inherits marks or pending hits',()=>{
  const {c,tick,cast}=setup();cast('Q');tick(.46);c.target('a').health=1;cast('E');tick(.5);assert.equal(c.target('a').alive,false);tick(1.3);assert.equal(c.target('a').alive,true);assert.equal(c.target('a').sigils.length,0);assert.equal(c.target('a').health,600);
  cast('W');c.takeDamage(1000);assert.equal(c.dash,null);assert.equal(cast('R'),false);assert.equal(c.pending,false);
});
test('mana is charged once, no cost for R, and AP scales damage using extracted coefficients',()=>{
  const {c,tick,cast}=setup({unlimitedMana:false,abilityPower:100});const mana=c.mana;cast('Q');assert.equal(c.mana,mana-50);assert.equal(cast('Q'),true);tick(.5);assert.equal(c.damage,105);assert.equal(c.skillCasts,1);
  c.mana=0;assert.equal(cast('E'),false);assert.equal(cast('R'),true);assert.equal(c.mana,0);
});
test('return pad expires and cannot bypass cooldown; zero-length E cannot create a stationary hit projectile',()=>{
  const {c,p,tick,cast}=setup();assert.equal(cast('E',p),false);assert.equal(c.cooldowns.E,0);
  cast('W',{x:200,z:0});tick(4.5);assert.equal(c.anchors.W,undefined);assert.equal(cast('W'),false);assert.equal(p.x,200);
});
