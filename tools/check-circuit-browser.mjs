import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(()=>window.__modelLoaded&&__trainer.combatReady);
  await page.selectOption('#trainingProfile','assisted');await page.click('button[data-drill="combat"]');await page.uncheck('#combatHazards');
  await page.selectOption('#difficulty','1');await page.selectOption('#level','6');
  await page.click('#startChallenge');await page.waitForFunction(()=>!!__trainer.combat);
  // Real cursor-priority attack move, projected to target ground position.
  const screen=await page.evaluate(()=>{const p=__trainer.position.clone().set(-260,0,-240).project(__trainer.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
  await page.mouse.click(screen.x,screen.y);await page.waitForFunction(()=>__trainer.combat.released===1);
  await page.keyboard.press('KeyE');await page.waitForFunction(()=>__trainer.combat.completedMarks>=1);
  await page.waitForFunction(()=>__trainer.combat.hits>=2);
  const result=await page.evaluate(()=>__trainer.combat.summary());
  assert.equal(result.eUses,1);assert.equal(result.resets,1);assert.ok(result.damage>=180);assert.ok(result.priorityHits>=2);
  assert.equal(await page.evaluate(()=>__trainer.combat.markedId),'ryze-2');
  await page.evaluate(()=>{__trainer.combat.playerHealth=800;});await page.keyboard.press('KeyW');
  assert.equal(await page.evaluate(()=>__trainer.combat.playerHealth),860);assert.equal(await page.evaluate(()=>__trainer.combat.speedMultiplier),1.3);
  await page.keyboard.press('KeyW');assert.equal(await page.evaluate(()=>__trainer.combat.wUses),1);
  await page.keyboard.press('Escape');const frozen=await page.evaluate(()=>JSON.stringify({time:__trainer.combat.time,e:__trainer.combat.eReadyAt,w:__trainer.combat.wReadyAt,mark:__trainer.combat.markedUntil}));
  await page.keyboard.press('KeyE');await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>JSON.stringify({time:__trainer.combat.time,e:__trainer.combat.eReadyAt,w:__trainer.combat.wReadyAt,mark:__trainer.combat.markedUntil})),frozen);
  await page.screenshot({path:'tools/combat-circuit.png'});
  await page.keyboard.press('Escape');await page.click('#finishSession');await page.waitForFunction(()=>document.querySelector('#results').open);
  assert.match(await page.locator('#combatResults').textContent(),/APM/);assert.match(await page.locator('#combatResults').textContent(),/E: 1 usos/);
  await page.screenshot({path:'tools/combat-circuit-results.png'});assert.deepEqual(errors,[]);
  console.log(JSON.stringify({keyboard:'E/W accepted, cooldown and pause respected',circuit:result,errors},null,2));
}finally{await browser.close();}
