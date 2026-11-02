import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MatchupEncounter} from '../src/matchup-encounter.js';
import {matchupSkills} from '../src/matchup-data.js';
const origin={x:0,z:0},velocity={x:0,z:0};
function tick(e,seconds,p){for(let i=0;i<Math.round(seconds/.005);i++)e.update(.005,p,velocity,{allowStart:false});}

test('Ahri Q pierces once per leg, decelerates outbound and returns to her current position',()=>{
  const e=new MatchupEncounter({champion:'ahri',random:()=>.99}),p={x:0,z:400};e.phase='idle';e.cast('ahriQ',p);tick(e,.3,p);
  assert.equal(e.projectiles.length,1);const speed=e.projectiles[0].speed;tick(e,.2,p);assert.ok(e.projectiles[0].speed<speed);
  tick(e,2,p);const resolutions=e.drainEvents().filter(v=>v.type==='resolve');
  assert.equal(resolutions.filter(v=>v.hit&&v.action.skill.id==='ahriQ').length,1);
  assert.equal(resolutions.filter(v=>v.hit&&v.action.skill.id==='ahriQReturn').length,1);
  assert.equal(e.projectiles.length,0);
  const curved=new MatchupEncounter({champion:'ahri',random:()=>.99});curved.phase='idle';curved.cast('ahriQ',{x:0,z:400});
  tick(curved,1.5,{x:3000,z:0});const orb=curved.projectiles.find(p=>p.returning);assert.ok(orb);
  curved.position.x=300;tick(curved,.02,{x:3000,z:0});assert.ok(orb.direction.x>0);
});
test('Charm stops at first hit and forces slowed movement for 1.2 seconds',()=>{
  const e=new MatchupEncounter({champion:'ahri'}),p={x:0,z:400};e.phase='idle';e.cast('ahriE',p);tick(e,.5,p);
  assert.equal(e.charmed,true);assert.equal(e.projectiles.length,0);const before=p.z;e.moveCharmedPlayer(p,335,.1);assert.ok(p.z<before);
  tick(e,1.3,p);assert.equal(e.charmed,false);assert.equal(e.playerSpeedMultiplier,1);
});
test('Locke fires exactly three Qs with committed aim and minimum recast separation',()=>{
  for(const difficulty of [1,2,3]){
    const e=new MatchupEncounter({champion:'locke',difficulty,random:()=>.5,interval:10}),p={x:0,z:0};
    for(let i=0;i<600;i++)e.update(.01,p,velocity);
    const casts=e.drainEvents().filter(v=>v.type==='telegraph');assert.deepEqual(casts.map(v=>v.action.skill.id),['lockeQ1','lockeQ2','lockeQ3']);
    for(let i=1;i<casts.length;i++)assert.ok(casts[i].action.startedAt-casts[i-1].action.startedAt>=.5);
    assert.equal(e.rounds,1);
  }
  const e=new MatchupEncounter({champion:'locke',random:()=>.99});e.phase='idle';const a=e.cast('lockeQ1',{x:0,z:500});e.update(.1,{x:500,z:500});assert.deepEqual(a.direction,{x:0,z:1});
});
test('Locke nails stack only on hits, strengthen slow on three hits, then expire',()=>{
  const e=new MatchupEncounter({champion:'locke'}),p={x:0,z:400};e.phase='idle';
  for(let n=1;n<=3;n++){e.cast('lockeQ'+n,p);tick(e,.6,p);assert.equal(e.nails,n);}
  assert.equal(e.slowAmount,.6);assert.equal(e.playerSpeedMultiplier,.4);tick(e,4.1,p);assert.equal(e.nails,0);assert.equal(e.playerSpeedMultiplier,1);
});
test('pause freezes effects and finishing drains projectiles without another cast',()=>{
  const e=new MatchupEncounter({champion:'locke',random:()=>.5}),p={x:0,z:0};e.startRound(p);e.update(.5,p);
  const snapshot=JSON.stringify(e);e.update(0,p);assert.equal(JSON.stringify(e),snapshot);
  e.stop();tick(e,3,p);assert.equal(e.pending,false);assert.equal(e.rounds,1);assert.equal(e.drainEvents().filter(v=>v.type==='telegraph').length,1);
});
test('missile collision checks both player and projectile movement across a frame',()=>{
  const e=new MatchupEncounter({champion:'locke'});e.phase='idle';e.cast('lockeQ1',{x:0,z:500});e.update(.25,{x:-200,z:50},velocity,{allowStart:false});
  e.update(.05,{x:200,z:50},velocity,{playerBefore:{x:-200,z:50},allowStart:false});
  assert.equal(e.drainEvents().filter(v=>v.type==='resolve'&&v.hit).length,1);
  assert.equal(matchupSkills.lockeQ1.speed,1650);
});
