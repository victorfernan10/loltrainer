import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checked=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.text().includes('PropertyBinding'))errors.push(m.text());});
const finish=async()=>{await page.click('#finishSession');await page.waitForFunction(()=>document.querySelector('#results').open,null,{timeout:15000});};
try{
  await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__modelLoaded&&__trainer.combatReady,null,{timeout:90000});
  await page.click('[data-drill=combat]');await page.selectOption('#difficulty','3');await page.selectOption('#combatCircuit','on');await page.uncheck('#combatHazards');await page.selectOption('#level','6');
  await page.evaluate(()=>{document.querySelector('#attackSpeed').value=2;document.querySelector('#attackSpeed').dispatchEvent(new Event('input'));});
  await page.click('#startChallenge');await page.waitForFunction(()=>__trainer.combat?.advancedCircuit);
  assert.equal(await page.evaluate(()=>__trainer.combat.targets.length),3);await page.evaluate(()=>__trainer.combat.attackTarget(__trainer.combat.markedId));
  await page.waitForFunction(()=>__trainer.combat.stationaryReleases>0);await page.keyboard.press('Escape');await page.screenshot({path:'tools/advanced-circuit-goals.png'});await page.keyboard.press('Escape');await finish();
  assert.match(await page.textContent('#combatResults'),/disparos sem reposicionar/);checked.push('combat: three targets, stationary releases, report');await page.click('#closeResults');
  await page.click('[data-drill=lane]');await page.click('#startChallenge');await page.waitForFunction(()=>!!__trainer.lane,null,{timeout:60000});
  await page.evaluate(()=>{const c=__trainer.combat,m=c.target('lane-red-3');c.damageTarget(m,m.health);});await page.waitForFunction(()=>__trainer.lane.summary().siegeSecured===1);
  assert.match(await page.textContent('#laneWave'),/seu farm 1/);await finish();assert.match(await page.textContent('#resultMetrics'),/Seu farm/);checked.push('lane: last hit, siege and report');await page.click('#closeResults');
  await page.click('[data-drill=vault]');await page.waitForFunction(()=>__trainer.champion==='quinn'&&!__trainer.championLoading,null,{timeout:90000});await page.click('#startChallenge');await page.waitForFunction(()=>!!__trainer.vault);
  await page.evaluate(()=>{__trainer.vault.random=()=>.1;});await page.waitForFunction(()=>__trainer.vault.summary().held>=1,null,{timeout:15000});
  await finish();assert.match(await page.textContent('#combatResults'),/aproximações sem W respeitadas/);checked.push('vault: natural walk-only trial, restraint and report');await page.click('#closeResults');
  for(const mode of ['ahri','locke']){
    await page.click(`[data-drill=${mode}]`);await page.click('#startChallenge');await page.waitForFunction(()=>__trainer.matchup?.champion===document.body.dataset.drill,null,{timeout:60000});
    await page.waitForFunction(()=>__trainer.matchup.summary().completedRounds>=1,null,{timeout:20000});await finish();assert.match(await page.textContent('#resultMetrics'),/Sequências totalmente limpas/);checked.push(mode+': full sequence and completion report');await page.click('#closeResults');
  }
  await page.click('[data-drill=yone]');await page.selectOption('#difficulty','3');await page.selectOption('#yonePattern','full');await page.click('#startChallenge');await page.waitForFunction(()=>__trainer.yone?.advanced,null,{timeout:60000});
  assert.equal(await page.evaluate(()=>__trainer.yone.qCooldown),1.54);await page.waitForFunction(()=>__trainer.yone.stats.Q3.casts+__trainer.yone.stats.W.casts>0);await page.screenshot({path:'tools/advanced-yone-pressure.png'});await finish();checked.push('yone: advanced AI and preserved Q cooldown');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({checked,errors},null,2));
}catch(e){await page.screenshot({path:'tools/advanced-objectives-failure.png'});console.log({errors,status:await page.textContent('#status')});throw e;}finally{await browser.close();}
