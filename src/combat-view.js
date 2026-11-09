import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {CaitlynEffects} from './caitlyn-effects.js';
import {XerathEffects} from './xerath-effects.js';
import {LeBlancEffects} from './leblanc-effects.js';
import {QuinnEffects} from './quinn-effects.js';
import {SyndraEffects} from './syndra-effects.js';

export class CombatView {
  constructor(scene){
    this.scene=scene;this.ready=false;this.combat=null;this.targets=[];this.bolts=new Map();this.numbers=[];
    this.spellEffects=new LeBlancEffects(scene);this.caitlynEffects=new CaitlynEffects(scene);this.xerathEffects=new XerathEffects(scene);
    this.syndraEffects=new SyndraEffects(scene);this.quinnEffects=new QuinnEffects(scene);
    this.range=new THREE.Mesh(new THREE.RingGeometry(589,591,128),new THREE.MeshBasicMaterial({color:'#9ee3bc',transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}));
    this.range.rotation.x=-Math.PI/2;this.range.visible=false;scene.add(this.range);
    this.load().catch(error=>{this.error=error;console.error('Falha nos alvos de combate',error);});
  }
  async load(){
    const [gltf,map]=await Promise.all([new GLTFLoader().loadAsync('/assets/targets/ryze.glb'),new THREE.TextureLoader().loadAsync('/assets/targets/ryze_base.png')]);
    map.flipY=false;map.colorSpace=THREE.SRGBColorSpace;
    for(let i=0;i<3;i++){
      const root=clone(gltf.scene),group=new THREE.Group();
      root.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;o.castShadow=true;o.material=o.material.clone();o.material.map=map;o.material.side=THREE.DoubleSide;o.material.roughness=.85;o.material.needsUpdate=true;if(o.material.name==='Ryze_VFX')o.visible=false;});
      root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),scale=190/size.y;
      root.scale.setScalar(scale);root.position.set(-(bounds.min.x+bounds.max.x)/2*scale,-bounds.min.y*scale,-(bounds.min.z+bounds.max.z)/2*scale);
      group.add(root);group.visible=false;group.userData.combatTargetId=`ryze-${i+1}`;this.scene.add(group);
      const mixer=new THREE.AnimationMixer(root),idle=mixer.clipAction(gltf.animations.find(c=>c.name.includes('idle'))||gltf.animations[0]);idle.play();
      const label=document.createElement('div');label.className='combat-target-label';label.hidden=true;
      label.innerHTML=`<span>Ryze ${i+1} · alvo</span><div class="target-health"><i></i></div><small>600 / 600</small>`;document.body.append(label);
      this.targets.push({id:group.userData.combatTargetId,group,mixer,idle,label});
    }
    this.ready=true;
  }
  bind(combat){
    this.spellEffects.clear();this.caitlynEffects.clear();this.xerathEffects.clear();
    this.syndraEffects.clear();this.quinnEffects.clear();
    this.combat=combat;this.range.visible=false;
    for(const bolt of this.bolts.values())this.disposeBolt(bolt);this.bolts.clear();
    for(const number of this.numbers)number.node.remove();this.numbers=[];
    for(const target of this.targets){target.group.visible=!!combat?.target(target.id);target.label.hidden=!combat?.target(target.id);}
    if(combat){this.range.geometry.dispose();this.range.geometry=new THREE.RingGeometry(combat.range+64,combat.range+66,128);}
  }
  pick(raycaster){
    if(!this.combat)return null;
    const hit=raycaster.intersectObjects(this.targets.filter(v=>this.combat.target(v.id)?.alive).map(v=>v.group),true)[0];
    for(let object=hit?.object;object;object=object.parent)if(object.userData.combatTargetId)return object.userData.combatTargetId;
    return null;
  }
  disposeBolt(bolt){this.scene.remove(bolt);bolt.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
  events(events){
    if(this.combat?.champion==='caitlyn')this.caitlynEffects.events(events);
    else if(this.combat?.champion==='xerath')this.xerathEffects.events(events);
    else if(this.combat?.champion==='quinn')this.quinnEffects.events(events);
    else if(this.combat?.champion==='syndra')this.syndraEffects.events(events);
    else this.spellEffects.events(events);
    for(const event of events){
      if(event.type!=='hit')continue;const target=this.combat.target(event.targetId);if(!target)continue;
      const node=document.createElement('div');node.className='combat-damage-number';node.textContent=`−${event.amount}`;document.body.append(node);
      this.numbers.push({node,position:new THREE.Vector3(target.position.x,205,target.position.z),remaining:.7});
    }
  }
  update(dt,position,camera,armed){
    const combat=this.combat;if(!combat)return;
    if(combat.champion==='caitlyn')this.caitlynEffects.update(dt,combat,position);
    if(combat.champion==='xerath')this.xerathEffects.update(dt,combat,position);
    if(combat.champion==='leblanc')this.spellEffects.update(dt,combat,position);
    if(combat.champion==='quinn')this.quinnEffects.update(dt,combat);
    if(combat.champion==='syndra')this.syndraEffects.update(dt,combat,position);
    this.range.visible=armed;this.range.position.set(position.x,2,position.z);
    for(const visual of this.targets){
      const target=combat.target(visual.id);if(!target){visual.group.visible=false;visual.label.hidden=true;continue;}visual.group.visible=target.alive;visual.label.hidden=!target.alive;
      visual.group.position.set(target.position.x,0,target.position.z);visual.group.rotation.y=Math.atan2(position.x-target.position.x,position.z-target.position.z);visual.mixer.update(dt);
      const screen=new THREE.Vector3(target.position.x,218,target.position.z).project(camera);
      visual.label.style.left=(screen.x+1)*innerWidth/2+'px';visual.label.style.top=(-screen.y+1)*innerHeight/2+'px';
      visual.label.classList.toggle('selected',combat.activeTargetId===target.id);visual.label.querySelector('i').style.width=100*target.health/target.maxHealth+'%';visual.label.querySelector('small').textContent=`${target.health} / ${target.maxHealth}`;
      const marked=combat.circuit&&combat.markedId===target.id;visual.label.classList.toggle('marked',marked);visual.label.querySelector('span').textContent=marked?`◆ ALVO ${target.id.split('-').at(-1)} · ${combat.markedProgress}/${combat.markRequired}`:`Ryze ${target.id.split('-').at(-1)} · alvo`;
      if(target.nearsightUntil>combat.time)visual.label.querySelector('span').textContent+=' · VISÃO REDUZIDA';
      if(target.rootUntil>combat.time)visual.label.querySelector('span').textContent+=` · PRESO ${(target.rootUntil-combat.time).toFixed(1)} s`;
      if(target.stunUntil>combat.time)visual.label.querySelector('span').textContent+=` · ATORDOADO ${(target.stunUntil-combat.time).toFixed(1)} s`;
    }
    const ids=new Set(combat.bolts.map(b=>b.id));for(const [id,visual] of this.bolts){if(!ids.has(id)){this.disposeBolt(visual);this.bolts.delete(id);}}
    for(const bolt of combat.champion==='caitlyn'?[]:combat.bolts){
      let visual=this.bolts.get(bolt.id);
      if(!visual){visual=new THREE.Group();const core=new THREE.Mesh(new THREE.SphereGeometry(7,12,8),new THREE.MeshBasicMaterial({color:'#fff1b0'}));core.scale.z=2.2;visual.add(core);const halo=new THREE.Mesh(new THREE.SphereGeometry(13,12,8),new THREE.MeshBasicMaterial({color:'#f4ca58',transparent:true,opacity:.28,depthWrite:false,blending:THREE.AdditiveBlending}));halo.scale.z=2.4;visual.add(halo);this.bolts.set(bolt.id,visual);this.scene.add(visual);}
      if(combat.champion==='syndra'){visual.children[0].material.color.set('#d69bff');visual.children[1].material.color.set('#8b3ed8');}
      const end=combat.target(bolt.targetId).position,t=1-Math.max(0,bolt.remaining)/Math.max(.001,bolt.duration);
      visual.position.set(THREE.MathUtils.lerp(bolt.origin.x,end.x,t),120,THREE.MathUtils.lerp(bolt.origin.z,end.z,t));visual.lookAt(end.x,120,end.z);
    }
    for(let i=this.numbers.length-1;i>=0;i--){const number=this.numbers[i];number.remaining-=dt;number.position.y+=dt*70;const p=number.position.clone().project(camera);number.node.style.left=(p.x+1)*innerWidth/2+'px';number.node.style.top=(-p.y+1)*innerHeight/2+'px';number.node.style.opacity=Math.min(1,number.remaining*3);if(number.remaining<=0){number.node.remove();this.numbers.splice(i,1);}}
  }
}
