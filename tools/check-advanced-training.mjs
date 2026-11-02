import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.text().includes('PropertyBinding'))errors.push(m.text());});
try{
  await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__modelLoaded&&__trainer.loadedEnemies.length===5,null,{timeout:90000});
  assert.equal(await page.inputValue('#trainingProfile'),'advanced');
  assert.equal(await page.isChecked('#unlimitedMana'),false);assert.equal(await page.isDisabled('#unlimitedMana'),true);
  await page.click('[data-drill=pressure]');await page.click('#startChallenge');
  await page.waitForFunction(()=>__trainer.warnings.length>0,null,{timeout:15000});
  await page.keyboard.press('Escape');
  const state=await page.evaluate(()=>({config:__trainer.session.config,warnings:__trainer.warnings.map(w=>({id:w.skill.id,warning:w.skill.warning,lane:w.lane.visible,center:w.center.visible,beam:w.skill.kind==='beam'})),incoming:!document.querySelector('#incoming').hidden}));
  assert.equal(state.config.trainingProfile,'advanced');assert.equal(state.incoming,false);
  assert.ok(state.warnings.every(w=>w.center===false&&w.lane===w.beam));
  await page.screenshot({path:'tools/advanced-pressure.png'});
  await page.keyboard.press('Escape');await page.waitForTimeout(6500);
  await page.click('#finishSession');await page.waitForFunction(()=>document.querySelector('#results').open,null,{timeout:20000});
  assert.match(await page.textContent('#resultMetrics'),/Esquiva sob ameaça/);
  await page.screenshot({path:'tools/advanced-report.png'});await page.click('#closeResults');
  await page.selectOption('#trainingProfile','assisted');assert.equal(await page.isDisabled('#matchupTelegraphs'),false);assert.equal(await page.isChecked('#matchupTelegraphs'),true);
  await page.selectOption('#trainingProfile','advanced');
  await page.click('[data-drill=ahri]');await page.click('#startChallenge');
  await page.waitForFunction(()=>__trainer.session?.config.drill==='ahri',null,{timeout:90000});
  await page.waitForTimeout(2500);await page.click('#finishSession');await page.waitForFunction(()=>document.querySelector('#results').open,null,{timeout:20000});await page.click('#closeResults');
  await page.selectOption('#championSelect','syndra');await page.waitForFunction(()=>__trainer.champion==='syndra'&&!__trainer.championLoading,null,{timeout:90000});
  await page.click('[data-drill=lane]');await page.click('#startChallenge');await page.waitForFunction(()=>__trainer.laneVisual.units===14,null,{timeout:90000});
  assert.equal(await page.evaluate(()=>__trainer.lane.coach),false);assert.equal(await page.evaluate(()=>__trainer.lane.moveSpeed),340);
  // Put player in legal attack range; actual wave and original animations stay active.
  await page.evaluate(()=>{const l=__trainer.lane;for(const m of l.minions){m.health=m.maxHealth;m.readyAt=999;m.action=null;}l.cancelAttack();l.attackReadyAt=0;Object.assign(l.position,{x:0,z:-500});l.goal={...l.position};l.nextDecision=999;});
  await page.waitForFunction(()=>__trainer.lane.tradeHits>0,null,{timeout:10000});
  await page.keyboard.press('Escape');await page.screenshot({path:'tools/advanced-lane.png'});
  assert.ok(await page.evaluate(()=>__trainer.combat.playerHealth<__trainer.combat.maxPlayerHealth));
  assert.deepEqual(errors,[]);console.log(JSON.stringify({state,lane:await page.evaluate(()=>__trainer.lane.summary()),errors},null,2));
}catch(error){await page.screenshot({path:'tools/advanced-failure.png'});console.log({errors,status:await page.textContent('#status')});throw error;}finally{await browser.close();}
