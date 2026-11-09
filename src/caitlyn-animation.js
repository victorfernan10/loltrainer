import * as THREE from 'three';
import {KayleAnimator} from './kayle-animation.js';

// Authored clip bindings and muzzle events: installed Caitlyn Skin0 animation graph.
export const caitlynClipLabels={
  idle1:'Repouso',idle2:'Repouso alternativo',idle3:'Repouso alternativo',idle_in:'Entrada em repouso',
  run:'Corrida',run_fast:'Corrida rápida',run_fast_variant:'Corrida rápida alternativa',run_haste:'Corrida acelerada',run_in:'Entrada na corrida',run_variant:'Corrida alternativa',run_variant2:'Corrida alternativa 2',
  attack1:'Ataque 1',attack2:'Ataque 2',crit:'Crítico',passive:'Headshot',attack1_to_idle:'Ataque 1 → repouso',attack2_to_idle:'Ataque 2 → repouso',attack_to_run:'Ataque → corrida',passive_to_idle:'Headshot → repouso',
  spell1:'Q · Pacificadora de Piltover',spell1_to_idle:'Q → repouso',spell1_to_run:'Q → corrida',spell2:'W · Armadilha Mecânica Yordle',spell2_to_idle:'W → repouso',spell2_to_run:'W → corrida',spell3:'E · Rede Calibre 90',spell3_toidle:'E → corrida',spell3_to_idle:'E → repouso',
  spell4:'R · Ás na Manga', 'spell4_-90':'R · mira à esquerda',spell4_90:'R · mira à direita',spell4_to_idle:'R → repouso',spell4_to_run:'R → corrida',channel:'Canalização',channelin:'Início da canalização',dance_in:'Início da dança',dance_loop:'Dança',death:'Morte',joke:'Piada',knockup_loop:'No ar',knockup_start:'Arremessada',laugh:'Risada',recall:'Retorno à base',spawn:'Renascimento',stunned:'Atordoamento',taunt:'Provocação',
};
const recoveries={Q:['spell1_to_idle','spell1_to_run'],W:['spell2_to_idle','spell2_to_run'],E:['spell3_to_idle','spell3_toidle'],R:['spell4_to_idle','spell4_to_run']};
export class CaitlynAnimator extends KayleAnimator {
  constructor(model,clips){
    const idle=clips.find(c=>c.name==='idle1'),run=clips.find(c=>c.name==='run');
    super(model,clips.map(c=>{const authored=new Set(c.tracks.map(t=>t.name));return new THREE.AnimationClip(c.name,c.duration,[...c.tracks,...((c.name==='spell3_toidle'?run:idle)?.tracks??[]).filter(t=>!authored.has(t.name))]);}));
    this.model=model;this.alternates=new Map();this.preview=null;this.spell=null;this.recovery=null;this.hold=null;
    this.props=[];model.traverse(o=>{if(o.isMesh&&['Flag','Teacup'].includes(o.material.name)){this.props.push(o);o.visible=false;}});
    this.rifle=model.getObjectByName('Rifle_Root');this.rifleSnap=model.getObjectByName('Rifle_World_Snap');this.snapMatrix=new THREE.Matrix4();
  }
  play(name,{blend=.06,rate=1,loop=false,offset=0}={}){
    const source=this.clips.get(name);if(!source)return null;
    const previous=this.active;let clip=source;
    if(previous?.getClip()===source){if(!this.alternates.has(name))this.alternates.set(name,source.clone());clip=this.alternates.get(name);}
    const next=this.mixer.clipAction(clip);next.reset().setEffectiveWeight(1).setEffectiveTimeScale(rate).setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);next.clampWhenFinished=!loop;next.time=Math.min(offset,clip.duration);
    if(previous&&previous!==next)next.crossFadeFrom(previous,blend,false);next.play();this.active=next;return source;
  }
  attack(event,{time=0}={}){
    this.preview=null;this.spell=null;this.recovery=null;this.hold=null;this.kind='attack';this.attackId=event.id;this.releasedAttack=false;
    const variant=(event.id-1)%2+1,headshot=!!event.headshot,name=headshot?'passive':event.critical?'crit':`attack${variant}`;
    // Graph muzzle frames differ between the two authored basic shots.
    const frame=headshot?10:event.critical?8:variant===1?7:9,clip=this.clips.get(name),release=Math.min(frame/30,clip.duration),rate=release/Math.max(.01,event.windup);
    this.attackRecovery=headshot?'passive_to_idle':`attack${variant}_to_idle`;this.attackEnd=time+clip.duration/rate;
    this.play(name,{blend:Math.min(.045,event.windup*.3),rate,offset:Math.max(0,time-event.startedAt)*rate});
  }
  boost(){}
  cancel(id){if(id===this.attackId){super.cancel(id);this.recovery=null;}}
  cancelSpell(){this.spell=null;this.hold=null;this.recovery=null;this.kind='base';}
  cast(event,time){
    const key=event.ability??event.key,phase=event.phase;this.preview=null;this.recovery=null;
    if(key==='E'&&phase==='dash'&&this.spell?.ability==='E'&&this.spell.id===event.id){this.spell.lockUntil=time+(event.duration??.4);this.spell.until=Math.max(this.spell.until,this.spell.lockUntil);return true;}
    if(phase==='cancel'){this.cancelSpell();return true;}
    if(key==='R'&&phase==='fire'){
      if(this.spell?.ability==='R'){this.hold=null;this.spell.lockUntil=time+.15;this.spell.until=Math.max(time+.35,this.spell.until===Infinity?0:this.spell.until);return true;}
    }
    if(key==='R'&&phase==='end'){
      this.hold=null;if(this.spell?.ability==='R'&&this.spell.until!==Infinity)return true;
      this.spell=null;this.recover('R',false,time);return true;
    }
    const name=({Q:'spell1',W:'spell2',E:'spell3',R:'spell4'})[key];if(!name)return false;
    const source=this.clips.get(name),duration=Math.max(.05,event.duration??({Q:.625,W:.25,E:.4,R:1})[key]);
    // Spell windups scale to mechanical locks; R keeps the authored pose throughout
    // its channel and does not restart when its projectile becomes committed.
    const rate=key==='Q'?source.duration/duration:key==='W'?Math.min(2,source.duration/duration):1;
    this.play(name,{blend:.045,rate});this.hold=key==='R'&&phase==='channel'?'R':null;
    this.kind='spell';this.spell={id:event.id,ability:key,phase,lockUntil:time+duration,until:this.hold?Infinity:time+source.duration/rate};return true;
  }
  recover(key,moving,time){
    const name=key==='attack'?(moving?'attack_to_run':this.attackRecovery):recoveries[key]?.[moving?1:0];
    if(!name)return;const clip=this.play(name,{blend:.045});if(!clip)return;
    this.recovery={name,moving,until:time+clip.duration};this.kind='recovery';
  }
  previewClip(name,time){const clip=this.play(name,{blend:.08});if(!clip)return false;this.cancelSpell();this.preview={name,until:time+clip.duration};this.kind='preview';return true;}
  cancelPreview(){this.preview=null;this.kind='base';}
  applyAuthoredEvents(){
    const name=this.active?.getClip().name,t=this.active?.time??0,frame=t*30;
    for(const o of this.props)o.visible=o.material.name==='Flag'?name==='joke'&&frame>=21&&frame<=145:(name==='laugh'&&frame>=4&&frame<=138)||(name==='recall'&&frame>=122);
    // Resource event snaps the gun to an authored world-space marker; this keeps
    // R/idle/emote rifles attached to their intended hand/ground pose.
    const snap=name==='spell4'||name==='idle2'&&frame>=5&&frame<=162||name==='death'&&frame>=51||name==='recall'&&frame>=130||name==='taunt'&&frame>=61&&frame<77;
    if(snap&&this.rifle&&this.rifleSnap&&this.rifle.parent){
      this.model.updateMatrixWorld(true);this.snapMatrix.copy(this.rifle.parent.matrixWorld).invert().multiply(this.rifleSnap.matrixWorld);this.snapMatrix.decompose(this.rifle.position,this.rifle.quaternion,this.rifle.scale);this.rifle.updateMatrixWorld(true);
    }
  }
  update(dt,{time=0,moving=false,speed=325,attackUntil=0,windup=null,channel}={}){
    if(this.preview&&(time>=this.preview.until||moving))this.cancelPreview();
    if(this.hold==='R'&&channel!==undefined&&!channel){this.hold=null;if(this.spell?.until===Infinity)this.spell.until=time+.25;}
    if(this.spell&&!this.hold&&(time>=this.spell.until||moving&&time>=this.spell.lockUntil)){const key=this.spell.ability;this.spell=null;this.recover(key,moving,time);}
    if(this.kind==='attack'&&((moving&&!windup)||(this.releasedAttack&&time>=this.attackEnd)||time>=attackUntil)){this.recover('attack',moving,time);}
    if(this.recovery&&(moving!==this.recovery.moving||time>=this.recovery.until)){this.recovery=null;this.kind='base';}
    if(!this.preview&&!this.spell&&!this.recovery&&!(this.kind==='attack'&&time<attackUntil&&!moving)){
      const name=moving?'run':'idle1';if(this.active?.getClip().name!==name)this.play(name,{loop:true,blend:.055});this.active?.setEffectiveTimeScale(moving?speed/325:1);this.kind='base';
    }
    this.mixer.update(dt);this.applyAuthoredEvents();
  }
  reset(){super.reset();this.preview=null;this.spell=null;this.recovery=null;this.hold=null;for(const o of this.props??[])o.visible=false;}
  get diagnostics(){return {...super.diagnostics,preview:this.preview?.name??null,spell:this.spell?.ability??null,phase:this.spell?.phase??null,hold:this.hold,recovery:this.recovery?.name??null};}
}
