import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {KayleAnimator} from '../src/kayle-animation.js';
import {Combat} from '../src/combat.js';

const names=['idle1','run1','idlepassive','runpassive','attackranged1','spell2','spell2_transidle','spell3','spell3_l','spell3melee','spell3runtransition','spell3runtransitionleft'];
function setup(){const root=new THREE.Object3D(),clips=names.map((n,i)=>new THREE.AnimationClip(`kayle_${n}`,1,[new THREE.NumberKeyframeTrack('.position[x]',[0,1],[i,i+.1])])),a=new KayleAnimator(root,clips);a.update(.2,{time:0});return a;}
const attack={id:1,ranged:true,empowered:true,windup:.2,startedAt:0};
test('empowered attacks select original melee and directional ranged clips and preserve windup progress',()=>{
  const a=setup();a.attack(attack,{time:.1,attackSpeed:1,angle:-1});assert.equal(a.diagnostics.name,'kayle_spell3_l');assert.ok(Math.abs(a.active.time-11/60)<1e-7);
  a.attack(attack,{time:0,attackSpeed:1,angle:1});assert.equal(a.diagnostics.name,'kayle_spell3');
  a.attack({...attack,ranged:false},{time:0,attackSpeed:1});assert.equal(a.diagnostics.name,'kayle_spell3melee');
});
test('W uses the full original clip while moving and blends back through the idle transition',()=>{
  const a=setup();a.boost({time:0});a.update(.2,{time:.2,moving:true});assert.equal(a.diagnostics.name,'kayle_spell2');
  a.update(.9,{time:1.1,moving:false});assert.equal(a.diagnostics.name,'kayle_spell2_transidle');
  a.update(1.1,{time:2.2});assert.equal(a.diagnostics.name,'kayle_idle1');a.update(.2,{time:2.4});assert.equal(a.diagnostics.weight,1);
});
test('W during windup queues only the visual and a new attack interrupts W',()=>{
  const a=setup();a.attack(attack,{time:0,attackSpeed:1});a.boost({time:.1,windup:attack});a.update(.05,{time:.15,windup:attack,attackUntil:1});assert.equal(a.diagnostics.name,'kayle_spell3');
  a.update(.1,{time:.25,attackUntil:1});assert.equal(a.diagnostics.name,'kayle_spell2');assert.equal(a.pendingW,false);
  a.attack({...attack,startedAt:.3},{time:.3,attackSpeed:1});a.update(.1,{time:.4,windup:attack,attackUntil:1});assert.equal(a.diagnostics.name,'kayle_spell3');
});
test('E uses its original run transition without locking movement or preventing another attack',()=>{
  const a=setup();a.attack(attack,{time:0,attackSpeed:1,angle:-1});a.release(attack.id);a.update(.2,{time:.3,moving:true,attackUntil:1});assert.equal(a.diagnostics.name,'kayle_spell3runtransitionleft');
  a.attack({...attack,startedAt:.4},{time:.4,attackSpeed:1});assert.equal(a.diagnostics.name,'kayle_spell3');
  a.reset();a.update(.2,{time:0,moving:true});assert.equal(a.diagnostics.name,'kayle_run1');assert.equal(a.pendingW,false);
});
test('cancelled E goes directly to running instead of jumping to a post-release transition pose',()=>{
  const a=setup();a.attack(attack,{time:0,attackSpeed:1});a.cancel(attack.id);a.update(.1,{time:.1,moving:true});assert.equal(a.diagnostics.name,'kayle_run1');
});
test('combat exposes empowerment at attack start and during an existing windup without postponing release',()=>{
  const c=new Combat();c.castE();c.attackTarget('ryze-1');c.update(.01,{x:0,z:0},{x:0,z:0},335);assert.equal(c.drainEvents().find(e=>e.type==='start').empowered,true);
  const d=new Combat();d.attackTarget('ryze-1');d.update(.01,{x:0,z:0},{x:0,z:0},335);const release=d.windup.releaseAt;d.castE();assert.equal(d.windup.releaseAt,release);assert.equal(d.drainEvents().find(e=>e.type==='empower').attack.empowered,true);
});
