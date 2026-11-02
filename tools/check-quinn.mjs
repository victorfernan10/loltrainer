import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.text().includes('PropertyBinding'))errors.push(m.text());});
try{
  await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__modelLoaded,null,{timeout:90000});
  await page.click('[data-drill=vault]');await page.waitForFunction(()=>__trainer.champion==='quinn'&&!__trainer.championLoading,null,{timeout:90000});
  await page.screenshot({path:'tools/quinn-setup.png'});
  await page.click('#startChallenge');await page.waitForFunction(()=>__trainer.vault?.active,null,{timeout:90000});
  assert.equal(await page.evaluate(()=>__trainer.combat.champion),'quinn');
  // React to the published simulated W, then use the normal ability entry point.
  await page.evaluate(()=>{window.vaultTest=()=>{if(!__trainer.vault)return;const v=__trainer.vault;if(v.phase==='dash'&&!v.current.eCastAt)__trainer.castAbility('E',{...v.position},v.target.id);requestAnimationFrame(window.vaultTest);};requestAnimationFrame(window.vaultTest);});
  await page.waitForFunction(()=>__trainer.vault?.summary().interrupted>=2,null,{timeout:20000});
  await page.keyboard.press('Escape');await page.screenshot({path:'tools/quinn-vault.png'});
  const summary=await page.evaluate(()=>__trainer.vault.summary()),time=await page.evaluate(()=>__trainer.combat.time);
  await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>__trainer.combat.time),time);
  await page.evaluate(()=>{window.vaultTest=()=>{};const p=__trainer.position,angle=(Math.atan2(-p.x,-p.z)+Math.PI*2)%(Math.PI*2);let n=0;__trainer.vault.random=()=>n++===0?angle/(Math.PI*2):.5;});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>__trainer.vault.phase==='prepare');await page.keyboard.press('Escape');
  const cursor=await page.evaluate(()=>{const v=__trainer.vault.position,p=__trainer.position.clone().set(v.x,100,v.z).project(__trainer.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
  await page.mouse.move(cursor.x,cursor.y);await page.keyboard.press('Escape');await page.keyboard.press('e');await page.waitForFunction(()=>__trainer.combat.vaults>=3,null,{timeout:3000});
  await page.click('#finishSession');await page.waitForFunction(()=>document.querySelector('#results').open,null,{timeout:15000});
  assert.match(await page.textContent('#resultMetrics'),/W interrompidos/);await page.screenshot({path:'tools/quinn-report.png'});await page.click('#closeResults');
  await page.click('[data-drill=combat]');await page.click('#startChallenge');await page.waitForFunction(()=>__trainer.combat?.champion==='quinn'&&!__trainer.vault);
  await page.evaluate(()=>{__trainer.combat.stop();__trainer.castAbility('Q',{x:0,z:-1000});});await page.waitForTimeout(400);await page.screenshot({path:'tools/quinn-q.png'});
  await page.waitForTimeout(500);await page.evaluate(()=>__trainer.castAbility('W',{x:0,z:0}));await page.waitForTimeout(300);
  await page.evaluate(()=>__trainer.castAbility('R',{x:0,z:0}));await page.waitForFunction(()=>__trainer.combat.valor,null,{timeout:6000});
  await page.waitForTimeout(400);await page.screenshot({path:'tools/quinn-valor.png'});
  await page.evaluate(()=>__trainer.moveTo({x:350,z:0}));await page.waitForTimeout(400);await page.screenshot({path:'tools/quinn-flight.png'});
  await page.evaluate(()=>__trainer.castAbility('R',{x:0,z:0}));await page.waitForFunction(()=>!__trainer.combat.valor);assert.equal(await page.evaluate(()=>__trainer.combat.skystrikes),1);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({summary,errors},null,2));
}catch(error){await page.screenshot({path:'tools/quinn-failure.png'});console.log({errors,status:await page.textContent('#status'),state:await page.evaluate(()=>({champion:window.__trainer?.champion,vault:window.__trainer?.vault?.summary(),phase:window.__trainer?.vault?.phase}))});throw error;}finally{await browser.close();}
