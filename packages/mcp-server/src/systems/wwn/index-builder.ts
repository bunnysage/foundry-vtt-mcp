/**
 * Worlds Without Number Index Builder
 *
 * Runs in Foundry's browser context to build the enhanced creature index.
 * Handles character, NPC, and monster actor types for the wwn system.
 */

import type { IndexBuilder, SystemCreatureIndex } from '../types.js';
import type { WWNCreatureIndex } from '../types.js';
import { ACTOR_TYPES, calcMod, ATTRIBUTE_NAMES } from './constants.js';

export class WWNIndexBuilder implements IndexBuilder {
  getSystemId() {
    return 'wwn' as const;
  }

  async buildIndex(packs: any[], _force = false): Promise<SystemCreatureIndex[]> {
    const creatures: SystemCreatureIndex[] = [];

    for (const pack of packs) {
      const { creatures: packCreatures } = await this.extractDataFromPack(pack);
      creatures.push(...packCreatures);
    }

    return creatures;
  }

  async extractDataFromPack(
    pack: any
  ): Promise<{ creatures: SystemCreatureIndex[]; errors: number }> {
    const creatures: WWNCreatureIndex[] = [];
    let errors = 0;

    try {
      const documents = await pack.getDocuments();

      for (const doc of documents) {
        // Index character, NPC, and monster actor types
        if (
          doc.type !== ACTOR_TYPES.CHARACTER &&
          doc.type !== ACTOR_TYPES.NPC &&
          doc.type !== ACTOR_TYPES.MONSTER
        ) {
          continue;
        }

        try {
          const creature = this.extractFromDocument(doc, pack);
          if (creature) creatures.push(creature);
        } catch {
          errors++;
        }
      }
    } catch {
      errors++;
    }

    return { creatures, errors };
  }

  private extractFromDocument(doc: any, pack: any): WWNCreatureIndex | null {
    const system = doc.system ?? {};

    // ── Attributes ───────────────────────────────────────────────────────────
    const attributes: Record<string, { value: number; mod: number }> = {};
    if (system.stats) {
      for (const [key, attrData] of Object.entries(system.stats)) {
        const a = attrData as any;
        const value = typeof a === 'number' ? a : (a.value ?? a.base ?? 10);
        const mod = typeof a === 'object' && a.mod !== undefined ? a.mod : calcMod(value);
        const names = ATTRIBUTE_NAMES[key.toLowerCase()];
        if (names) {
          attributes[names.short] = { value, mod };
        }
      }
    }

    // ── Hit Points ───────────────────────────────────────────────────────────
    let hitPoints: number | undefined;
    if (system.health) {
      hitPoints = system.health.max ?? system.health.value;
    }

    // ── Armor Class ──────────────────────────────────────────────────────────
    let armorClass: number | undefined;
    if (system.ac !== undefined) {
      armorClass = typeof system.ac === 'object' ? system.ac.value : system.ac;
    }

    // ── Hit Dice ─────────────────────────────────────────────────────────────
    const hitDice = system.hitDice ?? system.hd ?? undefined;

    // ── Magic detection ──────────────────────────────────────────────────────
    // Check for spells or arts in items
    const items: any[] = Array.isArray(doc.items) ? doc.items : [];
    const hasMagic = items.some(
      (item: any) =>
        item.type === 'spell' ||
        item.type === 'art' ||
        item.type === 'gift' ||
        (item.type === 'skill' && ['cast', 'magic', 'pray'].includes(item.name?.toLowerCase()))
    );

    // ── Tags ─────────────────────────────────────────────────────────────────
    const tags: string[] = system.tags || [];

    const systemData: WWNCreatureIndex['systemData'] = {
      attributes,
      hasMagic,
      tags,
    };
    if (hitPoints !== undefined) systemData.hitPoints = hitPoints;
    if (armorClass !== undefined) systemData.armorClass = armorClass;
    if (hitDice !== undefined) systemData.hitDice = hitDice;

    return {
      id: doc.id,
      name: doc.name,
      type: doc.type,
      packName: pack.collection,
      packLabel: pack.metadata?.label ?? pack.collection,
      img: doc.img,
      system: 'wwn',
      systemData,
    };
  }
}
