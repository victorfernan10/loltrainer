import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],warnings=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warn'&&/PropertyBinding|track|bone/.test(m.text()))warnings.push(m.text());});
const config={champion:'kayle',drill:'yone',difficulty:2,duration:60,speed:335,closeRadius:150,pace:1,seed:8,skills:[],level:6,attackSpeed:1.5,bindLeft:true,combatHazards:false,combatCircuit:'off',attackPriority:'cursor',yonePattern:'full',yoneBonusAS:80,yoneStacks:2,yoneTelegraphs:true};
try{
  await page.goto('http://127.0.0.1:5173',{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.__modelLoaded&&__trainer.yoneReady&&__trainer.combatReady,null,{timeout:90000});
  await page.click('[data-drill=yone]');assert.equal(await page.locator('#yoneSettings').isVisible(),true);
  await page.evaluate(c=>__trainer.start(c),config);await page.locator('#arena').focus();
  await page.waitForFunction(()=>__trainer.yone.phase==='q3-windup');await page.keyboard.press('Escape');
  const frozen=await page.evaluate(()=>JSON.stringify([__trainer.yone.time,__trainer.yoneVisual.time]));await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>JSON.stringify([__trainer.yone.time,__trainer.yoneVisual.time])),frozen);
  await page.screenshot({path:'tools/yone-duel-q3.png'});await page.keyboard.press('Escape');
  await page.waitForFunction(()=>__trainer.yone.stats.R.casts>0);await page.screenshot({path:'tools/yone-duel-r.png'});
  await page.waitForFunction(()=>__trainer.yone.rounds>=2);await page.screenshot({path:'tools/yone-duel-live.png'});
  const visual=await page.evaluate(()=>__trainer.yoneVisual),summary=await page.evaluate(()=>__trainer.yone.summary());
  assert.equal(visual.meshes.some(m=>['Azakana','Fish','Sushi','Bow_Smear','Instrument'].includes(m.name)),false);
  assert.ok(visual.meshes.some(m=>m.name==='Katana'));assert.ok(visual.meshes.some(m=>m.name==='GhostKatana'));assert.ok(visual.clips>=30);
  assert.equal(await page.locator('#yoneHud').isVisible(),true);
  await page.click('#finishSession');await page.waitForFunction(()=>document.querySelector('#results').open);
  assert.match(await page.locator('#combatResults').textContent(),/Yone/);await page.click('#retryShot');await page.waitForFunction(()=>__trainer.session.config.rehearsal);await page.waitForFunction(()=>document.querySelector('#results').open);
  await page.click('#closeResults');assert.equal(await page.locator('#yoneHud').isVisible(),false);
  await page.evaluate(c=>__trainer.start({...c,drill:'combat'}),config);assert.equal(await page.evaluate(()=>__trainer.yone),null);assert.equal(await page.evaluate(()=>__trainer.combat.targets.length),2);
  assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);console.log(JSON.stringify({summary,visual,errors,warnings},null,2));
}catch(e){await page.screenshot({path:'tools/yone-duel-failure.png'});console.log({errors,warnings,state:await page.evaluate(()=>({enemy:__trainer.yone?.summary(),visual:__trainer.yoneVisual}))});throw e;}finally{await browser.close();}
