import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LeBlancAnimator} from '../src/leblanc-animation.js';

function animator(){
  const root=new THREE.Object3D();
  const names=['idle1','run1','attack1','attack2','spell1','spell1_run','spell2','spell2_toidle','spell2_torun','spell2_recast','spell3','spell3_run'];
  return new LeBlancAnimator(root,names.map((name,i)=>new THREE.AnimationClip(name,name==='spell2'?.5:2,[new THREE.NumberKeyframeTrack('.position[x]',[0,2],[i,i+.1])])));
}
test('Q/E hold their cast clip through the movement lock then use original moving variants',()=>{
  for(const [ability,clip] of [['Q','spell1'],['E','spell3']]){
    const a=animator();a.cast({ability,duration:.25},0);a.update(.1,{time:.1,moving:true});assert.equal(a.diagnostics.name,clip);
    a.update(.2,{time:.3,moving:true});assert.equal(a.diagnostics.name,clip+'_run');
    a.update(.4,{time:.7,moving:false});a.update(.2,{time:.9,moving:false});assert.equal(a.diagnostics.name,'idle1');assert.equal(a.diagnostics.weight,1);
  }
});
test('W leaves the dash pose through the original idle/run transition; return uses its recast clip',()=>{
  for(const moving of [true,false]){
    const a=animator();a.cast({ability:'W',duration:.4},0);a.update(.2,{time:.2,moving:false});assert.equal(a.diagnostics.name,'spell2');
    a.update(.21,{time:.41,moving});assert.equal(a.diagnostics.name,moving?'spell2_torun':'spell2_toidle');
    a.cast({ability:'W',returning:true,duration:.25},.5);a.update(.1,{time:.6});assert.equal(a.diagnostics.name,'spell2_recast');
    a.update(.6,{time:1.2});a.update(.2,{time:1.4});assert.equal(a.diagnostics.name,'idle1');assert.equal(a.diagnostics.weight,1);
  }
});
test('AA interrupts visual spell recovery and reset removes all ability state',()=>{
  const a=animator();a.cast({ability:'E',duration:.25},0);a.update(.3,{time:.3});
  a.attack({id:1,windup:.2,startedAt:.3},{time:.3});a.update(.1,{time:.4,attackUntil:1});assert.equal(a.diagnostics.name,'attack1');assert.equal(a.spell,null);
  a.cast({ability:'W',duration:.4},.5);a.reset();a.update(.2,{time:0});assert.equal(a.diagnostics.name,'idle1');assert.equal(a.spell,null);
});
