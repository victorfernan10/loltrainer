import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {QuinnAnimator} from '../src/quinn-animation.js';
async function load(name){const b=await fs.readFile(new URL(`../public/assets/quinn/${name}.glb`,import.meta.url));return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
test('original Quinn rig recovers from every spell in eight directions without bind poses',async()=>{
  const g=await load('quinn'),v=await load('valor');g.scene.scale.setScalar(1.3);const a=new QuinnAnimator(g.scene,g.animations);a.attachValor(v.scene,v.animations);let time=0;
  const tick=(t,state={})=>{for(let i=0;i<Math.ceil(t*120);i++){time+=1/120;a.update(1/120,{time,...state});}};
  assert.equal(g.animations.length,37);
  for(let i=0;i<8;i++){
    g.scene.rotation.y=i*Math.PI/4;
    for(const [ability,phase] of [['Q','cast'],['W','cast'],['E','dash'],['E','rebound'],['R','channel'],['R','skystrike']]){
      a.cast({ability,phase,duration:.25},time);tick(.12);assert.ok(a.active.getEffectiveWeight()>.99);tick(3);assert.equal(a.active.getClip().name,'quinn_idle1');
      const bounds=new THREE.Box3().setFromObject(g.scene);assert.ok([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite));assert.ok(bounds.max.y-bounds.min.y>100);
    }
    a.attack({id:i+1,startedAt:time,windup:.17},{time});tick(.1,{attackUntil:time+.3});tick(.5,{moving:true});assert.equal(a.active.getClip().name,'quinn_run');
  }
  a.cast({ability:'R',phase:'channel',duration:2},time);tick(.3);assert.equal(v.scene.visible,true);
  a.cast({ability:'R',phase:'transform',duration:0},time);tick(2,{valor:true,moving:true});assert.equal(a.active.getClip().name,'quinn_spell4_flap');assert.equal(a.diagnostics.valorVisible,true);
  const frozen=a.active.time;a.update(0,{time:time+10});assert.equal(a.active.time,frozen);
  a.reset();tick(.1);assert.equal(v.scene.visible,false);assert.equal(a.active.getClip().name,'quinn_idle1');
});
