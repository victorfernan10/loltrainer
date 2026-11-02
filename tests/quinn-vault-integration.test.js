import {test} from 'node:test';
import assert from 'node:assert/strict';
import {QuinnCombat} from '../src/quinn-combat.js';
import {VaultEncounter,vaultTargets} from '../src/vault-encounter.js';
import {seededRandom} from '../src/training.js';
function run(delay,fps){
  const c=new QuinnCombat({level:6,targets:vaultTargets()}),e=new VaultEncounter({combat:c,random:seededRandom(5)}),p={x:0,z:0},to={...p};
  e.startRound(p);Object.assign(e.position,{x:0,z:580});e.beginDash(p);let pressed=false;
  for(let t=0;t<2;t+=1/fps){
    if(!pressed&&c.time>=delay){pressed=true;c.castAbility('E',{...e.position},p,e.target.id);}
    c.update(1/fps,p,to,330);e.observe(c.drainEvents());e.update(1/fps,p,{allowStart:false});
  }
  return {c,e,p};
}
test('real Quinn E intercepts W before arrival at 20/60/144 fps and never receives landing damage',()=>{
  for(const fps of [20,60,144]){const {c,e}=run(.1,fps);assert.equal(e.summary().interrupted,1);assert.equal(e.summary().wHits,0);assert.equal(c.playerHealth,c.maxPlayerHealth);assert.equal(e.summary().attempts,1);}
});
test('a real late Vault cannot refund landing damage or count as an interruption',()=>{
  const {c,e}=run(.48,60);assert.equal(e.summary().interrupted,0);assert.equal(e.summary().late,1);assert.equal(e.summary().wHits,1);assert.equal(c.playerHealth,c.maxPlayerHealth-e.damage);
});
