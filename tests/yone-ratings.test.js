import {test} from 'node:test';
import assert from 'node:assert/strict';
import {YoneEncounter} from '../src/yone-encounter.js';
import {YONE,yoneRating,yoneQCooldown,yoneQCast} from '../src/yone-data.js';
const target=()=>({id:'yone',position:{x:0,z:0},alive:true,health:1800,maxHealth:1800,generation:0});
test('three loadouts use calibrated Q cooldowns and preserve attack speed and movement',()=>{
  for(const [difficulty,bonus,as,cd,cast,ms] of [[1,0,.625,3.12,.35,345],[2,.3,.8125,2.4,.30625,390],[3,.66,1.0375,1.54,.25375,390]]){
    const c=new YoneEncounter({target:target(),difficulty});assert.equal(c.bonusAS,bonus);assert.ok(Math.abs(c.attackSpeed-as)<1e-10);assert.ok(Math.abs(c.qCooldown-cd)<1e-10);assert.ok(Math.abs(c.qCastTime-cast)<1e-10);assert.equal(c.moveSpeed,ms);
  }
  assert.ok(Math.abs(yoneRating(3).bonusAS-yoneRating(2).bonusAS-.36)<1e-10);
});

test('Q and Q3 schedule the calibrated cooldown from cast start',()=>{
  for(const [difficulty,cooldown] of [[1,3.12],[2,2.4],[3,1.54]]){
    for(const kind of ['Q','Q3']){
      const c=new YoneEncounter({target:target(),difficulty});c.time=10;
      c.cast(kind,{x:0,z:300},{x:0,z:0});
      assert.equal(c.qReadyAt,10+cooldown);
    }
  }
  const custom=new YoneEncounter({target:target(),bonusAS:80});
  assert.equal(custom.qCooldown,yoneQCooldown(.8));
});
test('R leaves a full 750 ms before capture, deals damage later and does not start another attack during recovery',()=>{
  for(const difficulty of [1,2,3]){
    const t=target(),c=new YoneEncounter({target:t,difficulty}),p={x:0,z:300};t.alive=true;c.phase='idle';c.cast('R',p,{x:0,z:0});const origin={...c.position};c.drainEvents();
    c.update(.749,p);assert.deepEqual(c.position,origin);assert.equal(c.stats.R.hits,0);assert.equal(c.drainEvents().length,0);
    c.update(.001,p);assert.equal(c.phase,'r-impact');assert.equal(c.drainEvents().filter(e=>e.type==='control').length,1);assert.equal(c.stats.R.hits,0);
    c.update(.299,p);assert.equal(c.stats.R.hits,0);c.update(.001,p);assert.equal(c.stats.R.hits,1);assert.equal(c.drainEvents().filter(e=>e.type==='damage').length,1);
    assert.equal(c.action.kind,'r');assert.equal(c.stats.AA.casts,0);c.update(.14,p);assert.equal(c.action.kind,'r');c.update(.011,p);assert.equal(c.action,null);
  }
});
test('sidestep during R preparation avoids capture and delayed impact',()=>{
  const t=target(),c=new YoneEncounter({target:t}),p={x:0,z:300};t.alive=true;c.phase='idle';c.cast('R',p,{x:0,z:0});c.update(.4,p);p.x=300;c.update(.35,p);c.update(.3,p);assert.equal(c.stats.R.hits,0);assert.equal(c.events.some(e=>e.type==='control'||e.type==='damage'),false);
});

test('E preserves five seconds outside R, even when R crosses the original expiry',()=>{
  for(const difficulty of [1,2,3]){
    const c=new YoneEncounter({target:target(),difficulty}),p={x:10000,z:10000};
    c.startRound(p);c.update(.25,p);c.update(4.25,p);
    c.cast('R',p,{x:0,z:0});const remaining=c.spiritUntil-c.time;
    c.update(.75,p);
    assert.ok(Math.abs(c.spiritUntil-c.time-remaining)<1e-8);
    const beforePause=JSON.stringify(c);c.update(0,p);assert.equal(JSON.stringify(c),beforePause);
    // This tick extends .10s past the R recovery: only .45s should be excluded.
    c.update(.55,p);
    assert.ok(Math.abs(c.spiritUntil-(5+YONE.rCast+YONE.rRecovery))<1e-8);
    c.qReadyAt=c.wReadyAt=c.rReadyAt=c.attackReadyAt=Infinity;
    c.update(.39,p);assert.notEqual(c.phase,'e-return');assert.equal(c.spirit,true);
    c.update(.02,p);assert.equal(c.phase,'e-return');
  }
});

test('E without R lasts five seconds and ending a session still returns early',()=>{
  const p={x:10000,z:10000},c=new YoneEncounter({target:target()});
  c.startRound(p);c.update(.25,p);
  c.qReadyAt=c.attackReadyAt=Infinity;
  c.update(4.74,p);assert.notEqual(c.phase,'e-return');assert.equal(c.spiritUntil,5);
  c.update(.02,p);assert.equal(c.phase,'e-return');
  const stopped=new YoneEncounter({target:target()});stopped.startRound(p);stopped.update(.25,p);
  stopped.cast('R',p,{x:0,z:0});stopped.stop();stopped.update(1.21,p);stopped.update(.01,p);
  assert.equal(stopped.phase,'e-return');
});
test('already captured R finishes even if Yone dies; pausing never advances its windup',()=>{
  const t=target(),c=new YoneEncounter({target:t}),p={x:0,z:300};t.alive=true;c.phase='idle';c.cast('R',p,{x:0,z:0});const before=JSON.stringify(c);c.update(0,p);assert.equal(JSON.stringify(c),before);
  c.update(.75,p);t.alive=false;c.update(.2,p);assert.equal(c.stats.R.hits,0);assert.equal(c.pending,true);c.update(.11,p);assert.equal(c.stats.R.hits,1);assert.equal(c.pending,false);
});
