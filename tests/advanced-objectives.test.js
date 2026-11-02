import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Combat} from '../src/combat.js';
import {LaneEncounter,laneTargets} from '../src/lane-encounter.js';
import {VaultEncounter,vaultTargets} from '../src/vault-encounter.js';
import {YoneEncounter} from '../src/yone-encounter.js';
import {MatchupEncounter} from '../src/matchup-encounter.js';
import {seededRandom} from '../src/training.js';

test('advanced circuit requires displacement to score but every ordinary attack still deals damage',()=>{
  const c=new Combat({advanced:true,circuit:true,difficulty:3,attackSpeed:2,random:()=>.9}),p={x:0,z:0},to={...p};
  const tick=t=>{for(let left=t;left>1e-8;){const dt=Math.min(.005,left);c.update(dt,p,to,335);left-=dt;}};
  assert.equal(c.targets.length,3);const id=c.markedId;c.attackTarget(id);tick(.85);
  assert.equal(c.markedProgress,1);assert.ok(c.damage>=120);assert.ok(c.stationaryReleases>0);
  c.move({x:100,z:0});tick(.3);c.attackTarget(id);tick(.4);assert.equal(c.markedProgress,2);
  c.move({x:0,z:0});tick(.3);c.attackTarget(id);tick(.4);assert.equal(c.completedMarks,1);assert.notEqual(c.markedId,id);
  const slow=new Combat({advanced:true,circuit:true,difficulty:3,attackSpeed:.5});assert.ok(slow.priorityWindow>4.5);
});
test('lane counts player last hits once per generation and excludes live minions reset with the wave',()=>{
  const c=new Combat({targets:laneTargets()}),lane=new LaneEncounter({combat:c,advanced:true}),m=lane.minion('lane-red-3');
  c.damageTarget(m,m.health);const events=c.drainEvents();lane.observe(events);lane.observe(events);
  assert.equal(lane.summary().farmLastHits,1);assert.equal(lane.summary().siegeSecured,1);
  lane.damageMinion(lane.minion('lane-red-0'),999,'minion');assert.equal(lane.summary().farmMissed,1);
  lane.spawnWave();assert.equal(lane.summary().farmMissed,1);c.damageTarget(m,m.health);lane.observe(c.drainEvents());assert.equal(lane.summary().farmLastHits,2);
});
function vault(){const c=new Combat({targets:vaultTargets()}),e=new VaultEncounter({combat:c,advanced:true,difficulty:3,random:()=>.1});e.startRound({x:0,z:0});return {c,e,tick(t){c.time+=t;e.update(t,{x:0,z:0});}};}
test('Quinn patience trials have no W and score restraint separately from physical interceptions',()=>{
  const a=vault();assert.equal(a.e.current.patience,true);a.tick(2);assert.equal(a.e.summary().held,1);assert.equal(a.e.summary().attempts,0);assert.equal(a.e.summary().decisionAccuracy,100);assert.equal(a.e.drainViewEvents().some(e=>e.key==='W'),false);
  const b=vault();b.e.observe([{type:'spell',key:'E',phase:'dash',targetId:b.e.target.id,startedAt:.2}]);b.tick(2);assert.equal(b.e.summary().falseStarts,1);assert.equal(b.e.summary().decisionAccuracy,0);
  const partial=vault();partial.e.stop();assert.equal(partial.e.summary().patienceTrials,0);
});
test('Locke varies the third-Q hold without changing cast or missile timing',()=>{
  const values=[];for(let seed=1;seed<=8;seed++){const e=new MatchupEncounter({champion:'locke',advanced:true,difficulty:3,random:seededRandom(seed)});e.startRound({x:0,z:0});values.push(e.thirdHold);const a=e.cast('lockeQ2',{x:0,z:0});assert.equal(a.skill.warning,.25);assert.equal(a.skill.speed,1650);assert.ok(e.nextCastAt>e.time+.45);}
  assert.ok(new Set(values).size>1);assert.ok(values.every(n=>n>=0&&n<=.65));
});
test('stopping a matchup before its full sequence cannot inflate clean-round scores',()=>{
  const e=new MatchupEncounter({champion:'ahri',advanced:true,random:()=>.4});e.startRound({x:0,z:0});e.stop();e.update(.1,{x:0,z:0});assert.equal(e.summary().completedRounds,0);
  const a={id:1,skill:{id:'ahriQReturn'}};e.resolve(a,true);e.resolve(a,false);assert.deepEqual(e.summary().results.ahriQReturn,{total:1,hits:1});
});
test('advanced Yone varies spell opening while preserving requested Q cooldown and R preparation',()=>{
  const orders=new Set();for(let seed=1;seed<=12;seed++){
    const target={position:{x:0,z:0},maxHealth:1800,health:1800,generation:0},e=new YoneEncounter({target,advanced:true,pattern:'full',difficulty:3,random:seededRandom(seed)});
    e.startRound({x:0,z:0});orders.add(e.roundOpener);assert.equal(e.qCooldown,1.54);assert.equal(e.spiritUntil-e.spiritStartedAt,5);
    e.cast('R',{x:0,z:0},{x:0,z:0});assert.equal(e.action.releaseAt-e.action.startedAt,.75);
  }assert.deepEqual([...orders].sort(),['Q','W']);
});
