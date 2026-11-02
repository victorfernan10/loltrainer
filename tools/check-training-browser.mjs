import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(()=>window.__modelLoaded&&__trainer.loadedEnemies.length===5,{timeout:30000});
  await page.screenshot({path:'tools/training-setup.png'});
  await page.setViewportSize({width:1366,height:768});
  const startButton=await page.locator('#startChallenge').boundingBox();
  assert.ok(startButton.y+startButton.height<700,'Start button must be visible before scrolling at 1366×768');
  await page.screenshot({path:'tools/training-setup-compact.png'});
  await page.setViewportSize({width:1440,height:900});
  await page.click('button[data-drill="pressure"]');await page.click('#startChallenge');
  await page.waitForFunction(()=>__trainer.warnings.length>0,{timeout:10000});
  // Pause a live warning through the actual UI. Both clocks and rigs must stop.
  await page.keyboard.press('Escape');
  const paused=await page.evaluate(()=>({time:__trainer.session.time,warnings:__trainer.warnings.map(w=>w.remaining),projectiles:__trainer.projectiles.map(p=>p.travelled),position:__trainer.position.toArray(),animations:__trainer.enemyAnimations.map(e=>e.time)}));
  await page.waitForTimeout(350);
  const after=await page.evaluate(()=>({time:__trainer.session.time,warnings:__trainer.warnings.map(w=>w.remaining),projectiles:__trainer.projectiles.map(p=>p.travelled),position:__trainer.position.toArray(),animations:__trainer.enemyAnimations.map(e=>e.time)}));
  assert.deepEqual(after,paused,'Pause must freeze time, hazards, movement and animations');
  await page.keyboard.press('Escape');
  // Feed a real right-click to exercise the screen-to-world command path.
  await page.mouse.click(780,510,{button:'right'});
  await page.waitForFunction(()=>__trainer.session.summary().total>=2,{timeout:15000});
  await page.screenshot({path:'tools/training-live.png'});
  assert.ok(await page.evaluate(()=>__trainer.session.clicks.length>0));
  await page.click('#finishSession');
  await page.waitForFunction(()=>document.querySelector('#results').open,{timeout:6000});
  const report=await page.evaluate(()=>JSON.parse(localStorage.getItem('kayle:training-history:v1')).at(-1));
  assert.ok(report.summary.total>=2);assert.equal(report.config.drill,'pressure');
  assert.ok(report.shots.every(s=>s.path.length>1&&s.resolved&&s.feedback));
  await page.screenshot({path:'tools/training-review.png'});
  await page.locator('#reviewTime').fill('200');await page.locator('#reviewTime').dispatchEvent('input');
  const selection=await page.locator('#shotPicker').inputValue();
  const original=report.shots[+selection];
  await page.click('#retryShot');
  const replay=await page.evaluate(()=>({shot:__trainer.session.shots[0],count:__trainer.session.shots.length,rehearsal:__trainer.session.config.rehearsal}));
  assert.equal(replay.rehearsal,true);assert.equal(replay.count,1);
  assert.deepEqual(replay.shot.origin,original.origin);assert.deepEqual(replay.shot.start,original.start);
  assert.ok(Math.hypot(replay.shot.endpoint.x-original.endpoint.x,replay.shot.endpoint.z-original.endpoint.z)<.001);
  await page.waitForFunction(()=>document.querySelector('#results').open,{timeout:6000});
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kayle:training-history:v1')).length),1,'Rehearsals must not inflate the scored history');
  await page.click('#closeResults');
  await page.reload();await page.waitForFunction(()=>window.__modelLoaded&&__trainer.loadedEnemies.length===5);
  assert.equal(await page.locator('.history-entry').count(),1);
  // Shortened test duration uses the same timer as the 60/90/120-second UI.
  await page.evaluate(()=>__trainer.start({drill:'precision',difficulty:2,duration:2,speed:335,closeRadius:150,pace:1,seed:123,skills:['ezrealQ']}));
  await page.waitForFunction(()=>__trainer.session.state==='finished',{timeout:8000});
  assert.ok(await page.evaluate(()=>__trainer.session.summary().total>=1));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({pause:'frozen',input:'right-click recorded',review:report.summary,replay:'same origin, aim and start',history:'persists across reload',timer:'drains and completes',errors},null,2));
}finally{await browser.close();}
