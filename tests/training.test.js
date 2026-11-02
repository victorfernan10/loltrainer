import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TrainingSession,seededRandom,settingsKey} from '../src/training.js';
import {dodgeSkills,fullCastEndpoint,movingPointDistance} from '../src/dodge-simulation.js';

const config={drill:'precision',difficulty:2,duration:60,speed:335,closeRadius:150,pace:1,seed:42,skills:['ezrealQ']};
const cast=(session,position={x:0,z:500})=>session.beginShot({skill:dodgeSkills.ezrealQ,origin:{x:0,z:0},endpoint:{x:0,z:1200},direction:{x:0,z:1},position,target:position,velocity:{x:0,z:0},aimMode:'current',radius:125});

test('a close aim still produces a full-range shot; a coincident aim has a stable direction',()=>{
  assert.deepEqual(fullCastEndpoint({x:0,z:0},{x:0,z:10},1200),{x:0,z:1200});
  assert.deepEqual(fullCastEndpoint({x:5,z:5},{x:5,z:5},1200),{x:5,z:1205});
});
test('relative sweep catches two bodies crossing between frames',()=>{
  const distance=movingPointDistance({x:-200,z:200},{x:200,z:200},{x:0,z:0},{x:0,z:400});
  assert.equal(distance,0);
});
test('relative sweep does not hit a place the player left earlier in the frame',()=>{
  const distance=movingPointDistance({x:0,z:200},{x:0,z:400},{x:0,z:0},{x:0,z:200});
  assert.equal(distance,200);
});
test('repeated seeds reproduce scheduling randomness',()=>{
  const a=seededRandom(42),b=seededRandom(42),c=seededRandom(43);
  const first=Array.from({length:20},a);assert.deepEqual(first,Array.from({length:20},b));assert.notDeepEqual(first,Array.from({length:20},c));
});
test('paused time and commands do not contaminate session metrics',()=>{
  const s=new TrainingSession(config),shot=cast(s);s.state='paused';s.tick(5);s.command({x:0,z:500},{x:100,z:500});
  assert.equal(s.time,0);assert.equal(s.clicks.length,0);assert.equal(shot.firstCommandAt,null);
  s.state='running';s.tick(.2);s.command({x:0,z:500},{x:100,z:500});s.tick(.3);s.resolve(shot,false,{x:160,z:500});
  assert.equal(s.summary().firstCommandMs,200);assert.equal(s.summary().shortClicks,100);
});
test('already-safe dodges are not included as command reaction samples',()=>{
  const s=new TrainingSession(config),shot=cast(s,{x:300,z:500});s.tick(.1);s.command({x:300,z:500},{x:400,z:500});s.resolve(shot,false,{x:400,z:500});
  assert.equal(s.summary().commandSamples,0);assert.equal(s.summary().firstCommandMs,null);assert.match(shot.feedback,/fora da linha/);
});
test('only resolved shots affect accuracy and resolving twice is ignored',()=>{
  const s=new TrainingSession(config),shot=cast(s);cast(s);s.tick(.5);s.resolve(shot,true,{x:0,z:500});s.resolve(shot,false,{x:200,z:500});
  assert.equal(s.summary().total,1);assert.equal(s.summary().hits,1);assert.equal(s.summary().accuracy,0);assert.equal(s.report().shots.length,1);
});
test('duration expiry drains in-flight shots instead of silently counting them as dodges',()=>{
  const s=new TrainingSession({...config,duration:1}),shot=cast(s);s.tick(1.1);assert.equal(s.state,'draining');assert.equal(s.summary().total,0);
  s.tick(.1);s.resolve(shot,true,{x:0,z:500});assert.equal(s.summary().hits,1);
});
test('historical comparisons require the same training settings, not just the same drill',()=>{
  assert.equal(settingsKey(config),settingsKey({...config,seed:999}));
  assert.notEqual(settingsKey(config),settingsKey({...config,speed:400}));
  assert.notEqual(settingsKey(config),settingsKey({...config,closeRadius:300}));
});
