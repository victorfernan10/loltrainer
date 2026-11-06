import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {loadPlayerModel} from './player-models.js';
import {LeBlancAnimator} from './leblanc-animation.js';
import {LeBlancEffects} from './leblanc-effects.js';

// The target uses the same complete original skeleton, masks and animation
// blending as playable LeBlanc. Difficulty never alters model or clip speed.
export class AimView {
  constructor(scene){
    this.scene=scene;this.encounter=null;this.ready=false;this.group=new THREE.Group();this.group.visible=false;scene.add(this.group);
    this.effects=new LeBlancEffects(scene);this.label=document.createElement('div');this.label.className='combat-target-label';this.label.hidden=true;
    this.label.innerHTML='<span>LeBlanc · alvo móvel</span><div class="target-health"><i></i></div><small></small>';document.body.append(this.label);
  }
  async load(){
    if(this.ready)return;if(this.loading)return this.loading;
    this.loading=(async()=>{
      const source=await loadPlayerModel('leblanc');this.model=clone(source.model);this.model.rotation.set(0,0,0);
      this.animator=new LeBlancAnimator(this.model,source.clips);this.group.add(this.model);this.animator.update(.12,{time:0});this.ready=true;
    })().catch(error=>{this.loading=null;throw error;});return this.loading;
  }
  bind(encounter){
    this.encounter=encounter;this.group.visible=false;this.label.hidden=true;this.effects.clear();this.lastGeneration=null;this.wasControlled=false;
    if(this.animator){this.animator.reset();this.animator.update(.12,{time:encounter?.time??0});}
  }
  update(dt,player,camera){
    const e=this.encounter;if(!e||!this.ready)return;
    if(this.lastGeneration!==e.target.generation){this.lastGeneration=e.target.generation;this.animator.reset();this.animator.update(.12,{time:e.time});this.wasControlled=false;}
    const events=e.drainViewEvents();
    for(const event of events)if(event.type==='spell')this.animator.cast(event,event.startedAt);
    const controlled=e.phase==='controlled',stunned=(e.target.stunUntil??0)>e.time;
    if(controlled&&stunned){
      if(!this.wasControlled){this.animator.kind='spell';this.animator.play('stunned',{loop:true,blend:.06});}
      this.animator.spell={ability:'stunned',lockUntil:e.target.stunUntil,until:e.target.stunUntil,run:false};
    }else if(this.wasControlled&&this.animator.spell?.ability==='stunned'){this.animator.spell=null;}
    this.wasControlled=controlled&&stunned;
    this.effects.events(events);this.effects.update(dt,{anchors:{},skillProjectiles:[],tethers:[],targets:[],time:e.time},e.position);
    this.group.visible=e.active;this.label.hidden=!e.active;this.group.position.set(e.position.x,0,e.position.z);
    const delta=Math.atan2(Math.sin(e.facing-this.group.rotation.y),Math.cos(e.facing-this.group.rotation.y));
    this.group.rotation.y+=delta*(1-Math.exp(-40*dt));
    this.animator.update(dt,{time:e.time,moving:e.moving,speed:e.moveSpeed});
    if(!e.active)return;
    const p=new THREE.Vector3(e.position.x,240,e.position.z).project(camera);
    this.label.style.left=(p.x+1)*innerWidth/2+'px';this.label.style.top=(1-p.y)*innerHeight/2+'px';this.label.style.visibility=p.z>1?'hidden':'visible';
    this.label.querySelector('i').style.width=100*e.target.health/e.target.maxHealth+'%';
    this.label.querySelector('small').textContent=`${Math.ceil(e.target.health)} / ${e.target.maxHealth}`;
    this.label.querySelector('span').textContent=stunned?'LeBlanc · atordoada':e.phase==='dash'?'LeBlanc · Distorção':'LeBlanc · alvo móvel';
  }
  pick(raycaster){
    if(!this.encounter?.active)return null;
    if(raycaster.intersectObject(this.group,true).length)return this.encounter.target.id;
    const center=this.group.position.clone();center.y+=85;
    return raycaster.ray.intersectsSphere(new THREE.Sphere(center,100))?this.encounter.target.id:null;
  }
  get diagnostics(){return {ready:this.ready,visible:this.group.visible,phase:this.encounter?.phase,animation:this.animator?.diagnostics};}
}
