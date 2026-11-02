import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MatchupAnimator} from '../src/matchup-view.js';
import {matchupProfiles,matchupSkills} from '../src/matchup-data.js';

for(const champion of ['ahri','locke'])test(`${champion}: original rig remains finite across repeated casts, 360 degree turns and idle recovery`,async()=>{
  const bytes=await fs.readFile(new URL(`../public/assets/${champion}/${champion}.glb`,import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const animator=new MatchupAnimator(gltf.scene,gltf.animations,champion),profile=matchupProfiles[champion];
  for(let i=0;i<12;i++){
    const skill=matchupSkills[champion==='ahri'?(i%2?'ahriQ':'ahriE'):`lockeQ${i%3+1}`];
    gltf.scene.rotation.y=i*Math.PI/4;
    animator.update(.25,{phase:'cast',action:{id:i,skill}});
    assert.ok(animator.active.getEffectiveWeight()>.99);
    animator.update(.2,{phase:'run'});assert.equal(animator.active.getClip().name,profile.run);
    animator.update(.2,{phase:'idle'});assert.equal(animator.active.getClip().name,profile.idle);assert.equal(animator.active.enabled,true);
    const b=new THREE.Box3().setFromObject(gltf.scene);assert.ok([...b.min.toArray(),...b.max.toArray()].every(Number.isFinite));
    assert.ok(b.max.y-b.min.y>80);
    gltf.scene.traverse(o=>assert.ok([...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()].every(Number.isFinite)));
  }
});
