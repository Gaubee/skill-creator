/**
 * Search Engine Factory
 * Provides a simple way to create appropriate search engines based on options
 */

import type { SearchEngine } from './searchAdapter.js'
import { AutoSearchAdapter } from './autoSearchAdapter.js'
import { FuzzySearchAdapter } from './fuzzySearchAdapter.js'
import { ChromaSearchAdapter } from './chromaSearchAdapter.js'
import type { SkillConfig } from '../types/index.js'

export interface SearchEngineOptions {
  /** Search mode: auto, fuzzy, or chroma */
  mode?: 'auto' | 'fuzzy' | 'chroma'
  /** Skill directory for file operations */
  skillDir?: string
  /** References directory containing documentation */
  referencesDir?: string
  /** Skill configuration */
  config?: SkillConfig
  /** Additional options for adapters */
  adapterOptions?: {
    /** Enable ChromaDB fallback on failure */
    enableChromaFallback?: boolean
    /** ChromaDB startup timeout */
    chromaStartupTimeout?: number
    /** Auto search quality threshold */
    qualityThreshold?: number
  }
}

/**
 * Build and return appropriate search engine based on options
 */
export async function buildSearchEngine(options: SearchEngineOptions = {}): Promise<SearchEngine> {
  const { mode = 'auto', skillDir = '', referencesDir = '', config, adapterOptions = {} } = options

  switch (mode) {
    case 'auto':
      if (!config) {
        throw new Error('Config is required for auto mode')
      }

      return new AutoSearchAdapter({
        skillDir,
        collectionName: `skills`,
        enableChromaFallback: adapterOptions.enableChromaFallback ?? true,
        chromaStartupTimeout: adapterOptions.chromaStartupTimeout ?? 15000,
        qualityThreshold: adapterOptions.qualityThreshold ?? 0.3,
      })

    case 'fuzzy':
      return new FuzzySearchAdapter()

    case 'chroma':
      if (!config) {
        throw new Error('Config is required for chroma mode')
      }

      return new ChromaSearchAdapter({
        skillDir,
        collectionName: `skills`,
        startupTimeout: adapterOptions.chromaStartupTimeout ?? 15000,
        enableFallback: adapterOptions.enableChromaFallback ?? true,
      })

    default:
      throw new Error(`Invalid search mode: ${mode}. Use 'auto', 'fuzzy', or 'chroma'.`)
  }
}
