import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],warnings=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warn'&&/PropertyBinding|track|bone/i.test(m.text()))warnings.push(m.text());});
const config={champion:'leblanc',drill:'combat',difficulty:1,duration:120,speed:340,closeRadius:150,pace:1,seed:7,skills:[],level:6,attackSpeed:1.5,bindLeft:true,combatHazards:false,combatCircuit:'off',attackPriority:'cursor',abilityPower:0,unlimitedMana:true};
async function start(){await page.evaluate(c=>__trainer.start(c),config);await page.locator('#arena').focus();}
async function aim(x,z,y=5){const p=await page.evaluate(({x,z,y})=>{const p=__trainer.position.clone().set(x,y,z).project(__trainer.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};},{x,z,y});await page.mouse.move(p.x,p.y);}
async function aimTarget(){const p=await page.evaluate(()=>__trainer.combat.targets[0].position);await aim(p.x,p.z,100);}
try{
  await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__modelLoaded&&__trainer.combatReady);
  await page.selectOption('#championSelect','leblanc');await page.waitForFunction(()=>__trainer.champion==='leblanc'&&!__trainer.championLoading);
  await start();assert.equal(await page.locator('#leblancAbilities').isVisible(),true);
  await aimTarget();await page.keyboard.press('KeyQ');await page.waitForFunction(()=>__trainer.combat.casting?.ability==='Q');
  assert.equal(await page.evaluate(()=>__trainer.attackAnimation.name),'spell1');
  await page.waitForFunction(()=>__trainer.combat.markDetonations===0&&__trainer.combat.damage===65);
  await page.screenshot({path:'tools/leblanc-q-mark.png'});
  await page.keyboard.press('KeyR');await page.waitForFunction(()=>__trainer.combat.damage===200);
  await page.keyboard.press('KeyE');await page.waitForFunction(()=>__trainer.combat.tethers.length===1);
  await page.screenshot({path:'tools/leblanc-e-tether.png'});
  await page.waitForFunction(()=>__trainer.combat.roots===1);assert.equal(await page.evaluate(()=>__trainer.combat.damage),470);
  await page.waitForFunction(()=>__trainer.attackAnimation.name==='idle1'&&__trainer.attackAnimation.weight>.99);
  assert.equal(await page.evaluate(()=>__trainer.kaylePose.finite),true);
  await page.click('#finishSession');await page.waitForFunction(()=>document.querySelector('#results').open);
  assert.match(await page.locator('#combatResults').textContent(),/2 marcas detonadas/);
  const report=await page.evaluate(()=>JSON.parse(localStorage.getItem('kayle:training-history:v1')).at(-1));assert.equal(report.summary.combat.skillCasts,3);
  await page.click('#closeResults');await start();
  await aim(450,0);await page.keyboard.press('KeyW');await page.waitForFunction(()=>__trainer.combat.dash!==null);
  assert.equal(await page.evaluate(()=>__trainer.attackAnimation.name),'spell2');await page.waitForFunction(()=>!__trainer.combat.dash);
  const first=await page.evaluate(()=>({x:__trainer.position.x,z:__trainer.position.z}));assert.ok(first.x>430);
  await aim(800,200);await page.keyboard.press('KeyR');await page.waitForFunction(()=>__trainer.combat.skillCasts===2&&!__trainer.combat.dash);
  await page.waitForTimeout(250);await page.screenshot({path:'tools/leblanc-w-rw.png'});
  await page.keyboard.press('KeyR');await page.waitForFunction(()=>__trainer.combat.returns===1);
  const returned=await page.evaluate(()=>({x:__trainer.position.x,z:__trainer.position.z}));assert.ok(Math.hypot(returned.x-first.x,returned.z-first.z)<1);
  await page.keyboard.press('KeyW');await page.waitForFunction(()=>__trainer.combat.returns===2);assert.ok(await page.evaluate(()=>__trainer.position.length()<1));
  await page.waitForFunction(()=>__trainer.attackAnimation.name==='idle1'&&__trainer.attackAnimation.weight>.99);
  await page.keyboard.press('Escape');const frozen=await page.evaluate(()=>JSON.stringify([__trainer.combat.time,__trainer.attackAnimation]));await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>JSON.stringify([__trainer.combat.time,__trainer.attackAnimation])),frozen);await page.keyboard.press('Escape');
  await page.click('#finishSession');await page.waitForFunction(()=>document.querySelector('#results').open);await page.click('#closeResults');
  await page.selectOption('#championSelect','kayle');await page.waitForFunction(()=>__trainer.champion==='kayle'&&!__trainer.championLoading);
  await page.evaluate(c=>__trainer.start({...c,champion:'kayle',speed:335}),config);await page.locator('#arena').focus();await page.keyboard.press('KeyW');await page.waitForFunction(()=>__trainer.attackAnimation.name==='kayle_spell2');
  assert.equal(await page.locator('#leblancAbilities').isVisible(),false);assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);
  console.log(JSON.stringify({combo:report.summary.combat,independentReturns:true,paused:true,kayleRegression:true,errors,warnings},null,2));
}catch(e){await page.screenshot({path:'tools/leblanc-abilities-failure.png'});console.log({errors,warnings,state:await page.evaluate(()=>({animation:__trainer.attackAnimation,combat:__trainer.combat?.summary(),feedback:__trainer.combat?.feedback}))});throw e;}finally{await browser.close();}
