import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checked=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto(process.env.TRAINER_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__modelLoaded&&__trainer.combatReady&&__trainer.loadedEnemies.length===8,null,{timeout:90000});
  for(const champion of ['syndra','quinn']){
    await page.selectOption('#championSelect',champion);await page.waitForFunction(id=>__trainer.champion===id&&!__trainer.championLoading,champion,{timeout:90000});
    assert.equal(await page.isChecked('#combatHazards'),true,`${champion} must not silently disable hazards`);
    assert.equal(await page.inputValue('#combatCircuit'),'on');
    await page.selectOption('#difficulty','3');await page.click('#startChallenge');await page.waitForFunction(()=>__trainer.combat?.targets.length===3&&__trainer.stats.challengeActive);
    await page.evaluate(()=>__trainer.combat.attackTarget(__trainer.combat.markedId));
    await page.waitForFunction(()=>__trainer.stats.casts>=2&&__trainer.combat.hits>=1,null,{timeout:25000});
    checked.push(await page.evaluate(()=>({champion:__trainer.champion,targets:__trainer.combat.targets.length,casts:__trainer.stats.casts,hits:__trainer.combat.hits})));
    await page.click('#reset');
  }
  // Warmup remains an explicit option. Re-entering the named mode restores pressure.
  if(!await page.isVisible('#combatHazards'))await page.click('#toggle');
  await page.uncheck('#combatHazards');await page.selectOption('#combatCircuit','off');await page.click('#startChallenge');await page.waitForFunction(()=>!!__trainer.combat);
  assert.equal(await page.evaluate(()=>__trainer.stats.challengeActive),false);assert.equal(await page.evaluate(()=>__trainer.combat.targets.length),2);await page.click('#reset');
  await page.click('button[data-drill=combat]');assert.equal(await page.isChecked('#combatHazards'),true);assert.equal(await page.inputValue('#combatCircuit'),'on');
  // A playlist started from warmup must still contain the actual pressure drill.
  await page.uncheck('#combatHazards');await page.selectOption('#combatCircuit','off');await page.click('#openPlaylist');await page.click('#beginPlaylist');
  for(let index=0;index<3;index++){
    await page.waitForFunction(i=>__trainer.playlist?.index===i&&!__trainer.playlist.loading&&__trainer.session?.state==='running',index,{timeout:30000});
    await page.evaluate(()=>{__trainer.session.time=__trainer.session.config.duration-.01;});
  }
  await page.waitForFunction(()=>__trainer.playlist?.index===3&&!__trainer.playlist.loading&&__trainer.session?.state==='running',null,{timeout:30000});
  assert.equal(await page.evaluate(()=>__trainer.session.config.combatHazards),true);assert.equal(await page.evaluate(()=>__trainer.combat.circuit),true);
  await page.waitForFunction(()=>__trainer.stats.casts>=1,null,{timeout:20000});await page.screenshot({path:'tools/combat-pressure-verified.png'});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({checked,explicitWarmup:true,reentry:true,playlist:true,errors},null,2));
}catch(e){console.log(e);console.log({errors,selection:await page.evaluate(()=>({champion:__trainer.champion,hazards:document.querySelector('#combatHazards').checked,circuit:document.querySelector('#combatCircuit').value})).catch(()=>null)});throw e;}finally{await browser.close();}
