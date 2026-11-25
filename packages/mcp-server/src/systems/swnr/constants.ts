/**
 * Stars Without Number Revised (SWNR) Constants
 *
 * Field paths, attribute names, and type definitions for the swnr Foundry system.
 * Based on the community SWNR system (https://github.com/Spice-King/foundry-swnr).
 */

/**
 * Attribute short codes → display names
 * SWN uses classic D&D-style attributes with 3-18 range
 */
export const ATTRIBUTE_NAMES: Record<string, { short: string; full: string }> = {
  str: { short: 'STR', full: 'Strength' },
  dex: { short: 'DEX', full: 'Dexterity' },
  con: { short: 'CON', full: 'Constitution' },
  int: { short: 'INT', full: 'Intelligence' },
  wis: { short: 'WIS', full: 'Wisdom' },
  cha: { short: 'CHA', full: 'Charisma' },
};

/**
 * Calculate attribute modifier from attribute value
 * SWN formula: floor((value - 10) / 2)
 */
export function calcMod(value: number): number {
  // The Without Number table, not the d20 formula: 3 is -2, 4-7 is -1,
  // 8-13 is 0, 14-17 is +1, 18 is +2.
  if (value <= 3) return -2;
  if (value <= 7) return -1;
  if (value <= 13) return 0;
  if (value <= 17) return 1;
  return 2;
}

/**
 * Actor types in the SWNR system
 */
export const ACTOR_TYPES = {
  CHARACTER: 'character',
  NPC: 'npc',
  SHIP: 'ship',
  FACTION: 'faction',
  DRONE: 'drone',
  VEHICLE: 'vehicle',
} as const;

/**
 * Item types in the SWNR system
 */
export const ITEM_TYPES = {
  WEAPON: 'weapon',
  ARMOR: 'armor',
  ITEM: 'item', // Generic gear/equipment
  FEATURE: 'feature', // foci, edges, class abilities (system.type says which)
  SKILL: 'skill',
  POWER: 'power', // Psionic powers
  CYBERWARE: 'cyberware',
  SHIP_WEAPON: 'shipWeapon',
  SHIP_FITTING: 'shipFitting',
  SHIP_DEFENSE: 'shipDefense',
} as const;

/**
 * Field paths into actor.system for SWNR actors
 */
export const FIELD_PATHS = {
  // Attributes
  ATTRIBUTES: 'system.stats',
  ATTR_STR: 'system.stats.str',
  ATTR_DEX: 'system.stats.dex',
  ATTR_CON: 'system.stats.con',
  ATTR_INT: 'system.stats.int',
  ATTR_WIS: 'system.stats.wis',
  ATTR_CHA: 'system.stats.cha',

  // Health
  HEALTH_VALUE: 'system.health.value',
  HEALTH_MAX: 'system.health.max',

  // System Strain (optional subsystem)
  SYSTEM_STRAIN_VALUE: 'system.systemStrain.value',
  SYSTEM_STRAIN_MAX: 'system.systemStrain.max',

  // Armor Class
  AC: 'system.baseAc',

  // Level (for characters/NPCs)
  LEVEL: 'system.level.value',

  // Hit Dice (for NPCs/creatures)
  HIT_DICE: 'system.hitDice',

  // Character details
  CLASS: 'system.class',
  BACKGROUND: 'system.background',
  HOMEWORLD: 'system.homeworld',
  SPECIES: 'system.species',

  // Ship fields
  SHIP_HP: 'system.health',
  SHIP_AC: 'system.ac',
  SHIP_POWER: 'system.power',
  SHIP_MASS: 'system.mass',
  SHIP_HARDPOINTS: 'system.hardpoints',
  SHIP_CLASS: 'system.shipClass',
  SHIP_HULL_TYPE: 'system.shipHullType',

  // Faction fields
  FACTION_HP: 'system.health',
  FACTION_WEALTH: 'system.wealth',
  FACTION_FORCE: 'system.force',
  FACTION_CUNNING: 'system.cunning',
  FACTION_TAG: 'system.tag',
} as const;

/**
 * Common skill names in SWNR
 * Skills in SWN go from -1 (untrained) to 4 (mastery)
 */
export const COMMON_SKILLS = [
  'administer',
  'connect',
  'exert',
  'fix',
  'heal',
  'know',
  'lead',
  'notice',
  'perform',
  'pilot',
  'program',
  'punch',
  'sail',
  'shoot',
  'sneak',
  'stab',
  'survive',
  'talk',
  'trade',
  'work',
] as const;

/**
 * Psionic skill names
 */
export const PSIONIC_SKILLS = [
  'biopsionics',
  'metapsionics',
  'precognition',
  'telekinesis',
  'telepathy',
  'teleportation',
] as const;
