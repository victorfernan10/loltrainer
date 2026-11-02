import { chromium } from '@playwright/test';

const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1680,height:945}});
await page.goto('http://127.0.0.1:5173');
await page.waitForFunction(()=>window.__modelLoaded&&__trainer.enemyAnimations.every(enemy=>enemy.clips>0),{timeout:30000});

for(let index=0;index<4;index++){
  await page.evaluate(index=>{
    for(const enemy of __trainer.enemies){
      enemy.mixer.stopAllAction();
      const action=enemy.actions[index%enemy.actions.length];
      action.reset().play();
      enemy.action=action;
      enemy.idleTimer=1000;
    }
  },index);
  await page.waitForTimeout(2500);
  await page.screenshot({path:`tools/dodge-idle-variant-${index+1}.png`});
}

console.log(JSON.stringify(await page.evaluate(()=>__trainer.enemyAnimations),null,2));
await browser.close();
