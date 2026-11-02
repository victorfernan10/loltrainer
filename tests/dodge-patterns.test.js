import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dodgeWavePlan,DodgeDeck} from '../src/dodge-patterns.js';
import {seededRandom} from '../src/training.js';

test('wave plans are reproducible and contain no player-state dependency',()=>{
  const a=seededRandom(71),b=seededRandom(71);
  for(let i=0;i<40;i++)assert.deepEqual(dodgeWavePlan(a,{difficulty:3,drill:'pressure',available:8,advanced:true}),dodgeWavePlan(b,{difficulty:3,drill:'pressure',available:8,advanced:true}));
});

test('pressure progresses to three casters, while precision and limited pools remain bounded',()=>{
  for(const difficulty of [1,2,3])assert.equal(dodgeWavePlan(seededRandom(9),{difficulty,drill:'pressure',available:8}).count,difficulty);
  for(const available of [0,1,2,3,8]){
    assert.equal(dodgeWavePlan(seededRandom(9),{difficulty:3,drill:'pressure',available}).count,Math.min(3,available));
    assert.equal(dodgeWavePlan(seededRandom(9),{difficulty:3,drill:'precision',available}).count,Math.min(1,available));
  }
  assert.equal(dodgeWavePlan(seededRandom(1),{difficulty:3,drill:'pressure',available:['lux','brand']}).count,2);
});

test('multi-caster plans mix aim, use distinct corners, and stagger casts rather than stacking simultaneous inputs',()=>{
  const random=seededRandom(312),patterns=new Set(),firstAim=new Set(),corners=new Set();
  for(let i=0;i<100;i++){
    const p=dodgeWavePlan(random,{difficulty:3,drill:'pressure',available:12,advanced:true});
    assert.equal(p.cornerIndices.length,3);assert.equal(new Set(p.cornerIndices).size,3);
    assert.ok(p.cornerIndices.every(c=>Number.isInteger(c)&&c>=0&&c<=3));
    assert.deepEqual(new Set(p.aimModes),new Set(['lead','current']));
    assert.equal(p.castOffsets[0],0);
    for(let j=1;j<p.count;j++)assert.ok(p.castOffsets[j]-p.castOffsets[j-1]>=.24-1e-9);
    assert.ok(p.castOffsets.at(-1)<=.8+1e-9);
    assert.ok(p.minimumResponseTime>=.68);assert.ok(p.cooldownFactor>=.342&&p.cooldownFactor<=.504);
    patterns.add(p.pattern);firstAim.add(p.aimModes[0]);corners.add(p.cornerIndices[0]);
  }
  assert.equal(patterns.size,2);assert.equal(firstAim.size,2);assert.equal(corners.size,4);
});

test('difficulty increases scheduling pressure without returning any spell physics overrides',()=>{
  const easy=dodgeWavePlan(()=>.5,{difficulty:1,drill:'pressure',available:5});
  const hard=dodgeWavePlan(()=>.5,{difficulty:3,drill:'pressure',available:5});
  assert.ok(hard.cooldownFactor<easy.cooldownFactor);assert.ok(hard.minimumResponseTime<easy.minimumResponseTime);
  for(const forbidden of ['speed','warning','width','radius','range','position','target'])assert.equal(Object.hasOwn(hard,forbidden),false);
  const one=dodgeWavePlan(()=>.5,{difficulty:3,drill:'precision',available:5});assert.deepEqual(one.aimModes,['current']);
});

test('balanced skill deck consumes every enabled spell before refilling and reproduces its seed',()=>{
  const pool=['luxQ','luxR','brandQ','brandW','morganaQ','xerathQ','xerathE'];
  const a=new DodgeDeck(seededRandom(42)),b=new DodgeDeck(seededRandom(42));let seen=new Set(),cycle=0;
  for(let i=0;i<100;i++){
    const x=a.draw(pool,1);assert.deepEqual(x,b.draw(pool,1));
    if(a.cycle!==cycle){if(cycle)assert.equal(seen.size,pool.length);seen=new Set();cycle=a.cycle;}
    assert.equal(seen.has(x[0]),false);seen.add(x[0]);
  }
});

test('sibling spells are deferred, not lost or emitted as simultaneous duplicate champions',()=>{
  const pool=['luxQ','luxR','brandQ','brandW','xerathQ','xerathE','morganaQ','blitzcrankQ'];
  const champion=id=>id.replace(/[QWER]$/,'');const deck=new DodgeDeck(seededRandom(123)),seen=new Set();
  for(let i=0;i<25;i++){
    const wave=deck.draw(pool,3,champion);assert.ok(wave.length>=1&&wave.length<=3);
    assert.equal(new Set(wave.map(champion)).size,wave.length);wave.forEach(id=>seen.add(id));
    if(i===pool.length)assert.equal(seen.size,pool.length);
  }
  const siblings=new DodgeDeck(()=>.5);
  assert.equal(siblings.draw(['luxQ','luxR'],3,champion).length,1);assert.equal(siblings.remaining.length,1);
  assert.equal(siblings.draw(['luxQ','luxR'],3,champion).length,1);assert.equal(siblings.remaining.length,0);
});

test('changing enabled spells resets the bag and an empty selection produces no wave',()=>{
  const deck=new DodgeDeck(seededRandom(9));deck.draw(['luxQ','luxR','brandW'],2);
  assert.deepEqual(deck.draw(['morganaQ'],3),['morganaQ']);assert.deepEqual(deck.draw([],3),[]);
});
