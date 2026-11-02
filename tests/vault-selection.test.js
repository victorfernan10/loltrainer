import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {VaultView} from '../src/vault-view.js';

test('LeBlanc selection fills animated mesh gaps without accepting distant or inactive targets',()=>{
  const view={enemy:{active:true},group:new THREE.Group()};
  const ray=new THREE.Raycaster(new THREE.Vector3(80,85,500),new THREE.Vector3(0,0,-1));
  assert.equal(VaultView.prototype.pick.call(view,ray),'vault-leblanc');
  ray.ray.origin.x=101;assert.equal(VaultView.prototype.pick.call(view,ray),null);
  ray.ray.origin.x=0;view.enemy.active=false;assert.equal(VaultView.prototype.pick.call(view,ray),null);
});
