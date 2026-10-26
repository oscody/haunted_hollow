/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { AtmosphereSystem } from './atmosphere-system.js';
import { CaptionSystem } from './caption-system.js';
import { DesktopLookSystem } from './desktop-look-system.js';
import { GhostSystem } from './ghost-system.js';
import { mountHud } from './hud.js';
import { MomentSystem } from './moment-system.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world.registerSystem(DesktopLookSystem);
  world.registerSystem(MomentSystem);
  world.registerSystem(AtmosphereSystem);
  world.registerSystem(GhostSystem);
  world.registerSystem(CaptionSystem);
  mountHud(world);
});
