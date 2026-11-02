import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VaultEncounter,vaultTargets,VAULT_LEBLANC} from '../src/vault-encounter.js';
import {seededRandom} from '../src/training.js';

function fixture(){
  const target={...vaultTargets()[0],alive:true,generation:0},combat={time:0,level:6,playerHealth:1000,maxPlayerHealth:1000,busy:false,resets:0,target:()=>target,takeDamage(n){this.playerHealth-=n;},resetVaultPractice(){this.resets++;}};
  const encounter=new VaultEncounter({combat,random:seededRandom(42)}),player={x:0,z:0};
  return {combat,encounter,player,target,tick(dt,options){combat.time+=dt;encounter.update(dt,player,options);}};
}
function dash(f){f.encounter.startRound(f.player);Object.assign(f.target.position,{x:0,z:580});f.encounter.beginDash(f.player);return f.encounter.action;}

test('Distortion commits its endpoint, traverses at 1450, and deals damage only at landing',()=>{
  const f=fixture(),a=dash(f);assert.equal(a.until-a.startedAt,580/1450);f.player.x=100;
  f.tick(.2);assert.deepEqual(a.end,{x:0,z:0});assert.equal(f.target.position.x,0);assert.ok(Math.abs(f.target.position.z-290)<1e-8);assert.equal(f.combat.playerHealth,1000);
  f.tick(.2);assert.equal(f.combat.playerHealth,1000-f.encounter.damage);assert.equal(f.encounter.phase,'recovery');assert.equal(f.target.vaultDash,undefined);
});
test('physical E contact before dash end cancels W and preserves knockback ownership',()=>{
  const f=fixture(),a=dash(f);f.tick(.2);f.target.displacement={from:{x:0,z:280},to:{x:0,z:330},startedAt:.2,duration:.25};Object.assign(f.target.position,{x:0,z:300});
  f.encounter.observe([{type:'spell',key:'E',phase:'dash',targetId:f.target.id,startedAt:.1},{type:'vault-impact',targetId:f.target.id,time:.2,position:{x:0,z:280},spellId:1}]);
  assert.equal(f.encounter.phase,'interrupted');assert.equal(f.target.position.z,300);assert.equal(f.target.vaultDash,undefined);
  f.tick(1);assert.equal(f.combat.playerHealth,1000);assert.equal(f.encounter.summary().interrupted,1);assert.equal(f.encounter.summary().reactionMs,100);assert.equal(f.encounter.drainViewEvents().some(e=>e.type==='spell-impact'),false);
});
test('late E delivered before frame-finalization cannot retroactively suppress the W explosion',()=>{
  const f=fixture(),a=dash(f);f.target.displacement={from:{x:0,z:0},to:{x:0,z:50},startedAt:a.until,duration:.25};
  f.encounter.observe([{type:'vault-impact',targetId:f.target.id,time:a.until,position:{x:0,z:0},spellId:1}]);f.tick(a.until+.001);
  assert.equal(f.combat.playerHealth,1000-f.encounter.damage);assert.equal(f.encounter.current.result,'late');f.tick(1);assert.equal(f.encounter.summary().late,1);
});
test('early E delays the cast until stun ends but is not an interrupt',()=>{
  const f=fixture();f.encounter.startRound(f.player);f.encounter.castAt=.05;f.target.stunUntil=.5;
  f.encounter.observe([{type:'vault-impact',targetId:f.target.id,time:.1,position:{...f.target.position},spellId:1}]);f.tick(.3);assert.equal(f.encounter.phase,'prepare');f.tick(.25);assert.equal(f.encounter.phase,'dash');
  f.tick(1);f.tick(1);assert.equal(f.encounter.summary().interrupted,0);assert.equal(f.encounter.summary().early,1);
});
test('nearsight blocks a new aimed W beyond vision but never cancels one already committed',()=>{
  const f=fixture();f.encounter.startRound(f.player);f.encounter.castAt=0;f.target.nearsightUntil=1;f.target.nearsightRange=300;
  f.tick(.5);assert.equal(f.encounter.phase,'prepare');f.tick(.6);assert.equal(f.encounter.phase,'dash');f.target.nearsightUntil=10;f.tick(.6);assert.equal(f.encounter.phase,'recovery');
});
test('pause freezes the drill and stopping drains only the already committed W',()=>{
  const f=fixture();dash(f);const before=JSON.stringify([f.encounter.time,f.encounter.phase,f.target.position]);f.encounter.update(0,f.player);assert.equal(JSON.stringify([f.encounter.time,f.encounter.phase,f.target.position]),before);
  f.encounter.stop();f.tick(.5,{allowStart:false});f.tick(1,{allowStart:false});assert.equal(f.encounter.pending,false);assert.equal(f.encounter.rounds,1);assert.equal(f.encounter.summary().attempts,1);
});
test('each new attempt resets E/mana once and restores a fresh target generation',()=>{
  const f=fixture();dash(f);const generation=f.target.generation;f.tick(.5);f.tick(1);assert.equal(f.combat.resets,1);f.tick(2);assert.equal(f.combat.resets,2);assert.equal(f.target.generation,generation+1);assert.equal(f.target.health,f.target.maxHealth);
});
test('walking clear of the destination is a dodge, not a successful interruption',()=>{
  const f=fixture();dash(f);f.player.x=VAULT_LEBLANC.radius+66;f.tick(.5);f.tick(1);const s=f.encounter.summary();assert.equal(s.wHits,0);assert.equal(s.interrupted,0);assert.equal(s.missed,1);assert.equal(s.accuracy,0);
});
