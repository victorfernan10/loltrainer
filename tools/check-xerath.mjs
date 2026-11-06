import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
await page.goto(process.env.TRAINER_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__modelLoaded&&__trainer.combatReady,null,{timeout:90000});
await page.click('[data-drill=aim]');await page.waitForFunction(()=>__trainer.champion==='xerath'&&!__trainer.championLoading,null,{timeout:90000});
await page.click('#startChallenge');await page.waitForFunction(()=>__trainer.aim&&__trainer.session?.state==='running',null,{timeout:90000});

console.log('Loaded Xerath and aim target');
const waitSeconds=async seconds=>{const t=await page.evaluate(()=>__trainer.combat.time);await page.waitForFunction(end=>__trainer.combat.time>=end,t+seconds,{timeout:30000});};
await page.evaluate(()=>{__trainer.combat.unlimitedMana=true;});
const point=()=>page.evaluate(()=>({...__trainer.aim.position}));
await page.mouse.move(780,400);await page.keyboard.down('q');await page.waitForFunction(()=>!!__trainer.combat.charge);await waitSeconds(1.6);
assert.equal(await page.evaluate(()=>__trainer.combat.qRange),1500);await page.screenshot({path:'tools/xerath-charge.png'});
await page.keyboard.up('q');await page.waitForFunction(()=>__trainer.aim.summary().byAbility.Q.casts===1);
assert.equal(await page.evaluate(()=>__trainer.combat.charge),null);console.log('Q hold and release passed');
for(const key of ['W','E']){const p=await point();assert.equal(await page.evaluate(({key,p})=>__trainer.castAbility(key,p),{key,p}),true);await page.waitForFunction(key=>__trainer.aim.summary().byAbility[key].casts===1,key,{timeout:15000});console.log(key+' resolved');}
const p=await point();assert.equal(await page.evaluate(p=>__trainer.castAbility('R',p),p),true);await waitSeconds(.55);
for(let n=0;n<4;n++){assert.equal(await page.evaluate(p=>__trainer.castAbility('R',p),await point()),true);await waitSeconds(.65);}
assert.equal(await page.evaluate(()=>__trainer.combat.channel),null);await waitSeconds(1);
await page.screenshot({path:'tools/xerath-browser.png'});
assert.equal(await page.evaluate(()=>__trainer.attackAnimation.hold),null);
assert.equal(await page.evaluate(()=>__trainer.playerClips.length),25);
const summary=await page.evaluate(()=>__trainer.aim.summary());assert.equal(summary.casts,7);assert.equal(summary.byAbility.R.casts,4);
await page.click('#finishSession');await page.waitForFunction(()=>document.querySelector('#results').open,null,{timeout:20000});assert.match(await page.textContent('#resultTitle'),/timing contra a esquiva/);
await page.screenshot({path:'tools/xerath-report.png'});assert.deepEqual(errors,[]);console.log(JSON.stringify({summary,errors},null,2));

}catch(e){console.log({errors,status:await page.locator('#status').textContent()});throw e;}finally{await browser.close();}
