import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CaitlynAnimator,caitlynClipLabels} from '../src/caitlyn-animation.js';
async function rig(){
 const bytes=await fs.readFile(new URL('../public/assets/caitlyn/caitlyn.glb',import.meta.url));const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const animator=new CaitlynAnimator(gltf.scene,gltf.animations);let time=0;
 const tick=(seconds,options={})=>{for(let i=0;i<Math.ceil(seconds*120);i++){time+=1/120;animator.update(1/120,{time,...options});}return time;};
 const bounds=()=>{gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});const box=new THREE.Box3();gltf.scene.traverse(o=>{if(o.isMesh&&o.visible)box.union(new THREE.Box3().setFromObject(o,true));});return box;};return {gltf,animator,tick,bounds,get time(){return time;}};
}
test('Caitlyn keeps complete original rig and firearm through every cast, recovery and world bearing',async()=>{
 const r=await rig(),a=r.animator;assert.equal(r.gltf.animations.length,46);assert.deepEqual([...a.clips.keys()].sort(),Object.keys(caitlynClipLabels).sort());assert.ok([...a.clips.values()].every(c=>c.tracks.length===420));
 for(let yaw=0;yaw<8;yaw++){
  r.gltf.scene.rotation.y=yaw*Math.PI/4;a.reset();r.tick(.2);
  for(const key of ['Q','W','E']){a.cast({ability:key,phase:'cast',duration:.4},r.time);r.tick(.15);const b=r.bounds();assert.ok([...b.min.toArray(),...b.max.toArray()].every(Number.isFinite));assert.ok(b.max.y>100&&b.min.y>-30);assert.ok(a.props.every(o=>!o.visible));r.tick(5);assert.equal(a.diagnostics.name,'idle1');}
  a.attack({id:yaw+1,windup:.07,startedAt:r.time,headshot:yaw%2===0},{time:r.time});r.tick(.04,{attackUntil:r.time+.3,windup:{}});assert.equal(a.kind,'attack');a.release(yaw+1);r.tick(.2,{moving:true,speed:325});assert.equal(a.diagnostics.name,'attack_to_run');r.tick(.2);assert.equal(a.diagnostics.name,'idle1');
 }
});
test('Caitlyn repeated headshots restart without bind poses and R survives channel then returns to locomotion',async()=>{
 const r=await rig(),a=r.animator;r.tick(.2);a.attack({id:1,headshot:true,windup:.1,startedAt:r.time},{time:r.time});r.tick(.02,{attackUntil:r.time+1,windup:{}});const old=a.active;a.attack({id:2,headshot:true,windup:.1,startedAt:r.time},{time:r.time});assert.notEqual(a.active,old);r.tick(.02,{attackUntil:r.time+1,windup:{}});assert.ok(r.bounds().max.y>130);
 a.cast({ability:'R',phase:'channel',duration:1},r.time);r.tick(.8,{channel:{}});assert.equal(a.hold,'R');assert.equal(a.diagnostics.name,'spell4');const channelAction=a.active;a.cast({ability:'R',phase:'fire'},r.time);assert.equal(a.active,channelAction);a.cast({ability:'R',phase:'end'},r.time);r.tick(.1,{channel:null});assert.equal(a.diagnostics.name,'spell4');r.tick(4,{channel:null});assert.equal(a.diagnostics.name,'idle1');
 a.cast({ability:'R',phase:'channel',duration:1},r.time);r.tick(.1,{channel:{}});a.cancelSpell();r.tick(.1,{moving:true,channel:null});assert.equal(a.diagnostics.name,'run');assert.equal(a.hold,null);
});
test('Caitlyn preview-only props obey original visibility windows and disappear before combat',async()=>{
 const r=await rig(),a=r.animator;r.tick(.2);a.previewClip('laugh',r.time);r.tick(.3);assert.equal(a.props.find(o=>o.material.name==='Teacup').visible,true);assert.equal(a.props.find(o=>o.material.name==='Flag').visible,false);a.cancelPreview();r.tick(.2);assert.ok(a.props.every(o=>!o.visible));a.previewClip('joke',r.time);r.tick(1);assert.equal(a.props.find(o=>o.material.name==='Flag').visible,true);a.attack({id:1,windup:.2,startedAt:r.time},{time:r.time});r.tick(.1,{windup:{},attackUntil:r.time+1});assert.ok(a.props.every(o=>!o.visible));
});
