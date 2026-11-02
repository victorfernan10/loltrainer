import * as THREE from 'three';

export class YoneEffects {
  constructor(scene){this.scene=scene;this.objects=new Map();}
  clear(){for(const o of this.objects.values()){this.scene.remove(o);o.geometry?.dispose();o.material?.dispose();}this.objects.clear();}
  update(enemy,telegraphs=true){
    const used=new Set();
    const mesh=(id,geometry,color,opacity)=>{used.add(id);let o=this.objects.get(id);if(!o){o=new THREE.Mesh(geometry(),new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false}));this.objects.set(id,o);this.scene.add(o);}return o;};
    const a=enemy?.action;
    if(a?.skill&&(!a.released?telegraphs:a.kind!=='q3-dash'&&enemy.time<a.until)){
      const skill=a.skill;
      const o=mesh('cast-'+a.id,()=>skill.kind==='cone'?new THREE.CircleGeometry(600,40,-40*Math.PI/180,80*Math.PI/180):new THREE.PlaneGeometry(skill.width,skill.range),skill.color,.2);
      if(skill.kind==='cone'){
        o.rotation.set(-Math.PI/2,0,Math.atan2(a.direction.x,a.direction.z)-Math.PI/2);o.position.set(a.origin.x,3,a.origin.z);
      }else{o.rotation.set(-Math.PI/2,0,Math.atan2(a.direction.x,a.direction.z));o.position.set((a.origin.x+a.endpoint.x)/2,3,(a.origin.z+a.endpoint.z)/2);}
      o.material.opacity=a.released?.5*Math.min(1,Math.max(0,(a.until-enemy.time)/.14)):(skill.key==='R'?.3:.12)+.2*Math.max(0,1-(a.releaseAt-enemy.time)/a.duration);
      if(skill.key==='Q3'&&!a.released){const body=mesh('dash-'+a.id,()=>new THREE.PlaneGeometry(200,450),skill.color,.1);body.rotation.copy(o.rotation);body.position.set(a.origin.x+a.direction.x*225,3.1,a.origin.z+a.direction.z*225);}
    }
    for(const p of enemy?.projectiles??[]){
      const o=mesh('q3-'+p.id,()=>new THREE.TorusGeometry(47,5,6,30),'#a7dceb',.85);
      o.position.set(p.position.x,60,p.position.z);o.rotation.set(Math.PI/2,0,enemy.time*12);o.scale.set(1,1,1.8);
      const core=mesh('q3core-'+p.id,()=>new THREE.ConeGeometry(30,130,12,1,true),'#c2e6ec',.25);core.position.copy(o.position);core.rotation.y=enemy.time*10;
    }
    if(enemy?.spirit&&enemy.anchor){
      const o=mesh('anchor',()=>new THREE.RingGeometry(48,52,48),'#c97a83',.5);o.rotation.x=-Math.PI/2;o.position.set(enemy.anchor.x,3,enemy.anchor.z);
    }
    for(const [id,o] of this.objects)if(!used.has(id)){this.scene.remove(o);o.geometry.dispose();o.material.dispose();this.objects.delete(id);}
  }
}
