// Loads the real converted skeleton; catches clip/layer/reset regressions.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SyndraAnimator} from '../src/syndra-animation.js';
const bytes=fs.readFileSync(new URL('../public/assets/syndra/syndra.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const animator=new SyndraAnimator(gltf.scene,gltf.animations);let time=0;
const step=(seconds,options={})=>{for(let i=0;i<seconds*60;i++){time+=1/60;animator.update(1/60,{time,...options});}};
for(const event of [{ability:'Q'},{ability:'W',phase:'pickup'},{ability:'W',phase:'throw'},{ability:'E'},{ability:'R'}]){
  animator.cast({...event,duration:.25},time);
  step(.1,{moving:true});assert.equal(animator.diagnostics.kind,'spell','movement must not discard a cast');
  step(3);assert.equal(animator.diagnostics.kind,'base');assert.equal(animator.diagnostics.name,'syndra_idle1');
}
for(let id=1;id<=30;id++){
  const until=time+.22;
  animator.attack({id,windup:.22,startedAt:time},{time});step(.15,{attackUntil:until});
  assert.equal(animator.diagnostics.kind,'attack');step(.5);
}
animator.reset();step(.1);
assert.equal(animator.diagnostics.kind,'base');assert.ok(animator.orbs.getEffectiveWeight()>.99);
gltf.scene.traverse(node=>{if(node.isBone)assert.ok([...node.position,...node.quaternion].every(Number.isFinite),node.name);});
console.log(`Syndra: ${gltf.animations.length} original clips; moving casts, recovery, 30 attacks and orb-layer reset passed.`);
