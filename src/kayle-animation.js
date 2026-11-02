import * as THREE from 'three';

// Original resources/mappings: tools/kayle-spell-map-evidence.json.
// The native scheduling semantics are not recovered: gameplay stays owned by
// Combat. In particular, a W during windup waits for release visually only.
export class KayleAnimator {
  constructor(model,clips){
    this.mixer=new THREE.AnimationMixer(model);this.clips=new Map(clips.map(c=>[c.name,c]));
    this.active=null;this.kind='base';this.special=null;this.pendingW=false;this.empoweredAttack=false;
  }
  play(name,{blend=.1,rate=1,loop=false,offset=0}={}){
    const clip=this.clips.get(name);if(!clip)return null;
    const next=this.mixer.clipAction(clip),previous=this.active;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(rate).setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);
    next.clampWhenFinished=!loop;next.time=Math.min(offset,clip.duration);
    if(previous&&previous!==next)next.crossFadeFrom(previous,blend,false);
    else next.fadeIn(blend);
    next.play();this.active=next;return clip;
  }
  attack(event,{time,attackSpeed,angle=0}){
    this.special=null;this.kind='attack';this.empoweredAttack=!!event.empowered;this.attackId=event.id;this.releasedAttack=false;
    const variant=(event.id-1)%2+1,fast=attackSpeed>=1.7;
    // Signed target bearing selects L/R; this selection is simulator policy,
    // anchored to the two original condition branches, not native runtime proof.
    const left=angle<0;
    const name=event.empowered?(event.ranged?(left?'kayle_spell3_l':'kayle_spell3'):'kayle_spell3melee'):
      event.ranged?`kayle_attackranged${fast?'fast':''}${variant}`:`kayle_attack${variant}${fast?'fast':''}`;
    this.runTransition=event.ranged&&!left?'kayle_spell3runtransition':'kayle_spell3runtransitionleft';
    const castFrame=event.empowered?(event.ranged?11:9.5):(event.ranged?8:9.5),rate=(castFrame/30)/event.windup;
    this.play(name,{blend:Math.min(event.empowered&&left?.1:.05,event.windup*.35),rate,offset:Math.max(0,time-event.startedAt)*rate});
  }
  release(id){if(id===this.attackId)this.releasedAttack=true;}
  cancel(id){if(id===this.attackId){this.kind='base';this.empoweredAttack=false;this.releasedAttack=false;}}
  boost({time,windup}){if(windup)this.pendingW=true;else this.startSpecial('w','kayle_spell2',time);}
  startSpecial(kind,name,time){const clip=this.play(name);if(!clip)return;this.special={kind,until:time+clip.duration};this.kind=kind;this.empoweredAttack=false;}
  update(dt,{time,moving=false,level=1,speed=335,windup=null,attackUntil=0}={}){
    if(this.pendingW&&!windup){this.pendingW=false;this.startSpecial('w','kayle_spell2',time);}
    if(this.special&&time>=this.special.until){
      const kind=this.special.kind;this.special=null;
      if(kind==='w'&&!moving)this.startSpecial('w-idle','kayle_spell2_transidle',time);
    }
    if(this.special&&((this.special.kind==='w-idle'&&moving)||(this.special.kind==='e-run'&&!moving)))this.special=null;
    if(!this.special&&this.kind==='attack'&&this.empoweredAttack&&this.releasedAttack&&moving&&!windup)this.startSpecial('e-run',this.runTransition,time);
    if(!this.special&&!(this.kind==='attack'&&time<attackUntil&&!moving)){
      const passive=level>=11,name=`kayle_${moving?'run':'idle'}${passive?'passive':'1'}`;
      if(this.active?.getClip().name!==name)this.play(name,{loop:true,blend:.12});
      this.active?.setEffectiveTimeScale(moving?speed/335:1);this.kind='base';this.empoweredAttack=false;
    }
    this.mixer.update(dt);
  }
  reset(){this.mixer.stopAllAction();this.active=null;this.kind='base';this.special=null;this.pendingW=false;this.empoweredAttack=false;}
  get diagnostics(){return {name:this.active?.getClip().name,time:this.active?.time,weight:this.active?.getEffectiveWeight(),kind:this.kind,pendingW:this.pendingW};}
}
