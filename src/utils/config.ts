/**
 * Configuration utilities
 */

import { z } from 'zod'
import { readFileSync, writeFileSync } from 'node:fs'
import type { SkillConfig } from '../types/index.js'

export const SkillConfigSchema = z.object({
  packageName: z.string().optional(),
  context7LibraryId: z.string().optional(),
})

export type SkillConfigInput = z.input<typeof SkillConfigSchema>

export class Config {
  static createDefault(options: { skillName: string; context7Id?: string }): SkillConfig {
    return {
      packageName: options.skillName,
      context7LibraryId: options.context7Id || '',
    }
  }

  static load(filePath: string): SkillConfig {
    try {
      const content = readFileSync(filePath, 'utf-8')
      const config = SkillConfigSchema.parse(JSON.parse(content))
      return config
    } catch (error) {
      throw new Error(`Failed to load config from ${filePath}: ${error}`)
    }
  }

  static save(config: SkillConfig, filePath: string): void {
    writeFileSync(filePath, JSON.stringify(config, null, 2))
  }

  static loadWithDefaults(filePath: string): SkillConfig {
    try {
      return this.load(filePath)
    } catch (error) {
      // If config file doesn't exist or is invalid, return a minimal default config
      console.warn(`⚠️  Warning: Could not load config from ${filePath}. Using default values.`)
      return {
        packageName: 'unknown',
      }
    }
  }
}
