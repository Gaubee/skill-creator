/**
 * Shared utilities for commands
 */

import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { Config } from '../utils/config.js'
import type { SkillConfig } from '../types/index.js'

/**
 * Load skill configuration from current directory
 */
export function loadSkillConfig(): SkillConfig {
  const configPath = join(process.cwd(), 'config.json')

  if (!existsSync(configPath)) {
    console.warn('⚠️  config.json not found. Using default configuration.')
    return {}
  }

  return Config.loadWithDefaults(configPath)
}

/**
 * Parse command line arguments
 */
export function parseArgs(
  args: string[],
  definitions: Array<{
    name: string
    alias?: string
    type: 'string' | 'number' | 'boolean'
    required?: boolean
    default?: any
  }>
): Record<string, any> {
  const result: Record<string, any> = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const def = definitions.find((d) => d.name === key || d.alias === key)

      if (def) {
        if (def.type === 'boolean') {
          result[key] = true
        } else if (i + 1 < args.length) {
          const value = args[++i]
          result[key] = def.type === 'number' ? Number(value) : value
        }
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1)
      const def = definitions.find((d) => d.alias === key)

      if (def) {
        if (def.type === 'boolean') {
          result[def.name] = true
        } else if (i + 1 < args.length) {
          const value = args[++i]
          result[def.name] = def.type === 'number' ? Number(value) : value
        }
      }
    }
  }

  // Check for required arguments
  for (const def of definitions) {
    if (def.required && !(def.name in result)) {
      console.error(`❌ Required argument --${def.name} is missing`)
      process.exit(1)
    }
  }

  // Apply defaults
  for (const def of definitions) {
    if (!(def.name in result) && def.default !== undefined) {
      result[def.name] = def.default
    }
  }

  return result
}

/**
 * Create search engine instance
 */
export async function createSearchEngine(
  config: SkillConfig,
  searchMode: 'chroma' | 'fuzzy' | 'auto' = 'auto',
  useFormatting: boolean = true
) {
  const { UnifiedSearchEngine } = await import('../core/unifiedSearch.js')

  return new UnifiedSearchEngine({
    mode: searchMode,
    skillDir: join(process.cwd(), 'assets'),
    referencesDir: join(process.cwd(), 'assets', 'references'),
    config,
    skillPath: process.cwd(),
    format: useFormatting ? 'enhanced' : undefined,
    adapterOptions: {
      enableChromaFallback: true,
      chromaStartupTimeout: 15000,
      qualityThreshold: 0.3,
    },
    formatting: {
      maxPreviewLength: 200,
      showFullContentThreshold: 0.8,
      minScoreForPreview: 0.3,
      showLineNumbers: true,
    },
  })
}
