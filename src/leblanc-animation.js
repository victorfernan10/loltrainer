import {KayleAnimator} from './kayle-animation.js';
import * as THREE from 'three';

// Shares only the playback/blending primitives. Kayle abilities and passive
// animation choices never run on LeBlanc's skeleton.
export class LeBlancAnimator extends KayleAnimator {
  constructor(model,clips){
    // The original persistent WeaponSpin track is masked to joint 174 only.
    // Excluding that joint from Default avoids averaging spin with static keys.
    const idleTracks=clips.find(c=>c.name==='idle1')?.tracks??[];
    super(model,clips.map(c=>{
      const names=new Set(c.tracks.map(t=>t.name));
      // Partial standalone previews retain idle for joints they do not author,
      // rather than exposing the bind pose after a reset.
      const complete=[...c.tracks,...idleTracks.filter(t=>!names.has(t.name))];
      return new THREE.AnimationClip(c.name,c.duration,complete.filter(t=>!t.name.startsWith('WeaponTip.')));
    }));
    this.preview=null;this.model=model;this.weapon=model.getObjectByName('Weapon');this.weaponSnap=model.getObjectByName('Buffbone_Cstm_WeaponSnap');this.snapMatrix=new THREE.Matrix4();
    const source=clips.find(c=>c.name==='weaponspin');
    if(source){const clip=new THREE.AnimationClip('leblanc_weapon_spin',source.duration,source.tracks.filter(t=>t.name.startsWith('WeaponTip.')));this.spin=this.mixer.clipAction(clip);this.spin.play();}
  }
  attack(event,{time}){
    this.preview=null;this.spell=null;this.kind='attack';this.attackId=event.id;
    const rate=(8/30)/event.windup;
    this.play(`attack${(event.id-1)%2+1}`,{blend:Math.min(.06,event.windup*.35),rate,offset:Math.max(0,time-event.startedAt)*rate});
  }
  boost(){}
  cast(event,time){
    this.preview=null;this.kind='spell';
    const name=event.returning?'spell2_recast':({Q:'spell1',W:'spell2',E:'spell3'})[event.ability];
    const rate=event.ability==='W'&&!event.returning?.5/Math.max(.05,event.duration):1;
    this.play(name,{blend:.055,rate});
    this.spell={ability:event.ability,returning:event.returning,lockUntil:time+event.duration,until:time+Math.max(event.duration,.65),run:false};
  }
  previewClip(name,time){const clip=this.play(name==='weaponspin'?'idle1':name,{blend:.12});if(!clip)return false;this.preview={name,until:time+(this.clips.get(name)?.duration??clip.duration)};this.kind='preview';return true;}
  cancelPreview(){this.preview=null;this.kind='base';}
  update(dt,{time,moving=false,speed=340,attackUntil=0}={}){
    if(this.preview&&(time>=this.preview.until||moving))this.cancelPreview();
    if(this.spell?.ability==='W'&&!this.spell.returning&&!this.spell.transition&&time>=this.spell.lockUntil){
      this.play(moving?'spell2_torun':'spell2_toidle',{blend:.07});
      this.spell.transition=true;this.spell.run=moving;this.spell.until=time+.35;
    }
    if(this.spell&&time>=this.spell.until)this.spell=null;
    if(this.spell&&moving&&time>=this.spell.lockUntil&&!this.spell.run){
      const name=this.spell.returning?'run1':({Q:'spell1_run',W:'spell2_torun',E:'spell3_run'})[this.spell.ability];
      this.play(name,{blend:.09,offset:this.spell.ability==='W'?0:.25});this.spell.run=true;
    }
    if(!this.preview&&!this.spell&&!(this.kind==='attack'&&time<attackUntil&&!moving)){
      const name=moving?'run1':'idle1';
      if(this.active?.getClip().name!==name)this.play(name,{loop:true,blend:.12});
      this.active?.setEffectiveTimeScale(moving?speed/340:1);this.kind='base';
    }
    this.mixer.update(dt);
    // JointSnap is declared on Idle1 and Death, not on attack/run/spell clips.
    if(this.weapon&&this.weaponSnap&&['idle1','death'].includes(this.active?.getClip().name)){
      this.model.updateMatrixWorld(true);
      this.snapMatrix.copy(this.weapon.parent.matrixWorld).invert().multiply(this.weaponSnap.matrixWorld);
      this.snapMatrix.decompose(this.weapon.position,this.weapon.quaternion,this.weapon.scale);
      this.weapon.updateMatrixWorld(true);
    }
  }
  reset(){super.reset();this.preview=null;this.spell=null;this.spin?.reset().setEffectiveWeight(1).play();}
  get diagnostics(){return {...super.diagnostics,preview:this.preview?.name??null,weaponSpin:this.spin?.time};}
}
