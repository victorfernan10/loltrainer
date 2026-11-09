import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const waitSeconds=async n=>{const t=await page.evaluate(()=>__trainer.combat.time);await page.waitForFunction(t=>__trainer.combat.time>=t,t+n,{timeout:60000});};
try{
  await page.goto(process.env.TRAINER_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__modelLoaded&&__trainer.combatReady,null,{timeout:90000});
  await page.click('[data-drill=spacing]');await page.waitForFunction(()=>__trainer.champion==='caitlyn'&&!__trainer.championLoading,null,{timeout:90000});
  assert.equal(await page.evaluate(()=>__trainer.playerClips.length),46);
  await page.click('#startChallenge');await page.waitForFunction(()=>__trainer.spacing&&__trainer.session?.state==='running',null,{timeout:90000});
  assert.equal(await page.evaluate(()=>__trainer.combat.range),650);assert.equal(await page.evaluate(()=>__trainer.spacing.enemyRange),500);
  await page.keyboard.press('q');assert.equal(await page.evaluate(()=>__trainer.combat.skillCasts),0);
  await page.evaluate(()=>__trainer.attackTarget('spacing-lucian'));await waitSeconds(8);
  const stationary=await page.evaluate(()=>__trainer.spacing.summary());assert.ok(stationary.playerHits>0);assert.ok(stationary.retaliationHits>0);
  await page.screenshot({path:'tools/caitlyn-spacing.png'});await page.click('#finishSession');await page.waitForFunction(()=>document.querySelector('#results').open,null,{timeout:20000});assert.match(await page.textContent('#resultTitle'),/alcance virou vantagem/);
  await page.screenshot({path:'tools/caitlyn-spacing-report.png'});await page.click('#closeResults');
  if(!await page.locator('#controls').isVisible())await page.click('#toggle');await page.locator('#spacingSkills').check();await page.click('#startChallenge');await page.waitForFunction(()=>__trainer.session?.state==='running');
  await page.evaluate(()=>{__trainer.combat.unlimitedMana=true;__trainer.combat.playerHealth=100000;});
  for(const key of ['Q','W','E']){
    assert.equal(await page.evaluate(key=>__trainer.castAbility(key,{...__trainer.spacing.position},'spacing-lucian'),key),true);
    await waitSeconds(key==='E'?.8:1);
  }
  assert.ok(await page.evaluate(()=>__trainer.combat.traps.length>0));
  assert.equal(await page.evaluate(()=>__trainer.castAbility('R',{...__trainer.spacing.position},'spacing-lucian')),true);await waitSeconds(3);
  await page.screenshot({path:'tools/caitlyn-kit.png'});
  await page.click('#finishSession');await page.waitForFunction(()=>document.querySelector('#results').open,null,{timeout:20000});
  const kit=await page.evaluate(()=>__trainer.combat.summary());assert.ok(kit.skillCasts>=4);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({stationary,kit,errors},null,2));
}catch(error){await page.screenshot({path:'tools/caitlyn-failure.png'});console.log({errors,status:await page.locator('#status').textContent()});throw error;}finally{await browser.close();}
