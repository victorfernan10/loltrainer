import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

// Exact initialSubmeshToHide from the base skin, plus animated trail meshes
// which are switched on only during the corresponding sword swing.
const PROPS=new Set(['Bow_Smear','Fish','Sushi','Instrument','Azakana']);
const SMEARS=new Set(['Katana_Smear','GhostKatana_Smear']);
const SCALE=.9300000071525574;

function sequence(first,second){
  if(!first||!second)return first;
  const tracks=first.tracks.map(track=>{
    const next=second.tracks.find(t=>t.name===track.name);if(!next)return track.clone();
    const times=[...track.times,...Array.from(next.times,t=>t+first.duration+.00001)];
    return new track.constructor(track.name,times,[...track.values,...next.values],track.getInterpolation());
  });
  return new THREE.AnimationClip('yone_q_sequence',first.duration+second.duration+.00001,tracks);
}

class YoneAnimator {
  constructor(model,clips){
    this.model=model;this.mixer=new THREE.AnimationMixer(model);this.active=null;this.key='';
    const idle=clips.find(c=>c.name==='yone_idle01');
    this.clips=new Map(clips.map(c=>{
      const names=new Set(c.tracks.map(t=>t.name));
      // E's body-only loop is intentionally partial; complete un-authored
      // joints from idle so it cannot expose bind pose after another action.
      return [c.name,new THREE.AnimationClip(c.name,c.duration,[...c.tracks,...idle.tracks.filter(t=>!names.has(t.name))])];
    }));
    const q=sequence(this.clips.get('yone_spell1_a_01'),this.clips.get('yone_spell1_a_02'));
    if(q)this.clips.set(q.name,q);
    this.play('yone_idle01',{loop:true,blend:0});this.mixer.update(0);
  }
  play(name,{loop=false,rate=1,blend=.09,offset=0}={}){
    const clip=this.clips.get(name)??this.clips.get('yone_idle01'),next=this.mixer.clipAction(clip),previous=this.active;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(rate).setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);next.clampWhenFinished=!loop;
    next.time=Math.max(0,Math.min(offset,clip.duration));
    if(previous&&previous!==next)next.crossFadeFrom(previous,blend,false);else if(blend>0)next.fadeIn(blend);
    next.play();this.active=next;return clip;
  }
  setPhase(enemy){
    const phase=enemy.phase??'idle',action=enemy.action??{},time=enemy.time??0;
    const key=`${phase}:${['idle','run','waiting'].includes(phase)?'':action.id??action.startedAt??0}`;
    if(key===this.key){if(phase==='run')this.active?.setEffectiveTimeScale(Math.max(.6,(enemy.currentMoveSpeed??enemy.moveSpeed??345)/345));return;}
    const last=this.phase;this.key=key;this.phase=phase;
    const start=phase==='q3-dash'?(action.releaseAt??action.startedAt??time):(action.startedAt??time);
    const prep=Math.max(.04,(action.releaseAt??start+.3)-(action.startedAt??start));
    const duration=Math.max(.04,(enemy.stateUntil??action.until??time+.3)-start);
    let name='yone_idle01',loop=false,rate=1,blend=.07,offset=Math.max(0,time-start);
    if(phase==='run'){name='yone_run01';loop=true;rate=Math.max(.6,(enemy.currentMoveSpeed??enemy.moveSpeed??345)/345);offset=0;blend=.1;}
    else if(phase==='idle'||phase==='waiting'){name='yone_idle01';loop=true;offset=0;blend=.12;}
    else if(phase==='attack'){const variant=((action.id??0)%4)+1;name=`yone_attack0${variant}`;rate=(8/30)/prep;}
    else if(phase==='q'){name='yone_q_sequence';rate=(7/30)/prep;}
    else if(phase==='q3-windup'){name='yone_spell1c_in';rate=.4/prep;}
    else if(phase==='q3-dash'){name='yone_spell1c_dash';rate=this.clips.get(name).duration/duration;blend=.04;}
    else if(phase==='w'){name='yone_spell2';rate=.5/prep;}
    else if(phase==='e-out'){name='yone_spell3_spiritin';rate=this.clips.get(name).duration/duration;}
    else if(phase==='e-return'){name='yone_spell3_out';rate=this.clips.get(name).duration/duration;}
    else if(phase==='r'){name='yone_spell4_in';rate=this.clips.get(name).duration/prep;blend=.025;}
    else if(phase==='r-impact'){name='yone_spell4_out_notmoving';offset=Math.max(0,time-action.releaseAt);}
    else if(phase==='death'){name='yone_death01';}
    // A brief original recovery is used at the end of W/Q3/E instead of
    // holding their final pose. New actions/movement override it immediately.
    if(phase==='idle'&&last&& !['idle','run','waiting'].includes(last)){
      const recovery=({w:'yone_spell2_toidle','q3-dash':'yone_spell1c_toidle','e-return':'yone_spell3_out_toidle',r:'yone_spell4_out_notmoving','r-impact':'yone_spell4_towalk',q:'yone_spell1a_towalk01'})[last];
      if(recovery){name=recovery;loop=false;this.recoveryUntil=time+.28;}
    }else this.recoveryUntil=null;
    this.play(name,{loop,rate,blend,offset:offset*rate});
  }
  update(dt,enemy){
    this.setPhase(enemy);
    if(this.recoveryUntil!=null&&enemy.time>=this.recoveryUntil){this.recoveryUntil=null;this.play('yone_idle01',{loop:true,blend:.12});}
    this.mixer.update(dt);
  }
  reset(){this.mixer.stopAllAction();this.key='';this.phase=null;this.recoveryUntil=null;this.active=null;this.play('yone_idle01',{loop:true,blend:0});this.mixer.update(0);}
}

export class YoneView {
  constructor(scene){
    this.scene=scene;this.enemy=null;this.ready=false;this.group=new THREE.Group();this.group.visible=false;this.group.userData.combatTargetId='yone';scene.add(this.group);
    this.bodyGroup=new THREE.Group();this.bodyGroup.visible=false;scene.add(this.bodyGroup);
    this.label=document.createElement('div');this.label.className='combat-target-label';this.label.hidden=true;
    this.label.innerHTML='<span>Yone</span><div class="target-health"><i></i></div><small></small>';document.body.append(this.label);
    this.loadPromise=this.loadAssets().catch(error=>{this.error=error;console.error('Falha no modelo completo do Yone',error);throw error;});
  }
  load(){return this.loadPromise;}
  async loadAssets(){
    const loader=new THREE.TextureLoader();
    const [gltf,body,swords,red,white]=await Promise.all([new GLTFLoader().loadAsync('/assets/yone/yone-combat.glb'),...['yone_base_tx_cm','yone_base_swords_tx_cm','streak_red_tx_cm','streak_white_tx_cm'].map(name=>loader.loadAsync(`/assets/yone/${name}.png`))]);
    for(const texture of [body,swords,red,white]){texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;}
    const build=(ghost=false)=>{
      const model=clone(gltf.scene),remove=[],materials=[],smears=[];
      model.traverse(object=>{
        if(!object.isMesh)return;
        const name=object.material.name;
        if(PROPS.has(name)){remove.push(object);return;}
        object.frustumCulled=false;object.castShadow=!ghost;
        const isSmear=SMEARS.has(name),map=name==='GhostKatana_Smear'?red:name==='Katana_Smear'?white:['GhostKatana','Katana','Sheath'].includes(name)?swords:body;
        object.material=isSmear?new THREE.MeshBasicMaterial({name,map,transparent:true,opacity:ghost?.2:.65,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}):new THREE.MeshStandardMaterial({name,map,roughness:.86,metalness:0,side:THREE.DoubleSide,transparent:ghost,opacity:ghost?.46:1,depthWrite:!ghost});
        if(ghost)object.material.color.set('#a1a9b8');
        if(name==='Skirt_Inner')object.material.color.multiplyScalar(.72);
        materials.push(object.material);
        if(isSmear){object.visible=false;smears.push(object);}
      });
      for(const prop of remove)prop.removeFromParent();
      model.scale.setScalar(SCALE);
      return {model,materials,smears,animator:new YoneAnimator(model,gltf.animations)};
    };
    const actor=build(),bodyActor=build(true);
    Object.assign(this,actor);this.bodyActor=bodyActor;this.group.add(actor.model);this.bodyGroup.add(bodyActor.model);this.clips=gltf.animations;
    this.ready=true;return this;
  }
  bind(enemy){
    this.enemy=enemy;this.group.visible=false;this.bodyGroup.visible=false;this.label.hidden=true;this.anchorKey=null;
    this.animator?.reset();this.bodyActor?.animator.reset();
  }
  update(dt,playerPosition,camera){
    if(!this.ready||!this.enemy)return;
    const e=this.enemy,visible=e.phase!=='waiting'&&e.active!==false&&(e.target?.alive!==false||e.phase==='death');
    this.group.visible=visible;this.label.hidden=!visible;
    this.group.position.set(e.position.x,0,e.position.z);this.group.rotation.y=Number.isFinite(e.facing)?e.facing:Math.atan2(playerPosition.x-e.position.x,playerPosition.z-e.position.z);
    this.animator.update(dt,e);
    const spirit=!!e.spirit;
    for(const material of this.materials)if(material.emissive){material.emissive.set(spirit?'#641e2a':'#000000');material.emissiveIntensity=spirit?.24:0;}
    const action=e.action??{},release=action.releaseAt??0,age=(e.time??0)-release;
    for(const mesh of this.smears)mesh.visible=visible&&['attack','q','q3-dash','w'].includes(e.phase)&&age>=-.08&&age<.12;
    const anchor=e.anchor;
    this.bodyGroup.visible=visible&&!!anchor&&(spirit||e.phase==='e-return'||e.phase==='e-out');
    if(this.bodyGroup.visible){
      const key=`${anchor.x}:${anchor.z}`;
      if(this.anchorKey!==key){this.anchorKey=key;this.anchorStarted=e.time;this.bodyGroup.rotation.y=this.group.rotation.y;this.bodyActor.animator.reset();this.bodyActor.animator.play('yone_spell3_bodyin',{blend:.05});}
      this.bodyGroup.position.set(anchor.x,0,anchor.z);
      const animator=this.bodyActor.animator;
      if(e.time-this.anchorStarted>=.733&&animator.active.getClip().name!=='yone_spell3_bodyloop')animator.play('yone_spell3_bodyloop',{loop:true,blend:.12});
      animator.mixer.update(dt);
    }else this.anchorKey=null;
    if(visible&&camera){
      const screen=new THREE.Vector3(e.position.x,235,e.position.z).project(camera);
      this.label.style.left=(screen.x+1)*innerWidth/2+'px';this.label.style.top=(1-screen.y)*innerHeight/2+'px';
      const target=e.target,health=target?.health??1000,max=target?.maxHealth??1000;
      this.label.querySelector('i').style.width=100*health/max+'%';
      this.label.querySelector('span').textContent=`Yone${spirit?' · E ativo':''}`;
      this.label.querySelector('small').textContent=`${Math.ceil(health)} / ${max}`;
    }
  }
  pick(raycaster){return this.ready&&this.group.visible&&this.enemy?.target?.alive!==false&&raycaster.intersectObject(this.group,true).some(hit=>hit.object.visible)?'yone':null;}
  get diagnostics(){return {ready:this.ready,phase:this.enemy?.phase,clip:this.animator?.active?.getClip().name,time:this.animator?.active?.time,rate:this.animator?.active?.getEffectiveTimeScale(),weight:this.animator?.active?.getEffectiveWeight(),clips:this.clips?.length,scale:SCALE,ghostVisible:this.bodyGroup.visible,ghostClip:this.bodyActor?.animator.active?.getClip().name,meshes:this.model?this.meshDiagnostics():[]};}
  meshDiagnostics(){const meshes=[];this.model.traverse(o=>{if(o.isMesh)meshes.push({name:o.material.name,visible:o.visible});});return meshes;}
}
