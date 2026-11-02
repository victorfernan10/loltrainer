import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MinionAnimator} from '../src/minion-models.js';
const root=new URL('../public/assets/minions/',import.meta.url),profiles=JSON.parse(await fs.readFile(new URL('resources.json',root),'utf8'));
for(const [name,profile] of Object.entries(profiles))test(`${name}: original minion rig animates, freezes and resets after death/renewal`,async()=>{
  const bytes=await fs.readFile(new URL(profile.model,root));const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const animator=new MinionAnimator(gltf.scene,gltf.animations,profile),unit={generation:1,alive:true,action:null};let time=0;
  const tick=(seconds,moving=false)=>{for(let i=0;i<Math.round(seconds*120);i++){time+=1/120;animator.update(1/120,{unit,time,moving});}};
  animator.update(0,{unit,time});assert.equal(animator.active.getClip().name,profile.idle);assert.equal(animator.active.getEffectiveWeight(),1);
  for(let i=0;i<8;i++){
    gltf.scene.rotation.y=i*Math.PI/4;tick(.2,true);assert.equal(animator.active.getClip().name,profile.run);
    unit.action={startedAt:time,releaseAt:time+.3};tick(.3);assert.ok(profile.attacks.includes(animator.active.getClip().name));unit.action=null;tick(3);assert.equal(animator.active.getClip().name,profile.idle);
    const bounds=new THREE.Box3().setFromObject(gltf.scene);assert.ok([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite));assert.ok(bounds.max.y-bounds.min.y>30);
  }
  tick(.2,true);const before=[animator.active.time,animator.active.getClip().name];animator.update(0,{unit,time,moving:false});assert.deepEqual([animator.active.time,animator.active.getClip().name],before);
  unit.alive=false;tick(.3);assert.equal(animator.active.getClip().name,profile.death);
  unit.alive=true;unit.generation++;tick(.15);assert.equal(animator.active.getClip().name,profile.idle);assert.equal(animator.deathAt,null);
});
