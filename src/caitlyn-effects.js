import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

// Native Q/net/trap rigs and original texture pixels. Particle scheduling and
// material composition are reconstructed locally, independent of collision.
export class CaitlynEffects {
  constructor(scene){this.scene=scene;this.objects=new Map();this.bursts=[];this.sources={};this.textures={};this.ready=false;}
  async load(){
    if(this.ready)return;if(this.loading)return this.loading;
    this.loading=(async()=>{
      const textureNames=['caitlyn_base_q_tx_cm','caitlyn_base_entrapment_mis_net','caitlyntrap_base_tx_cm','caitlyn_base_ult_mis_mult','caitlyn_r_snipersight','caitlyn_lasersight_beam','radial_headshot','bolts_headshot','caitlyn_base_mis_add','caitlyn_base_r_hit_flash','caitlyn_base_w_indicator_ring'];
      await Promise.all(textureNames.map(async name=>{const map=await new THREE.TextureLoader().loadAsync(`/assets/caitlyn/${name}.png`);map.colorSpace=THREE.SRGBColorSpace;this.textures[name]=map;}));
      await Promise.all([['Q','q-missile','caitlyn_base_q_tx_cm'],['E','e-net','caitlyn_base_entrapment_mis_net'],['W','trap','caitlyntrap_base_tx_cm']].map(async([key,file,texture])=>{
        const gltf=await new GLTFLoader().loadAsync(`/assets/caitlyn/${file}.glb`),map=this.textures[texture];map.flipY=false;
        gltf.scene.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;o.material=new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide,transparent:key!=='W',alphaTest:.02,depthWrite:key==='W',blending:key==='Q'?THREE.AdditiveBlending:THREE.NormalBlending});});this.sources[key]=gltf;
      }));this.ready=true;
    })().catch(e=>{this.loading=null;throw e;});return this.loading;
  }
  dispose(visual){this.scene.remove(visual.object);if(visual.native){visual.mixer.stopAllAction();visual.mixer.uncacheRoot(visual.object);}else visual.object.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
  clear(){for(const v of this.objects.values())this.dispose(v);this.objects.clear();for(const b of this.bursts)this.dispose(b);this.bursts=[];}
  native(key){const source=this.sources[key],object=clone(source.scene),mixer=new THREE.AnimationMixer(object);if(key==='W')object.scale.setScalar(2);return {object,mixer,native:true,source};}
  play(v,name,loop=true,rate=1){if(v.clip===name)return;const clip=v.source.animations.find(a=>a.name===name)??v.source.animations[0];if(!clip)return;v.mixer.stopAllAction();const action=v.mixer.clipAction(clip);action.reset().setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);action.clampWhenFinished=true;action.setEffectiveTimeScale(rate).play();v.clip=name;}
  plane(texture,width,height,opacity=1){const object=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:this.textures[texture],transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));object.rotation.x=-Math.PI/2;return {object};}
  events(events){
    if(!this.ready)return;
    for(const e of events){if(e.type!=='spell-impact'&&!(e.type==='hit'&&e.isBasicAttack))continue;
      const point=e.position??this.combat?.target(e.targetId)?.position;if(!point)continue;
      const v=this.plane(e.key==='R'?'caitlyn_base_r_hit_flash':'radial_headshot',e.key==='R'?170:80,e.key==='R'?170:80,.8);v.object.position.set(point.x,70,point.z);this.scene.add(v.object);this.bursts.push({...v,age:0,duration:.25});
    }
  }
  update(dt,combat,position){
    this.combat=combat;if(!this.ready)return;const seen=new Set(),use=(id,create)=>{seen.add(id);if(!this.objects.has(id)){const v=create();this.objects.set(id,v);this.scene.add(v.object);}return this.objects.get(id);};
    for(const trap of combat.traps){
      const v=use(`trap-${trap.id}`,()=>this.native('W'));v.object.position.set(trap.position.x,0,trap.position.z);
      this.play(v,trap.triggeredAt!=null?'attack1':combat.time<trap.armedAt?'set':'idle',trap.triggeredAt==null&&combat.time>=trap.armedAt,combat.time<trap.armedAt?1/.9:1);v.mixer.update(dt);
    }
    for(const missile of combat.skillProjectiles){
      const v=use(`spell-${missile.id}`,()=>missile.key==='R'?this.plane('caitlyn_base_ult_mis_mult',140,55):this.native(missile.key));
      v.object.position.set(missile.position.x,missile.key==='E'?40:100,missile.position.z);const yaw=Math.atan2(missile.direction.x,missile.direction.z);
      if(v.native){v.object.rotation.y=yaw;const clip=missile.key==='Q'?(missile.hitIds.size?'caitlyn_base_q_2_anim':'caitlyn_base_q_1_loop'):'caitlyn_base_entrapment_mis_net';this.play(v,clip,true);v.mixer.update(dt);}else v.object.rotation.set(-Math.PI/2,0,Math.PI/2-yaw);
    }
    for(const bolt of combat.bolts){const victim=combat.target(bolt.targetId);if(!victim)continue;const headshot=bolt.metadata?.headshot,v=use(`aa-${bolt.id}`,()=>this.plane(headshot?'bolts_headshot':'caitlyn_base_mis_add',headshot?130:90,headshot?48:26));const t=1-Math.max(0,bolt.remaining)/Math.max(.001,bolt.duration),end=victim.position;
      v.object.position.set(THREE.MathUtils.lerp(bolt.origin.x,end.x,t),105,THREE.MathUtils.lerp(bolt.origin.z,end.z,t));v.object.rotation.set(-Math.PI/2,0,Math.atan2(-(end.z-bolt.origin.z),end.x-bolt.origin.x));}
    for(const target of combat.targets){if(!target.alive||!combat.markedSource(target))continue;const v=use(`mark-${target.id}`,()=>this.plane('radial_headshot',170,170,.7));v.object.position.set(target.position.x,6,target.position.z);v.object.rotation.z+=dt*.6;}
    if(combat.channel){const target=combat.target(combat.channel.targetId);if(target){const p=target.position,length=Math.hypot(p.x-position.x,p.z-position.z),v=use('r-laser',()=>this.plane('caitlyn_lasersight_beam',1,14,.55));v.object.scale.x=length;v.object.position.set((p.x+position.x)/2,95,(p.z+position.z)/2);v.object.rotation.set(-Math.PI/2,0,Math.atan2(-(p.z-position.z),p.x-position.x));const ring=use('r-target',()=>this.plane('caitlyn_r_snipersight',190,190,.85));ring.object.position.set(p.x,8,p.z);}}
    for(const [id,v] of this.objects)if(!seen.has(id)){this.dispose(v);this.objects.delete(id);}
    for(let i=this.bursts.length-1;i>=0;i--){const b=this.bursts[i];b.age+=dt;b.object.material.opacity=Math.max(0,.8*(1-b.age/b.duration));if(b.age>=b.duration){this.dispose(b);this.bursts.splice(i,1);}}
  }
}
