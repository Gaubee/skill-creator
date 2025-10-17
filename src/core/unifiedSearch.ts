/**
 * Unified search engine that can use either ChromaDB or simple search
 */

import { join } from 'node:path'
import type { SearchResult } from '../types/index.js'
import { ChromaSearchEngine } from './chromaSearch.js'
import { SimpleSearchEngine } from './simpleSearch.js'

export interface UnifiedSearchOptions {
  type: 'chroma' | 'simple'
  dbPath: string
  collectionName: string
  referencesDir: string
}

export class UnifiedSearchEngine {
  private engine: ChromaSearchEngine | SimpleSearchEngine | null = null
  private options: UnifiedSearchOptions

  constructor(options: UnifiedSearchOptions) {
    this.options = options
  }

  private async getEngine(): Promise<ChromaSearchEngine | SimpleSearchEngine> {
    if (!this.engine) {
      if (this.options.type === 'chroma') {
        this.engine = new ChromaSearchEngine({
          dbPath: this.options.dbPath,
          collectionName: this.options.collectionName,
        })
      } else {
        this.engine = new SimpleSearchEngine({
          referencesDir: this.options.referencesDir,
          collectionName: this.options.collectionName,
        })
      }
    }
    return this.engine
  }

  async buildIndex(referencesDir: string, hashFile: string): Promise<void> {
    const engine = await this.getEngine()
    await engine.buildIndex(referencesDir, hashFile)
  }

  async search(
    query: string,
    topK: number = 5,
    where?: Record<string, any>,
  ): Promise<SearchResult[]> {
    const engine = await this.getEngine()
    return engine.search(query, topK, where)
  }

  async searchByPriority(query: string, topK: number = 5): Promise<SearchResult[]> {
    const engine = await this.getEngine()
    return engine.searchByPriority(query, topK)
  }

  async getStats(): Promise<{ totalDocuments: number }> {
    const engine = await this.getEngine()
    return engine.getStats()
  }
}