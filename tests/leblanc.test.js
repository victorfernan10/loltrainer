import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Combat} from '../src/combat.js';
import {championRange,champions,leblancClipLabels} from '../src/champions.js';
import {settingsKey} from '../src/training.js';

test('LeBlanc remains ranged at level 1 and uses its own projectile speed',()=>{
 const c=new Combat({champion:'leblanc',level:1,attackSpeed:1}),p={x:0,z:0},dest={...p};
 for(const level of [1,6,11,16])assert.equal(championRange('leblanc',level),525);
 c.attackTarget('ryze-1');c.update(.01,p,dest,340);assert.equal(c.drainEvents().find(e=>e.type==='start').ranged,true);
 c.update(.22,p,dest,340);assert.equal(c.bolts.length,1);assert.ok(Math.abs(c.bolts[0].duration-Math.hypot(260,240)/1700)<1e-9);
 c.move({x:50,z:0});c.update(.3,p,dest,340);assert.equal(c.damage,60);assert.equal(c.cancelled,0);
});
test('Kayle abilities cannot leak into LeBlanc combat',()=>{
 const c=new Combat({champion:'leblanc'});c.playerHealth=800;assert.equal(c.castE(),false);assert.equal(c.castW(),false);assert.equal(c.playerHealth,800);assert.equal(c.speedMultiplier,1);assert.equal(c.commands,0);
});
test('history separates champions while retaining older Kayle comparison keys',()=>{
 const config={drill:'precision',skills:['ezrealQ'],speed:335};assert.equal(settingsKey(config),settingsKey({...config,champion:'kayle'}));assert.notEqual(settingsKey(config),settingsKey({...config,champion:'leblanc'}));
});
test('all 31 base animation resources have a converted clip and the weapon mask joint is intact',()=>{
 const data=fs.readFileSync(new URL('../public/assets/leblanc/leblanc.glb',import.meta.url)),gltf=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
 const manifest=JSON.parse(fs.readFileSync(new URL('../tools/leblanc-original/manifest.json',import.meta.url),'utf8'));
 const names=manifest.records.filter(r=>r.path.includes('/skins/base/animations/')&&r.path.endsWith('.anm')).map(r=>r.path.split('/').at(-1).slice(0,-4)).sort();
 assert.equal(names.length,31);assert.deepEqual(gltf.animations.map(c=>c.name).sort(),names);assert.deepEqual(Object.keys(leblancClipLabels).sort(),names);
 assert.equal(gltf.nodes[gltf.skins[0].joints[174]].name,'WeaponTip');assert.equal(champions.leblanc.moveSpeed,340);
});
