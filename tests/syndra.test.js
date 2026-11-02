import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SyndraCombat} from '../src/syndra-combat.js';
import {SYNDRA, syndraRanks} from '../src/syndra-data.js';
import {settingsKey} from '../src/training.js';

function setup(options={}) {
  const combat=new SyndraCombat({level:18,syndraSplinters:0,targets:[{id:'enemy',position:{x:400,z:0},maxHealth:3000}],...options});
  const position={x:0,z:0},destination={...position};
  const tick=(dt,flags={})=>combat.update(dt,position,destination,330,{allowStart:false,...flags});
  const cast=(key,point={x:400,z:0},id=null)=>combat.castAbility(key,point,position,id);
  return {combat,position,destination,tick,cast,target:combat.target('enemy')};
}
function close(actual,expected,tolerance=1e-6){assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);}

test('level-one Syndra has a ranged auto with her own windup, missile and attack damage',()=>{
  const {combat,tick,target}=setup({level:1,attackSpeed:1});
  combat.attackTarget('enemy');tick(.01,{allowStart:true});assert.equal(combat.ranged,true);assert.equal(combat.range,550);
  close(combat.windup.releaseAt-combat.windup.startedAt,.1875);
  tick(.2);assert.equal(target.health,3000);assert.equal(combat.bolts.length,1);close(combat.bolts[0].duration,400/1800);
  tick(.23);assert.equal(target.health,2946);assert.equal(combat.hits,1);
});

test('Syndra history separates haste and initial passive upgrades',()=>{
  const config={champion:'syndra',drill:'combat',skills:[]};
  assert.notEqual(settingsKey(config),settingsKey({...config,abilityHaste:50}));
  assert.notEqual(settingsKey(config),settingsKey({...config,syndraSplinters:120}));
});

test('Syndra ranks obey level gates and rank caps',()=>{
  for(let level=1;level<=18;level++){
    const ranks=syndraRanks(level);
    assert.equal(Object.values(ranks).reduce((a,b)=>a+b,0),level);
    assert.ok(ranks.Q<=5&&ranks.W<=5&&ranks.E<=5&&ranks.R<=3);
    assert.equal(ranks.R,level<6?0:level<11?1:level<16?2:3);
  }
  assert.deepEqual(syndraRanks(18),{Q:5,W:5,E:5,R:3});
});

test('Q hits after formation, stays at its cast point while Syndra moves, and expires',()=>{
  const {combat,position,tick,cast,target}=setup();
  combat.move({x:0,z:1000});assert.equal(cast('Q'),true);
  const id=combat.spheres[0].id;
  tick(.59);assert.equal(target.health,3000);assert.equal(combat.spheres[0].state,'forming');assert.ok(position.z>190);
  tick(.02);assert.equal(target.health,2770);assert.equal(combat.spheres[0].state,'ground');
  assert.deepEqual(combat.spheres[0].position,{x:400,z:0});assert.equal(combat.spheres[0].id,id);
  tick(5.98);assert.equal(combat.spheres.length,1);tick(.03);assert.equal(combat.spheres.length,0);
});

test('Q clamps to 800 and uses circular collision plus enemy radius',()=>{
  const {combat,cast,tick}=setup({targets:[{id:'edge',position:{x:1044,z:0},radius:65,maxHealth:3000},{id:'outside',position:{x:1046,z:0},radius:65,maxHealth:3000}]});
  cast('Q',{x:1200,z:0});assert.deepEqual(combat.spheres[0].position,{x:800,z:0});tick(.61);
  assert.equal(combat.target('edge').health,2770);assert.equal(combat.target('outside').health,3000);
});

test('W preserves sphere identity, requires recast delay, charges mana only once and starts cooldown on throw',()=>{
  const {combat,cast,tick,target}=setup({unlimitedMana:false});
  cast('Q');tick(.61);const sphere=combat.spheres[0],manaBefore=combat.mana;
  assert.equal(cast('W'),true);assert.equal(combat.holding.id,sphere.id);close(combat.mana,manaBefore-100);
  assert.equal(cast('W'),false);assert.equal(combat.cooldowns.W,0);
  tick(.26);const manaBeforeThrow=combat.mana;assert.equal(cast('W'),true);close(combat.mana,manaBeforeThrow);
  assert.equal(combat.holding,null);assert.equal(sphere.state,'throw');close(combat.cooldowns.W-combat.time,9);
  tick(1);assert.equal(combat.spheres.length,1);assert.equal(sphere.id,combat.spheres[0].id);assert.equal(sphere.state,'ground');
  assert.equal(target.health,2580);assert.ok(target.slowUntil>combat.time);assert.equal(target.slowAmount,.25);
});

test('W timeout drops a held sphere with renewed lifetime and starts cooldown',()=>{
  const {combat,cast,tick}=setup();cast('Q');tick(.61);cast('W');const sphere=combat.holding;
  tick(4.99);assert.equal(combat.holding.id,sphere.id);tick(.02);
  assert.equal(combat.holding,null);assert.equal(sphere.state,'ground');assert.ok(sphere.expiresAt-combat.time>5.9);
  assert.ok(combat.abilityState('W').remaining>8.9);assert.equal(cast('W'),false);
});

test('W cannot grab forming/out-of-range spheres and failed pickup consumes nothing',()=>{
  const {combat,cast,tick}=setup({unlimitedMana:false});cast('Q');const mana=combat.mana;
  assert.equal(cast('W'),false);assert.equal(combat.mana,mana);tick(.61);
  assert.equal(cast('W',{x:-1000,z:0}),false);assert.equal(combat.heldId,null);
  combat.spheres[0].position.x=1000;assert.equal(cast('W',{x:1000,z:0}),false);
});

test('upgraded W adds current true-damage formula and keeps the slow',()=>{
  const {combat,cast,tick,target}=setup({syndraSplinters:60,abilityPower:200});
  const sphere=combat.sphere({x:400,z:0});cast('W');tick(.26);cast('W');tick(1);
  assert.equal(sphere.state,'ground');assert.equal(target.health,3000-Math.round((190+.65*200)*(1+.12+.0002*200)));
  assert.equal(target.slowAmount,.25);
});

test('Q charges enforce intercast gate and recharge sequentially with R-rank haste',()=>{
  const {combat,cast,tick}=setup({syndraSplinters:40});assert.equal(combat.qCharges,2);
  cast('Q');assert.equal(combat.qCharges,1);assert.equal(cast('Q'),false);tick(1.26);
  assert.equal(cast('Q'),true);assert.equal(combat.qCharges,0);const first=combat.qRecharges[0],second=combat.qRecharges[1];
  close(first,7/1.3);close(second-first,7/1.3);tick(first-combat.time-.01);assert.equal(combat.qCharges,0);
  tick(.02);assert.equal(combat.qCharges,1);tick(second-combat.time+.01);assert.equal(combat.qCharges,2);
});

test('passive Q upgrade adds one charge without resetting outstanding recharge',()=>{
  const {combat,cast}=setup({syndraSplinters:39});cast('Q');const recharge=combat.qRecharges[0];
  combat.addSplinters(1);assert.equal(combat.maxQCharges,2);assert.equal(combat.qCharges,1);assert.equal(combat.qRecharges[0],recharge);
  combat.addSplinters(500);assert.equal(combat.splinters,120);assert.equal(combat.qCharges,1);
});

test('E pushed sphere stuns beyond the cone and does not double-damage cone victims',()=>{
  const {combat,cast,tick}=setup({targets:[{id:'near',position:{x:500,z:0},maxHealth:3000},{id:'far',position:{x:1050,z:0},maxHealth:3000}]});
  const sphere=combat.sphere({x:300,z:0});cast('E');tick(.24);assert.equal(combat.damage,0);tick(.8);
  assert.equal(combat.target('near').health,2800);assert.equal(combat.target('far').health,2800);
  assert.ok(combat.target('far').stunUntil>combat.time);assert.ok(combat.stuns>=2);assert.equal(sphere.state,'ground');close(sphere.position.x,1300);
});

test('Q then E catches an already forming sphere; E then Q does not',()=>{
  const first=setup({targets:[{id:'enemy',position:{x:1000,z:0},maxHealth:3000}]});
  first.cast('Q',{x:300,z:0});first.cast('E');first.tick(1.2);
  assert.equal(first.target.health,2800);assert.ok(first.combat.stuns>0);close(first.combat.spheres[0].position.x,1300);
  const second=setup({targets:[{id:'enemy',position:{x:1000,z:0},maxHealth:3000}]});
  second.cast('E');assert.equal(second.cast('Q',{x:300,z:0}),true);second.tick(1.2,{allowStart:true});
  assert.equal(second.target.health,3000);assert.equal(second.combat.stuns,0);assert.equal(second.combat.spheres[0].state,'ground');close(second.combat.spheres[0].position.x,300);
});

test('E upgrade widens cone and applies slow after crowd control',()=>{
  const angle=35*Math.PI/180,targets=[{id:'enemy',position:{x:600*Math.cos(angle),z:600*Math.sin(angle)},radius:1,maxHealth:3000}];
  const base=setup({targets});base.cast('E');base.tick(.3);assert.equal(base.target.health,3000);
  const upgraded=setup({targets,syndraSplinters:80});upgraded.cast('E');upgraded.tick(.3);
  assert.equal(upgraded.target.health,2800);assert.equal(upgraded.target.slowAmount,.7);assert.ok(upgraded.target.slowStartsAt>upgraded.combat.time);
});

test('E swept collision and Q timing give the same outcome across render step sizes',()=>{
  function run(dt){const env=setup({targets:[{id:'enemy',position:{x:1200,z:0},radius:1,maxHealth:3000}]});env.cast('Q',{x:300,z:0});env.cast('E');for(let t=0;t<1.5-1e-9;t+=dt)env.tick(Math.min(dt,1.5-t));return env;}
  const small=run(1/240),large=run(.5);assert.equal(small.target.health,2800);assert.equal(large.target.health,small.target.health);assert.equal(large.combat.stuns,small.combat.stuns);
  close(large.combat.spheres[0].position.x,small.combat.spheres[0].position.x);
});

test('R fires three spheres without ground balls and restores them as ground entities',()=>{
  const {combat,cast,tick,target}=setup();assert.equal(cast('R',{x:400,z:0},'enemy'),true);tick(.24);assert.equal(combat.rSpheres,0);
  tick(1.6);assert.equal(combat.rSpheres,3);assert.equal(target.health,2520);assert.equal(combat.spheres.length,3);
  assert.ok(combat.spheres.every(s=>s.state==='ground'));assert.equal(combat.passiveProcs,0,'one R is one passive hit even with three missiles');
});

test('R caps at seven, reuses ground sphere identities and excludes held/out-of-range spheres',()=>{
  const {combat,cast,tick,target}=setup();const ids=[];
  for(let i=0;i<6;i++)ids.push(combat.sphere({x:100+i*50,z:80}).id);
  const outside=combat.sphere({x:1500,z:0}),held=combat.sphere({x:0,z:0},'held',{holdUntil:20,recastAt:0});combat.heldId=held.id;
  cast('R',{x:400,z:0},'enemy');tick(1.8);
  assert.equal(combat.rSpheres,7);assert.equal(target.health,1880);assert.equal(combat.spheres.length,11);
  assert.ok(ids.every(id=>combat.spheres.some(s=>s.id===id)));assert.equal(outside.position.x,1500);assert.equal(combat.holding.id,held.id);
});

test('R cannot hit a respawned generation with missiles already launched',()=>{
  const {combat,cast,tick,target}=setup();cast('R',{x:400,z:0},'enemy');tick(.3);assert.ok(combat.skillProjectiles.length>0);
  target.generation++;tick(1.4);assert.equal(target.health,3000);assert.equal(combat.skillProjectiles.length,0);assert.ok(combat.spheres.every(s=>s.state==='ground'));
});

test('R execute is gated by splinters and health threshold',()=>{
  const normal=setup({syndraSplinters:99}),upgraded=setup({syndraSplinters:100});
  for(const env of [normal,upgraded]){env.target.health=600;env.cast('R',{x:400,z:0},'enemy');env.tick(.65);}
  assert.ok(normal.target.alive);assert.equal(normal.combat.executions,0);assert.equal(upgraded.target.alive,false);assert.equal(upgraded.combat.executions,1);
});

test('R rejects absent and out-of-range targets without consuming mana/cooldown',()=>{
  const {combat,cast,target}=setup({unlimitedMana:false});const mana=combat.mana;
  assert.equal(cast('R'),false);target.position.x=676;assert.equal(cast('R',target.position,'enemy'),false);
  assert.equal(combat.cooldowns.R,0);assert.equal(combat.mana,mana);assert.equal(combat.spheres.length,0);
});

test('passive needs two distinct casts within four seconds and respects target cooldown',()=>{
  const {combat,cast,tick}=setup({syndraSplinters:40});cast('Q');tick(.61);assert.equal(combat.passiveProcs,0);
  tick(.65);cast('Q');tick(.61);assert.equal(combat.passiveProcs,1);assert.equal(combat.splinters,43);
  cast('W');tick(.26);cast('W');tick(1);assert.equal(combat.passiveProcs,1,'third hit during passive cooldown must not award another proc');
});

test('passive expired mark cannot proc and same spell id cannot count twice',()=>{
  const {combat,target,tick}=setup();combat.passiveHit(target,{id:1});combat.passiveHit(target,{id:1});assert.equal(combat.passiveProcs,0);
  tick(4.01);combat.passiveHit(target,{id:2});assert.equal(combat.passiveProcs,0);combat.passiveHit(target,{id:3});assert.equal(combat.passiveProcs,1);
});

test('paused zero-delta update freezes formation, recharge, held lifetime and mana',()=>{
  const {combat,cast,tick}=setup({unlimitedMana:false});cast('Q');const snapshot=JSON.stringify({time:combat.time,spheres:combat.spheres,mana:combat.mana,charges:combat.qCharges,recharges:combat.qRecharges});
  for(let i=0;i<20;i++)tick(0,{allowActions:false});
  assert.equal(JSON.stringify({time:combat.time,spheres:combat.spheres,mana:combat.mana,charges:combat.qCharges,recharges:combat.qRecharges}),snapshot);
});

test('end blocks new casts and drops held sphere while released projectiles finish',()=>{
  const {combat,cast,tick,target}=setup();cast('Q');tick(.61);cast('W');tick(.26);cast('W');combat.endAttacks();
  assert.equal(cast('Q'),false);tick(1,{allowStart:false,allowActions:false});assert.equal(target.health,2580);assert.equal(combat.pending,false);
  const held=setup();held.cast('Q');held.tick(.61);held.cast('W');held.combat.endAttacks();assert.equal(held.combat.holding,null);assert.equal(held.combat.spheres[0].state,'ground');
});

test('death interrupts pending cast and prevents new abilities',()=>{
  const {combat,cast,tick,target}=setup();cast('E');combat.takeDamage(1000);tick(.5);
  assert.equal(combat.casting,null);assert.equal(target.health,3000);assert.equal(cast('Q'),false);
});
