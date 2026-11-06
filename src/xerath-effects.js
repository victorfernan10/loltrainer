import * as THREE from 'three';
import {assetUrl} from './asset-url.js';

// Original Riot textures/particle meshes, composed locally. This renderer does
// not execute the game's particle graph; simulation owns all hit timings.
export class XerathEffects {
  constructor(scene){this.scene=scene;this.root=new THREE.Group();scene.add(this.root);this.textures={};this.meshes={};this.live=new Map();this.bursts=[];this.ready=false;}
  async load(){
    if(this.ready)return;if(this.loading)return this.loading;
    this.loading=(async()=>{
      const names=['xerath_base_q_beam','xerath_base_q_beamenergy','xerath_base_w_targetring','xerath_base_w_skybeam','xerath_base_w_scorch','xerath_base_r_aoering_tx','xerath_base_z_nova','xerath_base_z_warpedsphere_tx','common_zapball2','common_lightning02','common_flare-blue'];
      await Promise.all(names.map(async name=>{const t=await new THREE.TextureLoader().loadAsync(`/assets/xerath/${name}.png`);t.colorSpace=THREE.SRGBColorSpace;this.textures[name]=t;}));
      await Promise.all(['r-ring','impact-ring','warped-sphere'].map(async name=>{const response=await fetch(assetUrl(`/assets/xerath/${name}.json`));if(!response.ok)throw new Error(`Xerath particle ${name}: ${response.status}`);const data=await response.json(),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));g.computeVertexNormals();this.meshes[name]=g;}));this.ready=true;
    })().catch(e=>{this.loading=null;throw e;});return this.loading;
  }
  material(name,opacity=1){return new THREE.MeshBasicMaterial({map:this.textures[name],color:0xffffff,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});}
  plane(name,width,height,opacity=1){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),this.material(name,opacity));mesh.rotation.x=-Math.PI/2;return mesh;}
  ring(point,radius,key='W'){
    const group=new THREE.Group(),mesh=key==='R'?new THREE.Mesh(this.meshes['r-ring'],this.material('xerath_base_r_aoering_tx',.7)):this.plane('xerath_base_w_targetring',radius*2,radius*2,.7);
    if(key==='R'){mesh.scale.setScalar(radius/1019);mesh.position.y=-26.4*radius/1019;mesh.userData.sharedGeometry=true;}
    group.add(mesh);group.position.set(point.x,4,point.z);return group;
  }
  beam(origin,end,width,opacity=1){
    const group=new THREE.Group(),length=Math.hypot(end.x-origin.x,end.z-origin.z);
    for(const [name,scale,alpha] of [['xerath_base_q_beam',1.5,.7],['xerath_base_q_beamenergy',.6,1]]){const mesh=this.plane(name,length,width*scale,alpha*opacity);mesh.position.y=group.children.length*2;group.add(mesh);}
    group.position.set((origin.x+end.x)/2,45,(origin.z+end.z)/2);group.rotation.y=Math.atan2(-(end.z-origin.z),end.x-origin.x);return group;
  }
  orb(){const group=new THREE.Group(),sphere=new THREE.Mesh(this.meshes['warped-sphere'],this.material('xerath_base_z_warpedsphere_tx',.8));sphere.scale.setScalar(32);sphere.userData.sharedGeometry=true;group.add(sphere);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:this.textures.common_zapball2,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));sprite.scale.set(135,135,1);group.add(sprite);return group;}
  remove(group){this.root.remove(group);group.traverse(o=>{if(o.geometry&&!o.userData.sharedGeometry)o.geometry.dispose();o.material?.dispose();});}
  clear(){for(const child of [...this.root.children])this.remove(child);this.live.clear();this.bursts=[];}
  events(events){
    if(!this.ready)return;
    for(const e of events){if(e.type!=='spell-impact')continue;let group;
      if(e.key==='Q')group=this.beam(e.origin,e.end,e.width);
      else {group=this.ring(e.point,e.radius??100,e.key);const radius=e.radius??100;
        const nova=this.plane('xerath_base_z_nova',radius*2.4,radius*2.4,.9);nova.position.y=5;group.add(nova);
        if(e.key==='W'||e.key==='R'){for(let i=0;i<2;i++){const shaft=this.plane('xerath_base_w_skybeam',radius*.9,850,.85);shaft.rotation.set(0,i*Math.PI/2,0);shaft.position.y=425;group.add(shaft);}}
      }
      this.root.add(group);this.bursts.push({group,age:0,life:e.key==='Q'?.4:.65});
    }
  }
  update(dt,combat,position){
    if(!this.ready)return;const active=new Set(),use=(id,create)=>{active.add(id);if(!this.live.has(id)){const object=create();this.live.set(id,object);this.root.add(object);}return this.live.get(id);};
    if(combat.charge){const group=use('charge',()=>{const g=new THREE.Group();const guide=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:'#85e1f7',opacity:.18,transparent:true,depthWrite:false,side:THREE.DoubleSide}));guide.rotation.x=-Math.PI/2;g.add(guide);return g;}),dx=combat.aimPoint.x-position.x,dz=combat.aimPoint.z-position.z,len=Math.hypot(dx,dz)||1,r=combat.qRange;group.position.set(position.x+dx/len*r/2,3,position.z+dz/len*r/2);group.rotation.y=Math.atan2(-dz,dx);group.children[0].scale.set(r,145,1);}
    if(combat.charge){const orb=use('charge-energy',()=>this.orb());orb.position.set(position.x,140,position.z);orb.scale.setScalar(.7+.12*Math.sin(combat.time*7));}
    if(combat.channel){const aura=use('channel',()=>this.ring(position,150,'R'));aura.position.set(position.x,3,position.z);aura.rotation.y+=dt*.35;}
    for(const s of combat.threats){if(s.kind!=='circle')continue;const ring=use(`warning-${s.id}`,()=>this.ring(s.point,s.radius,s.key));const progress=THREE.MathUtils.clamp((combat.time-s.startedAt)/(s.impactAt-s.startedAt),0,1);ring.children[0].material.opacity=.3+.6*progress;}
    for(const s of combat.skillProjectiles){const orb=use(`missile-${s.id}`,()=>this.orb());orb.position.set(s.position.x,90,s.position.z);orb.children[0].rotation.y+=dt*6;}
    for(const [id,group] of this.live)if(!active.has(id)){this.remove(group);this.live.delete(id);}
    for(let i=this.bursts.length-1;i>=0;i--){const b=this.bursts[i];b.age+=dt;const opacity=Math.max(0,1-b.age/b.life);b.group.traverse(o=>{if(o.material)o.material.opacity=opacity;});if(b.age>=b.life){this.remove(b.group);this.bursts.splice(i,1);}}
  }
}
