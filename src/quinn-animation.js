import * as THREE from 'three';
import {KayleAnimator} from './kayle-animation.js';

// Original mappings: tools/quinn-original/animation-map.json. Gameplay controls
// all release/contact times; original pose curves are never used as collision.
export class QuinnAnimator extends KayleAnimator {
  constructor(model,clips){
    const idle=clips.find(c=>c.name==='quinn_idle1');
    super(model,clips.map(c=>{
      const names=new Set(c.tracks.map(t=>t.name));
      return new THREE.AnimationClip(c.name,c.duration,[...c.tracks,...(idle?.tracks??[]).filter(t=>!names.has(t.name))]);
    }));
    this.model=model;this.spell=null;this.preview=null;this.valor=null;
    this.play('quinn_idle1',{loop:true,blend:0});this.mixer.update(0);
  }
  attachValor(model,clips){
    if(this.valor)this.model.remove(this.valor.model);
    model.scale.setScalar(2.5/this.model.scale.x);model.visible=false;this.model.add(model);
    const idle=clips.find(c=>c.name==='quinnvalor_idle1');
    const complete=clips.map(c=>{const names=new Set(c.tracks.map(t=>t.name));return new THREE.AnimationClip(c.name,c.duration,[...c.tracks,...(idle?.tracks??[]).filter(t=>!names.has(t.name))]);});
    this.valor={model,animator:new KayleAnimator(model,complete)};
    this.valor.animator.play('quinnvalor_idle1',{loop:true,blend:0});this.valor.animator.mixer.update(0);
  }
  attack(event,{time}){
    this.preview=null;this.spell=null;this.kind='attack';this.attackId=event.id;this.releasedAttack=false;
    const name=(event.empowered||event.harrier)?'quinn_attack1_p':`quinn_attack${(event.id-1)%3+1}`;
    // QuinnBasicAttack authors its release at frame5.2 (30fps).
    const rate=(5.2/30)/Math.max(.01,event.windup);
    this.play(name,{blend:Math.min(.045,event.windup*.3),rate,offset:Math.max(0,time-event.startedAt)*rate});
  }
  boost(){}
  cast(event,time){
    const ability=event.ability??event.key,phase=event.phase;
    this.preview=null;this.kind='spell';
    if(ability==='R'&&phase==='transform'){
      const clip=this.play('quinn_spell4_runin',{blend:.07});
      this.spell={ability,phase,until:time+clip.duration,startedAt:time};return true;
    }
    const name=ability==='E'?(phase==='rebound'?'quinn_spell3_flip':'quinn_spell3_dash'):
      ability==='R'?(phase==='channel'?'quinn_spell4_leadin':'quinn_spell4'):
      ability==='Q'?'quinn_spell1':ability==='W'?'quinn_attack1':null;
    if(!name)return false;
    const source=this.clips.get(name);if(!source)return false;
    let duration=event.duration??source.duration,rate=1,until=time+source.duration,follow=null,transitionAt=Infinity;
    if(ability==='E'){duration=Math.max(.04,duration);rate=source.duration/duration;until=time+duration;}
    if(ability==='W'){until=time+.22;rate=1.5;}
    if(ability==='Q')until=time+Math.max(.25,Math.min(.6,source.duration));
    if(ability==='R'&&phase==='channel'){until=time+Math.max(.4,duration);follow='quinn_spell4_channel';transitionAt=time+source.duration;}
    if(ability==='R'&&phase==='skystrike'){duration=Math.max(.3,duration);rate=source.duration/duration;until=time+duration;}
    this.play(name,{blend:ability==='E'?.035:.055,rate});
    this.spell={ability,phase,until,startedAt:time,follow,transitionAt};return true;
  }
  cancelSpell(){this.spell=null;this.kind='base';}
  previewClip(name,time){
    const clip=this.play(name,{blend:.08});if(!clip)return false;
    this.spell=null;this.preview={name,until:time+clip.duration,startedAt:time};this.kind='preview';return true;
  }
  cancelPreview(){this.preview=null;this.kind='base';}
  updateValor(dt,{valor,moving,time}){
    if(!this.valor)return;
    const {model,animator}=this.valor;
    const r=this.spell?.ability==='R'?this.spell:null;
    const previewR=this.preview?.name.startsWith('quinn_spell4');
    model.visible=!!(valor||r?.phase==='channel'||r?.phase==='transform'||previewR);
    if(!model.visible)return;
    let name='quinnvalor_idle1',loop=true;
    if(r?.phase==='channel'){name='quinnvalor_spell4_in';loop=false;}
    else if(r?.phase==='transform'){name='quinnvalor_run_in';loop=false;}
    else if(moving)name='quinnvalor_run_flap';
    if(previewR){name=({quinn_spell4_flap:'quinnvalor_run_flap',quinn_spell4_glide:'quinnvalor_run_glide',quinn_spell4_runin:'quinnvalor_run_in',quinn_spell4_idlein:'quinnvalor_idle1_in',quinn_spell4_channel:'quinnvalor_spell4_in'})[this.preview.name]??'quinnvalor_idle1';}
    if(animator.active?.getClip().name!==name)animator.play(name,{loop,blend:.07,offset:r?.phase==='channel'?Math.max(0,time-r.startedAt):0});
    animator.mixer.update(dt);
  }
  update(dt,{time=0,moving=false,speed=330,attackUntil=0,valor=false,dashPhase=null}={}){
    if(dt<=0)return;
    if(this.preview&&(time>=this.preview.until||moving))this.cancelPreview();
    if(this.spell?.follow&&time>=this.spell.transitionAt){this.play(this.spell.follow,{loop:true,blend:.06,offset:Math.max(0,time-this.spell.transitionAt)});this.spell.follow=null;}
    if(this.spell&&time>=this.spell.until&&!(this.spell.ability==='E'&&dashPhase))this.cancelSpell();
    if(!this.preview&&!this.spell&&!(this.kind==='attack'&&time<attackUntil&&!moving)){
      const name=valor?(moving?'quinn_spell4_flap':'quinn_spell4_idle'):(moving?'quinn_run':'quinn_idle1');
      if(this.active?.getClip().name!==name)this.play(name,{loop:true,blend:valor?.12:.085});
      this.active?.setEffectiveTimeScale(moving&&!valor?speed/330:1);this.kind='base';
    }
    this.mixer.update(dt);this.updateValor(dt,{valor,moving,time});
  }
  reset(){
    super.reset();this.spell=null;this.preview=null;
    if(this.valor){this.valor.animator.reset();this.valor.model.visible=false;}
    this.play('quinn_idle1',{loop:true,blend:0});this.mixer.update(0);
  }
  get diagnostics(){return {...super.diagnostics,preview:this.preview?.name??null,spell:this.spell?.ability??null,phase:this.spell?.phase??null,valorVisible:this.valor?.model.visible??false,valorClip:this.valor?.animator.active?.getClip().name??null};}
}
