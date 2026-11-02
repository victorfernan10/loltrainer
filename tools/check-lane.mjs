import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.text().includes('PropertyBinding'))errors.push(m.text());});
try{
  await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__modelLoaded&&__trainer.combatReady,null,{timeout:90000});
  await page.selectOption('#championSelect','syndra');await page.waitForFunction(()=>__trainer.champion==='syndra'&&!__trainer.championLoading);
  await page.click('[data-drill=lane]');assert.equal(await page.locator('#laneSettings').isVisible(),true);
  await page.click('#startChallenge');await page.waitForFunction(()=>!!__trainer.lane,null,{timeout:90000});
  await page.waitForFunction(()=>__trainer.laneVisual.units===14);
  await page.evaluate(()=>{window.laneTestEvents=[];const old=__trainer.combat.drainEvents.bind(__trainer.combat);__trainer.combat.drainEvents=()=>{const events=old();window.laneTestEvents.push(...JSON.parse(JSON.stringify(events)));return events;};});
  assert.equal(await page.evaluate(()=>__trainer.combat.targets.length),8);
  await page.locator('#arena').focus();await page.waitForTimeout(500);
  await page.screenshot({path:'tools/lane-overview.png'});
  // Deterministic low-health fixture supplements the full-wave simulation tests.
  await page.evaluate(()=>{const l=__trainer.lane;for(const m of l.minions){m.readyAt=999;m.action=null;}Object.assign(l.position,{x:0,z:-700});l.goal={...l.position};l.nextDecision=999;const m=l.minion('lane-blue-0');Object.assign(m.position,{x:0,z:-250});m.health=62;});
  await page.waitForFunction(()=>!!__trainer.lane.action);
  await page.evaluate(()=>{const p=__trainer.lane.position;__trainer.castAbility('Q',{...p});});
  await page.waitForFunction(()=>__trainer.lane.summary().enemyDamage>0);
  await page.keyboard.press('Escape');await page.screenshot({path:'tools/lane-poke.png'});
  const state=await page.evaluate(()=>({time:__trainer.lane.time,summary:__trainer.lane.summary(),visual:__trainer.laneVisual,units:__trainer.lane.minions.length}));
  assert.equal(state.summary.hits,1);assert.equal(state.units,14);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>__trainer.lane.time),state.time);
  await page.evaluate(()=>{const l=__trainer.lane;for(const m of l.minions.filter(m=>m.team==='red').slice(0,3))l.damageMinion(m,999,'player');});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>__trainer.lane.wave===2);assert.equal(await page.evaluate(()=>__trainer.lane.minions.every(m=>m.alive&&m.health===m.maxHealth)),true);
  await page.screenshot({path:'tools/lane-original-minions.png'});
  await page.click('#finishSession');await page.waitForFunction(()=>document.querySelector('#results').open,null,{timeout:20000});
  assert.match(await page.locator('#resultMetrics').textContent(),/Pokes na janela/);
  await page.click('#closeResults');assert.equal(await page.locator('#laneHud').isVisible(),false);
  await page.click('[data-drill=combat]');await page.click('#startChallenge');await page.waitForFunction(()=>__trainer.combat&&!__trainer.lane);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({state,errors},null,2));
}catch(error){await page.screenshot({path:'tools/lane-failure.png'});console.log({errors,state:await page.evaluate(()=>({status:document.querySelector('#status').textContent,lane:__trainer.lane?.summary(),session:__trainer.session?.state}))});throw error;}finally{await browser.close();}
