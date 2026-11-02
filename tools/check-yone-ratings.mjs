import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('http://127.0.0.1:5173',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__modelLoaded&&__trainer.yoneReady&&__trainer.combatReady,null,{timeout:90000});
  await page.click('button[data-drill=yone]');assert.equal(await page.locator('#difficulty').inputValue(),'1');assert.equal(await page.locator('#yoneBonusAS').count(),0);
  const ratings=[];
  for(const [difficulty,bonus,q] of [[1,0,3.12],[2,.3,2.4],[3,.66,1.54]]){
    await page.selectOption('#difficulty',String(difficulty));await page.selectOption('#yonePattern','full');await page.click('#startChallenge');
    const values=await page.evaluate(()=>({bonus:__trainer.yone.bonusAS,as:__trainer.yone.attackSpeed,q:__trainer.yone.qCooldown,version:__trainer.session.config.yoneRatingVersion}));assert.equal(values.bonus,bonus);assert.equal(values.q,q);assert.equal(values.version,4);ratings.push(values);
    if(difficulty<3){await page.click('#reset');await page.click('button[data-drill=yone]');}
  }
  await page.waitForFunction(()=>__trainer.yone.phase==='r'&&__trainer.yoneVisual.clip==='yone_spell4_in');await page.keyboard.press('Escape');
  const r=await page.evaluate(()=>({duration:__trainer.yone.action.releaseAt-__trainer.yone.action.startedAt,rate:__trainer.yoneVisual.rate,remaining:__trainer.yone.action.releaseAt-__trainer.yone.time}));assert.ok(Math.abs(r.duration-.75)<1e-8);assert.ok(Math.abs(r.rate-1.633333444595337/.75)<1e-6);assert.ok(r.remaining>0);
  assert.match(await page.locator('#yonePhase').textContent(),/CONJURANDO/);await page.screenshot({path:'tools/yone-r-preparation.png'});await page.keyboard.press('Escape');
  await page.waitForFunction(()=>__trainer.yone.phase==='r-impact');await page.click('#finishSession');await page.waitForFunction(()=>document.querySelector('#results').open);
  const report=await page.evaluate(()=>JSON.parse(localStorage.getItem('kayle:training-history:v1')).at(-1));assert.equal(report.config.yoneRatingVersion,4);assert.equal(report.config.difficulty,3);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({ratings,r,errors},null,2));
}catch(e){console.log({errors});await page.screenshot({path:'tools/yone-ratings-failure.png'});throw e;}finally{await browser.close();}
