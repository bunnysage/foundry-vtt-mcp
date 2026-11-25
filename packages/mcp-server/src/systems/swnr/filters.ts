/**
 * SWNR Creature Filters
 *
 * Filter logic for Stars Without Number Revised creatures and NPCs.
 */

import { z } from 'zod';
import type { SWNRCreatureIndex } from '../types.js';

/**
 * SWNR filter schema
 */
export const SWNRFiltersSchema = z
  .object({
    hitDice: z
      .object({
        min: z.number().optional(),
        max: z.number().optional(),
      })
      .optional(),
    minHitPoints: z.number().optional(),
    maxHitPoints: z.number().optional(),
    minArmorClass: z.number().optional(),
    maxArmorClass: z.number().optional(),
    hasPsionics: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  })
  .strict();

export type SWNRFilters = z.infer<typeof SWNRFiltersSchema>;

/**
 * Check if a creature matches SWNR filters
 */
export function matchesSWNRFilters(creature: SWNRCreatureIndex, filters: SWNRFilters): boolean {
  const data = creature.systemData;
  if (!data) return false;

  // Hit Dice range
  if (filters.hitDice) {
    const hd = data.hitDice;
    if (hd === undefined) return false;
    if (filters.hitDice.min !== undefined && hd < filters.hitDice.min) return false;
    if (filters.hitDice.max !== undefined && hd > filters.hitDice.max) return false;
  }

  // Hit Points range
  if (filters.minHitPoints !== undefined) {
    const hp = data.hitPoints;
    if (hp === undefined || hp < filters.minHitPoints) return false;
  }
  if (filters.maxHitPoints !== undefined) {
    const hp = data.hitPoints;
    if (hp === undefined || hp > filters.maxHitPoints) return false;
  }

  // Armor Class range
  if (filters.minArmorClass !== undefined) {
    const ac = data.armorClass;
    if (ac === undefined || ac < filters.minArmorClass) return false;
  }
  if (filters.maxArmorClass !== undefined) {
    const ac = data.armorClass;
    if (ac === undefined || ac > filters.maxArmorClass) return false;
  }

  // Psionics flag
  if (filters.hasPsionics !== undefined) {
    if (data.hasPsionics !== filters.hasPsionics) return false;
  }

  // Tags (all must be present)
  if (filters.tags && filters.tags.length > 0) {
    const creatureTags = data.tags || [];
    for (const tag of filters.tags) {
      if (!creatureTags.some((t: string) => t.toLowerCase().includes(tag.toLowerCase()))) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Generate human-readable description of SWNR filters
 */
export function describeSWNRFilters(filters: SWNRFilters): string {
  const parts: string[] = [];

  if (filters.hitDice) {
    if (filters.hitDice.min !== undefined && filters.hitDice.max !== undefined) {
      parts.push(`HD ${filters.hitDice.min}-${filters.hitDice.max}`);
    } else if (filters.hitDice.min !== undefined) {
      parts.push(`HD ${filters.hitDice.min}+`);
    } else if (filters.hitDice.max !== undefined) {
      parts.push(`HD ≤${filters.hitDice.max}`);
    }
  }

  if (filters.minHitPoints !== undefined) {
    parts.push(`HP ≥${filters.minHitPoints}`);
  }
  if (filters.maxHitPoints !== undefined) {
    parts.push(`HP ≤${filters.maxHitPoints}`);
  }

  if (filters.minArmorClass !== undefined) {
    parts.push(`AC ≥${filters.minArmorClass}`);
  }
  if (filters.maxArmorClass !== undefined) {
    parts.push(`AC ≤${filters.maxArmorClass}`);
  }

  if (filters.hasPsionics !== undefined) {
    parts.push(filters.hasPsionics ? 'has psionics' : 'no psionics');
  }

  if (filters.tags && filters.tags.length > 0) {
    parts.push(`tags: ${filters.tags.join(', ')}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'no filters';
}
