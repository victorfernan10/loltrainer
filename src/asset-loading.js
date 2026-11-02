import {DefaultLoadingManager} from 'three';
import {assetUrl} from './asset-url.js';
DefaultLoadingManager.setURLModifier(url=>assetUrl(url));
