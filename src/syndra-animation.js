import * as THREE from 'three';
import {KayleAnimator} from './kayle-animation.js';

// Native clip names and persistent Orbs mask: tools/syndra-original/animation-map.json.
// Gameplay owns cast/release timing; blending below is a reconstruction of playback.
const orbTrack=track=>/^Buffbone_CSTM_Orb_[123]\./i.test(track.name);
export class SyndraAnimator extends KayleAnimator {
  constructor(model,clips){
    const idle=clips.find(c=>c.name==='syndra_idle1');
    super(model,clips.map(c=>{
      const names=new Set(c.tracks.map(t=>t.name));
      return new THREE.AnimationClip(c.name,c.duration,[...c.tracks,...(idle?.tracks??[]).filter(t=>!names.has(t.name))].filter(t=>!orbTrack(t)));
    }));
    this.model=model;this.preview=null;this.spell=null;
    if(idle){
      this.orbs=this.mixer.clipAction(new THREE.AnimationClip('syndra_orbs_persistent',idle.duration,idle.tracks.filter(orbTrack)));
      this.orbs.setLoop(THREE.LoopRepeat,Infinity).play();
    }
  }
  attack(event,{time}){
    this.preview=null;this.spell=null;this.kind='attack';this.attackId=event.id;this.releasedAttack=false;
    // Both original attack spell records author release at frame 15.075 (30fps).
    const rate=.5025/Math.max(.01,event.windup);
    this.play(`syndra_attack${(event.id-1)%2+1}`,{blend:Math.min(.055,event.windup*.3),rate,offset:Math.max(0,time-event.startedAt)*rate});
  }
  boost(){}
  cast(event,time){
    this.preview=null;this.kind='spell';
    const ability=event.ability;
    const throwing=event.phase==='throw'||event.throwing||event.recast||event.returning;
    const name=({Q:'syndra_spell1',W:throwing?'syndra_spell2_throw':'syndra_spell2_pull',E:'syndra_spell3_start',R:'syndra_spell4_start'})[ability];
    if(!name)return false;
    const clip=this.play(name,{blend:.055});if(!clip)return false;
    const follow=({E:'syndra_spell3_cast',R:'syndra_spell4_cast'})[ability];
    this.spell={ability,follow,transitionAt:time+clip.duration,until:time+clip.duration+(this.clips.get(follow)?.duration??0),lockUntil:time+(event.duration??0)};
    return true;
  }
  previewClip(name,time){
    const clip=this.play(name,{blend:.1});if(!clip)return false;
    this.spell=null;this.preview={name,until:time+clip.duration};this.kind='preview';return true;
  }
  cancelPreview(){this.preview=null;this.kind='base';}
  update(dt,{time=0,moving=false,speed=330,attackUntil=0}={}){
    if(this.preview&&(time>=this.preview.until||moving))this.cancelPreview();
    if(this.spell?.follow&&time>=this.spell.transitionAt){
      this.play(this.spell.follow,{blend:.045,offset:Math.max(0,time-this.spell.transitionAt)});this.spell.follow=null;
    }
    if(this.spell&&time>=this.spell.until){this.spell=null;this.kind='base';}
    // Syndra's original Q/W float animations remain active during movement.
    // Movement never cancels their visual pose or changes gameplay cast timing.
    if(!this.preview&&!this.spell&&!(this.kind==='attack'&&time<attackUntil&&!moving)){
      const name=moving?'syndra_run':'syndra_idle1';
      if(this.active?.getClip().name!==name)this.play(name,{loop:true,blend:.1});
      this.active?.setEffectiveTimeScale(moving?speed/330:1);this.kind='base';
    }
    this.mixer.update(dt);
  }
  reset(){super.reset();this.preview=null;this.spell=null;this.orbs?.reset().setEffectiveWeight(1).play();}
  get diagnostics(){return {...super.diagnostics,preview:this.preview?.name??null,spell:this.spell?.ability??null,orbs:this.orbs?.time};}
}
