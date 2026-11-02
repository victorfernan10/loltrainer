import {chromium} from '@playwright/test';
import fs from 'node:fs';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1680,height:945}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173');
await page.mouse.move(840,470);
await page.waitForFunction(()=>window.__modelLoaded&&window.__trainer?.targets.length===1&&window.__trainer.targets[0].visual&&window.__trainer.yone.mixer,{timeout:30000});
await page.evaluate(()=>{const y=__trainer.yone;y.aiEnabled=false;y.group.position.set(760,0,0);y.moveTarget.copy(y.group.position);y.mixer.stopAllAction();y.activeAction=null;y.attackAction=null;y.attackClock=0;y.launched=false;y.hits=0;y.mixer.clipAction(y.clips.find(c=>c.name==='yone_idle01')).reset().play();y.activeAction=y.mixer.clipAction(y.clips.find(c=>c.name==='yone_idle01'));y.aiEnabled=true;});
await page.waitForTimeout(80);
await page.screenshot({path:'tools/preview.png'});

const models=await page.evaluate(()=>({kayle:!!__trainer.model,yone:{name:__trainer.yone.name,visual:!!__trainer.yone.visual,clips:__trainer.yone.clips.map(c=>c.name),state:__trainer.yoneAnimationState,targets:__trainer.targets.length}}));
if(!models.kayle||models.yone.name!=='Yone'||!models.yone.visual||models.yone.targets!==1||!models.yone.clips.includes('yone_run01')||!models.yone.clips.includes('yone_attack01'))throw new Error(`Animated Yone model did not load: ${JSON.stringify(models)}`);

const yoneChase=await page.evaluate(()=>({start:Math.hypot(__trainer.position.x-__trainer.yone.group.position.x,__trainer.position.z-__trainer.yone.group.position.z),state:__trainer.yoneAnimationState}));
await page.waitForTimeout(160);
const yoneRunning=await page.evaluate(()=>({distance:Math.hypot(__trainer.position.x-__trainer.yone.group.position.x,__trainer.position.z-__trainer.yone.group.position.z),state:__trainer.yoneAnimationState,moving:__trainer.yone.moving,weapons:['mesh_0','mesh_0_5'].map(n=>__trainer.yone.visual.getObjectByName(n)?.visible),smears:['mesh_0_6','mesh_0_7'].map(n=>__trainer.yone.visual.getObjectByName(n)?.visible)}));
await page.evaluate(()=>{const y=__trainer.yone;y.group.position.set(303,0,0);y.moveTarget.copy(y.group.position);y.mixer.stopAllAction();y.activeAction=null;y.attackAction=null;y.attackClock=0;y.launched=false;y.hits=0;});
await page.waitForTimeout(1500);
const yoneCombat=await page.evaluate(()=>({distance:Math.hypot(__trainer.position.x-__trainer.yone.group.position.x,__trainer.position.z-__trainer.yone.group.position.z),hits:__trainer.yone.hits,state:__trainer.yoneAnimationState,as:__trainer.yoneAS,weaponMeshes:['mesh_0','mesh_0_5'].map(n=>__trainer.yone.visual.getObjectByName(n)?.visible),smears:['mesh_0_6','mesh_0_7'].map(n=>__trainer.yone.visual.getObjectByName(n)?.visible)}));
if(!yoneRunning.moving||yoneRunning.distance>=yoneChase.start||yoneRunning.state.attack||JSON.stringify(yoneRunning.weapons)!==JSON.stringify([false,true])||JSON.stringify(yoneRunning.smears)!==JSON.stringify([false,false])||yoneCombat.hits<1||!yoneCombat.state.attack||yoneCombat.as<.62||JSON.stringify(yoneCombat.weaponMeshes)!==JSON.stringify([false,true])||JSON.stringify(yoneCombat.smears)!==JSON.stringify([true,false]))throw new Error(`Yone chase/attack did not run correctly: ${JSON.stringify({yoneChase,yoneRunning,yoneCombat})}`);
const yoneFirstHitStarted=Date.now();
await page.evaluate(()=>{const y=__trainer.yone;__trainer.position.set(0,0,0);__trainer.target.copy(__trainer.position);y.group.position.set(303,0,0);y.moveTarget.copy(y.group.position);y.aiEnabled=true;y.mixer.stopAllAction();y.activeAction=null;y.attackAction=null;y.attackClock=0;y.retryDelay=0;y.launched=false;y.hits=0;});
await page.waitForFunction(()=>__trainer.yone.hits===1,{timeout:3000});
const yoneFirstHit={...await page.evaluate(()=>({hits:__trainer.yone.hits,as:__trainer.yoneAS,windup:.22/__trainer.yoneAS,period:1/__trainer.yoneAS,clock:__trainer.yone.attackClock})),elapsed:(Date.now()-yoneFirstHitStarted)/1000};
if(yoneFirstHit.hits!==1||yoneFirstHit.clock<yoneFirstHit.windup||yoneFirstHit.clock>=yoneFirstHit.period)throw new Error(`Yone first attack did not fire from a ready timer at windup timing: ${JSON.stringify(yoneFirstHit)}`);

const yoneDirections=await page.evaluate(async()=>{const y=__trainer.yone;__trainer.position.set(0,0,0);__trainer.target.copy(__trainer.position);y.aiEnabled=true;const cases=[{position:[230,0,0],yaw:-Math.PI/2},{position:[-230,0,0],yaw:Math.PI/2},{position:[0,0,230],yaw:Math.PI},{position:[0,0,-230],yaw:0}],results=[];for(const test of cases){y.group.position.fromArray(test.position);y.moveTarget.copy(y.group.position);y.model.rotation.y=0;y.mixer.stopAllAction();y.activeAction=null;y.attackAction=null;y.attackClock=0;y.launched=false;await new Promise(resolve=>setTimeout(resolve,1000));const difference=Math.atan2(Math.sin(y.model.rotation.y-test.yaw),Math.cos(y.model.rotation.y-test.yaw));results.push({actual:y.model.rotation.y,expected:test.yaw,error:Math.abs(difference),attack:__trainer.yoneAnimationState.attack});}return results;});
if(yoneDirections.some(r=>r.error>.12||!r.attack))throw new Error(`Yone attacks did not turn toward targets from all four directions: ${JSON.stringify(yoneDirections)}`);
const yoneMoveCancelsAttack=await page.evaluate(async()=>{const y=__trainer.yone;__trainer.position.set(0,0,0);__trainer.target.copy(__trainer.position);y.group.position.set(230,0,0);y.moveTarget.copy(y.group.position);y.model.rotation.y=0;y.aiEnabled=true;y.mixer.stopAllAction();y.activeAction=null;y.attackAction=null;y.attackClock=0;y.retryDelay=0;y.launched=false;y.hits=0;await new Promise(resolve=>setTimeout(resolve,120));__trainer.position.set(900,0,0);__trainer.target.copy(__trainer.position);await new Promise(resolve=>setTimeout(resolve,120));return {moving:y.moving,attack:__trainer.yoneAnimationState.attack,active:__trainer.yoneAnimationState.active,clock:y.attackClock,retryDelay:y.retryDelay,launched:y.launched,hits:y.hits};});
if(!yoneMoveCancelsAttack.moving||yoneMoveCancelsAttack.attack||yoneMoveCancelsAttack.active!=='yone_run01'||yoneMoveCancelsAttack.clock!==0||yoneMoveCancelsAttack.retryDelay!==.16||yoneMoveCancelsAttack.launched||yoneMoveCancelsAttack.hits!==0)throw new Error(`Yone kept attacking while chasing after Kayle left during windup: ${JSON.stringify(yoneMoveCancelsAttack)}`);
const yoneRetryDebounce=await page.evaluate(async()=>{const y=__trainer.yone;__trainer.position.set(0,0,0);__trainer.target.copy(__trainer.position);y.group.position.set(230,0,0);y.moveTarget.copy(y.group.position);y.mixer.stopAllAction();y.activeAction=null;y.attackAction=null;y.attackClock=0;y.retryDelay=.16;y.launched=false;y.hits=0;await new Promise(resolve=>setTimeout(resolve,50));const early={attack:__trainer.yoneAnimationState.attack,retryDelay:y.retryDelay};await new Promise(resolve=>setTimeout(resolve,200));return {early,attack:__trainer.yoneAnimationState.attack,retryDelay:y.retryDelay,moving:y.moving,clock:y.attackClock,distance:__trainer.position.distanceTo(y.group.position),hits:y.hits};});
if(yoneRetryDebounce.early.attack||yoneRetryDebounce.early.retryDelay<=0||!yoneRetryDebounce.attack||yoneRetryDebounce.retryDelay!==0)throw new Error(`Yone retry after an interrupted windup was not stabilized: ${JSON.stringify(yoneRetryDebounce)}`);
await page.evaluate(()=>{const y=__trainer.yone;__trainer.position.set(0,0,0);__trainer.target.copy(__trainer.position);y.aiEnabled=true;y.group.position.set(303,0,0);y.moveTarget.copy(y.group.position);y.mixer.stopAllAction();y.activeAction=null;y.attackAction=null;y.attackClock=0;y.retryDelay=0;y.launched=false;y.hits=0;});
await page.waitForFunction(()=>!!__trainer.yoneAnimationState.attack);
const yoneRangeHysteresis=await page.evaluate(async()=>{const y=__trainer.yone,started=__trainer.yoneAnimationState.attack;__trainer.position.set(315,0,0);__trainer.target.copy(__trainer.position);await new Promise(resolve=>setTimeout(resolve,100));return {started,attack:__trainer.yoneAnimationState.attack,active:__trainer.yoneAnimationState.active,moving:y.moving,distance:__trainer.position.distanceTo(y.group.position),hits:y.hits,clock:y.attackClock};});
if(!yoneRangeHysteresis.started||yoneRangeHysteresis.attack!==yoneRangeHysteresis.started||yoneRangeHysteresis.moving||yoneRangeHysteresis.hits!==0)throw new Error(`Yone toggled from attack to run during a small range fluctuation: ${JSON.stringify(yoneRangeHysteresis)}`);
const yoneMoveAfterHit=await page.evaluate(async()=>{const y=__trainer.yone;__trainer.position.set(0,0,0);__trainer.target.copy(__trainer.position);y.group.position.set(230,0,0);y.moveTarget.copy(y.group.position);y.model.rotation.y=0;y.aiEnabled=true;y.mixer.stopAllAction();y.activeAction=null;y.attackAction=y.mixer.clipAction(y.clips.find(c=>c.name==='yone_attack01')).reset().play();y.attackClock=.65;y.launched=true;y.hits=1;__trainer.position.set(900,0,0);__trainer.target.copy(__trainer.position);await new Promise(resolve=>setTimeout(resolve,160));return {moving:y.moving,hits:y.hits,attack:__trainer.yoneAnimationState.attack,active:__trainer.yoneAnimationState.active,launched:y.launched,clock:y.attackClock,weaponMeshes:['mesh_0','mesh_0_5','mesh_0_6','mesh_0_7'].map(n=>y.visual.getObjectByName(n)?.visible)};});
if(!yoneMoveAfterHit.moving||yoneMoveAfterHit.hits!==1||yoneMoveAfterHit.attack||yoneMoveAfterHit.active!=='yone_run01'||!yoneMoveAfterHit.launched||JSON.stringify(yoneMoveAfterHit.weaponMeshes)!==JSON.stringify([false,true,false,false]))throw new Error(`Yone kept the attack pose while moving after a hit: ${JSON.stringify(yoneMoveAfterHit)}`);
const yoneTurn=await page.evaluate(async()=>{const y=__trainer.yone;__trainer.position.set(900,0,0);__trainer.target.copy(__trainer.position);y.group.position.set(0,0,0);y.moveTarget.copy(y.group.position);y.model.rotation.y=-Math.PI/2;y.mixer.stopAllAction();y.activeAction=null;y.attackAction=null;y.attackClock=0;y.launched=false;const yaw=[];for(let i=0;i<10;i++){await new Promise(resolve=>requestAnimationFrame(resolve));yaw.push(y.model.rotation.y);}return {yaw,moving:y.moving,animation:__trainer.yoneAnimationState.active,ground:y.group.position.y,rootY:__trainer.yoneAnimationState.rootY};});
const yoneTurnSteps=yoneTurn.yaw.slice(1).map((value,i)=>Math.abs(Math.atan2(Math.sin(value-yoneTurn.yaw[i]),Math.cos(value-yoneTurn.yaw[i]))));
if(!yoneTurn.moving||yoneTurn.animation!=='yone_run01'||yoneTurn.ground!==0||yoneTurnSteps.some(step=>step>.7)||Math.abs(yoneTurn.yaw.at(-1)-Math.PI/2)>.08||yoneTurn.rootY<80)throw new Error(`Yone 180-degree chase turn was not smooth and grounded: ${JSON.stringify({yoneTurn,yoneTurnSteps})}`);
await page.evaluate(()=>{document.querySelector('#reset').click();__trainer.yone.aiEnabled=false;const unit=__trainer.targets[0];unit.group.position.set(250,0,0);});
const kayleFirstHitStarted=Date.now();
await page.evaluate(()=>{const unit=__trainer.targets[0];__trainer.attackMoveAt(unit.group.position.clone(),unit);});
await page.waitForFunction(()=>__trainer.attack.hits===1,{timeout:3000});
const kayleFirstHit={...await page.evaluate(()=>({hits:__trainer.attack.hits,as:__trainer.as,windup:.193555/__trainer.as,period:1/__trainer.as,clock:__trainer.attack.clock})),elapsed:(Date.now()-kayleFirstHitStarted)/1000};
if(kayleFirstHit.hits!==1||kayleFirstHit.clock<kayleFirstHit.windup||kayleFirstHit.clock>=kayleFirstHit.period)throw new Error(`Kayle first attack did not fire from a ready timer at windup timing: ${JSON.stringify(kayleFirstHit)}`);

await page.evaluate(()=>{__trainer.yone.aiEnabled=false;document.querySelector('#reset').click();});
await page.waitForTimeout(160);
const ranges=await page.evaluate(()=>{const setLevel=value=>{const el=document.querySelector('#level');el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));};const range=[],indicator=[];for(const level of [1,6,16]){setLevel(level);range.push(__trainer.attackRangeCenter);indicator.push(__trainer.attackRangeIndicator);}return {range,indicator,inside:[__trainer.withinAttackRange(280,150),__trainer.withinAttackRange(655,525),__trainer.withinAttackRange(756,626)],outside:[__trainer.withinAttackRange(280.01,150),__trainer.withinAttackRange(655.01,525),__trainer.withinAttackRange(756.01,626)],yoneInside:__trainer.withinAttackRange(305,175),yoneOutside:__trainer.withinAttackRange(305.01,175),collisionRadius:__trainer.yone.radius,restWeapons:['mesh_0','mesh_0_5','mesh_0_6','mesh_0_7'].map(n=>__trainer.yone.visual.getObjectByName(n)?.visible),recallProps:['mesh_0_3','mesh_0_8','mesh_0_9','mesh_0_10','mesh_0_11'].map(n=>__trainer.yone.visual.getObjectByName(n))};});
if(JSON.stringify(ranges.range)!==JSON.stringify([280,655,756])||JSON.stringify(ranges.indicator)!==JSON.stringify([215,590,691])||ranges.inside.some(v=>!v)||ranges.outside.some(Boolean)||!ranges.yoneInside||ranges.yoneOutside||ranges.collisionRadius!==65||JSON.stringify(ranges.restWeapons)!==JSON.stringify([false,true,false,false])||ranges.recallProps.some(Boolean))throw new Error(`Champion hitbox/range boundary mismatch: ${JSON.stringify(ranges)}`);
await page.evaluate(()=>{const el=document.querySelector('#level');el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));});

await page.evaluate(()=>__trainer.moveTo(__trainer.position.clone().set(0,0,-800)));
await page.waitForTimeout(100);
const turnPose=await page.evaluate(()=>__trainer.animationState);
if(turnPose.active!=='kayle_run1'||turnPose.rootY<80)throw new Error(`180-degree Kayle movement did not stay upright in its run animation: ${JSON.stringify(turnPose)}`);

await page.keyboard.press('s');
await page.locator('#reset').click();
await page.waitForTimeout(160);
await page.evaluate(()=>{const unit=__trainer.targets[0];unit.group.position.set(250,0,0);__trainer.attackMoveAt(unit.group.position.clone(),unit);});
await page.waitForTimeout(100);
const attackPose1=await page.evaluate(()=>__trainer.animationState);
await page.waitForTimeout(100);
const attackPose2=await page.evaluate(()=>__trainer.animationState);
const handMotion=attackPose1.hand?.reduce((sum,x,i)=>sum+Math.abs(x-attackPose2.hand[i]),0)||0;
if(attackPose1.attack!=='kayle_attack1'||attackPose1.rootY<80||handMotion<.02)throw new Error(`Kayle attack animation failed: ${JSON.stringify({attackPose1,attackPose2,handMotion})}`);

await page.keyboard.press('s');
await page.locator('#reset').click();
await page.evaluate(()=>{const unit=__trainer.targets[0];unit.group.position.set(0,0,-200);__trainer.model.rotation.y=0;__trainer.attackMoveAt(unit.group.position.clone(),unit);});
const attackTurns=[];
for(let i=0;i<15;i++){await page.waitForTimeout(80);attackTurns.push(await page.evaluate(()=>__trainer.model.rotation.y));}
const omnidirectional=await page.evaluate(()=>({yaw:__trainer.model.rotation.y,hits:__trainer.attack.hits,clock:__trainer.attack.clock,launched:__trainer.attack.launched,state:__trainer.animationState}));
if(Math.abs(omnidirectional.yaw)<2.8||omnidirectional.hits<1||attackTurns.some((yaw,i)=>i>0&&yaw<attackTurns[i-1]-.2))throw new Error(`Kayle did not turn smoothly through her attack: ${JSON.stringify({omnidirectional,attackTurns})}`);

await page.keyboard.press('s');
await page.locator('#reset').click();
const selection=await page.evaluate(()=>{const point=__trainer.position.clone().set(0,0,-720);document.querySelector('#targetPriority').value='cursor';__trainer.attackMoveAt(point.clone());const cursor=__trainer.targets.indexOf(__trainer.attack.unit);document.querySelector('#targetPriority').value='champion';__trainer.attackMoveAt(point.clone());const champion=__trainer.targets.indexOf(__trainer.attack.unit);return {cursor,champion,cameraOffset:__trainer.cameraOffset,targets:__trainer.targets.length};});
if(selection.cursor!==0||selection.champion!==0||selection.cameraOffset.up!==1510||selection.targets!==1)throw new Error(`Single-Yone selection/camera mismatch: ${JSON.stringify(selection)}`);

await page.locator('#reset').click();
await page.locator('#toggle').click();
await page.locator('#targetPriority').selectOption('cursor');
await page.locator('#gameCfgFile').setInputFiles({name:'game.cfg',mimeType:'text/plain',buffer:Buffer.from('[General]\nGameMouseSpeed=24\nEnableLeftMouseButtonAttackMove=0\nEnableTargetedAttackMove=0\n[HUD]\nMapScrollSpeed=0.75')});
await page.waitForFunction(()=>document.querySelector('#configStatus').textContent.includes('game.cfg'));
const importedCfg=await page.evaluate(()=>({mouseSpeed:document.querySelector('#mouseSpeed').value,bind:document.querySelector('#bindLeft').checked,priority:document.querySelector('#targetPriority').value}));
if(importedCfg.mouseSpeed!=='24'||importedCfg.bind||importedCfg.priority!=='champion')throw new Error(`game.cfg import failed: ${JSON.stringify(importedCfg)}`);
await page.locator('#persistedSettingsFile').setInputFiles({name:'PersistedSettings.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({files:[{name:'Game.cfg',sections:[{name:'General',settings:[{name:'GameMouseSpeed',value:16},{name:'EnableLeftMouseButtonAttackMove',value:1},{name:'EnableTargetedAttackMove',value:1}]}]}]}))});
await page.waitForFunction(()=>document.querySelector('#configStatus').textContent.includes('PersistedSettings.json'));
const importedJson=await page.evaluate(()=>({mouseSpeed:document.querySelector('#mouseSpeed').value,bind:document.querySelector('#bindLeft').checked,priority:document.querySelector('#targetPriority').value}));
if(importedJson.mouseSpeed!=='16'||!importedJson.bind||importedJson.priority!=='cursor')throw new Error(`PersistedSettings import failed: ${JSON.stringify(importedJson)}`);
await page.locator('#bindLeft').check();
await page.locator('#targetPriority').selectOption('cursor');

const clickAt=async(x,z)=>page.evaluate(({x,z})=>{const v=__trainer.position.clone().set(x,0,z).project(__trainer.camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};},{x,z});
await page.evaluate(()=>{__trainer.yone.group.position.set(620,0,0);});
const leftClickPoint=await clickAt(580,10);
await page.mouse.click(leftClickPoint.x,leftClickPoint.y);
let leftClickTarget=await page.evaluate(()=>__trainer.targets.indexOf(__trainer.attack.unit));
if(leftClickTarget!==0)throw new Error(`Bound left click did not select Yone: ${leftClickTarget}`);
await page.locator('#bindLeft').uncheck();
await page.locator('#reset').click();
await page.keyboard.press('a');
await page.mouse.click(leftClickPoint.x,leftClickPoint.y);
let aLeftTarget=await page.evaluate(()=>__trainer.targets.indexOf(__trainer.attack.unit));
if(aLeftTarget!==0)throw new Error(`A + left click did not select Yone: ${aLeftTarget}`);

await page.locator('#bindLeft').check();
await page.locator('#reset').click();
await page.evaluate(()=>__trainer.yone.group.position.set(250,0,0));
const sameSpot=await clickAt(0,100);
await page.mouse.click(sameSpot.x,sameSpot.y,{button:'right'});
await page.waitForTimeout(50);
await page.mouse.click(sameSpot.x,sameSpot.y);
const sameSpotOrder=await page.evaluate(()=>({target:__trainer.targets.indexOf(__trainer.attack.unit),moving:__trainer.position.distanceTo(__trainer.target)>2,marker:__trainer.lastClickMarkerColor}));
await page.waitForTimeout(1000);
Object.assign(sameSpotOrder,await page.evaluate(()=>({hits:__trainer.attack.hits,clock:__trainer.attack.clock,launched:__trainer.attack.launched,attack:__trainer.animationState,target:__trainer.targets.indexOf(__trainer.attack.unit)})));
if(sameSpotOrder.target!==0||sameSpotOrder.moving||sameSpotOrder.marker!=='eb625c'||sameSpotOrder.hits<1)throw new Error(`Same-spot right-click then left attack-move failed: ${JSON.stringify(sameSpotOrder)}`);

await page.locator('#reset').click();
await page.evaluate(()=>__trainer.yone.group.position.set(250,0,0));
await page.mouse.move(sameSpot.x,sameSpot.y);
await page.mouse.down({button:'right'});
await page.waitForTimeout(20);
await page.mouse.down({button:'left'});
const chordOrder=await page.evaluate(()=>({target:__trainer.targets.indexOf(__trainer.attack.unit),moving:__trainer.position.distanceTo(__trainer.target)>2,marker:__trainer.lastClickMarkerColor}));
await page.mouse.up({button:'left'});
await page.mouse.up({button:'right'});
await page.waitForTimeout(1000);
chordOrder.hits=await page.evaluate(()=>__trainer.attack.hits);
if(chordOrder.target!==0||chordOrder.moving||chordOrder.marker!=='eb625c'||chordOrder.hits<1)throw new Error(`Held-right + pressed-left attack-move failed: ${JSON.stringify(chordOrder)}`);

await page.locator('#bindLeft').check();
await page.evaluate(()=>{document.querySelector('#targetPriority').value='champion';for(const [id,value] of [['level','18'],['bonus','250']]){const input=document.querySelector(`#${id}`);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}__trainer.yone.group.position.set(900,0,0);});
const moveOrder=await clickAt(0,-400);
await page.mouse.click(moveOrder.x,moveOrder.y,{button:'right'});
const targetClick=await clickAt(0,450);
for(let i=0;i<28;i++){await page.mouse.click(targetClick.x,targetClick.y);await page.waitForTimeout(30);}
const boundKite=await page.evaluate(()=>({hits:__trainer.attack.hits,target:__trainer.targets.indexOf(__trainer.attack.unit),moving:__trainer.position.distanceTo(__trainer.target)>2,as:__trainer.as}));
if(boundKite.target!==0||boundKite.hits<2||boundKite.moving)throw new Error(`Bound left-click kiting failed at high attack speed: ${JSON.stringify(boundKite)}`);

await page.locator('#reset').click();
await page.evaluate(()=>{for(const [id,value] of [['level','1'],['bonus','0']]){const input=document.querySelector(`#${id}`);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('#targetPriority').value='cursor';});
await page.locator('#toggle').click();
const movePoint=await clickAt(500,300);
await page.mouse.click(movePoint.x,movePoint.y,{button:'right'});
await page.waitForTimeout(250);
const moving=await page.evaluate(()=>({position:__trainer.position.toArray(),target:__trainer.target.toArray(),distance:document.getElementById('distance').textContent}));
await page.keyboard.press('s');
const stop=await page.evaluate(()=>__trainer.position.toArray());
await page.waitForTimeout(200);
const stopped=await page.evaluate(()=>__trainer.position.toArray());
if(JSON.stringify(stop)!==JSON.stringify(stopped))throw new Error('Stop command failed');
if(Math.hypot(moving.position[0],moving.position[2])<1)throw new Error(`Kayle movement failed: ${JSON.stringify(moving)}`);
await page.locator('#toggle').click();
await page.locator('#form').selectOption('11');
await page.waitForTimeout(400);
await page.screenshot({path:'tools/preview-level11.png'});

const result={models,yoneChase,yoneRunning,yoneCombat,yoneFirstHit,yoneMoveCancelsAttack,yoneRetryDebounce,yoneRangeHysteresis,yoneMoveAfterHit,yoneTurn,kayleFirstHit,ranges,turnPose,attackPose1,attackPose2,omnidirectional,selection,importedCfg,importedJson,leftClickTarget,aLeftTarget,sameSpotOrder,chordOrder,boundKite,moving,stop,errors};
console.log(result);
fs.writeFileSync('tools/browser-check.json',JSON.stringify(result,null,2));
await browser.close();
if(errors.length)process.exitCode=1;
