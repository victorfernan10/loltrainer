// Installed client snapshot: tools/syndra-original/character.json.
// Seconds and League world units. Rank arrays are indexed by rank - 1.
// Server-script reconstruction is isolated below; see tools/syndra-mechanics-evidence.md.
export const SYNDRA = {
  base: {
    moveSpeed: 330, attackRange: 550, attackSpeed: 0.658, attackSpeedRatio: 0.625,
    attackSpeedGrowth: 0.02, attackDamage: 54, attackDamageGrowth: 2.9,
    attackMissileSpeed: 1800, attackCastOffset: -0.1125,
    health: 583, healthGrowth: 100, armor: 25, armorGrowth: 4,
    magicResist: 30, magicResistGrowth: 1.3,
    mana: 480, manaGrowth: 40, manaRegen: 1.6, manaRegenGrowth: 0.16,
    pathfindingRadius: 35, selectionRadius: 125,
  },
  passive: {
    markWindow: 4, targetCooldown: 8, stacksPerLevel: 5, stacksPerSiege: 1,
    maxStacks: 120, qThreshold: 40, wThreshold: 60, eThreshold: 80,
    rThreshold: 100, apThreshold: 120, apBonus: 0.15,
    procLevels: [1, 11, 18], procStacks: [1, 2, 3],
    manaBase: 20, manaGrowth: 4,
    manaBreakpoints: [{ level: 7, growth: 6 }, { level: 11, growth: 15 }, { level: 16, growth: 20 }],
  },
  Q: {
    name: 'Esfera Negra', range: 800, radius: 180, delay: 0.6, sphereDuration: 6,
    resourceCastTime: 0.375, cooldown: [7, 7, 7, 7, 7],
    mana: [40, 45, 50, 55, 60], damage: [90, 125, 160, 195, 230], apRatio: 0.7,
    upgradedCharges: 2, chargeCooldown: 1.25, recharge: 7,
  },
  W: {
    name: 'Determinação', pickupRange: 925, range: 950, radius: 195,
    extraSpherePickupRadius: 450, resourceCastTime: 0.25, resourceMissileSpeed: 1450,
    // Prefer the modern Cooldown property over the stale cooldownTime field.
    cooldown: [13, 12, 11, 10, 9], mana: [60, 70, 80, 90, 100],
    damage: [70, 100, 130, 160, 190], apRatio: 0.65,
    slow: 0.25, slowDuration: 1.5, trueDamageBase: 0.12, trueDamagePerAP: 0.0002,
  },
  E: {
    name: 'Dispersar os Fracos', range: 650, castTime: 0.25,
    coneDegrees: 56, upgradedConeDegrees: 84,
    cooldown: [15, 15, 15, 15, 15], mana: [50, 50, 50, 50, 50],
    damage: [60, 95, 130, 165, 200], apRatio: 0.6,
    stunDuration: 1.25, upgradedSlow: 0.7, upgradedSlowDuration: 1.25,
    sphereSpeed: 2000, sphereMissileWidth: 100,
    waveSpeeds: [2500, 1600, 1100],
  },
  R: {
    name: 'Poder Irrestrito', range: 675, castTime: 0.25,
    cooldown: [120, 100, 80], mana: [100, 100, 100],
    damage: [80, 120, 160], apRatio: 0.2,
    minSpheres: 3, maxSpheres: 7, executeThreshold: 0.15, qHastePerRank: 10,
    missileInitialSpeed: 1, missileAcceleration: 7500, missileMaxSpeed: 10000,
    bounceDuration: 0.4,
  },
  reconstruction: {
    // Calibration values/behavior, not extracted server code or runtime measurements.
    gameplayRadius: 65, attackWindupFraction: 0.1875,
    qMovementLock: 0, wMovementLock: 0, wHoldDuration: 5, wRecastDelay: 0.25,
    wThrowSpeed: 1450, wMinimumFlightTime: 0.25,
    eSphereEndpointRange: 1300, eKnockbackDuration: 0.25,
    rSphereGatherRange: 1300, rLaunchInterval: 0.1,
  },
};

const LEVEL_ORDER = ['Q', 'W', 'E', 'Q', 'Q', 'R', 'Q', 'W', 'Q', 'W', 'R', 'W', 'W', 'E', 'E', 'R', 'E', 'E'];

export function syndraRanks(level) {
  const ranks = { Q: 0, W: 0, E: 0, R: 0 };
  const count = Math.max(1, Math.min(18, Math.floor(Number(level) || 1)));
  for (const key of LEVEL_ORDER.slice(0, count)) ranks[key]++;
  return ranks;
}

export function syndraPassiveStacks(level) {
  return level >= 18 ? 3 : level >= 11 ? 2 : 1;
}

// Interpretation of the client's named breakpoint calculation. No linear 20-215 approximation.
export function syndraPassiveMana(level) {
  const count = Math.max(1, Math.min(18, Math.floor(Number(level) || 1)));
  let mana = SYNDRA.passive.manaBase;
  for (let current = 2; current <= count; current++) {
    let growth = SYNDRA.passive.manaGrowth;
    for (const point of SYNDRA.passive.manaBreakpoints) if (current >= point.level) growth = point.growth;
    mana += growth;
  }
  return mana;
}
