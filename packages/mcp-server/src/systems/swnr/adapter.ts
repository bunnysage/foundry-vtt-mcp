/**
 * Stars Without Number Revised System Adapter
 *
 * Implements SystemAdapter for the swnr Foundry system
 * (https://github.com/Spice-King/foundry-swnr).
 *
 * Handles attribute extraction (STR/DEX/CON/INT/WIS/CHA with mods),
 * skills with levels -1 to 4, hit points, AC, and creature indexing.
 * Also supports ships and factions.
 */

import type { SystemAdapter, SystemMetadata, SystemCreatureIndex } from '../types.js';
import type { SWNRCreatureIndex } from '../types.js';
import {
  SWNRFiltersSchema,
  matchesSWNRFilters,
  describeSWNRFilters,
  type SWNRFilters,
} from './filters.js';
import { ATTRIBUTE_NAMES, ACTOR_TYPES, FIELD_PATHS, calcMod } from './constants.js';

export class SWNRAdapter implements SystemAdapter {
  getMetadata(): SystemMetadata {
    return {
      id: 'swnr',
      name: 'swnr',
      displayName: 'Stars Without Number Revised',
      version: '1.0.0',
      description:
        'Support for Stars Without Number Revised with attributes (STR/DEX/CON/INT/WIS/CHA), ' +
        'skills with levels -1 to 4, hit points, AC, characters, NPCs, ships, factions, and creature indexing.',
      supportedFeatures: {
        creatureIndex: true,
        characterStats: true,
        spellcasting: false, // Psionics handled separately
        powerLevel: true, // Hit Dice
      },
    };
  }

  canHandle(systemId: string): boolean {
    return systemId.toLowerCase() === 'swnr';
  }

  /**
   * extractCreatureData is delegated to SWNRIndexBuilder (browser context).
   */
  extractCreatureData(
    _doc: any,
    _pack: any
  ): { creature: SystemCreatureIndex; errors: number } | null {
    throw new Error('extractCreatureData should be called from SWNRIndexBuilder, not the adapter');
  }

  getFilterSchema() {
    return SWNRFiltersSchema;
  }

  matchesFilters(creature: SystemCreatureIndex, filters: Record<string, any>): boolean {
    const validated = SWNRFiltersSchema.safeParse(filters);
    if (!validated.success) return false;
    return matchesSWNRFilters(creature as SWNRCreatureIndex, validated.data as SWNRFilters);
  }

  getDataPaths(): Record<string, string | null> {
    return {
      // SWNR paths
      attributes: FIELD_PATHS.ATTRIBUTES,
      str: FIELD_PATHS.ATTR_STR,
      dex: FIELD_PATHS.ATTR_DEX,
      con: FIELD_PATHS.ATTR_CON,
      int: FIELD_PATHS.ATTR_INT,
      wis: FIELD_PATHS.ATTR_WIS,
      cha: FIELD_PATHS.ATTR_CHA,
      hitPoints: FIELD_PATHS.HEALTH_VALUE,
      hitPointsMax: FIELD_PATHS.HEALTH_MAX,
      armorClass: FIELD_PATHS.AC,
      level: FIELD_PATHS.LEVEL,
      hitDice: FIELD_PATHS.HIT_DICE,

      // D&D5e / PF2e paths — not directly applicable
      challengeRating: null,
      creatureType: null,
      alignment: null,
      legendaryActions: null,
      legendaryResistances: null,
      perception: null,
      saves: null,
      rarity: null,
    };
  }

  formatCreatureForList(creature: SystemCreatureIndex): any {
    const swnrCreature = creature as SWNRCreatureIndex;
    const formatted: any = {
      id: creature.id,
      name: creature.name,
      type: creature.type,
      pack: { id: creature.packName, label: creature.packLabel },
    };

    if (swnrCreature.systemData) {
      const stats: any = {};
      if (swnrCreature.systemData.hitDice !== undefined)
        stats.hitDice = swnrCreature.systemData.hitDice;
      if (swnrCreature.systemData.hitPoints !== undefined)
        stats.hp = swnrCreature.systemData.hitPoints;
      if (swnrCreature.systemData.armorClass !== undefined)
        stats.ac = swnrCreature.systemData.armorClass;
      if (swnrCreature.systemData.hasPsionics) stats.psionic = true;
      if (Object.keys(stats).length > 0) formatted.stats = stats;
    }

    if (creature.img) formatted.hasImage = true;
    return formatted;
  }

  formatCreatureForDetails(creature: SystemCreatureIndex): any {
    const swnrCreature = creature as SWNRCreatureIndex;
    const formatted = this.formatCreatureForList(creature);

    if (swnrCreature.systemData) {
      formatted.detailedStats = {
        hitDice: swnrCreature.systemData.hitDice,
        hitPoints: swnrCreature.systemData.hitPoints,
        armorClass: swnrCreature.systemData.armorClass,
        hasPsionics: swnrCreature.systemData.hasPsionics ?? false,
        attributes: swnrCreature.systemData.attributes ?? {},
        tags: swnrCreature.systemData.tags ?? [],
      };
    }

    if (creature.img) formatted.img = creature.img;
    return formatted;
  }

  describeFilters(filters: Record<string, any>): string {
    const validated = SWNRFiltersSchema.safeParse(filters);
    if (!validated.success) return 'invalid filters';
    return describeSWNRFilters(validated.data as SWNRFilters);
  }

  getPowerLevel(creature: SystemCreatureIndex): number | undefined {
    const swnrCreature = creature as SWNRCreatureIndex;
    return swnrCreature.systemData?.hitDice;
  }

  /**
   * Extract character statistics from a SWNR actor document.
   * Called by the get-character tool after receiving raw actor data from Foundry.
   */
  extractCharacterStats(actorData: any): any {
    const system = actorData.system || {};
    const stats: any = {};
    const num = (v: unknown): number | undefined =>
      typeof v === 'number' && Number.isFinite(v) ? v : undefined;

    // ── Attributes ───────────────────────────────────────────────────────────
    // system.stats.<attr> is { base, bonus, boost, temp }; the system derives
    // total and mod when the actor is prepared. Older data used { value, mod }.
    if (system.stats && Object.keys(system.stats).length > 0) {
      stats.attributes = {};
      for (const [key, attrData] of Object.entries(system.stats)) {
        const a = attrData as any;
        const names = ATTRIBUTE_NAMES[key.toLowerCase()];
        if (!names) continue;
        const value: number = typeof a === 'number' ? a : (a?.total ?? a?.value ?? a?.base ?? 10);
        const mod: number = typeof a === 'object' && a?.mod !== undefined ? a.mod : calcMod(value);
        stats.attributes[names.short] = { value, mod, full: names.full };
      }
    }

    // ── Health ───────────────────────────────────────────────────────────────
    if (system.health) {
      stats.health = { value: system.health.value ?? 0, max: system.health.max ?? 0 };
    }

    // ── Armor Class ──────────────────────────────────────────────────────────
    // `ac` is derived from readied armor; `baseAc` is the stored unarmored value.
    const ac = typeof system.ac === 'object' ? system.ac?.value : system.ac;
    const armorClass = num(ac) ?? num(system.baseAc);
    if (armorClass !== undefined) stats.armorClass = armorClass;
    if (num(system.meleeAc) !== undefined && system.meleeAc !== armorClass) {
      stats.meleeArmorClass = system.meleeAc;
    }

    // ── Attack bonus and saves ───────────────────────────────────────────────
    if (num(system.ab) !== undefined) stats.attackBonus = system.ab;
    if (system.save && typeof system.save === 'object') {
      // Characters: one target per save.
      stats.saves = {
        physical: system.save.physical,
        evasion: system.save.evasion,
        mental: system.save.mental,
        luck: system.save.luck,
      };
    } else if (num(system.saves) !== undefined) {
      // NPCs: a single save target for everything.
      stats.saves = { all: system.saves };
    }

    // ── Level / Hit Dice ─────────────────────────────────────────────────────
    if (system.level !== undefined) stats.level = system.level;
    if (system.hitDice !== undefined && system.hitDice !== '') stats.hitDice = system.hitDice;
    if (system.hitDie) stats.hitDie = system.hitDie;

    // ── NPC combat line ──────────────────────────────────────────────────────
    if (num(system.skillBonus) !== undefined) stats.skillBonus = system.skillBonus;
    if (num(system.moralScore) !== undefined) stats.morale = system.moralScore;
    if (system.attacks && typeof system.attacks === 'object') {
      stats.attacks = {
        number: system.attacks.number,
        damage: system.attacks.damage,
        bonusDamage: system.attacks.bonusDamage,
      };
    }
    if (num(system.speed) !== undefined) stats.speed = system.speed;

    // ── Skills ───────────────────────────────────────────────────────────────
    // Skills are owned items of type "skill" with system.rank (-1 untrained to 4).
    const skillItems = (actorData.items || []).filter((i: any) => i?.type === 'skill');
    if (skillItems.length > 0) {
      stats.skills = {};
      for (const item of skillItems) {
        const rank = item.system?.rank;
        stats.skills[item.name] = { rank: typeof rank === 'number' ? rank : -1 };
      }
    } else if (system.skills && Object.keys(system.skills).length > 0) {
      stats.skills = {};
      for (const [key, skillData] of Object.entries(system.skills)) {
        const sk = skillData as any;
        stats.skills[key] = { rank: typeof sk === 'number' ? sk : (sk.rank ?? sk.value ?? -1) };
      }
    }

    // ── System Strain ────────────────────────────────────────────────────────
    if (system.systemStrain) {
      stats.systemStrain = {
        value: system.systemStrain.value ?? 0,
        ...(system.systemStrain.permanent ? { permanent: system.systemStrain.permanent } : {}),
        ...(system.systemStrain.max !== undefined ? { max: system.systemStrain.max } : {}),
      };
    }

    // ── Ships ────────────────────────────────────────────────────────────────
    if (actorData.type === ACTOR_TYPES.SHIP) {
      for (const key of ['armor', 'speed', 'crew', 'power', 'mass', 'hardpoints', 'spikeDrive']) {
        if (system[key] !== undefined) stats[key] = system[key];
      }
    }

    return stats;
  }

  /**
   * Extract basic info for the get-character response top-level basicInfo block.
   *
   * SWNR field paths by actor type:
   * - character/npc: system.class, system.background, system.homeworld, system.species
   * - ship: system.shipClass, system.shipHullType, system.power, system.mass
   * - faction: system.wealth, system.force, system.cunning
   */
  extractBasicInfo(actorData: any): any {
    const system = actorData.system || {};
    const basicInfo: any = {};
    const actorType = actorData.type ?? 'character';

    if ([ACTOR_TYPES.CHARACTER, ACTOR_TYPES.NPC].includes(actorType)) {
      if (system.class) basicInfo.class = system.class;
      if (system.background) basicInfo.background = system.background;
      if (system.homeworld) basicInfo.homeworld = system.homeworld;
      if (system.species) basicInfo.species = system.species;
      if (system.employer) basicInfo.employer = system.employer;
      if (system.level !== undefined) basicInfo.level = system.level;
    } else if (actorType === ACTOR_TYPES.SHIP) {
      if (system.shipClass) basicInfo.shipClass = system.shipClass;
      const hull = system.shipHullType ?? system.hullType;
      if (hull) basicInfo.hullType = hull;
      if (system.power !== undefined) basicInfo.power = system.power;
      if (system.mass !== undefined) basicInfo.mass = system.mass;
      if (system.hardpoints !== undefined) basicInfo.hardpoints = system.hardpoints;
    } else if (actorType === ACTOR_TYPES.FACTION) {
      if (system.wealth !== undefined) basicInfo.wealth = system.wealth;
      if (system.force !== undefined) basicInfo.force = system.force;
      if (system.cunning !== undefined) basicInfo.cunning = system.cunning;
      if (system.tag) basicInfo.tag = system.tag;
    }

    basicInfo.actorType = actorType;
    return basicInfo;
  }

  describeActorSchema(): string {
    return [
      '=== Stars Without Number (swnr system) Actor Schema Reference ===',
      '',
      'ACTOR TYPES: character, npc, ship, mech, vehicle, drone, cyberdeck, faction',
      '',
      'ATTRIBUTES (character only) — system.stats.<str|dex|con|int|wis|cha>:',
      '  Stored:    { base: 14, bonus: 0, boost: 0, temp: 0 }   (set "base")',
      '  Shorthand accepted here: { str: 14, dex: 12, ... } is written as base.',
      '  The system derives total and mod itself. Modifiers: 3 = -2, 4-7 = -1,',
      '  8-13 = 0, 14-17 = +1, 18 = +2. Do not write mod.',
      '',
      'HEALTH — system.health: { value: 20, max: 20 }',
      'ARMOR CLASS — system.baseAc (unarmored, default 10). system.ac is derived from',
      '  readied armor and cannot be written. system.meleeAc is the melee AC.',
      'ATTACK BONUS — system.ab (and system.meleeAb).',
      'SYSTEM STRAIN — system.systemStrain: { value, permanent }',
      '',
      'CHARACTER:',
      '  system.level: { value: 3, exp: 0 }      system.hitDie: "d6"',
      '  system.class, system.background, system.homeworld, system.species, system.employer',
      '  system.credits: { balance, debt, owed }',
      '  Saves (physical, evasion, mental, luck) are derived from level and attributes.',
      '',
      'NPC (flat stat line, no attributes):',
      '  system.hitDice: "3"          system.health: { value, max }',
      '  system.baseAc: 13            system.ab: 4',
      '  system.saves: 13  (one target for every save)',
      '  system.skillBonus: 1         system.moralScore: 8        system.speed: 10',
      '  system.attacks: { number: 1, damage: "d8", bonusDamage: 0 }',
      '',
      'SKILLS are owned items of type "skill": system.rank from -1 (untrained) to 4,',
      '  system.defaultStat (e.g. "dex"), system.source ("Core" or "Psionic").',
      '  Core: Administer, Connect, Exert, Fix, Heal, Know, Lead, Notice, Perform, Pilot,',
      '  Program, Punch, Shoot, Sneak, Stab, Survive, Talk, Trade, Work.',
      '  Psychic: Biopsionics, Metapsionics, Precognition, Telekinesis, Telepathy, Teleportation.',
      '',
      'SHIP — system.health {value,max}, system.ac, system.armor, system.speed,',
      '  system.crew {min,max,current}, system.power {value,max}, system.mass {value,max},',
      '  system.hardpoints {value,max}, system.shipClass, system.shipHullType, system.spikeDrive.',
      '',
      'ITEM TYPES: weapon, armor, item (gear), skill, power (psychic or other; system.subType),',
      '  feature (foci, edges, class abilities; system.type is "focus", "edge", ...), cyberware,',
      '  asset (faction), program, injury, shipWeapon, shipDefense, shipFitting.',
      '  weapon: system.damage "1d8", system.ab, system.stat "dex", system.range {normal,max},',
      '    system.shock {dmg, ac}, system.ammo {type,max,value}, system.isMelee.',
      '  armor: system.ac, system.meleeAc, system.shield, system.use (true = readied/worn).',
    ].join('\n');
  }

  normalizePayload(system: Record<string, any>, actorType?: string): Record<string, any> {
    const normalized = { ...system };
    // Ships, mechs, vehicles and drones store a real `ac`; people store `baseAc`.
    // On an update the type is unknown, so fall back to what the payload looks like.
    const person = actorType
      ? actorType === ACTOR_TYPES.CHARACTER || actorType === ACTOR_TYPES.NPC
      : !['shipClass', 'shipHullType', 'armor', 'crew', 'spikeDrive', 'hardpoints', 'mass'].some(
          key => key in normalized
        );

    // Attributes are stored as { base }. Accept the shorthand number and the
    // older { value, mod } shape, and never write the derived fields.
    if (normalized.stats && typeof normalized.stats === 'object') {
      const stats: Record<string, any> = { ...normalized.stats };
      for (const key of Object.keys(ATTRIBUTE_NAMES)) {
        const given = stats[key];
        if (typeof given === 'number') {
          stats[key] = { base: given };
        } else if (given && typeof given === 'object') {
          const {
            value,
            mod: _mod,
            total: _total,
            baseTotal: _baseTotal,
            label: _label,
            ...rest
          } = given;
          stats[key] =
            rest.base === undefined && typeof value === 'number' ? { ...rest, base: value } : rest;
        }
      }
      normalized.stats = stats;
    }

    // `ac` is derived; the stored field is baseAc.
    if (person && normalized.ac !== undefined && normalized.baseAc === undefined) {
      const ac = typeof normalized.ac === 'object' ? normalized.ac?.value : normalized.ac;
      if (typeof ac === 'number') normalized.baseAc = ac;
      delete normalized.ac;
    }

    // Level is { value, exp }.
    if (typeof normalized.level === 'number') {
      normalized.level = { value: normalized.level };
    }

    return normalized;
  }
}
