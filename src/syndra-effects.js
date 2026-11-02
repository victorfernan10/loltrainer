import {assetUrl} from './asset-url.js';
import * as THREE from 'three';

// Original texture masks and particle meshes from the installed skin0 WAD.
// Timing/particle composition are reconstructed, not Riot's proprietary renderer.
const ASSETS='/assets/syndra/';
export class SyndraEffects {
  constructor(scene){
    this.scene=scene;this.objects=new Map();this.bursts=[];this.time=0;this.anchors=[];
    this.geometries={};this.textures={};this.orbRadius=30;
    this.fallback=new THREE.PlaneGeometry(40,40);this.coreGeometry=new THREE.SphereGeometry(1,20,14);
    this.world=new THREE.Vector3();
    const loader=new THREE.TextureLoader();
    for(const [key,file] of Object.entries({core:'syndra_base_q_orb_core',outline:'common_darksov_orb_outlines',swirl:'common_darksov_blackhole',flash:'syndra_base_2021_q_flash_01',cracks:'syndra_base_2021_q_cracks',wave:'syndra_base_2021_e_core',trail:'syndra_base_2021_r_mis_core',impact:'syndra_base_2021_r_hitflash_ring'})){
      const texture=loader.load(`${ASSETS}${file}.png`);texture.colorSpace=THREE.SRGBColorSpace;
      if(key==='outline'){texture.repeat.x=.5;texture.wrapS=THREE.RepeatWrapping;}
      this.textures[key]=texture;
    }
    this.ready=Promise.all(['q-flat-sphere','q-swirl-sphere','e-plane','e-wave'].map(async name=>{
      try{
        const response=await fetch(assetUrl(`${ASSETS}${name}.json`));if(!response.ok)throw new Error(`${response.status}`);
        const source=await response.json(),geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(source.positions,3));
        geometry.setAttribute('uv',new THREE.Float32BufferAttribute(source.uv,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();
        this.geometries[name]=geometry;
        // Replace any placeholder created before asynchronous asset loading.
        for(const object of this.objects.values())object.traverse(child=>{if(child.userData.sourceMesh===name)child.geometry=geometry;});
      }catch(error){console.warn(`Syndra particle mesh ${name} unavailable`,error);}
    }));
  }
  setOrbAnchors(bones){this.anchors=(bones??[]).filter(Boolean);}
  material(map,color,opacity=1,additive=true){return new THREE.MeshBasicMaterial({map:this.textures[map],color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending});}
  particle(name,map,color,opacity=1,additive=true){
    const mesh=new THREE.Mesh(this.geometries[name]??this.fallback,this.material(map,color,opacity,additive));mesh.userData.sourceMesh=name;return mesh;
  }
  billboard(mesh){mesh.onBeforeRender=(_renderer,_scene,camera)=>{camera.getWorldQuaternion(mesh.quaternion);mesh.updateMatrixWorld();};return mesh;}
  orb(id,radius=30){
    let group=this.objects.get(id);if(group)return group;
    group=new THREE.Group();group.userData.radius=radius;
    const core=new THREE.Mesh(this.coreGeometry,new THREE.MeshBasicMaterial({color:'#16052e'}));core.scale.setScalar(radius*.78);group.add(core);
    const body=this.billboard(this.particle('q-flat-sphere','core','#100321',1,false));body.scale.setScalar(radius/20);group.add(body);
    const rim=this.billboard(this.particle('q-flat-sphere','outline','#9d59ff',.9));rim.scale.setScalar(radius/20*1.09);group.add(rim);
    const swirl=this.billboard(this.particle('q-swirl-sphere','swirl','#8641f2',.6));swirl.scale.setScalar(radius/20*1.2);group.add(swirl);
    group.userData.rim=rim;group.userData.swirl=swirl;group.userData.core=core;
    this.objects.set(id,group);this.scene.add(group);return group;
  }
  remove(object){this.scene.remove(object);object.traverse(child=>{if(child.userData.ownedGeometry)child.geometry?.dispose();if(child.material)child.material.dispose();});}
  clear(){for(const object of this.objects.values())this.remove(object);this.objects.clear();for(const burst of this.bursts)this.remove(burst.object);this.bursts=[];}
  burst(point,radius=80,ability='Q'){
    if(!point)return;
    const group=new THREE.Group();group.position.set(point.x,5,point.z);
    const flash=new THREE.Mesh(this.fallback,this.material(ability==='R'?'impact':'flash','#b366ff',.85));flash.rotation.x=-Math.PI/2;flash.scale.setScalar(radius/20);group.add(flash);
    const cracks=new THREE.Mesh(this.fallback,this.material('cracks','#7542d1',.7));cracks.rotation.x=-Math.PI/2;cracks.scale.setScalar(radius/20);group.add(cracks);
    this.scene.add(group);this.bursts.push({object:group,kind:'impact',age:0,duration:.5});
  }
  events(events){for(const event of events){
    if(event.type==='syndra-impact')this.burst(event.point,event.radius??90,event.ability);
    if(event.type==='syndra-pickup')this.burst(event.point??event.position,50,'W');
    if(event.type==='syndra-wave'&&event.origin&&event.point){
      const dx=event.point.x-event.origin.x,dz=event.point.z-event.origin.z;
      const group=new THREE.Group();group.position.set(event.origin.x,5,event.origin.z);group.rotation.y=-Math.atan2(dz,dx);
      const floor=this.particle('e-plane','wave','#773ad1',.65),wall=this.particle('e-wave','wave','#bb72ff',.85);
      group.add(floor,wall);this.scene.add(group);
      this.bursts.push({object:group,kind:'wave',floor,wall,age:0,duration:event.duration??.35,range:event.range??700,tangent:Math.tan((event.angleDegrees??56)*Math.PI/360)});
    }
  }}
  update(dt,combat,playerPosition){
    this.time=combat.time??this.time+dt;const seen=new Set();
    for(const sphere of combat.spheres??[]){
      if(sphere.state==='ultimate'&&(combat.skillProjectiles??[]).some(p=>p.id===sphere.id))continue;
      const id=`sphere-${sphere.id}`,orb=this.orb(id);seen.add(id);
      const forming=sphere.state==='forming',grow=forming?THREE.MathUtils.clamp(1-((sphere.activeAt??this.time)-this.time)/.6,.02,1):1;
      const expiry=sphere.state!=='ground'||sphere.expiresAt==null?1:THREE.MathUtils.clamp((sphere.expiresAt-this.time)/.7,0,1);
      orb.position.set(sphere.position.x,sphere.height??45,sphere.position.z);
      orb.scale.setScalar((.15+.85*grow)*Math.max(.05,Math.sqrt(expiry)));
      orb.userData.rim.material.opacity=(.72+.2*Math.sin(this.time*4+sphere.id))*grow;
      orb.userData.swirl.material.opacity=(sphere.state==='pushed'||sphere.state==='throw'?.85:.5)*grow;
      orb.userData.swirl.rotation.z=this.time;
    }
    for(const projectile of combat.skillProjectiles??[]){
      if(projectile.kind!=='R'&&projectile.ability!=='R')continue;
      const id=`r-${projectile.id}`,orb=this.orb(id,25);seen.add(id);
      orb.position.set(projectile.position.x,projectile.height??100,projectile.position.z);orb.userData.rim.material.opacity=1;
    }
    // Original base model has no orb geometry; these are the three VFX attachments.
    for(let i=0;i<3;i++){
      const id=`orbit-${i}`,orb=this.orb(id,20);seen.add(id);
      if(this.anchors[i]){this.anchors[i].getWorldPosition(this.world);orb.position.copy(this.world);}
      else if(playerPosition){const angle=this.time*1.1+i*Math.PI*2/3;orb.position.set(playerPosition.x+Math.cos(angle)*85,100+Math.sin(angle*2)*18,playerPosition.z+Math.sin(angle)*85);}
      orb.visible=!(combat.rLaunches?.length||combat.skillProjectiles?.some(p=>p.kind==='R'));
      orb.userData.rim.material.opacity=.7;orb.userData.swirl.material.opacity=.42;
    }
    for(const [id,object] of this.objects)if(!seen.has(id)){this.remove(object);this.objects.delete(id);}
    for(let i=this.bursts.length-1;i>=0;i--){
      const burst=this.bursts[i];burst.age+=dt;const progress=THREE.MathUtils.clamp(burst.age/burst.duration,0,1);
      if(burst.kind==='wave'){
        const distance=burst.range*progress,halfWidth=Math.max(18,distance*burst.tangent);
        burst.floor.scale.set(-Math.max(1,distance)/108,1,halfWidth/43);burst.floor.material.opacity=.6*(1-progress);
        burst.wall.position.x=distance;burst.wall.scale.set(1.2,1.8,halfWidth/43);burst.wall.material.opacity=Math.sin(progress*Math.PI)*.95;
      }else{burst.object.scale.setScalar(.65+progress*.55);burst.object.traverse(child=>{if(child.material)child.material.opacity=Math.max(0,1-progress)*.8;});}
      if(progress>=1){this.remove(burst.object);this.bursts.splice(i,1);}
    }
  }
}
