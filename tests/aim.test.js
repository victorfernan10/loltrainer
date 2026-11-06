import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Combat} from '../src/combat.js';
import {XerathCombat} from '../src/xerath-combat.js';
import {AimEncounter,aimTargets,AIM_TARGET} from '../src/aim-encounter.js';
import {seededRandom} from '../src/training.js';

const player={x:0,z:0},distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

test('hard opponent evades more real unanticipated Q releases than easy across seeded trials',()=>{
  const score=difficulty=>{
    let hits=0;
    for(let seed=1;seed<=30;seed++){
      const combat=new XerathCombat({level:18,targets:aimTargets(),unlimitedMana:true});
      const encounter=new AimEncounter({combat,difficulty,random:seededRandom(seed)}),position={x:0,z:0};
      const step=()=>{encounter.update(1/60,position);combat.update(1/60,position,{...position},340);encounter.observe(combat.drainEvents());};
      for(let i=0;i<120;i++)step();
      combat.castAbility('Q',encounter.position,position);encounter.observe(combat.drainEvents());
      for(let i=0;i<90;i++)step();
      combat.releaseAbility('Q',{...encounter.position},position);encounter.observe(combat.drainEvents());
      for(let i=0;i<36;i++)step();
      assert.equal(encounter.summary().casts,1);hits+=encounter.summary().hits;
    }
    return hits;
  };
  assert.ok(score(3)<score(1),'Aiming at current position should become less effective as reaction improves');
});
function setup(difficulty=3,seed=42){
  const combat=new Combat({targets:aimTargets()}),e=new AimEncounter({combat,difficulty,random:seededRandom(seed)});
  return {combat,e,tick(seconds,allowStart=true){for(let left=seconds;left>1e-8;){const dt=Math.min(left,.01);e.update(dt,player,{allowStart});combat.update(dt,player,{...player},335,{allowStart:false});e.observe(combat.drainEvents());left-=dt;}}};
}
const circle=(id,e,key='W',extra={})=>({type:'spell-telegraph',id,key,kind:'circle',origin:{...player},point:{...e.position},radius:200,startedAt:e.time,impactAt:e.time+1,...extra});

test('hard target changes footwork more often without receiving faster movement or dash physics',()=>{
  const easy=setup(1),hard=setup(3);easy.tick(30);hard.tick(30);
  assert.ok(hard.e.feints>easy.e.feints);assert.equal(easy.e.moveSpeed,340);assert.equal(hard.e.moveSpeed,340);
  assert.ok(hard.e.dashes>0);assert.equal(easy.e.summary().dashCooldown,10);assert.equal(hard.e.summary().dashCooldown,10);
  for(const d of hard.e.dashHistory){assert.ok(distance(d.origin,d.end)<=600.000001);assert.ok(Math.abs(distance(d.origin,d.end)/d.duration-1450)<1e-6);}
  for(let i=1;i<hard.e.dashHistory.length;i++)assert.ok(hard.e.dashHistory[i].startedAt-hard.e.dashHistory[i-1].startedAt>=10-1e-8);
  assert.ok(Math.abs(hard.e.position.x)<=1050&&hard.e.position.z>=-1100&&hard.e.position.z<=420);
});

test('uncommitted charge/cursor information cannot alter opponent decisions',()=>{
  const a=setup(),b=setup();
  for(let i=0;i<100;i++){
    a.e.observe([{type:'spell',key:'Q',phase:'charge',point:{x:i*99,z:-500},origin:player}]);a.tick(.05);b.tick(.05);
    assert.deepEqual(a.e.position,b.e.position);
  }
  assert.equal(a.e.records.size,0);assert.equal(a.e.threats.size,0);
});

test('visible cast reactions honor difficulty latency instead of reading a future cursor position',()=>{
  for(const difficulty of [1,3]){
    const a=setup(difficulty),b=setup(difficulty);a.e.observe([circle(1,a.e)]);
    const before=a.e.policy.reaction-.025;a.tick(before);b.tick(before);assert.deepEqual(a.e.position,b.e.position);assert.deepEqual(a.e.goal,b.e.goal);
    a.tick(.06);b.tick(.06);assert.ok(distance(a.e.goal,b.e.goal)>10);
    assert.equal(a.e.threats.get(1).reacted,true);
  }
});

test('dash is one committed trajectory, respects cooldown/CC, and finishes when a block drains',()=>{
  const {e,tick}=setup();e.dashReadyAt=0;e.target.stunUntil=1;
  assert.equal(e.beginDash({x:600,z:-660}),false);e.target.stunUntil=0;e.target.rootUntil=1;assert.equal(e.beginDash({x:600,z:-660}),false);
  e.target.rootUntil=0;const start={...e.position};assert.equal(e.beginDash({x:start.x+1000,z:start.z}),true);
  const committed={...e.dash.end};assert.equal(distance(start,committed),AIM_TARGET.dashRange);assert.equal(e.dash.speed,AIM_TARGET.dashSpeed);
  tick(.1);assert.ok(Math.abs(distance(start,e.position)-145)<.001);assert.equal(e.beginDash({x:0,z:0}),false);
  e.target.stunUntil=e.time+2;e.stop();tick(.4,false);assert.deepEqual(e.position,committed);assert.equal(e.pending,false);assert.equal(e.phase,'controlled');
  assert.equal(e.drainViewEvents().filter(v=>v.type==='spell'&&v.key==='W').length,1);
});

test('hard AI spends a ready dash on a visible blast it cannot walk out of, then respects its recast downtime',()=>{
  const {e,tick}=setup();tick(1.1);e.observe([circle(1,e,'R',{impactAt:e.time+.6})]);
  tick(.18);assert.equal(e.dashes,1);assert.ok(e.dash);assert.ok(e.dash.startedAt>=1.1+.14-1e-7);
  tick(.5);e.observe([circle(2,e,'W',{impactAt:e.time+.6})]);tick(.65);assert.equal(e.dashes,1);assert.ok(e.dashRemaining>8);
});

test('stun freezes footwork and slow applies only during its declared interval',()=>{
  const {e,tick}=setup();e.goal={x:e.position.x+600,z:e.position.z};e.nextDecision=Infinity;e.nextProactiveDash=Infinity;
  const start={...e.position};e.target.slowAmount=.5;e.target.slowStartsAt=.2;e.target.slowUntil=1;
  tick(.1);assert.ok(Math.abs(distance(start,e.position)-34)<.001);
  tick(.2);const before={...e.position};tick(.1);assert.ok(Math.abs(distance(before,e.position)-195*.1)<.001);
  e.target.stunUntil=e.time+.5;const frozen={...e.position};tick(.3);assert.deepEqual(e.position,frozen);
});

test('resolved skill accuracy separates W centers and dash/landing hits and ignores duplicate delivery',()=>{
  const {e}=setup();e.dashReadyAt=0;e.beginDash({x:650,z:-660});
  const end=e.dash.until;
  const resolve=(id,key,time,hit=true,centerHits=0)=>{e.observe([circle(id,e,key),{type:'spell-resolved',id,key,time,hit,targetIds:hit?[e.target.id]:[],centerHits}]);};
  resolve(1,'Q',.1);resolve(2,'Q',end+.1,false);resolve(3,'W',end+.2,true,1);
  e.observe([{type:'spell-resolved',id:3,key:'W',time:2,hit:false,targetIds:[]}]);e.observe([circle(4,e,'R')]);
  const s=e.summary();assert.equal(s.casts,3);assert.equal(s.hits,2);assert.equal(s.accuracy,67);assert.equal(s.pendingCasts,1);
  assert.equal(s.byAbility.Q.accuracy,50);assert.equal(s.wCenters,1);assert.equal(s.dashHits,1);assert.equal(s.landingHits,1);
});

test('E does not count its own newly applied stun as a successful follow-up',()=>{
  const {e}=setup();e.target.stunUntil=5;
  for(const [id,key] of [[1,'E'],[2,'W']])e.observe([circle(id,e,key),{type:'spell-resolved',id,key,time:1,hit:true,targetIds:[e.target.id]}]);
  assert.equal(e.summary().hits,2);assert.equal(e.summary().controlledHits,1);
});

test('respawn resets hitbox history and debuffs, and an ended block cannot spawn a new opponent',()=>{
  const {combat,e,tick}=setup();const generation=e.target.generation;
  combat.damageTarget(e.target,99999);e.observe(combat.drainEvents());e.target.stunUntil=99;e.target.rootUntil=99;tick(2);
  assert.equal(e.target.alive,true);assert.equal(e.target.generation,generation+1);assert.equal(e.target.stunUntil,0);assert.equal(e.target.rootUntil,0);
  assert.equal(e.summary().kills,1);assert.equal(e.summary().respawns,1);assert.ok(distance(e.target.previousPosition,e.position)<4);
  combat.damageTarget(e.target,99999);e.observe(combat.drainEvents());e.stop();tick(3,false);assert.equal(e.target.alive,false);assert.equal(e.pending,false);
});

test('draining preserves opponent movement against already committed casts rather than gifting a stationary hit',()=>{
  const {e,tick}=setup();e.observe([circle(1,e)]);e.stop();const start={...e.position};tick(.3,false);
  assert.ok(distance(start,e.position)>0);e.observe([{type:'spell-resolved',id:1,key:'W',time:e.time,hit:false,targetIds:[]}]);
  const done={...e.position};tick(.1,false);assert.deepEqual(e.position,done);assert.equal(e.pending,false);
});
