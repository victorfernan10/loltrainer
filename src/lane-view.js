import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {loadPlayerModel} from './player-models.js';
import {LeBlancAnimator} from './leblanc-animation.js';
import {loadMinionModels} from './minion-models.js';

export class LaneView{
  constructor(scene){this.scene=scene;this.lane=null;this.units=new Map();this.bolts=new Map();this.group=new THREE.Group();scene.add(this.group);this.group.visible=false;this.ready=false;}
  async load(){if(this.ready)return;if(this.loading)return this.loading;this.loading=(async()=>{const [source,minions]=await Promise.all([loadPlayerModel('leblanc'),loadMinionModels()]);this.minionModels=minions;this.model=clone(source.model);this.model.rotation.set(0,0,0);this.animator=new LeBlancAnimator(this.model,source.clips);this.group.add(this.model);this.label=this.makeLabel('LeBlanc · adversária');this.ready=true;})().catch(error=>{this.loading=null;throw error;});return this.loading;}
  makeLabel(name,minion=false){const node=document.createElement('div');node.className=minion?'lane-minion-label':'combat-target-label';node.innerHTML=`<span>${name}</span><div class="target-health"><i></i><em></em></div><small></small>`;node.hidden=true;document.body.append(node);return node;}
  createMinion(m){
    const group=new THREE.Group(),visual=this.minionModels.create(m);group.add(visual.body);
    group.userData.targetId=m.team==='red'?m.id:null;group.rotation.y=m.team==='blue'?Math.PI:0;this.scene.add(group);
    return {group,...visual,label:this.makeLabel('',true),previous:{...m.position},generation:m.generation};
  }
  bind(lane){this.lane=lane;this.lastAttack=null;this.animator?.reset();this.group.visible=false;if(this.label)this.label.hidden=true;for(const v of this.units.values()){v.animator.generation=null;v.generation=null;v.group.visible=false;v.label.hidden=true;}for(const v of this.bolts.values())this.dispose(v);this.bolts.clear();}
  dispose(mesh){this.scene.remove(mesh);mesh.geometry?.dispose();mesh.material?.dispose();}
  labelAt(node,position,y,camera){const p=new THREE.Vector3(position.x,y,position.z).project(camera);node.style.left=(p.x+1)*innerWidth/2+'px';node.style.top=(1-p.y)*innerHeight/2+'px';node.style.visibility=p.z>1?'hidden':'visible';}
  update(dt,camera){
    const lane=this.lane;if(!lane||!this.ready)return;this.group.visible=lane.target.alive;this.label.hidden=!lane.target.alive;
    this.group.position.set(lane.position.x,0,lane.position.z);const delta=Math.atan2(Math.sin(lane.facing-this.group.rotation.y),Math.cos(lane.facing-this.group.rotation.y));this.group.rotation.y+=delta*(1-Math.exp(-35*dt));
    if(lane.action&&lane.action.id!==this.lastAttack){this.lastAttack=lane.action.id;this.animator.attack({...lane.action,windup:lane.windup},{time:lane.time});}
    this.animator.update(dt,{time:lane.time,moving:lane.phase==='run',speed:lane.moveSpeed,attackUntil:lane.action?.releaseAt??0});
    this.labelAt(this.label,lane.position,230,camera);this.label.querySelector('i').style.width=100*lane.target.health/lane.target.maxHealth+'%';this.label.querySelector('small').textContent=`${Math.ceil(lane.target.health)} / ${lane.target.maxHealth}`;
    this.label.querySelector('span').textContent=lane.coach&&lane.action?'LeBlanc · AUTOATTACK':'LeBlanc · adversária';
    this.label.classList.toggle('lane-window',lane.coach&&!!lane.action);
    for(const m of lane.minions){let v=this.units.get(m.id);if(!v){v=this.createMinion(m);this.units.set(m.id,v);}
      if(v.generation!==m.generation){v.previous={...m.position};v.generation=m.generation;}
      const dx=m.position.x-v.previous.x,dz=m.position.z-v.previous.z,moving=Math.hypot(dx,dz)>.001;
      v.animator.update(dt,{unit:m,time:lane.time,moving});v.previous={...m.position};
      v.group.visible=m.alive||(v.animator.deathAt!=null&&lane.time-v.animator.deathAt<1.2);v.label.hidden=!m.alive;
      v.group.position.set(m.position.x,0,m.position.z);
      const victim=m.action?lane.minion(m.action.targetId):null;
      if(m.alive&&(victim||moving)){const yaw=victim?Math.atan2(victim.position.x-m.position.x,victim.position.z-m.position.z):Math.atan2(dx,dz),delta=Math.atan2(Math.sin(yaw-v.group.rotation.y),Math.cos(yaw-v.group.rotation.y));v.group.rotation.y+=delta*(1-Math.exp(-30*dt));}
      if(!m.alive)continue;
      this.labelAt(v.label,m.position,v.labelHeight,camera);
      const low=m.team==='blue'&&m.health<=lane.attackDamage;v.label.classList.toggle('low',low&&lane.coach);v.label.classList.toggle('red',m.team==='red');
      v.label.querySelector('i').style.width=100*m.health/m.maxHealth+'%';v.label.querySelector('em').style.left=100*lane.attackDamage/m.maxHealth+'%';v.label.querySelector('em').hidden=!lane.coach||m.team!=='blue';v.label.querySelector('small').textContent=lane.coach&&low?`${Math.ceil(m.health)} HP`:'';
    }
    const ids=new Set(lane.projectiles.map(p=>p.id));for(const [id,v] of this.bolts)if(!ids.has(id)){this.dispose(v);this.bolts.delete(id);}
    for(const p of lane.projectiles){let v=this.bolts.get(p.id);if(!v){v=new THREE.Mesh(new THREE.SphereGeometry(p.source==='enemy'?7:4,8,6),new THREE.MeshBasicMaterial({color:p.source==='enemy'?'#e6a7ff':p.origin.z<-325?'#ed9595':'#83c9f2'}));this.bolts.set(p.id,v);this.scene.add(v);}v.position.set(p.position.x,p.source==='enemy'?100:58,p.position.z);}
  }
  pick(raycaster){if(!this.lane)return null;const roots=[...(this.lane.target.alive?[this.group]:[]),...this.lane.minions.filter(m=>m.alive&&m.team==='red').map(m=>this.units.get(m.id)?.group).filter(Boolean)];const hit=raycaster.intersectObjects(roots,true)[0];for(let o=hit?.object;o;o=o.parent){if(o===this.group)return this.lane.target.id;if(o.userData.targetId)return o.userData.targetId;}return null;}
}
