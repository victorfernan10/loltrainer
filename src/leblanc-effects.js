import * as THREE from 'three';

// Readable training VFX, not a reproduction of Riot's particle renderer.
export class LeBlancEffects {
  constructor(scene){this.scene=scene;this.objects=new Map();this.bursts=[];}
  remove(object){this.scene.remove(object);object.geometry?.dispose();object.material?.dispose();}
  clear(){for(const object of this.objects.values())this.remove(object);this.objects.clear();for(const b of this.bursts)this.remove(b.object);this.bursts=[];}
  mesh(id,shape,color){
    let object=this.objects.get(id);if(object)return object;
    const geometry=shape==='ring'?new THREE.TorusGeometry(38,3,6,48):shape==='mark'?new THREE.OctahedronGeometry(15):new THREE.SphereGeometry(12,12,8);
    object=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending}));
    if(shape==='ring')object.rotation.x=Math.PI/2;
    this.scene.add(object);this.objects.set(id,object);return object;
  }
  line(id,a,b,color){
    let line=this.objects.get(id);
    if(!line){line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color,transparent:true,opacity:.9}));this.objects.set(id,line);this.scene.add(line);}
    const p=line.geometry.attributes.position;p.setXYZ(0,a.x,110,a.z);p.setXYZ(1,b.x,110,b.z);p.needsUpdate=true;line.geometry.computeBoundingSphere();
  }
  events(events){for(const e of events){if(e.type!=='spell-impact'&&e.type!=='blink')continue;
    const object=new THREE.Mesh(new THREE.RingGeometry(50,65,64),new THREE.MeshBasicMaterial({color:e.key==='R'?'#c68aff':'#ffca71',transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    object.rotation.x=-Math.PI/2;object.position.set(e.position.x,8,e.position.z);this.scene.add(object);this.bursts.push({object,remaining:.35,radius:e.radius??80});
  }}
  update(dt,combat,position){
    const seen=new Set(),color=key=>key==='R'?'#ce80ff':'#ffd27a';
    for(const [key,anchor] of Object.entries(combat.anchors)){
      const id=`pad-${key}`;seen.add(id);const o=this.mesh(id,'ring',color(key));o.position.set(anchor.position.x,5,anchor.position.z);o.material.opacity=.3+.5*Math.min(1,(anchor.until-combat.time)/4);
    }
    for(const p of combat.skillProjectiles){const id=`projectile-${p.id}`;seen.add(id);const o=this.mesh(id,'orb',color(p.key));o.position.set(p.position.x,110,p.position.z);
      if(p.ability==='E'){const lineId=`flying-chain-${p.id}`;seen.add(lineId);this.line(lineId,position,p.position,color(p.key));}
    }
    for(const t of combat.tethers){const id=`tether-${t.id}`;seen.add(id);this.line(id,position,combat.target(t.targetId).position,color(t.key));}
    for(const target of combat.targets){
      for(const mark of target.sigils??[]){const id=`sigil-${target.id}-${mark.key}`;seen.add(id);const o=this.mesh(id,'mark',color(mark.key));o.position.set(target.position.x,270,target.position.z);o.rotation.y=combat.time*2;}
      if(target.alive&&target.rootUntil>combat.time){const id=`root-${target.id}`;seen.add(id);const o=this.mesh(id,'ring','#e7b8ff');o.position.set(target.position.x,12,target.position.z);o.rotation.z=combat.time*2;}
    }
    for(const [id,o] of this.objects)if(!seen.has(id)){this.remove(o);this.objects.delete(id);}
    for(let i=this.bursts.length-1;i>=0;i--){const b=this.bursts[i];b.remaining-=dt;b.object.material.opacity=Math.max(0,b.remaining/.35);b.object.scale.setScalar(1+(1-b.remaining/.35)*(b.radius/65-1));if(b.remaining<=0){this.remove(b.object);this.bursts.splice(i,1);}}
  }
}
