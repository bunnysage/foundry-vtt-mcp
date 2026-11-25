/**
 * Worlds Without Number System Module
 *
 * Exports for wwn system support in the Registry Pattern architecture.
 */

// Type definitions (from central types.ts)
export type { WWNCreatureIndex } from '../types.js';

// Index builder (runs in Foundry browser context)
export { WWNIndexBuilder } from './index-builder.js';

// System adapter (runs in MCP server Node.js context)
export { WWNAdapter } from './adapter.js';

// Filter system
export { WWNFiltersSchema, matchesWWNFilters, describeWWNFilters } from './filters.js';
export type { WWNFilters } from './filters.js';

// Constants
export {
  ATTRIBUTE_NAMES,
  ACTOR_TYPES,
  ITEM_TYPES,
  FIELD_PATHS,
  COMMON_SKILLS,
  calcMod,
} from './constants.js';
