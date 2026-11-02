import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'||/PropertyBinding/.test(m.text()))errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
async function aim(x,z,y=0){const screen=await page.evaluate(async ({x,z,y})=>{const {Vector3}=await import('/node_modules/three/build/three.module.js');const p=new Vector3(x,y,z).project(__trainer.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};},{x,z,y});await page.mouse.move(screen.x,screen.y);}
try{
  await page.goto('http://127.0.0.1:5173',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__modelLoaded&&__trainer.combatReady,null,{timeout:90000});
  await page.selectOption('#championSelect','syndra');
  await page.waitForFunction(()=>__trainer.champion==='syndra'&&!__trainer.championLoading,null,{timeout:90000});
  assert.equal(await page.locator('#syndraSettings').isVisible(),true);
  await page.selectOption('#level','18');await page.selectOption('#syndraSplinters','120');
  await page.click('#startChallenge');await page.waitForFunction(()=>__trainer.combat?.champion==='syndra');
  await page.locator('#arena').focus();
  await aim(390,-200);await page.keyboard.press('q');
  await page.waitForFunction(()=>__trainer.combat.spheres.some(s=>s.state==='ground'));
  assert.equal(await page.evaluate(()=>__trainer.combat.skillHits),1);
  await page.screenshot({path:'tools/syndra-q.png'});
  await page.keyboard.press('w');await page.waitForFunction(()=>!!__trainer.combat.holding);
  await page.waitForTimeout(300);await page.screenshot({path:'tools/syndra-held.png'});
  await aim(-260,-240);await page.keyboard.press('w');
  await page.waitForFunction(()=>__trainer.combat.spheresThrown===1&&__trainer.combat.spheres.every(s=>s.state==='ground'));
  await page.waitForFunction(()=>__trainer.combat.abilityState('Q').ready);
  await aim(200,-100);await page.keyboard.press('q');await page.keyboard.press('e');
  await page.waitForFunction(()=>__trainer.combat.stuns>0);
  await page.screenshot({path:'tools/syndra-e.png'});
  await page.waitForTimeout(1400);
  await aim(-260,-240,110);await page.keyboard.press('r');
  await page.waitForFunction(()=>__trainer.combat.rSpheres>=3);
  await page.screenshot({path:'tools/syndra-r.png'});
  await page.waitForFunction(()=>!__trainer.combat.pending&&__trainer.attackAnimation.kind==='base',null,{timeout:12000});
  assert.equal(await page.evaluate(()=>__trainer.kaylePose.finite),true);
  assert.equal(await page.evaluate(()=>__trainer.attackAnimation.name),'syndra_idle1');
  await page.keyboard.press('Escape');const frozen=await page.evaluate(()=>[__trainer.combat.time,__trainer.attackAnimation.time]);await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>[__trainer.combat.time,__trainer.attackAnimation.time]),frozen);
  await page.screenshot({path:'tools/syndra-final.png'});await page.keyboard.press('Escape');
  const result=await page.evaluate(()=>({summary:__trainer.combat.summary(),animation:__trainer.attackAnimation,clips:__trainer.playerClips.length,spheres:__trainer.combat.spheres.length}));
  await page.click('#finishSession');await page.waitForFunction(()=>document.querySelector('#results').open);
  assert.match(await page.locator('#combatResults').textContent(),/esferas criadas/);
  await page.click('#closeResults');
  // Previous playable models must still load after switching back.
  for(const champion of ['leblanc','kayle']){await page.selectOption('#championSelect',champion);await page.waitForFunction(id=>__trainer.champion===id&&!__trainer.championLoading,champion);assert.equal(await page.evaluate(()=>__trainer.kaylePose.finite),true);}
  assert.deepEqual(errors,[]);console.log(JSON.stringify({result,errors},null,2));
}catch(error){await page.screenshot({path:'tools/syndra-failure.png'});console.log(JSON.stringify({errors,state:await page.evaluate(()=>({champion:__trainer?.champion,feedback:__trainer?.combat?.feedback,time:__trainer?.combat?.time,summary:__trainer?.combat?.summary(),animation:__trainer?.attackAnimation,status:document.querySelector('#status').textContent}))},null,2));throw error;}
finally{await browser.close();}
