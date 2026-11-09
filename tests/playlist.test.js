import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TrainingPlaylist,PLAYLIST_MODES} from '../src/playlist.js';
import {drills,settingsKey} from '../src/training.js';
const base={champion:'syndra',speed:340,level:16,trainingProfile:'advanced',seed:7,skills:['ezrealQ'],duration:60,difficulty:1,abilityPower:200};
test('playlist visits all drills once with fixed duration/difficulty and restores the champion after Quinn',()=>{
  assert.deepEqual([...PLAYLIST_MODES].sort(),Object.keys(drills).sort());
  for(const duration of [60,90,120])for(const difficulty of [1,2,3]){
    const p=new TrainingPlaylist(base,{duration,difficulty});
    for(let i=0;i<PLAYLIST_MODES.length;i++){
      const config=p.config();assert.equal(config.duration,duration);assert.equal(config.difficulty,difficulty);assert.equal(config.abilityPower,200);
      assert.equal(config.trainingProfile,'advanced');assert.equal(config.champion,config.drill==='spacing'?'caitlyn':config.drill==='aim'?'xerath':config.drill==='vault'?'quinn':'syndra');assert.equal(config.speed,config.drill==='spacing'?325:config.drill==='vault'?330:340);
      config.skills.push('modified');assert.deepEqual(base.skills,['ezrealQ']);assert.deepEqual(p.base.skills,['ezrealQ']);
      assert.equal(p.complete({config}),i<PLAYLIST_MODES.length-1);
    }
    assert.equal(p.config(),null);assert.equal(p.reports.length,PLAYLIST_MODES.length);
  }
});
test('playlist rejects duplicate/foreign completions and stops after the current block on request',()=>{
  const p=new TrainingPlaylist(base),config=p.config();assert.equal(p.complete({config:{...config,playlistId:'other'}}),false);assert.equal(p.index,0);
  assert.equal(p.complete({config}),true);assert.equal(p.complete({config}),false);assert.equal(p.reports.length,1);
  p.stopping=true;assert.equal(p.complete({config:p.config()}),false);assert.equal(p.reports.length,2);
  assert.throws(()=>new TrainingPlaylist(base,{duration:0}));assert.throws(()=>new TrainingPlaylist(base,{difficulty:9}));
});

test('playlist scores compare across playlists but not with single-life standalone blocks',()=>{
  const a=new TrainingPlaylist(base),b=new TrainingPlaylist(base);assert.equal(settingsKey(a.config()),settingsKey(b.config()));
  const {playlistId,playlistIndex,...standalone}=a.config();assert.notEqual(settingsKey(standalone),settingsKey(a.config()));
});

test('playlist combat cannot inherit isolated warmup settings from champion selection or another drill',()=>{
  const p=new TrainingPlaylist({...base,combatHazards:false,combatCircuit:'off'});
  while(p.mode!=='combat')p.complete({config:p.config()});
  assert.equal(p.config().combatHazards,true);assert.equal(p.config().combatCircuit,'on');
  assert.equal(p.base.combatHazards,false);assert.equal(p.base.combatCircuit,'off');
});
