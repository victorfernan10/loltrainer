import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.text().includes('PropertyBinding'))errors.push(m.text());});
try{
  await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__modelLoaded&&__trainer.loadedEnemies.length===8,null,{timeout:90000});
  await page.evaluate(()=>{document.querySelector('#reset').click();for(const e of __trainer.enemies.filter(e=>['morgana','blitzcrank','brand'].includes(e.id))){e.group.visible=true;e.group.position.set(e.id==='morgana'?-300:e.id==='blitzcrank'?300:0,0,e.id==='brand'?-350:0);}});
  await page.waitForTimeout(300);await page.screenshot({path:'tools/dodge-models-corrected.png'});
  const casts={};
  for(const id of await page.evaluate(()=>Object.keys(__trainer.skills))){
    const cast=await page.evaluate(id=>{document.querySelector('#reset').click();const enemy=__trainer.enemies.find(e=>e.skills.includes(id));enemy.group.position.set(0,0,-600);__trainer.spawn(id);return {clip:enemy.castClip.name,warning:__trainer.warnings[0].remaining};},id);casts[id]=cast;
    assert.ok(cast.clip.includes('spell'));if(id==='brandW'){await page.screenshot({path:'tools/brand-w-warning.png'});}
    await page.waitForFunction(()=>__trainer.stats.hits+__trainer.stats.dodged===1,null,{timeout:5000});assert.equal(await page.evaluate(()=>__trainer.stats.hits),1,id+' stationary collision');
    await page.waitForFunction(id=>{const e=__trainer.enemies.find(e=>e.skills.includes(id));return !e.castRemaining||e.castRemaining<=0;},id,{timeout:5000});
  }
  await page.click('#reset');await page.click('[data-drill=pressure]');await page.selectOption('#difficulty','3');await page.click('#startChallenge');
  await page.waitForFunction(()=>__trainer.wave.active.length===3);assert.equal(new Set(await page.evaluate(()=>__trainer.wave.active)).size,3);
  const before=await page.evaluate(()=>({x:__trainer.position.x,z:__trainer.position.z}));
  await page.mouse.move(1040,500);await page.keyboard.press('f');await page.waitForFunction(()=>__trainer.flash.uses===1);
  const after=await page.evaluate(()=>({x:__trainer.position.x,z:__trainer.position.z}));assert.ok(Math.hypot(after.x-before.x,after.z-before.z)>300);assert.ok(Math.hypot(after.x-before.x,after.z-before.z)<=400.001);
  await page.keyboard.press('f');assert.equal(await page.evaluate(()=>__trainer.flash.uses),1);
  await page.keyboard.press('Escape');const remaining=await page.evaluate(()=>__trainer.flash.remaining);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>__trainer.flash.remaining),remaining);
  await page.screenshot({path:'tools/dodge-flash-cooldown.png'});await page.keyboard.press('Escape');
  await page.waitForFunction(()=>__trainer.flash.remaining===0,null,{timeout:25000});await page.keyboard.press('f');await page.waitForFunction(()=>__trainer.flash.uses===2);
  await page.click('#finishSession');await page.waitForFunction(()=>document.querySelector('#results').open,null,{timeout:10000});await page.screenshot({path:'tools/dodge-expansion-report.png'});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({casts,flash:'two uses, cooldown and pause verified',errors},null,2));
}catch(e){await page.screenshot({path:'tools/dodge-expansion-failure.png'});console.log({errors,status:await page.textContent('#status')});throw e;}finally{await browser.close();}
