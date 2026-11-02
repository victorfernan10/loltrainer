import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advance} from '../src/simulation.js';
import {clampSkillRange,dodgeSkills,pointSegmentDistanceXZ,skillshotHitsPoint} from '../src/dodge-simulation.js';
test('335 units per second independent of render frequency',()=>{
  for(const fps of [30,60,144]){const p={x:0,z:0};for(let i=0;i<fps;i++)advance(p,{x:3000,z:4000},335,1/fps);assert.ok(Math.abs(Math.hypot(p.x,p.z)-335)<1e-8);}
});
test('close clicks stop exactly at destination without overshoot',()=>{
  const p={x:0,z:0};advance(p,{x:1,z:1},335,.05);assert.deepEqual(p,{x:1,z:1});assert.equal(advance(p,{x:1,z:1},335,.05),false);
});
test('new command changes direction immediately',()=>{
  const p={x:0,z:0};advance(p,{x:1000,z:0},335,.1);advance(p,{x:-1000,z:0},335,.1);assert.ok(Math.abs(p.x)<1e-8);assert.equal(p.z,0);
});
test('challenge skills use individual release times and fixed projectile speeds',()=>{
  assert.deepEqual(Object.keys(dodgeSkills),['xerathQ','nautilusQ','threshQ','luxR','ezrealQ','luxQ','xerathE','morganaQ','blitzcrankQ','brandQ','brandW']);
  assert.deepEqual(Object.values(dodgeSkills).map(skill=>skill.warning),[.5,.25,.5,1,.25,.25,.25,.25,.25,.25,.875]);
  assert.deepEqual(Object.fromEntries(Object.entries(dodgeSkills).map(([key,skill])=>[key,[skill.range,skill.width,skill.speed]])),{
    xerathQ:[1450,145,Infinity],nautilusQ:[1100,180,2000],threshQ:[1100,140,1900],luxR:[3340,190,Infinity],ezrealQ:[1200,120,2000],
    luxQ:[1300,140,1200],xerathE:[1125,120,1400],morganaQ:[1300,140,1200],blitzcrankQ:[1080,140,1800],brandQ:[1100,120,1600],brandW:[900,480,Infinity]
  });
});
test('ranged skill paths clamp to cast range without changing their direction',()=>{
  assert.deepEqual(clampSkillRange({x:0,z:0},{x:3,z:4},10),{x:3,z:4});
  const end=clampSkillRange({x:10,z:20},{x:10,z:1020},300);
  assert.deepEqual(end,{x:10,z:320});
});
test('beam and missile collision use the same full-width plus champion-radius check',()=>{
  const start={x:0,z:0},end={x:0,z:1000};
  assert.equal(pointSegmentDistanceXZ({x:100,z:500},start,end),100);
  assert.equal(skillshotHitsPoint({x:136,z:500},start,end,140,65),false);
  assert.equal(skillshotHitsPoint({x:135,z:500},start,end,140,65),true);
  assert.equal(skillshotHitsPoint({x:0,z:1001},start,end,120,65),true);
});
test('Lux R collision covers its configured beam width without a hidden easy-mode reduction',()=>{
  const skill=dodgeSkills.luxR,start={x:0,z:0},end={x:0,z:1000};
  assert.equal(skill.width,190);
  assert.equal(skill.hitWidth,undefined);
  assert.equal(skillshotHitsPoint({x:160,z:500},start,end,skill.width,65),true);
  assert.equal(skillshotHitsPoint({x:161,z:500},start,end,skill.width,65),false);
});
