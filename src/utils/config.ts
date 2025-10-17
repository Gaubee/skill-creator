/**
 * Configuration utilities
 */

import { z } from 'zod'
import { readFileSync, writeFileSync } from 'node:fs'
import type { SkillConfig } from '../types/index.js'

export const SkillConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  context7_library_id: z.string(),
  version: z.string(),
  chunk_size: z.number(),
  chunk_overlap: z.number(),
  embedding_model: z.string(),
  similarity_threshold: z.number(),
  max_search_results: z.number(),
})

export type SkillConfigInput = z.input<typeof SkillConfigSchema>

export class Config {
  static createDefault(options: {
    skillName: string
    description: string
    context7Id: string
  }): SkillConfig {
    return {
      name: options.skillName,
      description: options.description,
      context7LibraryId: options.context7Id,
      version: '1.0.0',
      chunkSize: 1000,
      chunkOverlap: 200,
      embeddingModel: 'all-MiniLM-L6-v2',
      similarityThreshold: 0.85,
      maxSearchResults: 10,
    }
  }

  static load(filePath: string): SkillConfig {
    try {
      const content = readFileSync(filePath, 'utf-8')
      const raw = JSON.parse(content)
      const config = SkillConfigSchema.parse(raw)

      // Convert snake_case to camelCase
      return {
        name: config.name,
        description: config.description,
        context7LibraryId: config.context7_library_id,
        version: config.version,
        chunkSize: config.chunk_size,
        chunkOverlap: config.chunk_overlap,
        embeddingModel: config.embedding_model,
        similarityThreshold: config.similarity_threshold,
        maxSearchResults: config.max_search_results,
      }
    } catch (error) {
      throw new Error(`Failed to load config from ${filePath}: ${error}`)
    }
  }

  static save(config: SkillConfig, filePath: string): void {
    // Convert camelCase to snake_case for JSON
    const raw = {
      name: config.name,
      description: config.description,
      context7_library_id: config.context7LibraryId,
      version: config.version,
      chunk_size: config.chunkSize,
      chunk_overlap: config.chunkOverlap,
      embedding_model: config.embeddingModel,
      similarity_threshold: config.similarityThreshold,
      max_search_results: config.maxSearchResults,
    }

    writeFileSync(filePath, JSON.stringify(raw, null, 2))
  }
}