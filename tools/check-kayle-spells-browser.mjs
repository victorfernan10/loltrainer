import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],warnings=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warn'&&/PropertyBinding|track|bone/i.test(m.text()))warnings.push(m.text());});
const config={drill:'combat',difficulty:1,duration:60,speed:335,closeRadius:150,pace:1,seed:7,skills:[],level:6,attackSpeed:1,bindLeft:true,combatHazards:false,combatCircuit:'off',attackPriority:'cursor'};
try{
  await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__modelLoaded&&__trainer.combatReady);
  const clips=await page.evaluate(()=>__trainer.kayleSpellClips);assert.equal(clips.length,12);assert.ok(clips.every(c=>c.tracks===489));
  await page.evaluate(c=>__trainer.start(c),config);await page.keyboard.press('KeyW');
  await page.waitForFunction(()=>__trainer.attackAnimation.name==='kayle_spell2'&&__trainer.attackAnimation.time>.25);
  await page.keyboard.press('Escape');const w=await page.evaluate(()=>({animation:__trainer.attackAnimation,pose:__trainer.kaylePose}));
  await page.screenshot({path:'tools/kayle-W-original.png'});await page.waitForTimeout(150);assert.deepEqual(await page.evaluate(()=>__trainer.attackAnimation),w.animation);assert.equal(w.pose.finite,true);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>__trainer.attackAnimation.name==='kayle_spell2_transidle');
  await page.waitForFunction(()=>__trainer.attackAnimation.name==='kayle_idle1'&&__trainer.attackAnimation.weight>.99);
  await page.evaluate(c=>{__trainer.start(c);__trainer.moveTo({x:900,z:150});},config);await page.keyboard.press('KeyW');
  await page.waitForFunction(()=>__trainer.attackAnimation.name==='kayle_spell2'&&__trainer.position.x>80);
  assert.equal(await page.evaluate(()=>__trainer.combat.speedMultiplier),1.3);await page.screenshot({path:'tools/kayle-W-moving.png'});
  const attacks=[];
  for(const level of [1,6,11]){
    await page.evaluate(c=>__trainer.start(c),{...config,level});await page.keyboard.press('KeyE');
    await page.evaluate(()=>__trainer.attackTarget('ryze-1'));
    await page.waitForFunction(()=>__trainer.combat.released>=1);
    const attack=await page.evaluate(()=>({animation:__trainer.attackAnimation,pose:__trainer.kaylePose,level:__trainer.combat.level}));attacks.push(attack);
    assert.match(attack.animation.name,level===1?/^kayle_spell3melee$/:/^kayle_spell3(_l)?$/);assert.equal(attack.pose.finite,true);
    await page.keyboard.press('Escape');await page.screenshot({path:`tools/kayle-E-original-level${level}.png`});await page.keyboard.press('Escape');
    await page.evaluate(()=>__trainer.moveTo({x:160,z:200}));await page.waitForFunction(()=>__trainer.attackAnimation.name.includes('spell3runtransition'));
    await page.waitForFunction(()=>__trainer.combat.hits>0);assert.equal(await page.evaluate(()=>__trainer.combat.damage),120);
    await page.waitForFunction(()=>__trainer.attackAnimation.name.startsWith('kayle_idle'));
    assert.equal(await page.evaluate(()=>__trainer.combat.cancelled),0);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);console.log(JSON.stringify({originalClips:clips.length,w,attacks,errors,warnings},null,2));
}catch(e){await page.screenshot({path:'tools/kayle-spells-failure.png'});throw e;}finally{await browser.close();}
