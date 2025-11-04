/**
 * Configuration utilities
 */

import { z } from 'zod'
import { readFileSync, writeFileSync } from 'node:fs'

export const Context7ProjectInfoSchema = z.object({
  downloadedAt: z.string(),
  filesCount: z.number(),
})

export const SkillConfigSchema = z.object({
  // Legacy field for backward compatibility
  context7ProjectId: z.string().optional(),
  // New field to support multiple context7 projects
  context7Projects: z.record(z.string(), Context7ProjectInfoSchema).optional(),
})

export type SkillConfig = z.input<typeof SkillConfigSchema>
export type Context7ProjectInfo = z.input<typeof Context7ProjectInfoSchema>

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
