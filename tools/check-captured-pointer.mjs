import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(process.env.TRAINER_URL||'http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__modelLoaded&&__trainer.combatReady,null,{timeout:90000});
  await page.click('[data-drill=combat]');await page.click('#startChallenge');await page.waitForFunction(()=>__trainer.session?.state==='running');
  await page.mouse.move(720,500);await page.click('#captureMouse');await page.waitForFunction(()=>__trainer.capturedPointer.active);
  assert.equal(await page.locator('#capturedCursor').isVisible(),true);
  const before=await page.evaluate(()=>__trainer.capturedPointer);await page.mouse.move(900,450);const after=await page.evaluate(()=>__trainer.capturedPointer);assert.notDeepEqual([before.x,before.y],[after.x,after.y]);
  // Relative deltas must clamp the virtual cursor even beyond the window.
  await page.evaluate(()=>document.dispatchEvent(new MouseEvent('mousemove',{movementX:20000,movementY:-20000,bubbles:true})));
  const edge=await page.evaluate(()=>__trainer.capturedPointer);assert.ok(edge.x>.97&&edge.x<1&&edge.y>.97&&edge.y<1);assert.equal(await page.evaluate(()=>__trainer.session.state),'running');
  await page.evaluate(()=>document.dispatchEvent(new MouseEvent('mousemove',{movementX:-720,movementY:500,bubbles:true})));
  const commands=await page.evaluate(()=>__trainer.combat.commands);
  await page.mouse.down({button:'right'});await page.mouse.down({button:'left'});await page.mouse.up({button:'left'});await page.mouse.up({button:'right'});
  assert.equal(await page.evaluate(()=>__trainer.combat.commands),commands+2);assert.equal(await page.evaluate(()=>__trainer.combat.order.type),'attackMove');
  await page.screenshot({path:'tools/captured-pointer.png'});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!__trainer.capturedPointer.active&&__trainer.session.state==='paused');
  await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>__trainer.session.state),'paused');assert.equal(await page.locator('#capturedCursor').isVisible(),false);
  await page.click('#startChallenge');await page.click('#captureMouse');await page.waitForFunction(()=>__trainer.capturedPointer.active);
  await page.evaluate(()=>__trainer.finish());await page.waitForFunction(()=>document.querySelector('#results').open,null,{timeout:20000});assert.equal(await page.evaluate(()=>__trainer.capturedPointer.active),false);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({capture:true,relativeMovement:true,clampedEdges:true,simultaneousButtons:true,escapePause:true,recapture:true,finishRelease:true,errors}));
}finally{await browser.close();}
