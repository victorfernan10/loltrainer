import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {PLAYLIST_MODES} from '../src/playlist.js';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],blocks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto(process.env.TRAINER_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__modelLoaded&&__trainer.combatReady&&__trainer.loadedEnemies.length===8,null,{timeout:90000});
  await page.click('#openPlaylist');await page.selectOption('#playlistDuration','90');await page.selectOption('#playlistDifficulty','3');
  assert.match(await page.textContent('#playlistEstimate'),/15:00/);assert.equal(await page.locator('#playlistOrder li').count(),PLAYLIST_MODES.length);
  await page.screenshot({path:'tools/playlist-setup.png'});await page.click('#beginPlaylist');
  for(let i=0;i<PLAYLIST_MODES.length;i++){
    await page.waitForFunction(index=>__trainer.playlist?.index===index&&!__trainer.playlist.loading&&__trainer.session?.state==='running',i,{timeout:90000});
    const config=await page.evaluate(()=>__trainer.session.config);assert.equal(config.drill,PLAYLIST_MODES[i]);assert.equal(config.duration,90);assert.equal(config.difficulty,3);assert.equal(config.champion,config.drill==='aim'?'xerath':config.drill==='vault'?'quinn':'kayle');assert.equal(await page.locator('#results').isVisible(),false);
    if(i===0){await page.keyboard.press('Escape');const time=await page.evaluate(()=>__trainer.session.time);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>__trainer.session.time),time);await page.keyboard.press('Escape');await page.screenshot({path:'tools/playlist-running.png'});}
    if(config.drill==='combat'){await page.evaluate(()=>{__trainer.combat.playerHealth=0;});await page.waitForFunction(()=>__trainer.session.playlistKnockouts===1);assert.equal(await page.evaluate(()=>__trainer.playlist.index),i);assert.ok(await page.evaluate(()=>__trainer.combat.playerHealth>0));}
    blocks.push({mode:config.drill,duration:config.duration,difficulty:config.difficulty,champion:config.champion});
    // Advance only the session timer to exercise the real expiry/drain/next-block path.
    await page.evaluate(()=>{__trainer.session.time=__trainer.session.config.duration-.01;});
  }
  await page.waitForFunction(()=>!__trainer.playlist&&document.querySelector('#playlistDialog').open,null,{timeout:30000});assert.match(await page.textContent('#playlistTitle'),/concluída/);assert.equal(await page.locator('#playlistReports button').count(),PLAYLIST_MODES.length);
  await page.screenshot({path:'tools/playlist-complete.png'});
  await page.locator('#playlistReports button').first().click();await page.click('#backToPlaylist');assert.equal(await page.locator('#playlistReports button').count(),PLAYLIST_MODES.length);await page.locator('#playlistReports button').first().click();await page.click('#repeatSession');await page.waitForFunction(()=>__trainer.session?.state==='running');assert.equal(await page.evaluate(()=>__trainer.playlist),null);assert.equal(await page.evaluate(()=>__trainer.session.config.playlistId),undefined);
  await page.click('#reset');await page.click('#openPlaylist');await page.selectOption('#playlistDuration','120');await page.selectOption('#playlistDifficulty','1');await page.click('#beginPlaylist');await page.waitForFunction(()=>__trainer.playlist&&!__trainer.playlist.loading);
  assert.equal(await page.evaluate(()=>__trainer.session.config.duration),120);await page.click('#finishSession');await page.waitForFunction(()=>!__trainer.playlist&&document.querySelector('#playlistDialog').open,null,{timeout:20000});assert.match(await page.textContent('#playlistTitle'),/encerrada/);assert.equal(await page.locator('#playlistReports button').count(),1);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({blocks,pause:true,healthRestoration:true,standaloneRepeat:true,manualStop:true,errors},null,2));
}catch(e){await page.screenshot({path:'tools/playlist-failure.png'});console.log({errors,state:await page.evaluate(()=>({session:__trainer.session?.state,index:__trainer.playlist?.index,loading:__trainer.playlist?.loading,error:__trainer.playlist?.error,status:document.querySelector('#status').textContent}))});throw e;}finally{await browser.close();}
