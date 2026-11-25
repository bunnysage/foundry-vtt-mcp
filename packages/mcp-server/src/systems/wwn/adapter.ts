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
    const details = system.details || {};
    const stats: any = {};
    const num = (v: unknown): number | undefined =>
      typeof v === 'number' && Number.isFinite(v) ? v : undefined;

    // ── Attributes ───────────────────────────────────────────────────────────
    // The wwn system stores attributes in system.scores.<attr> as
    // { value, bonus, mod, tweak }. Monsters have none.
    const scores = system.scores ?? system.stats;
    if (scores && Object.keys(scores).length > 0 && actorData.type !== ACTOR_TYPES.MONSTER) {
      stats.attributes = {};
      for (const [key, attrData] of Object.entries(scores)) {
        const a = attrData as any;
        const names = ATTRIBUTE_NAMES[key.toLowerCase()];
        if (!names) continue;
        const value: number = typeof a === 'number' ? a : (a?.value ?? 10);
        const mod: number = typeof a === 'object' && a?.mod !== undefined ? a.mod : calcMod(value);
        stats.attributes[names.short] = { value, mod, full: names.full };
      }
    }

    // ── Hit points and hit dice — system.hp ──────────────────────────────────
    const hp = system.hp ?? system.health;
    if (hp) {
      stats.health = { value: hp.value ?? 0, max: hp.max ?? 0 };
      if (hp.hd !== undefined && hp.hd !== '') stats.hitDice = hp.hd;
    }

    // ── Armor Class — system.aac.value (ascending) ───────────────────────────
    const aac = typeof system.aac === 'object' ? system.aac?.value : system.aac;
    if (num(aac) !== undefined) stats.armorClass = aac;

    // ── Attack bonus — system.thac0.bba ──────────────────────────────────────
    if (num(system.thac0?.bba) !== undefined) stats.attackBonus = system.thac0.bba;

    // ── Saves ────────────────────────────────────────────────────────────────
    if (system.saves && typeof system.saves === 'object') {
      const saves: Record<string, number> = {};
      for (const key of ['physical', 'evasion', 'mental', 'luck']) {
        const v = system.saves[key]?.value;
        if (num(v) !== undefined) saves[key] = v;
      }
      if (Object.keys(saves).length) stats.saves = saves;
    }

    // ── Level, morale, skill bonus, movement ─────────────────────────────────
    if (details.level !== undefined) stats.level = details.level;
    if (num(details.morale) !== undefined && details.morale > 0) stats.morale = details.morale;
    if (num(details.skill) !== undefined) stats.skillBonus = details.skill;
    if (num(details.instinct) !== undefined) stats.instinct = details.instinct;
    if (system.movement?.base !== undefined) stats.movement = system.movement.base;
    if (details.strain) {
      stats.systemStrain = { value: details.strain.value ?? 0, max: details.strain.max ?? 0 };
    }

    // ── Skills ───────────────────────────────────────────────────────────────
    // Skills are owned items of type "skill"; the level is system.ownedLevel
    // (-1 untrained to 4).
    const skillItems = (actorData.items || []).filter((i: any) => i?.type === 'skill');
    if (skillItems.length > 0) {
      stats.skills = {};
      for (const item of skillItems) {
        const rank = item.system?.ownedLevel;
        stats.skills[item.name] = { rank: typeof rank === 'number' ? rank : -1 };
      }
    }

    // ── Effort — system.classes.effortN: { name, value, max } ────────────────
    const effort = Object.values(system.classes ?? {}).filter(
      (e: any) => e && typeof e === 'object' && e.name
    ) as any[];
    if (effort.length > 0) {
      stats.effort = effort.map(e => ({ name: e.name, value: e.value ?? 0, max: e.max ?? 0 }));
    }

    // ── Spellcasting ─────────────────────────────────────────────────────────
    if (system.spells?.enabled) {
      stats.spellcasting = {
        prepared: system.spells.prepared,
        perDay: system.spells.perDay,
      };
    }

    return stats;
  }

  /**
   * Extract basic info for the get-character response top-level basicInfo block.
   *
   * WWN field paths by actor type:
   * - character: system.details.class, .background, .alignment, .level
   * - monster: system.details.alignment, .xp, .appearing
   * - faction: system.forceRating, .cunningRating, .wealthRating, .magicRating
   */
  extractBasicInfo(actorData: any): any {
    const system = actorData.system || {};
    const details = system.details || {};
    const basicInfo: any = {};
    const actorType = actorData.type ?? 'character';

    if (actorType === ACTOR_TYPES.FACTION) {
      if (system.forceRating !== undefined) basicInfo.force = system.forceRating;
      if (system.cunningRating !== undefined) basicInfo.cunning = system.cunningRating;
      if (system.wealthRating !== undefined) basicInfo.wealth = system.wealthRating;
      if (system.magicRating !== undefined) basicInfo.magic = system.magicRating;
      if (system.homeworld) basicInfo.homeworld = system.homeworld;
      if (system.factionGoal) basicInfo.goal = system.factionGoal;
    } else {
      if (details.class) basicInfo.class = details.class;
      if (details.background) basicInfo.background = details.background;
      if (details.alignment) basicInfo.alignment = details.alignment;
      if (details.level !== undefined) basicInfo.level = details.level;
      if (actorType === ACTOR_TYPES.MONSTER && details.xp !== undefined) basicInfo.xp = details.xp;
    }

    basicInfo.actorType = actorType;
    return basicInfo;
  }

  describeActorSchema(): string {
    return [
      '=== Worlds Without Number (wwn system) Actor Schema Reference ===',
      '',
      'ACTOR TYPES: character, monster, faction   (there is no "npc" type; NPCs are monsters)',
      '',
      'ATTRIBUTES (character) — system.scores.<str|dex|con|int|wis|cha>:',
      '  Stored: { value: 14, bonus: 0, tweak: 0 }.  Shorthand accepted here: { str: 14, ... }.',
      '  The system derives mod: 3 = -2, 4-7 = -1, 8-13 = 0, 14-17 = +1, 18 = +2. Do not write mod.',
      '',
      'HIT POINTS — system.hp: { value: 11, max: 11, hd: "2d8+2" }   (hd is the hit dice text)',
      'ARMOR CLASS — system.aac.value (ascending AC, e.g. 13). Characters derive it from worn armor.',
      'ATTACK BONUS — system.thac0.bba',
      'SAVES — system.saves.<physical|evasion|mental|luck>.value  (characters derive these)',
      'MOVEMENT — system.movement.base (feet per move action, e.g. 30)',
      '',
      'CHARACTER — system.details: { class, background, alignment, level, xp: { value, next },',
      '  strain: { value, max } }.  system.currency: { cp, sp, gp, ... }.',
      '',
      'MONSTER — system.hp.hd "3d8", system.aac.value, system.thac0.bba,',
      '  system.saves.<save>.value (usually all the same), system.details.morale,',
      '  system.details.skill (skill bonus), system.details.instinct, system.details.xp,',
      '  system.details.appearing { d, w }, system.movement.base. Attacks are weapon items.',
      '',
      'SKILLS are owned items of type "skill": system.ownedLevel from -1 (untrained) to 4,',
      '  system.score (e.g. "int"), system.skillDice "2d6".',
      '  Administer, Connect, Convince, Craft, Exert, Heal, Know, Lead, Magic, Notice, Perform,',
      '  Pray, Punch, Ride, Sail, Shoot, Sneak, Stab, Survive, Trade, Work.',
      '',
      'EFFORT — system.classes.effort1..effort4: { name: "High Mage", value: 2, max: 2 }',
      'SPELLS — system.spells.enabled, system.spells.prepared { value, max }, perDay { value, max }',
      '',
      'FACTION — system.health { value, max }, system.forceRating, system.cunningRating,',
      '  system.wealthRating, system.magicRating ("None", "Low", ...), system.factionGoal.',
      '',
      'ITEM TYPES: weapon, armor, item (gear), skill, spell, art, focus, ability, asset (faction).',
      '  weapon: system.damage "1d8", system.bonus, system.score "str", system.skill "stab",',
      '    system.shock { damage, ac }, system.melee, system.missile, system.range.',
      '  armor: system.aac.value, system.type ("light"/"medium"/"heavy"), system.isShield.',
      '  spell: system.lvl, system.class, system.range, system.duration, system.save.',
      '  focus: system.ownedLevel.   art: system.source, system.effort.',
    ].join('\n');
  }

  normalizePayload(system: Record<string, any>, actorType?: string): Record<string, any> {
    const normalized = { ...system };

    // Attributes live in system.scores as { value }. Accept `stats` as an alias
    // and plain numbers as shorthand; never write the derived mod.
    const given = normalized.scores ?? normalized.stats;
    if (given && typeof given === 'object') {
      const scores: Record<string, any> = { ...given };
      for (const key of Object.keys(ATTRIBUTE_NAMES)) {
        const v = scores[key];
        if (typeof v === 'number') {
          scores[key] = { value: v };
        } else if (v && typeof v === 'object') {
          const { mod: _mod, base, ...rest } = v;
          scores[key] =
            rest.value === undefined && typeof base === 'number' ? { ...rest, value: base } : rest;
        }
      }
      normalized.scores = scores;
      delete normalized.stats;
    }

    // Hit points are system.hp; hit dice are system.hp.hd.
    if (normalized.health && normalized.hp === undefined && actorType !== ACTOR_TYPES.FACTION) {
      normalized.hp = normalized.health;
      delete normalized.health;
    }
    if (normalized.hitDice !== undefined) {
      normalized.hp = { ...(normalized.hp ?? {}), hd: String(normalized.hitDice) };
      delete normalized.hitDice;
    }

    // Ascending AC is system.aac.value. A bare `ac` number means the same thing here.
    for (const key of ['aac', 'ac'] as const) {
      if (typeof normalized[key] === 'number') {
        normalized.aac = { value: normalized[key] };
        if (key === 'ac') delete normalized.ac;
        break;
      }
    }

    // Class, background, level and morale live under system.details.
    const lifted: Record<string, any> = {};
    for (const key of ['class', 'background', 'alignment', 'level', 'morale']) {
      if (normalized[key] !== undefined && typeof normalized[key] !== 'object') {
        lifted[key] = normalized[key];
        delete normalized[key];
      }
    }
    if (Object.keys(lifted).length)
      normalized.details = { ...lifted, ...(normalized.details ?? {}) };

    return normalized;
  }
}
