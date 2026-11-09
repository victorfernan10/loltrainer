import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Full original Lucian skeleton and authored clips. Rendering has no role in
// attack release/collision timing; SpacingEncounter owns those decisions.
export class SpacingView {
  constructor(scene){
    this.scene=scene;this.encounter=null;this.ready=false;this.group=new THREE.Group();this.group.visible=false;scene.add(this.group);
    this.projectiles=new Map();this.attackUntil=0;this.active=null;this.lastGeneration=null;
    this.label=document.createElement('div');this.label.className='combat-target-label';this.label.hidden=true;
    this.label.innerHTML='<span>Lucian · 500 u</span><div class="target-health"><i></i></div><small></small>';document.body.append(this.label);
  }
  async load(){
    if(this.ready)return;if(this.loading)return this.loading;
    this.loading=(async()=>{
      const [gltf,map]=await Promise.all([new GLTFLoader().loadAsync('/assets/lucian/lucian.glb'),new THREE.TextureLoader().loadAsync('/assets/lucian/lucian_base_tx_cm.png')]);
      map.flipY=false;map.colorSpace=THREE.SRGBColorSpace;this.model=gltf.scene;this.model.scale.setScalar(1.05);
      this.model.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;o.castShadow=true;o.material.map=map;o.material.side=THREE.DoubleSide;o.material.vertexColors=false;o.material.alphaTest=.05;o.material.needsUpdate=true;});
      this.mixer=new THREE.AnimationMixer(this.model);const idle=gltf.animations.find(c=>c.name==='lucian_idle_ready');
      this.clips=new Map(gltf.animations.map(c=>{const names=new Set(c.tracks.map(t=>t.name));return [c.name,new THREE.AnimationClip(c.name,c.duration,[...c.tracks,...idle.tracks.filter(t=>!names.has(t.name))])];}));
      this.group.add(this.model);this.play('lucian_idle_ready',{loop:true});this.mixer.update(.12);this.ready=true;
    })().catch(error=>{this.loading=null;throw error;});return this.loading;
  }
  play(name,{loop=false,rate=1,blend=.065}={}){
    const clip=this.clips.get(name);if(!clip)return;
    const action=this.mixer.clipAction(clip),previous=this.active;
    action.reset().setEffectiveWeight(1).setEffectiveTimeScale(rate).setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);action.clampWhenFinished=!loop;
    if(previous&&previous!==action)action.crossFadeFrom(previous,blend,false);action.play();this.active=action;
  }
  clearProjectiles(){for(const visual of this.projectiles.values()){this.scene.remove(visual);visual.geometry.dispose();visual.material.dispose();}this.projectiles.clear();}
  bind(encounter){
    this.encounter=encounter;this.group.visible=false;this.label.hidden=true;this.attackUntil=0;this.lastGeneration=null;this.clearProjectiles();
    if(this.mixer){this.mixer.stopAllAction();this.active=null;this.play('lucian_idle_ready',{loop:true});this.mixer.update(.12);}
  }
  update(dt,player,camera){
    const e=this.encounter;if(!e||!this.ready)return;
    if(this.lastGeneration!==e.target.generation){this.lastGeneration=e.target.generation;this.mixer.stopAllAction();this.active=null;this.attackUntil=0;this.play('lucian_idle_ready',{loop:true});this.mixer.update(.12);}
    for(const event of e.drainViewEvents()){
      if(event.type==='start'){this.play(event.id%2?'lucian_attack1':'lucian_attack2',{rate:(8/30)/event.windup,blend:Math.min(.05,event.windup*.3)});this.attackUntil=event.startedAt+event.period;}
      if(event.type==='cancel')this.attackUntil=0;
    }
    const moving=e.moving,holding=e.phase==='attack'||(!moving&&e.time<this.attackUntil);
    if(!holding){const name=moving?'lucian_run1':'lucian_idle_ready';if(this.active?.getClip().name!==name)this.play(name,{loop:true,rate:moving?e.moveSpeed/335:1});else this.active.setEffectiveTimeScale(moving?e.moveSpeed/335:1);}
    const delta=Math.atan2(Math.sin(e.facing-this.group.rotation.y),Math.cos(e.facing-this.group.rotation.y));this.group.rotation.y+=delta*(1-Math.exp(-45*dt));
    this.group.position.set(e.position.x,0,e.position.z);this.group.visible=e.active;this.label.hidden=!e.active;this.mixer.update(dt);
    if(e.active){const p=new THREE.Vector3(e.position.x,265,e.position.z).project(camera);this.label.style.left=(p.x+1)*innerWidth/2+'px';this.label.style.top=(1-p.y)*innerHeight/2+'px';this.label.style.visibility=p.z>1?'hidden':'visible';this.label.querySelector('i').style.width=100*e.target.health/e.target.maxHealth+'%';this.label.querySelector('small').textContent=`${Math.ceil(e.target.health)} / ${e.target.maxHealth}`;}
    const ids=new Set(e.projectiles.map(p=>p.id));
    for(const [id,visual] of this.projectiles)if(!ids.has(id)){this.scene.remove(visual);visual.geometry.dispose();visual.material.dispose();this.projectiles.delete(id);}
    for(const projectile of e.projectiles){let visual=this.projectiles.get(projectile.id);if(!visual){visual=new THREE.Mesh(new THREE.SphereGeometry(6,10,6),new THREE.MeshBasicMaterial({color:'#fff3c6'}));visual.scale.set(1,1,3.6);this.projectiles.set(projectile.id,visual);this.scene.add(visual);}visual.position.set(projectile.position.x,105,projectile.position.z);visual.lookAt(player.x,105,player.z);}
  }
  pick(raycaster){
    if(!this.encounter?.active)return null;
    if(raycaster.intersectObject(this.group,true).length)return this.encounter.target.id;
    const center=this.group.position.clone();center.y+=85;return raycaster.ray.intersectsSphere(new THREE.Sphere(center,90))?this.encounter.target.id:null;
  }
  get diagnostics(){return {ready:this.ready,visible:this.group.visible,phase:this.encounter?.phase,animation:{name:this.active?.getClip().name,time:this.active?.time,weight:this.active?.getEffectiveWeight()},projectiles:this.projectiles.size};}
}
