import test from 'node:test';
import assert from 'node:assert/strict';
import {findLolSetting,parseLolConfig} from '../src/lol-config.js';

test('reads relevant values from game.cfg sections',()=>{
  const values=parseLolConfig('game.cfg','[General]\nGameMouseSpeed=12\nEnableLeftMouseButtonAttackMove=1\n[HUD]\nMapScrollSpeed=0.5000');
  assert.equal(findLolSetting(values,'GameMouseSpeed'),'12');
  assert.equal(findLolSetting(values,'EnableLeftMouseButtonAttackMove'),'1');
  assert.equal(findLolSetting(values,'MapScrollSpeed'),'0.5000');
});

test('reads Game.cfg settings from PersistedSettings JSON sections',()=>{
  const values=parseLolConfig('PersistedSettings.json',JSON.stringify({files:[{name:'Game.cfg',sections:[{name:'General',settings:[{name:'GameMouseSpeed',value:18},{name:'EnableLeftMouseButtonAttackMove',value:0}]},{name:'HUD',settings:[{name:'MapScrollSpeed',value:.75}]}]}]}));
  assert.equal(findLolSetting(values,'GameMouseSpeed'),'18');
  assert.equal(findLolSetting(values,'EnableLeftMouseButtonAttackMove'),'0');
  assert.equal(findLolSetting(values,'MapScrollSpeed'),'0.75');
});

test('prefers General settings over same-named settings in other sections',()=>{
  const values=parseLolConfig('PersistedSettings.json',JSON.stringify({files:[{sections:[{name:'Input',settings:[{name:'Setting',value:'input'}]},{name:'General',settings:[{name:'Setting',value:'general'}]}]}]}));
  assert.equal(findLolSetting(values,'Setting'),'general');
});
