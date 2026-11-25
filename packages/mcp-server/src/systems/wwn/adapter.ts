/**
 * Worlds Without Number System Adapter
 *
 * Implements SystemAdapter for the wwn Foundry system.
 *
 * Handles attribute extraction (STR/DEX/CON/INT/WIS/CHA with mods),
 * skills with levels -1 to 4, hit points, AC, and creature indexing.
 * Also supports magic arts and spells, and factions.
 */

import type { SystemAdapter, SystemMetadata, SystemCreatureIndex } from '../types.js';
import type { WWNCreatureIndex } from '../types.js';
import {
  WWNFiltersSchema,
  matchesWWNFilters,
  describeWWNFilters,
  type WWNFilters,
} from './filters.js';
import { ATTRIBUTE_NAMES, ACTOR_TYPES, FIELD_PATHS, calcMod } from './constants.js';

export class WWNAdapter implements SystemAdapter {
  getMetadata(): SystemMetadata {
    return {
      id: 'wwn',
      name: 'wwn',
      displayName: 'Worlds Without Number',
      version: '1.0.0',
      description:
        'Support for Worlds Without Number with attributes (STR/DEX/CON/INT/WIS/CHA), ' +
        'skills with levels -1 to 4, hit points, AC, characters, NPCs, factions, magic (arts/spells), and creature indexing.',
      supportedFeatures: {
        creatureIndex: true,
        characterStats: true,
        spellcasting: true, // High Magic and Low Magic
        powerLevel: true, // Hit Dice
      },
    };
  }

  canHandle(systemId: string): boolean {
    return systemId.toLowerCase() === 'wwn';
  }

  /**
   * extractCreatureData is delegated to WWNIndexBuilder (browser context).
   */
  extractCreatureData(
    _doc: any,
    _pack: any
  ): { creature: SystemCreatureIndex; errors: number } | null {
    throw new Error('extractCreatureData should be called from WWNIndexBuilder, not the adapter');
  }

  getFilterSchema() {
    return WWNFiltersSchema;
  }

  matchesFilters(creature: SystemCreatureIndex, filters: Record<string, any>): boolean {
    const validated = WWNFiltersSchema.safeParse(filters);
    if (!validated.success) return false;
    return matchesWWNFilters(creature as WWNCreatureIndex, validated.data as WWNFilters);
  }

  getDataPaths(): Record<string, string | null> {
    return {
      // WWN paths
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
    const wwnCreature = creature as WWNCreatureIndex;
    const formatted: any = {
      id: creature.id,
      name: creature.name,
      type: creature.type,
      pack: { id: creature.packName, label: creature.packLabel },
    };

    if (wwnCreature.systemData) {
      const stats: any = {};
      if (wwnCreature.systemData.hitDice !== undefined)
        stats.hitDice = wwnCreature.systemData.hitDice;
      if (wwnCreature.systemData.hitPoints !== undefined)
        stats.hp = wwnCreature.systemData.hitPoints;
      if (wwnCreature.systemData.armorClass !== undefined)
        stats.ac = wwnCreature.systemData.armorClass;
      if (wwnCreature.systemData.hasMagic) stats.spellcaster = true;
      if (Object.keys(stats).length > 0) formatted.stats = stats;
    }

    if (creature.img) formatted.hasImage = true;
    return formatted;
  }

  formatCreatureForDetails(creature: SystemCreatureIndex): any {
    const wwnCreature = creature as WWNCreatureIndex;
    const formatted = this.formatCreatureForList(creature);

    if (wwnCreature.systemData) {
      formatted.detailedStats = {
        hitDice: wwnCreature.systemData.hitDice,
        hitPoints: wwnCreature.systemData.hitPoints,
        armorClass: wwnCreature.systemData.armorClass,
        hasMagic: wwnCreature.systemData.hasMagic ?? false,
        attributes: wwnCreature.systemData.attributes ?? {},
        tags: wwnCreature.systemData.tags ?? [],
      };
    }

    if (creature.img) formatted.img = creature.img;
    return formatted;
  }

  describeFilters(filters: Record<string, any>): string {
    const validated = WWNFiltersSchema.safeParse(filters);
    if (!validated.success) return 'invalid filters';
    return describeWWNFilters(validated.data as WWNFilters);
  }

  getPowerLevel(creature: SystemCreatureIndex): number | undefined {
    const wwnCreature = creature as WWNCreatureIndex;
    return wwnCreature.systemData?.hitDice;
  }

  /**
   * Extract character statistics from a WWN actor document.
   * Called by the get-character tool after receiving raw actor data from Foundry.
   */
  extractCharacterStats(actorData: any): any {
    const system = actorData.system || {};
    const stats: any = {};

    // ── Attributes ───────────────────────────────────────────────────────────
    // WWN stores attributes in system.stats (str, dex, con, int, wis, cha)
    // Each attribute has a base value and potentially a modifier
    if (system.stats && Object.keys(system.stats).length > 0) {
      stats.attributes = {};
      for (const [key, attrData] of Object.entries(system.stats)) {
        const a = attrData as any;
        const value: number = typeof a === 'number' ? a : (a.value ?? a.base ?? 10);
        const mod: number = typeof a === 'object' && a.mod !== undefined ? a.mod : calcMod(value);

        const names = ATTRIBUTE_NAMES[key.toLowerCase()];
        if (!names) continue;

        stats.attributes[names.short] = {
          value,
          mod,
          full: names.full,
        };
      }
    }

    // ── Health ───────────────────────────────────────────────────────────────
    if (system.health) {
      stats.health = {
        value: system.health.value ?? 0,
        max: system.health.max ?? 0,
      };
    }

    // ── Armor Class ──────────────────────────────────────────────────────────
    if (system.ac !== undefined) {
      const ac = typeof system.ac === 'object' ? system.ac.value : system.ac;
      stats.armorClass = ac;
    }

    // ── Level ────────────────────────────────────────────────────────────────
    if (system.level !== undefined) {
      stats.level = system.level;
    }

    // ── Hit Dice (for NPCs/monsters) ─────────────────────────────────────────
    if (system.hitDice !== undefined) {
      stats.hitDice = system.hitDice;
    }

    // ── Skills ───────────────────────────────────────────────────────────────
    // WWN skills can be on the actor directly or as skill items
    // Check for skills in system.skills first, then fall back to items
    if (system.skills && Object.keys(system.skills).length > 0) {
      stats.skills = {};
      for (const [key, skillData] of Object.entries(system.skills)) {
        const s = skillData as any;
        const rank: number = typeof s === 'number' ? s : (s.rank ?? s.value ?? -1);
        stats.skills[key] = { rank };
      }
    }

    // ── Effort (for mages) ───────────────────────────────────────────────────
    if (system.effort) {
      stats.effort = {
        value: system.effort.value ?? 0,
        max: system.effort.max ?? 0,
      };
    }

    // ── Magic Detection ──────────────────────────────────────────────────────
    const items: any[] = Array.isArray(actorData.items) ? actorData.items : [];
    const hasSpells = items.some((i: any) => i?.type === 'spell');
    const hasArts = items.some((i: any) => i?.type === 'art');
    if (hasSpells || hasArts) {
      stats.magic = { hasSpells, hasArts };
    }

    // ── System Strain (optional subsystem) ───────────────────────────────────
    if (system.systemStrain) {
      stats.systemStrain = {
        value: system.systemStrain.value ?? 0,
        max: system.systemStrain.max ?? 0,
      };
    }

    return stats;
  }

  /**
   * Extract basic info for the get-character response top-level basicInfo block.
   *
   * WWN field paths by actor type:
   * - character/npc: system.class, system.background, system.homeworld, system.species
   * - faction: system.wealth, system.force, system.cunning, system.magic
   */
  extractBasicInfo(actorData: any): any {
    const system = actorData.system || {};
    const basicInfo: any = {};
    const actorType = actorData.type ?? 'character';

    if ([ACTOR_TYPES.CHARACTER, ACTOR_TYPES.NPC, ACTOR_TYPES.MONSTER].includes(actorType)) {
      if (system.class) basicInfo.class = system.class;
      if (system.background) basicInfo.background = system.background;
      if (system.homeworld) basicInfo.homeworld = system.homeworld;
      if (system.species) basicInfo.species = system.species;
      if (system.level !== undefined) basicInfo.level = system.level;
      if (system.tradition) basicInfo.arcaneTradition = system.tradition;
    } else if (actorType === ACTOR_TYPES.FACTION) {
      if (system.wealth !== undefined) basicInfo.wealth = system.wealth;
      if (system.force !== undefined) basicInfo.force = system.force;
      if (system.cunning !== undefined) basicInfo.cunning = system.cunning;
      if (system.magic !== undefined) basicInfo.magic = system.magic;
    }

    basicInfo.actorType = actorType;
    return basicInfo;
  }

  describeActorSchema(): string {
    return [
      '=== WWN Actor Schema Reference ===',
      '',
      'ACTOR TYPES: character, npc, monster, faction',
      '',
      'ATTRIBUTES (character/npc) — system.stats:',
      '  Full:      { str:{value:14,mod:2}, dex:{value:12,mod:1}, ... }',
      '  Shorthand: { str:14, dex:12, con:10, int:13, wis:11, cha:9 }  (mod auto-calculated)',
      '  Modifier formula: floor((value - 10) / 2)',
      '',
      'SKILLS (character/npc):',
      '  Can be in system.skills or as skill items',
      '  Rank range: -1 (untrained), 0, 1, 2, 3, 4',
      '  Common skills: administer, connect, exert, fix, heal, know, lead, notice, perform,',
      '    pray, punch, sail, shoot, sneak, stab, survive, talk, trade, work, cast, magic',
      '',
      'HEALTH — system.health:',
      '  { value: 20, max: 20 }',
      '',
      'ARMOR CLASS — system.ac:',
      '  Can be number or { value: 15 }',
      '',
      'LEVEL — system.level:',
      '  Character/NPC level (1-10 typical)',
      '',
      'HIT DICE — system.hitDice:',
      '  For NPCs/monsters; primary power-level indicator',
      '',
      'CHARACTER DETAILS:',
      '  system.class: "Warrior", "Expert", "Mage", "Partial Mage", etc.',
      '  system.background: Character background',
      '  system.homeworld: Home location/region',
      '  system.species: Species/ancestry',
      '  system.tradition: Arcane tradition (for mages)',
      '',
      'MAGIC:',
      '  system.effort: { value, max } — effort pool for high magic',
      '  Magic is detected via spell and art items',
      '',
      'FACTION FIELDS (faction actors):',
      '  system.health: { value, max } — faction hit points',
      '  system.wealth: Wealth rating',
      '  system.force: Force rating',
      '  system.cunning: Cunning rating',
      '  system.magic: Magic rating',
      '',
      'ITEM TYPES:',
      '  character/npc: weapon, armor, item (gear), focus, edge, skill, spell, art, gift, technique',
    ].join('\n');
  }

  normalizePayload(system: Record<string, any>): Record<string, any> {
    const normalized = { ...system };

    // Normalize attributes shorthand
    if (normalized.stats) {
      const stats = normalized.stats;
      for (const key of Object.keys(ATTRIBUTE_NAMES)) {
        if (typeof stats[key] === 'number') {
          const value = stats[key];
          stats[key] = {
            value,
            mod: calcMod(value),
          };
        }
      }
    }

    // Normalize AC if it's a plain number
    if (typeof normalized.ac === 'number') {
      normalized.ac = { value: normalized.ac };
    }

    return normalized;
  }
}
