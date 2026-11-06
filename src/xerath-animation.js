import * as THREE from 'three';
import {KayleAnimator} from './kayle-animation.js';

// Spell/graph bindings observed in the installed skin0 data. A full rig and
// continuous yaw are used; timing/blend policy is reconstructed in the trainer.
export const xerathClipLabels={
  xerath_idle1:'Repouso',xerath_idle2:'Repouso alternativo',xerath_idle3:'Repouso alternativo',xerath_idle4:'Retorno à base',xerath_run:'Movimento',
  xerath_attack1:'Autoattack alternativo',xerath_attack2:'Autoattack 2',xerath_attack3:'Autoattack 1',xerath_crit:'Ataque crítico',
  xerath_channel_windup:'Q · início da carga',xerath_channel:'Q · manter carga',xerath_spell1:'Q · disparo',
  xerath_spell4:'W · Olho da Destruição',xerath_spell3:'E · Orbe Eletrizante',
  spell5start:'R · preparar canalização',spell5loop:'R · manter canalização',spell5_fast:'R · disparar',spell5end:'R · encerrar canalização',
  xerath_spell2:'Clipe adicional 2',xerath_spell2_channel:'Canalização adicional',xerath_dance:'Dança',xerath_death:'Morte',xerath_joke:'Piada',xerath_laugh:'Risada',xerath_taunt:'Provocação',
};
export class XerathAnimator extends KayleAnimator {
  constructor(model,clips){
    const idle=clips.find(c=>c.name==='xerath_idle1');
    super(model,clips.map(c=>{
      const names=new Set(c.tracks.map(t=>t.name));
      // Preserve every authored joint; fill partial clips from the original idle
      // so ending a cast cannot expose bind pose in un-authored joints.
      return new THREE.AnimationClip(c.name,c.duration,[...c.tracks,...(idle?.tracks??[]).filter(t=>!names.has(t.name))]);
    }));
    this.model=model;this.preview=null;this.spell=null;this.hold=null;this.alternates=new Map();
  }
  play(name,{blend=.1,rate=1,loop=false,offset=0}={}){
    const source=this.clips.get(name);if(!source)return null;
    const previous=this.active;
    // Consecutive R shots may arrive before the previous pose has recovered.
    // Alternate two actions with the same authored clip instead of resetting
    // the currently weighted action (which would briefly expose bind pose).
    let clip=source;
    if(previous?.getClip()===source){if(!this.alternates.has(name))this.alternates.set(name,source.clone());clip=this.alternates.get(name);}
    const next=this.mixer.clipAction(clip);
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(rate).setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);
    next.clampWhenFinished=!loop;next.time=Math.min(offset,clip.duration);
    if(previous&&previous!==next)next.crossFadeFrom(previous,blend,false);
    next.play();this.active=next;return source;
  }
  attack(event,{time}){
    this.preview=null;this.spell=null;this.hold=null;this.kind='attack';this.attackId=event.id;this.releasedAttack=false;
    const rate=(10/30)/Math.max(.01,event.windup);
    this.play((event.id-1)%2?'xerath_attack2':'xerath_attack3',{blend:Math.min(.055,event.windup*.3),rate,offset:Math.max(0,time-event.startedAt)*rate});
  }
  boost(){}
  cast(event,time){
    const ability=event.ability??event.key,phase=event.phase;this.preview=null;
    if((ability==='Q'&&['cancel','end','expire'].includes(phase))){this.hold=null;this.spell=null;this.kind='base';return true;}
    let name,follow=null;
    if(ability==='Q'&&phase==='charge'){this.hold='Q';name='xerath_channel_windup';follow='xerath_channel';}
    else if(ability==='R'&&['channel','start'].includes(phase)){this.hold='R';name='spell5start';follow='spell5loop';}
    else if(ability==='R'&&phase==='shot'){this.hold='R';name='spell5_fast';follow='spell5loop';}
    else if(ability==='R'&&['end','cancel','expire'].includes(phase)){this.hold=null;name='spell5end';}
    else{this.hold=null;name=({Q:'xerath_spell1',W:'xerath_spell4',E:'xerath_spell3',R:'spell5start'})[ability];}
    if(!name)return false;
    // Original shot resource is 2.3s at exported rate, while the graph overrides
    // its tick to 1/60s. Fit its full recovery to the committed gameplay pulse
    // interval; this playback rate is a reconstruction, not native runtime proof.
    const rate=name==='spell5_fast'?this.clips.get(name).duration/Math.max(.1,event.duration??.6):1;
    const clip=this.play(name,{blend:phase==='release'?.035:.065,rate});if(!clip)return false;
    const duration=clip.duration/rate;
    this.kind='spell';this.spell={ability,phase,follow,transitionAt:time+duration,until:follow?Infinity:time+duration,lockUntil:time+(event.duration??.25)};
    return true;
  }
  previewClip(name,time){
    const clip=this.play(name,{blend:.08});if(!clip)return false;
    this.spell=null;this.hold=null;this.preview={name,until:time+clip.duration};this.kind='preview';return true;
  }
  cancelPreview(){this.preview=null;this.kind='base';}
  update(dt,{time=0,moving=false,speed=340,attackUntil=0,charge,channel}={}){
    if(this.preview&&(time>=this.preview.until||moving))this.cancelPreview();
    // State observation backs up terminal events (round reset, death, timeout).
    if(this.hold==='Q'&&charge!==undefined&&!charge){this.hold=null;this.spell=null;}
    if(this.hold==='R'&&channel!==undefined&&!channel)this.cast({ability:'R',phase:'end',duration:0},time);
    if(this.spell?.follow&&time>=this.spell.transitionAt){
      this.play(this.spell.follow,{loop:true,blend:.065,offset:0});this.spell.follow=null;
    }
    if(this.spell&&!this.hold&&(time>=this.spell.until||(moving&&time>=this.spell.lockUntil))){this.spell=null;this.kind='base';}
    if(!this.preview&&!this.spell&&!(this.kind==='attack'&&time<attackUntil&&!moving)){
      const name=moving?'xerath_run':'xerath_idle1';
      if(this.active?.getClip().name!==name)this.play(name,{loop:true,blend:.085});
      this.active?.setEffectiveTimeScale(moving?speed/340:1);this.kind='base';
    }
    this.mixer.update(dt);
  }
  reset(){super.reset();this.preview=null;this.spell=null;this.hold=null;}
  get diagnostics(){return {...super.diagnostics,preview:this.preview?.name??null,spell:this.spell?.ability??null,phase:this.spell?.phase??null,hold:this.hold};}
}
