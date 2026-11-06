import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {XerathAnimator,xerathClipLabels} from '../src/xerath-animation.js';

async function rig(){
  const bytes=await fs.readFile(new URL('../public/assets/xerath/xerath.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const animator=new XerathAnimator(gltf.scene,gltf.animations);let time=0;
  const tick=(seconds,options={})=>{for(let i=0;i<Math.ceil(seconds*120);i++){time+=1/120;animator.update(1/120,{time,...options});}return time;};
  const bounds=()=>{gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});return new THREE.Box3().setFromObject(gltf.scene,true);};
  return {gltf,animator,tick,bounds,get time(){return time;}};
}
test('Xerath original complete rig has all 25 clips and real animated poses at every yaw',async()=>{
  const r=await rig(),a=r.animator;assert.equal(r.gltf.animations.length,25);assert.deepEqual([...a.clips.keys()].sort(),Object.keys(xerathClipLabels).sort());
  const meshes=[];r.gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});assert.equal(meshes.length,1);assert.equal(meshes[0].skeleton.bones.length,99);
  for(let i=0;i<8;i++){
    r.gltf.scene.rotation.y=i*Math.PI/4;a.reset();r.tick(.2);
    const idle=r.bounds();assert.ok(idle.max.y>140&&idle.min.y>0);
    for(const ability of ['Q','W','E']){
      a.cast({ability,phase:'release',duration:.25},r.time);r.tick(.15);assert.equal(a.kind,'spell');
      const posed=r.bounds();assert.ok([...posed.min.toArray(),...posed.max.toArray()].every(Number.isFinite));assert.ok(posed.max.y>130&&posed.min.y>-10);
      r.tick(2);assert.equal(a.diagnostics.name,'xerath_idle1');assert.ok(a.diagnostics.weight>.99);
    }
    a.attack({id:i+1,windup:.08,startedAt:r.time},{time:r.time});r.tick(.04,{attackUntil:r.time+.2});assert.equal(a.kind,'attack');
    r.tick(.2,{moving:true,speed:340});assert.equal(a.diagnostics.name,'xerath_run');assert.ok(r.bounds().min.y>0);
  }
});
test('Xerath Q/R charge loops survive movement and repeated shots but always leave channel poses',async()=>{
  const r=await rig(),a=r.animator;r.tick(.2);
  a.cast({ability:'Q',phase:'charge'},r.time);r.tick(1.2,{charge:{},moving:true});assert.equal(a.diagnostics.name,'xerath_channel');assert.equal(a.hold,'Q');
  a.cast({ability:'Q',phase:'release',duration:.5},r.time);r.tick(.1,{charge:null});assert.equal(a.diagnostics.name,'xerath_spell1');r.tick(.6,{charge:null,moving:true});assert.equal(a.diagnostics.name,'xerath_run');
  a.cast({ability:'Q',phase:'charge'},r.time);r.tick(.2,{charge:null});assert.equal(a.diagnostics.name,'xerath_idle1');
  a.cast({ability:'R',phase:'channel'},r.time);r.tick(1,{channel:{}});assert.equal(a.diagnostics.name,'spell5loop');
  for(let i=0;i<5;i++){const previous=a.active;a.cast({ability:'R',phase:'shot',duration:.6},r.time);r.tick(.2,{channel:{}});assert.equal(a.diagnostics.name,'spell5_fast');assert.ok(Math.abs(a.active.getEffectiveTimeScale()-2.3/.6)<1e-5);assert.notEqual(a.active,previous);assert.ok(r.bounds().max.y>140);}
  r.tick(1.3,{channel:{}});assert.equal(a.diagnostics.name,'spell5loop');
  a.cast({ability:'R',phase:'end'},r.time);r.tick(1,{channel:null});assert.equal(a.diagnostics.name,'xerath_idle1');
  a.cast({ability:'R',phase:'channel'},r.time);r.tick(.1,{channel:{}});r.tick(1,{channel:null});assert.equal(a.diagnostics.name,'xerath_idle1');
  a.reset();r.tick(.2);assert.equal(a.hold,null);assert.equal(a.spell,null);assert.equal(a.diagnostics.name,'xerath_idle1');
});
