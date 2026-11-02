import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {YoneEffects} from '../src/yone-effects.js';
import {yoneSkills} from '../src/yone-encounter.js';

test('ground warnings align with committed world-space directions in all eight quadrants',()=>{
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4,direction={x:Math.sin(angle),z:Math.cos(angle)},origin={x:30,z:50},endpoint={x:origin.x+direction.x*450,z:origin.z+direction.z*450};
    const scene=new THREE.Scene(),view=new YoneEffects(scene);view.update({time:0,action:{id:1,skill:yoneSkills.yoneQ,origin,endpoint,direction,releaseAt:.35,duration:.35}});
    const o=view.objects.get('cast-1');o.updateMatrixWorld(true);const a=o.localToWorld(new THREE.Vector3(0,225,0)),b=o.localToWorld(new THREE.Vector3(0,-225,0));
    assert.ok(Math.hypot(a.x-origin.x,a.z-origin.z)<1e-5);assert.ok(Math.hypot(b.x-endpoint.x,b.z-endpoint.z)<1e-5);view.clear();assert.equal(scene.children.length,0);
  }
});
test('W cone center points toward its target and optional warnings never hide actual Q3 projectiles',()=>{
  const scene=new THREE.Scene(),view=new YoneEffects(scene),action={id:2,skill:yoneSkills.yoneW,origin:{x:0,z:0},endpoint:{x:600,z:0},direction:{x:1,z:0},releaseAt:.5,duration:.5};
  view.update({time:0,action});const o=view.objects.get('cast-2');o.updateMatrixWorld(true);const center=o.localToWorld(new THREE.Vector3(600,0,0));assert.ok(center.x>599);assert.ok(Math.abs(center.z)<1e-5);
  view.update({time:0,action,projectiles:[{id:1,position:{x:0,z:0}}]},false);assert.equal(view.objects.has('cast-2'),false);assert.equal(view.objects.has('q3-1'),true);
});
