import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {loadPlayerModel} from './player-models.js';
import {LeBlancAnimator} from './leblanc-animation.js';
import {LeBlancEffects} from './leblanc-effects.js';

export class VaultView {
  constructor(scene){
    this.scene=scene;this.enemy=null;this.ready=false;this.group=new THREE.Group();this.group.visible=false;this.group.userData.combatTargetId='vault-leblanc';scene.add(this.group);
    this.effects=new LeBlancEffects(scene);this.label=document.createElement('div');this.label.className='combat-target-label';this.label.hidden=true;
    this.label.innerHTML='<span>LeBlanc · Distorção</span><div class="target-health"><i></i></div><small></small>';document.body.append(this.label);
  }
  async load(){
    if(this.ready)return;if(this.loading)return this.loading;
    this.loading=(async()=>{const source=await loadPlayerModel('leblanc');this.model=clone(source.model);this.model.rotation.set(0,0,0);this.animator=new LeBlancAnimator(this.model,source.clips);this.group.add(this.model);this.animator.update(.12,{time:0});this.ready=true;})().catch(error=>{this.loading=null;throw error;});return this.loading;
  }
  bind(enemy){this.enemy=enemy;this.effects.clear();this.group.visible=false;this.label.hidden=true;this.lastRound=null;if(this.animator){this.animator.reset();this.animator.update(.12,{time:enemy?.time??0});}}
  update(dt,player,camera){
    const e=this.enemy;if(!e||!this.ready)return;
    if(this.lastRound!==e.rounds){this.lastRound=e.rounds;this.animator.reset();this.animator.update(.12,{time:e.time});}
    const events=e.drainViewEvents();
    for(const event of events){
      if(event.type==='spell')this.animator.cast(event,event.startedAt);
      if(event.type==='interrupted'){
        this.animator.spell={ability:'interrupt',lockUntil:event.until,until:event.until};this.animator.kind='spell';
        this.animator.play(this.animator.clips.has('knockup')?'knockup':'stunned',{blend:.04});
      }
    }
    this.effects.events(events);this.effects.update(dt,{anchors:{},skillProjectiles:[],tethers:[],targets:[],time:e.time},e.position);
    this.group.visible=e.active;this.label.hidden=!e.active;
    this.group.position.set(e.position.x,0,e.position.z);
    const delta=Math.atan2(Math.sin(e.facing-this.group.rotation.y),Math.cos(e.facing-this.group.rotation.y));this.group.rotation.y+=delta*(1-Math.exp(-40*dt));
    this.animator.update(dt,{time:e.time,moving:e.moving,speed:e.moveSpeed*.45});
    if(!e.active)return;
    const p=new THREE.Vector3(e.position.x,240,e.position.z).project(camera);this.label.style.left=(p.x+1)*innerWidth/2+'px';this.label.style.top=(1-p.y)*innerHeight/2+'px';this.label.style.visibility=p.z>1?'hidden':'visible';
    this.label.querySelector('i').style.width=100*e.target.health/e.target.maxHealth+'%';this.label.querySelector('small').textContent=`${Math.ceil(e.target.health)} / ${e.target.maxHealth}`;
    this.label.querySelector('span').textContent=e.phase==='interrupted'?'LeBlanc · W interrompido':'LeBlanc · Distorção';
  }
  pick(raycaster){
    if(!this.enemy?.active)return null;
    if(raycaster.intersectObject(this.group,true).length)return 'vault-leblanc';
    // Native LeBlanc selectionHeight=85 / selectionRadius=100. The selection
    // volume fills gaps between animated limbs; combat still uses radius 65.
    const center=this.group.position.clone();center.y+=85;
    return raycaster.ray.intersectsSphere(new THREE.Sphere(center,100))?'vault-leblanc':null;
  }
  get diagnostics(){return {ready:this.ready,phase:this.enemy?.phase,visible:this.group.visible,animation:this.animator?.diagnostics};}
}
