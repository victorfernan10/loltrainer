import {chromium} from '@playwright/test';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1680,height:945}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
await page.goto('http://127.0.0.1:5173');
await page.waitForFunction(()=>window.__modelLoaded&&__trainer.loadedEnemies.length===5,{timeout:30000});
await page.mouse.move(840,470);
await page.waitForTimeout(200);
await page.waitForFunction(()=>__trainer.enemyAnimations.every(enemy=>enemy.skinnedMeshes>0&&enemy.clips>0));
await page.waitForTimeout(900);
const loaded=await page.evaluate(()=>({enemies:__trainer.loadedEnemies,animations:__trainer.enemyAnimations,stats:__trainer.stats,controls:document.querySelectorAll('[data-skill]').length}));
if(loaded.enemies.length!==5||loaded.controls!==5)throw new Error(`Dodge arena did not load every champion/ability: ${JSON.stringify(loaded)}`);
if(loaded.animations.some(enemy=>!enemy.action?.toLowerCase().includes('idle')||enemy.time<=0||enemy.idleWeight<.99||!enemy.idleRunning))throw new Error(`Official idle animations are not active on every champion: ${JSON.stringify(loaded.animations)}`);
if(loaded.animations.some(enemy=>!enemy.runClip||enemy.runTracks<=0))throw new Error(`Official run animations are missing on a champion: ${JSON.stringify(loaded.animations)}`);
if(loaded.animations.some(enemy=>!enemy.castClip||enemy.castDuration<=0))throw new Error(`Official cast animations are missing on a champion: ${JSON.stringify(loaded.animations)}`);
const scaleCheck=await page.evaluate(()=>__trainer.enemies.filter(enemy=>['Nautilus','Thresh'].includes(enemy.name)).map(enemy=>({name:enemy.name,height:enemy.labelHeight-28})));
if(scaleCheck.some(enemy=>enemy.height<(enemy.name==='Nautilus'?270:260)))throw new Error(`Nautilus/Thresh visual scale was not increased: ${JSON.stringify(scaleCheck)}`);
await page.screenshot({path:'tools/dodge-preview.png'});
const turnStart=await page.evaluate(()=>{const enemy=__trainer.enemies.find(item=>item.name==='Xerath');const start=enemy.group.rotation.y;enemy.targetYaw=start+Math.PI;return start;});
await page.waitForTimeout(120);
const turnProgress=await page.evaluate(start=>{const enemy=__trainer.enemies.find(item=>item.name==='Xerath'),delta=enemy.group.rotation.y-start;enemy.targetYaw=start;return Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)));},turnStart);
if(turnProgress<.02||turnProgress>Math.PI-.02)throw new Error(`Champion turn was not a smooth 180-degree rotation: ${turnProgress}`);

await page.evaluate(()=>{document.querySelector('#reset').click();__trainer.position.set(320,0,270);__trainer.target.copy(__trainer.position);__trainer.spawn('luxR');});
const warning=await page.evaluate(()=>({name:document.querySelector('#incomingName').textContent,remaining:__trainer.warnings[0]?.remaining,kind:__trainer.warnings[0]?.skill.kind,visuals:__trainer.visualDiagnostics}));
if(!warning.name.includes('LUX')||!warning.name.toUpperCase().includes('FINAL SPARK')||Math.abs(warning.remaining-.5)>.06||warning.kind!=='beam')throw new Error(`Lux R warning did not start with the required half-second tell: ${JSON.stringify(warning)}`);
if(warning.visuals.playerRingHitbox||warning.visuals.warningTargetMarkers||warning.visuals.telegraphWidths.some(width=>width>20))throw new Error(`Visible gameplay hitbox leaked into the scene: ${JSON.stringify(warning.visuals)}`);
const luxCasting=await page.evaluate(()=>__trainer.enemyAnimations.find(enemy=>enemy.name==='Lux'));
if(!luxCasting.casting||!luxCasting.action.includes('spell4'))throw new Error(`Lux R did not trigger its official R casting animation: ${JSON.stringify(luxCasting)}`);
await page.waitForTimeout(150);
const blend=await page.evaluate(()=>{const lux=__trainer.enemyAnimations.find(enemy=>enemy.name==='Lux');return {idle:lux.idleWeight,cast:lux.castWeight,action:lux.action};});
if(blend.idle<=0||blend.cast<=0)throw new Error(`Lux cast is not cross-fading smoothly from idle: ${JSON.stringify(blend)}`);
const aimAlignment=await page.evaluate(()=>{const w=__trainer.warnings[0],dx=w.endpoint.x-w.origin.x,dz=w.endpoint.z-w.origin.z,expected=Math.atan2(dx,dz),enemy=__trainer.enemies.find(item=>item.name==='Lux'),angle=Math.atan2(Math.sin(enemy.group.rotation.y-expected),Math.cos(enemy.group.rotation.y-expected)),lane=w.lane,theta=lane.rotation.y,end={x:lane.position.x-Math.sin(theta)*w.length,z:lane.position.z-Math.cos(theta)*w.length};return {laneHeight:lane.position.y,laneEndpointError:Math.hypot(end.x-w.endpoint.x,end.z-w.endpoint.z),championFacingError:Math.abs(angle)};});
if(aimAlignment.laneHeight>2||aimAlignment.laneEndpointError>1||aimAlignment.championFacingError>.15)throw new Error(`Skill tell, hit path, and caster direction diverged: ${JSON.stringify(aimAlignment)}`);
await page.screenshot({path:'tools/dodge-cast-preview.png'});
await page.waitForFunction(()=>__trainer.stats.hits===1,{timeout:3000});
await page.waitForFunction(()=>{const lux=__trainer.enemyAnimations.find(enemy=>enemy.name==='Lux');return !lux.casting&&lux.action.toLowerCase().includes('idle')&&lux.idleRunning&&lux.idleWeight>.99;},{timeout:3000});
const luxHit=await page.evaluate(()=>__trainer.stats);
if(luxHit.hits!==1||luxHit.casts!==1)throw new Error(`Lux R did not register its beam hit: ${JSON.stringify(luxHit)}`);
await page.evaluate(()=>{document.querySelector('#reset').click();__trainer.spawn('luxR');const warning=__trainer.warnings[0],side=new (window.THREE?.Vector3||Object.getPrototypeOf(__trainer.position).constructor)(warning.direction.z,0,-warning.direction.x);__trainer.moveTo(__trainer.position.clone().addScaledVector(side,350));});
await page.waitForFunction(()=>__trainer.stats.hits+__trainer.stats.dodged===1,{timeout:3000});
const luxDodge=await page.evaluate(()=>__trainer.stats);
if(luxDodge.hits!==0||luxDodge.dodged!==1)throw new Error(`Kayle could not sidestep Lux R during its tell: ${JSON.stringify(luxDodge)}`);

const stationaryHits={luxR:luxHit};
const officialCastStarts={Lux:luxCasting.action};
for(const id of ['xerathQ','nautilusQ','threshQ','ezrealQ']){
  await page.evaluate(skill=>{document.querySelector('#reset').click();__trainer.spawn(skill);},id);
  if(id==='nautilusQ'){
    const launch=await page.evaluate(()=>{const warning=__trainer.warnings[0],enemy=warning.enemy;return {offset:Math.hypot(warning.origin.x-enemy.group.position.x,warning.origin.z-enemy.group.position.z),height:145};});
    if(launch.offset>.01)throw new Error(`Nautilus Q did not start at the caster center: ${JSON.stringify(launch)}`);
  }
  const caster=await page.evaluate(skill=>{const champion={xerathQ:'Xerath',nautilusQ:'Nautilus',threshQ:'Thresh',ezrealQ:'Ezreal'}[skill];return __trainer.enemyAnimations.find(enemy=>enemy.name===champion);},id);
  if(id==='nautilusQ'){await page.waitForFunction(()=>__trainer.projectiles.length===1,{timeout:1500});await page.screenshot({path:'tools/nautilus-q-axis-forward-preview.png'});}
  if(id==='xerathQ'){await page.waitForFunction(()=>__trainer.stats.hits+__trainer.stats.dodged===1,{timeout:1500});await page.screenshot({path:'tools/xerath-q-preview.png'});}
  const casterPosition=await page.evaluate(skill=>{const champion={xerathQ:'Xerath',nautilusQ:'Nautilus',threshQ:'Thresh',ezrealQ:'Ezreal'}[skill];return __trainer.enemies.find(enemy=>enemy.name===champion).group.position.toArray();},id);
  if(!caster.casting||!caster.action.toLowerCase().includes('spell1'))throw new Error(`${id} did not trigger its official Q cast animation: ${JSON.stringify(caster)}`);
  officialCastStarts[caster.name]=caster.action;
  await page.waitForFunction(()=>__trainer.stats.hits===1||__trainer.stats.dodged===1,{timeout:4000});
  stationaryHits[id]=await page.evaluate(()=>__trainer.stats);
  if(stationaryHits[id].hits!==1||stationaryHits[id].casts!==1)throw new Error(`${id} did not hit a stationary Kayle: ${JSON.stringify(stationaryHits[id])}`);
  try{
    await page.waitForFunction(skill=>{const champion={xerathQ:'Xerath',nautilusQ:'Nautilus',threshQ:'Thresh',ezrealQ:'Ezreal'}[skill],enemy=__trainer.enemyAnimations.find(item=>item.name===champion);return !enemy.casting&&enemy.action.toLowerCase().includes('idle')&&enemy.idleRunning&&enemy.idleWeight>.99;},id,{timeout:8000});
  }catch(error){
    const state=await page.evaluate(skill=>{const champion={xerathQ:'Xerath',nautilusQ:'Nautilus',threshQ:'Thresh',ezrealQ:'Ezreal'}[skill];return __trainer.enemyAnimations.find(item=>item.name===champion);},id);
    throw new Error(`${id} did not return to a running idle animation: ${JSON.stringify(state)}`,{cause:error});
  }
  const idleStart=await page.evaluate(skill=>{const champion={xerathQ:'Xerath',nautilusQ:'Nautilus',threshQ:'Thresh',ezrealQ:'Ezreal'}[skill];const enemy=__trainer.enemyAnimations.find(item=>item.name===champion);return {time:enemy.time,duration:enemy.idleDuration};},id);
  await page.waitForTimeout(250);
  const idleEnd=await page.evaluate(skill=>{const champion={xerathQ:'Xerath',nautilusQ:'Nautilus',threshQ:'Thresh',ezrealQ:'Ezreal'}[skill];const enemy=__trainer.enemyAnimations.find(item=>item.name===champion);return {time:enemy.time,duration:enemy.idleDuration,running:enemy.idleRunning,weight:enemy.idleWeight};},id);
  const idleAdvance=(idleEnd.time-idleStart.time+idleEnd.duration)%idleEnd.duration;
  if(!idleEnd.running||idleEnd.weight<.99||idleAdvance<.05)throw new Error(`${id} idle stopped advancing after its cast: ${JSON.stringify({idleStart,idleEnd,idleAdvance})}`);
  const casterPositionAfter=await page.evaluate(skill=>{const champion={xerathQ:'Xerath',nautilusQ:'Nautilus',threshQ:'Thresh',ezrealQ:'Ezreal'}[skill];return __trainer.enemies.find(enemy=>enemy.name===champion).group.position.toArray();},id);
  if(casterPosition.some((value,index)=>Math.abs(value-casterPositionAfter[index])>.001))throw new Error(`${id} moved its champion away from its fixed arena position: ${JSON.stringify({casterPosition,casterPositionAfter})}`);
}

await page.evaluate(()=>{document.querySelector('#reset').click();__trainer.spawn('ezrealQ');});
await page.waitForFunction(()=>__trainer.warnings.length===1);
await page.evaluate(()=>{const w=__trainer.warnings[0],d=w.direction;__trainer.position.set(d.z*420,0,-d.x*420);__trainer.target.copy(__trainer.position);});
await page.waitForFunction(()=>__trainer.stats.dodged===1||__trainer.stats.hits===1,{timeout:3000});
const ezrealDodge=await page.evaluate(()=>__trainer.stats);
if(ezrealDodge.hits!==0||ezrealDodge.dodged!==1)throw new Error(`Ezreal Q should miss Kayle after she leaves the marked line: ${JSON.stringify(ezrealDodge)}`);

await page.evaluate(()=>{document.querySelector('#reset').click();document.querySelector('#startChallenge').click();});
await page.waitForFunction(()=>__trainer.wave.active.length>=1&&__trainer.wave.active.length<=2,{timeout:3000});
const waveEntry=await page.evaluate(()=>{const names=__trainer.wave.active;return {names,enemies:__trainer.enemies.filter(enemy=>names.includes(enemy.name)).map(enemy=>({name:enemy.name,visible:enemy.group.visible,moving:enemy.moving,action:enemy.action?.getClip().name}))};});
if(waveEntry.enemies.some(enemy=>!enemy.visible||!enemy.moving||!enemy.action.toLowerCase().includes('run')))throw new Error(`Incoming enemy did not enter with its run animation: ${JSON.stringify(waveEntry)}`);
await page.screenshot({path:'tools/dodge-wave-preview.png'});
await page.waitForFunction(()=>__trainer.warnings.length>=1,{timeout:6000});
const active=await page.evaluate(()=>({active:__trainer.stats.challengeActive,warning:__trainer.warnings[0]?.skill.id,remaining:__trainer.warnings[0]?.remaining,aimMode:__trainer.warnings[0]?.aimMode,wave:__trainer.wave}));
if(!active.active||!active.warning||active.remaining>.5||!['current','lead'].includes(active.aimMode))throw new Error(`Challenge did not schedule an incoming ability from its moving wave: ${JSON.stringify(active)}`);
const waveCaster=await page.evaluate(()=>__trainer.warnings[0].enemy.name);
try{await page.waitForFunction(name=>!__trainer.enemies.find(enemy=>enemy.name===name).group.visible,waveCaster,{timeout:8000});}
catch(error){const state=await page.evaluate(name=>({enemy:__trainer.enemyAnimations.find(enemy=>enemy.name===name),wave:__trainer.wave,warnings:__trainer.warnings.map(warning=>({skill:warning.skill.id,remaining:warning.remaining,name:warning.enemy.name})),stats:__trainer.stats}),waveCaster);throw new Error(`One-shot caster did not disappear after casting: ${JSON.stringify(state)}`,{cause:error});}
if(errors.length)throw new Error(`Browser console errors: ${JSON.stringify(errors)}`);
console.log(JSON.stringify({loaded,officialCastStarts,turnProgress,warning,aimAlignment,stationaryHits,ezrealDodge,active,errors},null,2));
await browser.close();
