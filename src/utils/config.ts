/**
 * Configuration utilities
 */

import { z } from 'zod'
import { readFileSync, writeFileSync } from 'node:fs'

export const SkillConfigSchema = z.object({
  context7ProjectId: z.string().optional(),
})

export type SkillConfig = z.input<typeof SkillConfigSchema>

export class Config {
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
      return {}
    }
  }
}
