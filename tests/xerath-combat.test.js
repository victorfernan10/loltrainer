import test from 'node:test';
import assert from 'node:assert/strict';
import {XerathCombat} from '../src/xerath-combat.js';
import {XERATH as X,xerathPassiveMana,xerathRanks} from '../src/xerath-data.js';

const origin=()=>({x:0,z:0});
const target=(id,x,z=0)=>({id,kind:'champion',position:{x,z},radius:65,maxHealth:10000});
function fixture(targets=[],options={}){const combat=new XerathCombat({level:18,targets,...options}),position=origin(),moveTarget=origin();return {combat,position,step:dt=>combat.update(dt,position,moveTarget,340)};}
const resolved=c=>c.drainEvents().filter(e=>e.type==='spell-resolved');

test('Q grows range while moving slowly; charge does not expose private aim to opponent',()=>{
  const {combat:c,position,step}=fixture([target('near',600),target('far',1400)]);
  c.move({x:1000,z:0});assert.equal(c.castAbility('Q',{x:1800,z:0},position),true);
  assert.equal(c.visibleThreats().length,0);assert.equal(c.qRange,750);step(1.5);
  assert.ok(Math.abs(c.qRange-1500)<1e-7);assert.ok(position.x>300&&position.x<410);
  c.updateAim({x:1800,z:0});c.releaseAbility('Q',c.aimPoint,position);
  assert.equal(c.visibleThreats()[0].width,145);const x=position.x;step(.49);assert.equal(c.skillHits,0);assert.equal(position.x,x);
  step(.02);assert.equal(c.skillHits,2);assert.equal(resolved(c).length,1);
});

test('Q tap range and width do not grow after commitment; expired/cancelled charge drains',()=>{
  const {combat:c,position,step}=fixture([target('beyond',900),target('outside',500,140)]);
  c.castAbility('Q',{x:1500,z:0},position);c.releaseAbility('Q',{x:1500,z:0},position);step(.51);
  assert.equal(c.skillHits,0);assert.equal(resolved(c)[0].hit,false);
  c.cooldowns.Q=0;c.castAbility('Q',{x:1500,z:0},position);step(3.1);assert.equal(c.charge,null);assert.equal(c.pending,false);
  c.cooldowns.Q=0;c.castAbility('Q',{x:1500,z:0},position);c.endAttacks();assert.equal(c.pending,false);assert.equal(c.castAbility('W',position,position),false);
});

test('W unlocks walking after cast and damages only at .75s with central bonus/decaying slow',()=>{
  const {combat:c,position,step}=fixture([target('center',500),target('edge',750)]);
  c.castAbility('W',{x:500,z:0},position);c.move({x:1000,z:0});step(.24);assert.equal(position.x,0);step(.3);assert.ok(position.x>0);assert.equal(c.skillHits,0);
  step(.22);assert.equal(c.skillHits,2);const a=c.target('center'),b=c.target('edge');assert.ok(a.health<b.health);assert.ok(a.slowAmount>b.slowAmount);
  const e=resolved(c)[0];assert.deepEqual(e.centerHits,['center']);assert.equal(e.time<.77,true);step(2);assert.equal(a.slowAmount,.25);
});

test('E picks first collision by distance, emits one outcome and flight-scaled stun',()=>{
  const {combat:c,position,step}=fixture([target('far',900),target('near',500)]);
  c.castAbility('E',{x:2000,z:0},position);assert.ok(c.visibleThreats()[0].impactAt>1);step(.24);assert.equal(c.skillProjectiles.length,0);step(.5);
  assert.equal(c.target('far').health,10000);assert.equal(c.skillHits,1);assert.ok(c.target('near').stunUntil>c.time);assert.deepEqual(resolved(c)[0].targetIds,['near']);step(2);assert.equal(resolved(c).length,0);
});

test('E swept collision catches a fast perpendicular dash between frames',()=>{
  const {combat:c,position,step}=fixture([target('dash',500,-400)]);
  c.castAbility('E',{x:1500,z:0},position);step(.25);
  const t=c.target('dash');t.previousPosition={x:500,z:-400};t.position={x:500,z:400};step(.7);
  assert.equal(c.skillHits,1);assert.equal(c.stuns,1);assert.equal(resolved(c)[0].hit,true);
});

test('E miss resolves once and pending drains independently of accepting new skills',()=>{
  const {combat:c,position,step}=fixture();c.castAbility('E',{x:1500,z:0},position);c.endAttacks();assert.equal(c.pending,true);step(2);
  assert.equal(c.pending,false);assert.equal(resolved(c)[0].hit,false);step(2);assert.equal(resolved(c).length,0);
});

test('R channel roots, gates recasts, ramps champion hits once per shot and drains all charges',()=>{
  const {combat:c,position,step}=fixture([target('a',600),target('b',650)]);
  c.castAbility('R',{x:600,z:0},position);assert.equal(c.channel.shots,6);assert.equal(c.castAbility('R',{x:600,z:0},position),false);
  c.order={type:'move',point:{x:1000,z:0}};step(.5);assert.equal(position.x,0);
  const health=[];for(let n=0;n<6;n++){assert.equal(c.castAbility('R',{x:600,z:0},position),true);assert.equal(c.castAbility('R',{x:600,z:0},position),false);step(.6);health.push(c.target('a').health);}
  assert.equal(10000-health[0],270);assert.equal(health[0]-health[1],300);assert.equal(c.channel,null);assert.equal(c.pending,false);assert.equal(c.skillCasts,6);assert.equal(resolved(c).length,6);
});

test('moving cancels R; S cancels Q; already committed R shot survives end of exercise',()=>{
  const {combat:c,position,step}=fixture([target('a',600)]);c.castAbility('R',{x:600,z:0},position);c.move({x:400,z:0});assert.equal(c.channel,null);
  c.cooldowns.R=0;c.castAbility('R',{x:600,z:0},position);step(.5);c.castAbility('R',{x:600,z:0},position);c.endAttacks();assert.equal(c.pending,true);step(.7);assert.equal(c.pending,false);assert.equal(c.skillHits,1);
  const fresh=fixture();fresh.combat.castAbility('Q',{x:100,z:0},fresh.position);fresh.combat.stop();assert.equal(fresh.combat.pending,false);
});

test('passive restores mana on landed AA, never spells, with kill cooldown refund',()=>{
  const {combat:c,position,step}=fixture([target('a',500)],{unlimitedMana:false});c.mana=0;
  c.damageTarget(c.target('a'),50);assert.equal(c.mana,xerathPassiveMana(18)*2);assert.equal(c.passiveProcs,1);
  const prior=c.passiveReadyAt;c.spellDamage(c.target('a'),20000,{id:1,key:'Q'});assert.equal(c.passiveProcs,1);assert.equal(c.passiveReadyAt,prior-X.passive.killRefund);
  const other=fixture([target('a',500)],{unlimitedMana:false});other.combat.mana=500;other.combat.castAbility('W',{x:500,z:0},other.position);other.step(.8);assert.equal(other.combat.passiveProcs,0);
  assert.equal(xerathPassiveMana(1),30);assert.equal(xerathPassiveMana(18),195);
});

test('ranks, native cooldown haste, mana rejection and frozen updates',()=>{
  assert.deepEqual(xerathRanks(1),{Q:1,W:0,E:0,R:0});const {combat:c,position,step}=fixture([],{level:6,abilityHaste:100,unlimitedMana:false});
  assert.equal(c.cooldown('Q'),3.5);c.mana=0;assert.equal(c.castAbility('Q',{x:500,z:0},position),false);c.mana=c.maxMana;
  c.castAbility('Q',{x:500,z:0},position);const time=c.time;step(0);assert.equal(c.time,time);assert.equal(c.qRange,750);c.cancelCharge();assert.equal(c.charge,null);
});
