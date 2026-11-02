import {assetUrl} from './asset-url.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {matchupProfiles} from './matchup-data.js';

export class MatchupAnimator {
  constructor(model,clips,champion){
    this.profile=matchupProfiles[champion];this.champion=champion;this.mixer=new THREE.AnimationMixer(model);this.key='';this.active=null;
    const idle=clips.find(c=>c.name===this.profile.idle);
    this.clips=new Map(clips.map(c=>{const names=new Set(c.tracks.map(t=>t.name));return [c.name,new THREE.AnimationClip(c.name,c.duration,[...c.tracks,...idle.tracks.filter(t=>!names.has(t.name))])];}));
    this.play(this.profile.idle,true,0);this.mixer.update(0);
  }
  play(name,loop,blend=.1){
    const clip=this.clips.get(name)??this.clips.get(this.profile.idle),next=this.mixer.clipAction(clip),previous=this.active;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);next.clampWhenFinished=!loop;
    if(previous&&previous!==next)next.crossFadeFrom(previous,blend,false);
    next.play();this.active=next;
  }
  update(dt,e){
    const key=e.action?`cast:${e.action.id}`:e.phase;
    if(key!==this.key){
      this.key=key;
      const name=e.action?(this.champion==='locke'?(e.action.skill.id==='lockeQ2'?'spell1_r':'spell1_l'):e.action.skill.id==='ahriE'?'spell3_north':'spell1'):e.phase==='run'?this.profile.run:this.profile.idle;
      this.play(name,!e.action,e.action?.055:.12);
    }
    this.mixer.update(dt);
  }
  reset(){this.mixer.stopAllAction();this.key='';this.active=null;this.play(this.profile.idle,true,0);this.mixer.update(0);}
}

export class MatchupView {
  constructor(scene){this.scene=scene;this.models=new Map();this.loading=new Map();this.enemy=null;this.fx=new Map();this.maps=new Map();this.group=new THREE.Group();scene.add(this.group);this.group.visible=false;}
  async load(champion){
    if(this.models.has(champion))return this.models.get(champion);
    if(this.loading.has(champion))return this.loading.get(champion);
    const promise=this.loadAssets(champion).catch(error=>{this.loading.delete(champion);throw error;});this.loading.set(champion,promise);return promise;
  }
  async loadAssets(champion){
    const p=matchupProfiles[champion],loader=new THREE.TextureLoader();
    const gltf=await new GLTFLoader().loadAsync(`/assets/${champion}/${champion}.glb`);
    const textures=await Promise.all(p.textures.map(n=>loader.loadAsync(`/assets/${champion}/${n}.png`)));
    for(const t of textures){t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;}
    const model=gltf.scene,remove=[];
    model.traverse(o=>{if(!o.isMesh)return;const name=o.material.name;
      if(p.hidden.includes(name)){remove.push(o);return;}
      const index=champion==='ahri'?(name==='Tails'?1:0):name==='Hair'?1:['Weapon','Nailbelt'].includes(name)?2:0;
      o.material=new THREE.MeshStandardMaterial({name,map:textures[index],roughness:.9,metalness:0,side:THREE.DoubleSide,alphaTest:.1});o.castShadow=true;o.frustumCulled=false;
    });
    remove.forEach(o=>o.removeFromParent());
    const animator=new MatchupAnimator(model,gltf.animations,champion);
    // Models remain in game units; no bounding-box scale changes between clips.
    const particles={};
    await Promise.all((champion==='ahri'?['heart','orb']:['nail']).map(async name=>{
      const response=await fetch(assetUrl(`/assets/${champion}/${name}.json`));if(!response.ok)throw new Error('Missing original particle '+name);
      const data=await response.json(),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));g.computeVertexNormals();g.center();
      if(name==='nail')g.rotateX(Math.PI/2);particles[name]=g;
    }));
    const asset={model,animator,clips:gltf.animations,particles,textures};this.models.set(champion,asset);return asset;
  }
  bind(enemy){
    this.enemy=enemy;this.group.clear();this.group.visible=false;this.clearEffects();
    const asset=enemy&&this.models.get(enemy.champion);if(asset){this.group.add(asset.model);asset.animator.reset();}
  }
  texture(champion,name){const key=champion+'/'+name;if(!this.maps.has(key)){const t=new THREE.TextureLoader().load(`/assets/${champion}/${name}.png`);t.colorSpace=THREE.SRGBColorSpace;this.maps.set(key,t);}return this.maps.get(key);}
  clearEffects(){for(const o of this.fx.values())this.dispose(o);this.fx.clear();}
  dispose(o){this.scene.remove(o);o.traverse(c=>{if(c.geometry&&!c.isSprite)c.geometry.dispose();if(c.material)c.material.dispose();});}
  projectile(p){
    const g=new THREE.Group(),id=p.skill.id,asset=this.models.get(id.startsWith('ahri')?'ahri':'locke');
    const sprite=(name,color,size,opacity=1)=>{const o=new THREE.Sprite(new THREE.SpriteMaterial({map:this.texture(id.startsWith('ahri')?'ahri':'locke',name),color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending}));o.scale.set(size,size,1);g.add(o);return o;};
    if(id.startsWith('ahriQ')){
      sprite('ahri_base_q_orbbackground','#80dfff',140,.8);sprite('ahri_base_q_orbedge','#c5f8ff',105,.9);
      const core=new THREE.Mesh(asset.particles.orb.clone(),new THREE.MeshBasicMaterial({map:this.texture('ahri','ahri_base_q_orbbackground'),color:'#c5f7ff',transparent:true,opacity:.8}));core.scale.setScalar(2.8);g.add(core);
    }else if(id==='ahriE'){
      const heart=new THREE.Mesh(asset.particles.heart.clone(),new THREE.MeshBasicMaterial({map:this.texture('ahri','ahri_base_e_heart_01'),color:'#ff90cb',side:THREE.DoubleSide}));heart.scale.setScalar(4.3);heart.userData.faceCamera=true;g.add(heart);
      sprite('ahri_base_e_heart_01','#ff90cb',110,.28);
    }else{
      const nail=new THREE.Mesh(asset.particles.nail.clone(),new THREE.MeshStandardMaterial({map:asset.textures[2],color:'#f7cba8',metalness:.2,roughness:.6}));g.add(nail);
      sprite('locke_q_nailtipblnd','#ffd3a9',80,.7);
    }
    const trailTexture=id==='ahriE'?'ahri_base_e_trail_01':id.startsWith('ahriQ')?'ahri_base_q_trail_01':'lock_base_q_trail_v2';
    const trail=new THREE.Mesh(new THREE.PlaneGeometry(id.startsWith('ahriQ')?85:55,180),new THREE.MeshBasicMaterial({map:this.texture(id.startsWith('ahri')?'ahri':'locke',trailTexture),color:p.skill.color,transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));trail.rotation.x=-Math.PI/2;trail.position.z=-90;g.add(trail);return g;
  }
  update(dt,telegraphs=true,camera=null){
    const e=this.enemy,asset=e&&this.models.get(e.champion);this.group.visible=!!asset&&e.active;
    if(asset){this.group.position.set(e.position.x,0,e.position.z);this.group.rotation.y=e.facing;asset.animator.update(dt,e);}
    const used=new Set();
    const use=(key,create)=>{used.add(key);if(!this.fx.has(key)){const o=create();this.scene.add(o);this.fx.set(key,o);}return this.fx.get(key);};
    const a=e?.action;
    if(a&&!a.released&&telegraphs&&a.skill.warning>0){
      const o=use('warning'+a.id,()=>new THREE.Mesh(new THREE.PlaneGeometry(10,a.skill.range),new THREE.MeshBasicMaterial({color:a.skill.color,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false})));
      o.rotation.set(-Math.PI/2,0,Math.atan2(a.direction.x,a.direction.z));o.position.set((a.origin.x+a.endpoint.x)/2,2,(a.origin.z+a.endpoint.z)/2);
    }
    for(const p of e?.projectiles??[]){
      const o=use('missile'+p.id,()=>this.projectile(p));o.position.set(p.position.x,85,p.position.z);o.rotation.y=Math.atan2(p.direction.x,p.direction.z);
      if(camera)for(const child of o.children)if(child.userData.faceCamera)child.quaternion.copy(o.quaternion).invert().multiply(camera.quaternion);
    }
    for(const [key,o] of this.fx)if(!used.has(key)){this.dispose(o);this.fx.delete(key);}
  }
  get diagnostics(){const e=this.enemy,a=e&&this.models.get(e.champion),meshes=[];a?.model.traverse(o=>{if(o.isMesh)meshes.push(o.material.name);});return {champion:e?.champion,clip:a?.animator.active?.getClip().name,weight:a?.animator.active?.getEffectiveWeight(),animationTime:a?.animator.active?.time,clips:a?.clips.map(c=>c.name),visible:this.group.visible,meshes};}
}
