import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],bindingWarnings=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warn'&&/PropertyBinding|track|bone/i.test(m.text()))bindingWarnings.push(m.text());});
const config={champion:'leblanc',drill:'combat',difficulty:1,duration:60,speed:340,closeRadius:150,pace:1,seed:7,skills:[],level:1,attackSpeed:1.5,bindLeft:true,combatHazards:false,combatCircuit:'off',attackPriority:'cursor'};
try{
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__modelLoaded&&__trainer.combatReady);
 await page.selectOption('#championSelect','leblanc');await page.waitForFunction(()=>__trainer.champion==='leblanc'&&!__trainer.championLoading);
 assert.equal(await page.locator('#heroName').textContent(),'LeBlanc');assert.equal(await page.locator('#speed').inputValue(),'340');
 const clips=await page.evaluate(()=>__trainer.playerClips);assert.equal(clips.length,31);
 await page.waitForFunction(()=>__trainer.attackAnimation.name==='idle1'&&__trainer.attackAnimation.weight>.99);
 await page.screenshot({path:'tools/leblanc-idle.png'});
 const yaws=[];
 for(const point of [{x:260,z:0},{x:-260,z:0},{x:0,z:260},{x:0,z:-260}]){
   await page.evaluate(p=>__trainer.moveTo(p),point);await page.waitForFunction(()=>__trainer.attackAnimation.name==='run1');await page.waitForTimeout(200);yaws.push(await page.evaluate(()=>__trainer.playerYaw));await page.keyboard.press('KeyS');
 }
 assert.ok(Math.max(...yaws)-Math.min(...yaws)>2);
 await page.click('#toggle');
 for(const clip of clips){
   await page.selectOption('#animationClip',clip.name);await page.click('#playAnimation');
   await page.waitForFunction(name=>__trainer.attackAnimation.preview===name,clip.name);await page.waitForTimeout(100);
   assert.equal(await page.evaluate(()=>__trainer.kaylePose.finite),true,clip.name);
   if(['spell1','spell2','spell3','recall'].includes(clip.name))await page.screenshot({path:`tools/leblanc-${clip.name}.png`});
   await page.click('#stopAnimation');await page.waitForFunction(()=>__trainer.attackAnimation.name==='idle1');
 }
 await page.evaluate(c=>__trainer.start(c),config);assert.equal(await page.evaluate(()=>__trainer.combat.range),525);assert.equal(await page.locator('.combat-abilities').isVisible(),false);
 await page.keyboard.press('KeyE');await page.keyboard.press('KeyW');assert.equal(await page.evaluate(()=>__trainer.combat.eUses+__trainer.combat.wUses),0);
 await page.evaluate(()=>__trainer.attackTarget('ryze-1'));await page.waitForFunction(()=>__trainer.combat.hits>=2);assert.match(await page.evaluate(()=>__trainer.attackAnimation.name),/^attack[12]$/);
 await page.keyboard.press('Escape');const frozen=await page.evaluate(()=>JSON.stringify(__trainer.attackAnimation));await page.waitForTimeout(160);assert.equal(await page.evaluate(()=>JSON.stringify(__trainer.attackAnimation)),frozen);await page.keyboard.press('Escape');
 await page.screenshot({path:'tools/leblanc-combat.png'});await page.keyboard.press('KeyS');await page.click('#finishSession');await page.waitForFunction(()=>document.querySelector('#results').open);
 const report=await page.evaluate(()=>JSON.parse(localStorage.getItem('kayle:training-history:v1')).at(-1));assert.equal(report.config.champion,'leblanc');
 await page.click('#closeResults');await page.selectOption('#championSelect','kayle');await page.waitForFunction(()=>__trainer.champion==='kayle'&&!__trainer.championLoading&&__trainer.attackAnimation.name.startsWith('kayle_idle'));
 await page.evaluate(c=>__trainer.start({...c,champion:'kayle',level:6,speed:335}),config);await page.keyboard.press('KeyW');await page.waitForFunction(()=>__trainer.attackAnimation.name==='kayle_spell2');
 assert.deepEqual(errors,[]);assert.deepEqual(bindingWarnings,[]);console.log(JSON.stringify({champion:'LeBlanc',clips:clips.length,yaws,combat:report.summary.combat,switchBack:'Kayle W plays original clip',errors,bindingWarnings},null,2));
}catch(e){await page.screenshot({path:'tools/leblanc-failure.png'});console.log(errors);throw e;}finally{await browser.close();}
