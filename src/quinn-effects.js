import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

// Native Valor Q model/flight. Marks, vision pulse and Skystrike are readable
// reconstructions; the original particle runtime is not part of this engine.
export class QuinnEffects {
  constructor(scene){this.scene=scene;this.objects=new Map();this.pulses=[];}
  async load(){
    if(this.source)return;if(this.loading)return this.loading;
    this.loading=(async()=>{
      const [gltf,map]=await Promise.all([new GLTFLoader().loadAsync('/assets/quinn/valor-q.glb'),new THREE.TextureLoader().loadAsync('/assets/quinn/quinn_base_q_mis_valor.png')]);
      map.flipY=false;map.colorSpace=THREE.SRGBColorSpace;
      gltf.scene.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.material.map=map;o.material.side=THREE.DoubleSide;o.material.alphaTest=.04;}});this.source=gltf;
    })().catch(e=>{this.loading=null;throw e;});return this.loading;
  }
  dispose(v){this.scene.remove(v.object);if(!v.native)v.object.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
  clear(){for(const v of this.objects.values())this.dispose(v);this.objects.clear();for(const p of this.pulses)this.dispose(p);this.pulses=[];}
  events(events){for(const e of events){
    const vision=e.type==='spell'&&e.ability==='W';if(!vision&&e.type!=='spell-impact'&&e.type!=='harrier')continue;
    const position=e.position??e.origin;if(!position)continue;
    const geometry=new THREE.RingGeometry(.95,1,64),material=new THREE.MeshBasicMaterial({color:vision?'#7acdf2':'#f5d274',transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false});
    const object=new THREE.Mesh(geometry,material);object.rotation.x=-Math.PI/2;object.position.set(position.x,6,position.z);this.scene.add(object);
    this.pulses.push({object,time:0,duration:vision?1.3:.4,radius:vision?2100:e.radius??80});
  }}
  update(dt,combat){
    const ids=new Set();
    for(const p of combat.skillProjectiles){
      const id=`q-${p.id}`;ids.add(id);let v=this.objects.get(id);
      if(!v&&this.source){const object=clone(this.source.scene),mixer=new THREE.AnimationMixer(object);const clip=this.source.animations[0];if(clip)mixer.clipAction(clip).play();v={object,mixer,native:true};this.objects.set(id,v);this.scene.add(object);}
      if(v){v.object.position.set(p.position.x,100,p.position.z);v.object.rotation.y=Math.atan2(p.direction.x,p.direction.z);v.mixer.update(dt);}
    }
    for(const target of combat.targets){
      if(!target.alive||!(target.quinnMarkUntil>combat.time))continue;
      const id=`harrier-${target.id}`;ids.add(id);let v=this.objects.get(id);
      if(!v){const object=new THREE.Mesh(new THREE.OctahedronGeometry(15),new THREE.MeshBasicMaterial({color:'#ffdd79',transparent:true,opacity:.9}));v={object};this.objects.set(id,v);this.scene.add(object);}
      v.object.position.set(target.position.x,270,target.position.z);v.object.rotation.y=combat.time*1.5;
    }
    for(const [id,v] of this.objects)if(!ids.has(id)){this.dispose(v);this.objects.delete(id);}
    for(let i=this.pulses.length-1;i>=0;i--){const p=this.pulses[i];p.time+=dt;const t=p.time/p.duration;p.object.scale.setScalar(Math.max(1,p.radius*Math.min(1,t)));p.object.material.opacity=Math.max(0,(1-t)*.6);if(t>=1){this.dispose(p);this.pulses.splice(i,1);}}
  }
}
