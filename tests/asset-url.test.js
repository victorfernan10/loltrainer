import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assetUrl} from '../src/asset-url.js';
test('public models/textures/JSON follow the deployment subpath without rewriting blob or external URLs',()=>{
  for(const path of ['/assets/kayle.glb','/assets/minions/resources.json','/assets/dodge/lux.png']){
    assert.equal(assetUrl(path,'/loltrainer/'),'/loltrainer'+path);
    assert.equal(assetUrl(path,'/'),path);
  }
  for(const path of ['blob:https://example.org/id','https://example.org/model.glb','data:image/png;base64,data','/loltrainer/assets/kayle.glb'])assert.equal(assetUrl(path,'/loltrainer/'),path);
});
