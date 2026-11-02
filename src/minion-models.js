import {assetUrl} from './asset-url.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {KayleAnimator} from './kayle-animation.js';

export class MinionAnimator extends KayleAnimator{
  constructor(model,clips,profile){
    const idle=clips.find(c=>c.name===profile.idle);
    super(model,clips.map(c=>{const names=new Set(c.tracks.map(t=>t.name));return new THREE.AnimationClip(c.name,c.duration,[...c.tracks,...idle.tracks.filter(t=>!names.has(t.name))]);}));
    this.profile=profile;this.generation=null;this.attackKey=null;this.until=0;this.deathAt=null;
  }
  update(dt,{unit,time,moving=false}){
    if(dt<=0&&this.generation===unit.generation)return;
    if(this.generation!==unit.generation){this.reset();this.generation=unit.generation;this.attackKey=null;this.until=0;this.deathAt=null;this.play(this.profile.idle,{loop:true,blend:0});this.mixer.update(0);}
    if(!unit.alive){if(this.deathAt==null){this.deathAt=time;this.play(this.profile.death,{blend:.06});}this.mixer.update(dt);return;}
    const a=unit.action;
    if(a&&this.attackKey!==a.releaseAt){
      this.attackKey=a.releaseAt;
      const names=this.profile.attacks,name=names[Math.floor(a.releaseAt*1000)%names.length],rate=this.profile.castTime/Math.max(.02,a.releaseAt-a.startedAt);
      const clip=this.play(name,{blend:.045,rate,offset:Math.max(0,time-a.startedAt)*rate});this.until=a.startedAt+clip.duration/rate;
    }else if(!a&&(moving||time>=this.until)){
      const name=moving?this.profile.run:this.profile.idle;if(this.active?.getClip().name!==name)this.play(name,{loop:true,blend:.08});
      this.active?.setEffectiveTimeScale(moving?(unit.moveSpeed??160)/350:1);
    }
    this.mixer.update(dt);
  }
}

export async function loadMinionModels(){
  const response=await fetch(assetUrl('/assets/minions/resources.json'));if(!response.ok)throw new Error('Falha no catálogo de minions');
  const profiles=await response.json(),templates=new Map();
  await Promise.all(Object.entries(profiles).map(async([key,profile])=>{
    const [gltf,map]=await Promise.all([new GLTFLoader().loadAsync('/assets/minions/'+profile.model),new THREE.TextureLoader().loadAsync('/assets/minions/'+profile.texture)]);
    map.flipY=false;map.colorSpace=THREE.SRGBColorSpace;gltf.scene.scale.setScalar(profile.scale);
    gltf.scene.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;o.castShadow=true;for(const material of Array.isArray(o.material)?o.material:[o.material]){material.map=map;material.side=THREE.DoubleSide;material.roughness=.85;material.alphaTest=.04;material.needsUpdate=true;}});
    templates.set(key,{model:gltf.scene,clips:gltf.animations,profile});
  }));
  return {create(unit){const source=templates.get(`${unit.team}-${unit.kind}`),model=clone(source.model),animator=new MinionAnimator(model,source.clips,source.profile);animator.update(0,{unit,time:0});model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model);return {body:model,animator,labelHeight:Math.max(75,box.max.y)+15};}};
}
