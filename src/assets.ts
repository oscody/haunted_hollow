/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { defineAssets } from '@iwsdk/core';
import {
  createBushes,
  createFloor,
  createGraves,
  createHouse,
} from './scene-assets/haunted.scene-asset.js';
import { createFrontDoor } from './scene-assets/props.scene-asset.js';

// Everything in Hollow House is built in code; there are no model, texture or
// sound files.
export default defineAssets({
  floor: createFloor(),
  house: createHouse(),
  bushes: createBushes(),
  graves: createGraves(),
  'front-door': createFrontDoor(),
});
