import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(()=>window.__modelLoaded&&__trainer.loadedEnemies.length===5&&__trainer.combatReady,{timeout:30000});
  await page.click('button[data-drill="combat"]');await page.uncheck('#combatHazards');
  await page.locator('#attackSpeed').fill('2.5');await page.locator('#attackSpeed').dispatchEvent(new Event('input').type);
  await page.screenshot({path:'tools/combat-setup.png'});
  await page.click('#startChallenge');
  await page.waitForFunction(()=>!!__trainer.combat);
  // Press LMB before releasing RMB, matching the original multi-button bug.
  await page.mouse.move(760,510);await page.mouse.down({button:'right'});await page.mouse.down({button:'left'});await page.mouse.up({button:'left'});await page.mouse.up({button:'right'});
  await page.waitForFunction(()=>__trainer.combat.hits>=2,{timeout:5000});
  const afterChord=await page.evaluate(()=>({order:__trainer.combat.order.type,summary:__trainer.combat.summary(),animation:__trainer.attackAnimation}));
  assert.equal(afterChord.order,'attackMove');assert.ok(afterChord.animation.name.includes('attack'));
  const cancellations=afterChord.summary.cancelled;
  for(let i=0;i<12;i++)await page.mouse.click(760,510);
  assert.equal(await page.evaluate(()=>__trainer.combat.cancelled),cancellations,'Jitter-clicking the same target must not restart its attack');
  await page.screenshot({path:'tools/combat-live.png'});
  await page.keyboard.press('Escape');
  const pause=await page.evaluate(()=>JSON.stringify({time:__trainer.combat.time,windup:__trainer.combat.windup,bolts:__trainer.combat.bolts,animation:__trainer.attackAnimation,position:__trainer.position}));
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>JSON.stringify({time:__trainer.combat.time,windup:__trainer.combat.windup,bolts:__trainer.combat.bolts,animation:__trainer.attackAnimation,position:__trainer.position})),pause);
  await page.keyboard.press('Escape');await page.click('#finishSession');
  await page.waitForFunction(()=>document.querySelector('#results').open,{timeout:5000});
  const report=await page.evaluate(()=>JSON.parse(localStorage.getItem('kayle:training-history:v1')).at(-1));
  assert.ok(report.summary.combat.damage>0);assert.equal(report.summary.total,0);
  assert.equal(await page.locator('.review-layout').isVisible(),false);
  await page.screenshot({path:'tools/combat-results.png'});
  await page.click('#closeResults');

  await page.click('button[data-drill="combat"]');await page.uncheck('#bindLeft');await page.selectOption('#attackPriority','champion');await page.click('#startChallenge');
  await page.mouse.click(760,510);await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>__trainer.combat.started),0);
  await page.keyboard.press('KeyA');await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>__trainer.attackArmed),true);
  await page.screenshot({path:'tools/combat-range.png'});
  await page.mouse.click(760,510);await page.waitForFunction(()=>__trainer.combat.hits>0,{timeout:4000});assert.equal(await page.evaluate(()=>__trainer.attackArmed),false);
  const targetScreen=await page.evaluate(()=>{const t=__trainer.combat.target('ryze-2'),p=__trainer.position.clone().set(t.position.x,120,t.position.z).project(__trainer.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
  await page.mouse.click(targetScreen.x,targetScreen.y,{button:'right'});
  assert.equal(await page.evaluate(()=>__trainer.combat.order.targetId),'ryze-2');

  const config={drill:'combat',difficulty:2,duration:60,speed:335,closeRadius:150,pace:1,seed:7,skills:['ezrealQ'],level:1,attackSpeed:1.5,bindLeft:true,combatHazards:false,attackPriority:'cursor'};
  await page.evaluate(c=>{__trainer.start(c);__trainer.attackTarget('ryze-1');},config);
  await page.waitForFunction(()=>__trainer.combat.hits>0,{timeout:5000});
  assert.equal(await page.evaluate(()=>__trainer.combat.range),150);assert.ok(!(await page.evaluate(()=>__trainer.attackAnimation.name)).includes('ranged'));
  const melee=await page.evaluate(()=>({position:__trainer.position.toArray(),health:__trainer.combat.target('ryze-1').health}));
  assert.ok(Math.hypot(melee.position[0],melee.position[2])>0);
  await page.screenshot({path:'tools/combat-melee.png'});

  await page.evaluate(c=>{__trainer.start({...c,level:6,combatHazards:true});__trainer.combat.playerHealth=100;__trainer.spawn('ezrealQ');},config);
  await page.waitForFunction(()=>__trainer.session.state==='finished',{timeout:8000});
  assert.equal(await page.evaluate(()=>__trainer.session.summary().combat.playerHealth),0);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({overlappingButtons:'attack command honored',jitterClick:'no extra cancellations',afterChord,pause:'frozen',warmupReport:report.summary.combat,aClick:'range stays until LMB',directTarget:'right-click works',melee,damage:'incoming skill ends session at zero health',errors},null,2));
}catch(error){await page.screenshot({path:'tools/combat-failure.png'});console.log(await page.evaluate(()=>({state:__trainer.session?.state,controls:document.querySelector('#controls').hidden,drill:document.body.dataset.drill})));throw error;}finally{await browser.close();}
