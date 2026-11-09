import test from 'node:test';
import assert from 'node:assert/strict';
import {CaitlynCombat} from '../src/caitlyn-combat.js';
const unit=(id,x,z=0,kind='champion')=>({id,kind,position:{x,z},radius:65,maxHealth:10000});
function setup(targets=[unit('enemy',600)],options={}){const c=new CaitlynCombat({level:18,attackSpeed:1,targets,unlimitedMana:true,random:()=>.99,...options}),p={x:0,z:0},m={...p};return {c,p,step:n=>c.update(n,p,m,325)};}
test('Q commits direction, waits its cast and pierces with reduced subsequent damage',()=>{
  const {c,p,step}=setup([unit('near',400),unit('far',800),unit('outside',600,200)]);
  assert.ok(c.castAbility('Q',{x:1300,z:0},p));c.move({x:0,z:1000});step(.6);assert.equal(c.skillHits,0);assert.equal(p.z,0);
  step(1);const a=10000-c.target('near').health,b=10000-c.target('far').health;
  assert.ok(a>0);assert.ok(Math.abs(b/a-.6)<.01);assert.equal(c.target('outside').health,10000);assert.equal(c.abilityStats.Q.hits,1);
});
test('trap-vulnerable targets take full Q damage even after another unit',()=>{
  const {c,p,step}=setup([unit('near',400),unit('far',800)]);c.target('far').caitlynTrapVulnerableUntil=5;
  c.castAbility('Q',{x:1300,z:0},p);step(1.5);assert.equal(c.target('near').health,c.target('far').health);
});
test('W is a persistent entity, arms before root, grants one target-specific extended shot',()=>{
  const {c,p,step}=setup([unit('trapped',700),unit('other',1050,200)]);const t=c.target('trapped');
  assert.ok(c.castAbility('W',t.position,p));step(.8);assert.equal(c.traps.length,1);assert.equal(c.trapsTriggered,0);
  step(.4);assert.equal(c.trapsTriggered,1);assert.ok(t.rootUntil>c.time);assert.equal(c.rangeFor(t),1300);assert.equal(c.rangeFor(c.target('other')),650);
  t.position.x=1100;c.attackTarget(t.id);step(.7);assert.equal(c.trapHeadshots,1);assert.equal(c.rangeFor(t),650);
});
test('W charges recharge serially and old traps do not prolong session draining',()=>{
  const {c,p,step}=setup([]);const count=c.wCharges;
  for(let i=0;i<count;i++){assert.ok(c.castAbility('W',{x:300,z:i*100},p));step(.51);}
  assert.equal(c.wCharges,0);assert.equal(c.castAbility('W',{x:300,z:0},p),false);step(7.6);assert.equal(c.wCharges,1);
  c.endAttacks();step(.1);assert.equal(c.pending,false);assert.ok(c.traps.length>0);
});
test('E hits only the first unit, slows/marks it and recoils 400 units',()=>{
  const {c,p,step}=setup([unit('first',400),unit('second',600)]);c.castAbility('E',{x:800,z:0},p);step(.6);
  assert.ok(Math.abs(p.x+400)<1e-6);assert.ok(c.target('first').slowUntil>c.time);assert.equal(c.rangeFor(c.target('first')),1300);assert.equal(c.rangeFor(c.target('second')),650);assert.equal(c.target('second').health,10000);
  step(3);assert.equal(c.rangeFor(c.target('first')),650);
});
test('Q can be cast during the E recoil without erasing its displacement',()=>{
  const {c,p,step}=setup();c.castAbility('E',{x:800,z:0},p);step(.2);assert.ok(c.dash);assert.ok(c.castAbility('Q',{x:1200,z:0},p));step(1.1);assert.ok(Math.abs(p.x+400)<1e-6);assert.equal(c.skillCasts,2);
});
test('passive builds on ordinary releases and consumes a headshot without resetting attack cooldown',()=>{
  const {c,p,step}=setup();c.attackTarget('enemy');for(let i=0;i<6;i++)step(1);
  assert.equal(c.released,6);assert.equal(c.headshots,1);assert.equal(c.headshotStacks,0);assert.ok(c.readyAt>=5);
});
test('W and E marks are independent and attack-move can acquire an extended-range target',()=>{
  const {c,p,step}=setup([unit('enemy',1100)]),t=c.target('enemy');c.mark(t,'W');c.mark(t,'E');
  c.attackMove(t.position,p);step(.3);assert.equal(c.trapHeadshots,1);assert.equal(c.rangeFor(t),1300);step(1);assert.equal(c.netHeadshots,1);assert.equal(c.rangeFor(t),650);
});
test('R has a full channel and is intercepted by the first champion, not a minion',()=>{
  const {c,p,step}=setup([unit('minion',200,0,'minion'),unit('blocker',500),unit('victim',1000)]);
  assert.ok(c.castAbility('R',c.target('victim').position,p,'victim'));step(.99);assert.equal(c.skillHits,0);assert.ok(c.channel);
  step(.5);assert.equal(c.rIntercepted,1);assert.ok(c.target('blocker').health<10000);assert.equal(c.target('minion').health,10000);assert.equal(c.target('victim').health,10000);
});
test('R loses its channel to crowd control or target death; committed bullets still drain',()=>{
  const a=setup();a.c.castAbility('R',a.c.target('enemy').position,a.p,'enemy');a.step(.4);a.c.interruptSkills();a.step(2);assert.equal(a.c.skillHits,0);assert.equal(a.c.pending,false);
  const b=setup();b.c.castAbility('R',b.c.target('enemy').position,b.p,'enemy');b.step(1.02);b.c.endAttacks();assert.ok(b.c.pending);b.step(.5);assert.equal(b.c.skillHits,1);assert.equal(b.c.pending,false);
});
test('ranks and mana block unavailable spells; pause freezes traps, casts and cooldowns',()=>{
  const {c,p,step}=setup(undefined,{level:1,unlimitedMana:false});assert.equal(c.castAbility('R',{x:600,z:0},p,'enemy'),false);c.mana=0;assert.equal(c.castAbility('Q',{x:1000,z:0},p),false);
  c.mana=200;assert.ok(c.castAbility('Q',{x:1000,z:0},p));const time=c.time;step(0);assert.equal(c.time,time);assert.ok(c.casting);
});
test('critical attack animation and release damage use the same committed result',()=>{
  const {c,step}=setup(undefined,{critChance:100});c.attackTarget('enemy');step(.01);
  assert.equal(c.drainEvents().find(e=>e.type==='start').critical,true);step(.5);
  assert.equal(c.drainEvents().find(e=>e.type==='hit').critical,true);
  assert.equal(10000-c.target('enemy').health,Math.round(c.attackDamage*2));
});
