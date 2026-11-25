/**
 * Stars Without Number Revised System Module
 *
 * Exports for swnr system support in the Registry Pattern architecture.
 */

// Type definitions (from central types.ts)
export type { SWNRCreatureIndex } from '../types.js';

// Index builder (runs in Foundry browser context)
export { SWNRIndexBuilder } from './index-builder.js';

// System adapter (runs in MCP server Node.js context)
export { SWNRAdapter } from './adapter.js';

// Filter system
export { SWNRFiltersSchema, matchesSWNRFilters, describeSWNRFilters } from './filters.js';
export type { SWNRFilters } from './filters.js';

// Constants
export {
  ATTRIBUTE_NAMES,
  ACTOR_TYPES,
  ITEM_TYPES,
  FIELD_PATHS,
  COMMON_SKILLS,
  PSIONIC_SKILLS,
  calcMod,
} from './constants.js';
