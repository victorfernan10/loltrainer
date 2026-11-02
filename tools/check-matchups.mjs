import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/PropertyBinding/.test(m.text()))errors.push(m.text());});
try{
  await page.goto('http://127.0.0.1:5173',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__modelLoaded,null,{timeout:90000});
  const results=[];
  for(const champion of ['ahri','locke']){
    await page.click(`button[data-drill=${champion}]`);assert.equal(await page.locator('#matchupSettings').isVisible(),true);
    await page.click('#startChallenge');await page.waitForFunction(()=>__trainer.matchup?.action,null,{timeout:90000});
    await page.keyboard.press('Escape');await page.screenshot({path:`tools/${champion}-challenge.png`});
    const frozen=await page.evaluate(()=>JSON.stringify([__trainer.matchup.time,__trainer.matchupVisual.animationTime]));await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>JSON.stringify([__trainer.matchup.time,__trainer.matchupVisual.animationTime])),frozen);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>__trainer.matchup?.projectiles.some(p=>p.travelled>180));
    await page.keyboard.press('Escape');await page.screenshot({path:`tools/${champion}-projectile.png`});await page.keyboard.press('Escape');
    await page.waitForFunction(()=>__trainer.matchup?.rounds>=2,null,{timeout:30000});
    const state=await page.evaluate(()=>({champion:__trainer.matchup.champion,visual:__trainer.matchupVisual,shots:__trainer.session.shots.filter(s=>s.resolved).map(s=>s.skill)}));results.push(state);
    assert.ok(state.shots.includes(champion==='ahri'?'ahriQReturn':'lockeQ3'));
    assert.ok(state.visual.weight>0);assert.ok(state.visual.meshes.length>0);
    await page.click('#finishSession');await page.waitForFunction(()=>document.querySelector('#results').open,null,{timeout:20000});assert.match(await page.locator('#resultTitle').textContent(),/./);
    await page.click('#retryShot');await page.waitForFunction(()=>__trainer.session.config.rehearsal);await page.waitForFunction(()=>document.querySelector('#results').open,null,{timeout:20000});
    await page.click('#closeResults');assert.equal(await page.locator('#matchupHud').isVisible(),false);
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors},null,2));
}catch(error){await page.screenshot({path:'tools/matchup-failure.png'});console.log({errors,state:await page.evaluate(()=>({phase:__trainer.matchup?.phase,visual:__trainer.matchupVisual,session:__trainer.session?.state}))});throw error;}finally{await browser.close();}
