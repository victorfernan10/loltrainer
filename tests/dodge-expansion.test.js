import {test} from 'node:test';
import assert from 'node:assert/strict';
import {castEndpoint,hazardDistance,dodgeSkills} from '../src/dodge-simulation.js';
import {TrainingSession} from '../src/training.js';

test('Brand W lands at the aimed point, not the far end of a line',()=>{
  const skill=dodgeSkills.brandW,origin={x:0,z:0},aim={x:0,z:500};
  assert.deepEqual(castEndpoint(skill,origin,aim),aim);
  assert.deepEqual(castEndpoint(skill,origin,{x:0,z:1500}),{x:0,z:900});
  assert.equal(hazardDistance({x:0,z:0},skill,origin,aim),500);
  assert.equal(hazardDistance({x:305,z:500},skill,origin,aim),skill.width/2+65);
  assert.deepEqual(castEndpoint(dodgeSkills.brandQ,origin,aim),{x:0,z:1100});
});
test('circle training threat, escape commands and replay geometry use the area center',()=>{
  const s=new TrainingSession({skills:['brandW'],seed:10,duration:60}),skill=dodgeSkills.brandW;
  const shot=s.beginShot({skill,origin:{x:0,z:0},endpoint:{x:0,z:500},direction:{x:0,z:1},position:{x:0,z:500},target:{x:0,z:500},velocity:{x:0,z:0},aimMode:'current',radius:305});
  assert.equal(shot.threatened,true);s.tick(.1);s.command({x:0,z:500},{x:0,z:650});assert.equal(shot.firstDodgeAt,.1);
  s.resolve(shot,false,{x:0,z:900});assert.match(shot.feedback,/área/);assert.equal(s.report().shots[0].parameters.kind,'circle');
  const safe=s.beginShot({skill,origin:{x:0,z:0},endpoint:{x:0,z:500},direction:{x:0,z:1},position:{x:0,z:0},target:{x:0,z:0},velocity:{x:0,z:0},aimMode:'current',radius:305});
  assert.equal(safe.threatened,false);s.resolve(safe,false,{x:0,z:0});assert.equal(s.summary().threats,1);
});
