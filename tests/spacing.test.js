import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Combat} from '../src/combat.js';
import {CaitlynCombat} from '../src/caitlyn-combat.js';
import {SpacingEncounter,spacingTargets,SPACING_LUCIAN} from '../src/spacing-encounter.js';
import {seededRandom} from '../src/training.js';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function setup(difficulty=3){
  const combat=new Combat({level:6,targets:spacingTargets()});combat.range=650;
  const player={x:0,z:0},e=new SpacingEncounter({combat,random:seededRandom(11),difficulty});
  return {combat,e,player,tick(seconds,{allowStart=true}={}){for(let left=seconds;left>1e-9;){const dt=Math.min(left,.005);e.update(dt,player,{allowStart});combat.update(dt,player,{...player},325,{allowStart:false});e.observe(combat.drainEvents());left-=dt;}}};
}

test('spacing compares edges exactly once and Lucian cannot shoot beyond his 500 range',()=>{
  const {e,tick}=setup();e.position.x=0;e.position.z=-631;e.target.rootUntil=99;e.readyAt=0;
  tick(1);assert.equal(e.edgeDistance,501);assert.equal(e.enemyReleases,0);
  e.position.z=-630;tick(.5);assert.equal(e.edgeDistance,500);assert.equal(e.enemyReleases,1);
  assert.equal(e.enemyRange,500);assert.equal(e.playerRange,650);
});

test('first ready Lucian attack uses reaction plus windup, then respects native cooldown at every difficulty',()=>{
  for(const difficulty of [1,2,3]){const {e,tick}=setup(difficulty);e.position.z=-600;e.readyAt=0;e.target.rootUntil=99;
    tick(e.policy.reaction+e.windup-.02);assert.equal(e.enemyReleases,0);
    tick(.04);assert.equal(e.enemyReleases,1);const ready=e.readyAt;
    tick(Math.max(0,ready-e.time-.01));assert.equal(e.enemyReleases,1);
    tick(e.windup+.03);assert.equal(e.enemyReleases,2);
    assert.equal(e.attackSpeed,.638*(1+.025*(.7025*5+.0175*(36-1))));
  }
});

test('Lucian freezes translation while preparing and releasing an attack',()=>{
  const {e,tick}=setup();e.position.z=-620;e.goal={...e.position};e.readyAt=0;tick(.13);assert.ok(e.attack);
  const origin={...e.position};while(e.attack){tick(.005);assert.ok(dist(origin,e.position)<.001);}assert.equal(e.enemyReleases,1);
});

test('leaving before release denies the shot; re-entering does not skip another windup',()=>{
  const {e,player,tick}=setup();e.position.z=-620;e.readyAt=0;e.target.rootUntil=99;tick(.13);assert.ok(e.attack);
  player.z=50;tick(.01);assert.equal(e.attack,null);assert.equal(e.deniedAttacks,1);assert.equal(e.enemyReleases,0);
  player.z=0;tick(.06);assert.equal(e.attack,null);tick(.08);assert.ok(e.attack);assert.equal(e.enemyReleases,0);
  tick(e.windup+.01);assert.equal(e.enemyReleases,1);
});

test('a released enemy bullet remains homing after moving outside range and drains on stop',()=>{
  const {e,combat,player,tick}=setup();e.position.z=-620;e.target.rootUntil=99;e.readyAt=0;
  tick(e.policy.reaction+e.windup+.01);assert.equal(e.projectiles.length,1);assert.equal(e.retaliationHits,0);
  player.x=800;e.stop();tick(.5,{allowStart:false});assert.equal(e.retaliationHits,1);assert.equal(combat.playerHealth,1000-e.attackDamage);assert.equal(e.pending,false);
});

test('stun prevents attacks and movement, root prevents movement, and slow scales walking',()=>{
  const {e,tick}=setup();e.target.stunUntil=1;e.readyAt=0;const start={...e.position};tick(.5);assert.deepEqual(e.position,start);assert.equal(e.enemyReleases,0);
  e.target.stunUntil=0;e.target.rootUntil=2;tick(.5);assert.deepEqual(e.position,start);
  e.target.rootUntil=0;e.target.slowAmount=.5;e.target.slowStartsAt=0;e.target.slowUntil=5;
  assert.equal(e.moveSpeed,193.75);assert.equal(SPACING_LUCIAN.moveSpeed,335);
});

test('clean spacing requires an actual AA in normal range, outside retaliation range, without control',()=>{
  const {e,tick}=setup();e.position.z=-720;e.stopped=true;
  e.observe([{type:'release',id:10,targetId:e.target.id},{type:'hit',attackId:10,isBasicAttack:true,targetId:e.target.id}]);
  assert.equal(e.pending,true);tick(1,{allowStart:false});assert.equal(e.cleanHits,1);assert.equal(e.playerHits,1);assert.equal(e.pending,false);
  e.observe([{type:'hit',spellId:5,ability:'Q',targetId:e.target.id}]);assert.equal(e.playerHits,1);
  e.target.rootUntil=99;e.observe([{type:'release',id:11,targetId:e.target.id},{type:'hit',attackId:11,isBasicAttack:true,targetId:e.target.id}]);tick(1,{allowStart:false});assert.equal(e.cleanHits,1);
  e.target.rootUntil=0;e.position.z=-1000;e.observe([{type:'release',id:12,targetId:e.target.id},{type:'hit',attackId:12,isBasicAttack:true,targetId:e.target.id}]);tick(1,{allowStart:false});assert.equal(e.cleanHits,1);
});

test('an enemy response during the trade window invalidates a clean hit exactly once',()=>{
  const {e,tick}=setup();e.stopped=true;e.position.z=-720;
  e.observe([{type:'release',id:1,targetId:e.target.id},{type:'hit',attackId:1,isBasicAttack:true,targetId:e.target.id}]);e.retaliationTimes.push(.4);
  tick(1,{allowStart:false});assert.equal(e.cleanHits,0);assert.equal(e.trades,1);
  e.observe([{type:'hit',attackId:1,isBasicAttack:true,targetId:e.target.id}]);tick(.2,{allowStart:false});assert.equal(e.trades,1);assert.equal(e.playerHits,1);
});

test('an E-slow assisted attack is recorded but cannot inflate clean spacing points',()=>{
  const {e,tick}=setup();e.stopped=true;e.position.z=-720;e.target.slowUntil=2;e.target.slowAmount=.5;
  e.observe([{type:'release',id:1,targetId:e.target.id},{type:'hit',attackId:1,isBasicAttack:true,targetId:e.target.id}]);
  tick(1,{allowStart:false});assert.equal(e.playerHits,1);assert.equal(e.cleanHits,0);
});

test('dead targets reset debuffs and generation; ending does not spawn another target',()=>{
  const {e,combat,tick}=setup();combat.damageTarget(e.target,99999);e.observe(combat.drainEvents());e.target.rootUntil=99;
  tick(1.8);assert.equal(e.respawns,1);assert.equal(e.target.generation,1);assert.equal(e.target.rootUntil,0);assert.equal(e.target.alive,true);
  combat.damageTarget(e.target,99999);e.observe(combat.drainEvents());e.stop();tick(2,{allowStart:false});assert.equal(e.respawns,1);assert.equal(e.target.alive,false);
});

test('timed Caitlyn retreat/re-entry yields clean trades while holding attack draws retaliation',()=>{
  const exercise=kite=>{
    const combat=new CaitlynCombat({level:6,attackSpeed:.8,targets:spacingTargets(),unlimitedMana:true});
    const player={x:0,z:0},moveTarget={...player},e=new SpacingEncounter({combat,random:seededRandom(12),difficulty:3});
    combat.playerHealth=combat.maxPlayerHealth=99999;
    if(!kite)combat.attackTarget(e.target.id);
    const step=allowStart=>{e.update(1/120,player,{allowStart});combat.update(1/120,player,moveTarget,325,{allowStart});e.observe(combat.drainEvents());};
    for(let i=0;i<3600;i++){
      if(kite&&!combat.windup){const dx=player.x-e.position.x,dz=player.z-e.position.z,d=Math.hypot(dx,dz),edge=d-130;
        if(combat.time>=combat.readyAt&&edge>=610&&edge<=650)combat.attackTarget(e.target.id);
        else if(edge<630||combat.time<combat.readyAt)combat.move({x:player.x+dx/d*100,z:player.z+dz/d*100});
        else if(edge>650)combat.move({x:player.x-dx/d*30,z:player.z-dz/d*30});
      }
      step(true);
    }
    e.stop();combat.endAttacks();for(let i=0;i<150;i++)step(false);
    assert.equal(e.pending,false);return e.summary();
  };
  const stationary=exercise(false),kiting=exercise(true);
  assert.ok(stationary.retaliationHits>=10);assert.ok(kiting.cleanHits>=8);
  assert.ok(kiting.cleanHits>stationary.cleanHits);assert.ok(kiting.retaliationHits<stationary.retaliationHits/3);
});

test('health reaches zero on an actual bullet hit and stopping drains without more attacks',()=>{
  const {e,combat,tick}=setup();e.position.z=-620;e.target.rootUntil=99;e.readyAt=0;combat.playerHealth=1;
  tick(.65);assert.equal(combat.playerHealth,0);assert.equal(e.retaliationHits,1);
  e.stop();combat.endAttacks();const releases=e.enemyReleases;tick(2,{allowStart:false});assert.equal(e.enemyReleases,releases);assert.equal(e.pending,false);
});

test('Lucian original movement and both AA clips remain complete finite grounded poses at every yaw',async()=>{
  const bytes=await fs.readFile(new URL('../public/assets/lucian/lucian.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const mixer=new THREE.AnimationMixer(gltf.scene),names=['lucian_idle_ready','lucian_run1','lucian_attack1','lucian_attack2'];
  for(let yaw=0;yaw<8;yaw++)for(const name of names){
    mixer.stopAllAction();gltf.scene.rotation.y=yaw*Math.PI/4;
    const clip=gltf.animations.find(c=>c.name===name);assert.equal(clip.tracks.length,255);mixer.clipAction(clip).reset().play();mixer.update(.16);
    gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
    const bounds=new THREE.Box3().setFromObject(gltf.scene,true);
    assert.ok([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite));assert.ok(bounds.min.y>-12&&bounds.max.y>160&&bounds.max.y<280);
  }
});
