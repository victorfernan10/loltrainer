import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DodgeFlash,FLASH_MODES} from '../src/dodge-flash.js';
test('Flash clamps to 400 units and becomes available at exactly ten simulated seconds',()=>{
  const f=new DodgeFlash(),p={x:10,z:20};const jump=f.cast(2,p,{x:3010,z:4020});
  assert.deepEqual(jump.to,{x:250,z:340});assert.deepEqual(p,{x:10,z:20});
  assert.equal(f.cast(11.999,p,{x:30,z:40}),null);assert.equal(f.uses,1);
  assert.equal(f.remaining(2),10);assert.equal(f.remaining(2),10);
  assert.deepEqual(f.cast(12,p,{x:30,z:40}).to,{x:30,z:40});assert.equal(f.uses,2);
});
test('invalid and zero-distance Flash inputs do not spend cooldown; scoped to dodge modes',()=>{
  const f=new DodgeFlash(),p={x:0,z:0};assert.equal(f.cast(0,p,p),null);assert.equal(f.cast(0,p,{x:NaN,z:2}),null);assert.equal(f.readyAt,0);assert.equal(f.uses,0);
  assert.equal(FLASH_MODES.has('pressure'),true);assert.equal(FLASH_MODES.has('ahri'),true);assert.equal(FLASH_MODES.has('vault'),false);assert.equal(FLASH_MODES.has('lane'),false);
});
