import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SyndraAnimator} from '../src/syndra-animation.js';

test('Syndra original rig recovers from every spell and fast attack across all directions',async()=>{
  const bytes=await fs.readFile(new URL('../public/assets/syndra/syndra.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const animator=new SyndraAnimator(gltf.scene,gltf.animations);let time=0;
  const tick=(seconds,moving=false)=>{for(let i=0;i<Math.ceil(seconds*120);i++){time+=1/120;animator.update(1/120,{time,moving,speed:330});}};
  assert.equal(gltf.animations.length,27);
  for(let direction=0;direction<8;direction++){
    gltf.scene.rotation.y=direction*Math.PI/4;
    for(const [ability,phase] of [['Q'],['W','pickup'],['W','throw'],['E'],['R']]){
      animator.cast({ability,phase,duration:.25},time);tick(.1);
      assert.equal(animator.kind,'spell');assert.ok(animator.active.getEffectiveWeight()>.99);
      tick(3,direction%2===0);
      assert.equal(animator.active.getClip().name,direction%2===0?'syndra_run':'syndra_idle1');
      const bounds=new THREE.Box3().setFromObject(gltf.scene);
      assert.ok([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite));
      assert.ok(bounds.max.y-bounds.min.y>100);
      assert.ok(animator.orbs.enabled&&animator.orbs.getEffectiveWeight()>.99);
    }
    animator.attack({id:direction+1,startedAt:time,windup:.0625},{time});tick(.3,true);
    assert.equal(animator.active.getClip().name,'syndra_run');
    animator.reset();tick(.2);assert.equal(animator.active.getClip().name,'syndra_idle1');
  }
});
