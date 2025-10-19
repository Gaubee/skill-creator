/**
 * Unified search engine that can use either ChromaDB or simple search
 */

import { join } from 'node:path'
import type { SearchResult } from '../types/index.js'
import { ChromaSearchEngine } from './chromaSearch.js'
import { FuzzySearchAdapter } from './fuzzySearchAdapter.js'

export interface UnifiedSearchOptions {
  type: 'chroma' | 'fuzzy' | 'auto'
  dbPath: string
  collectionName: string
  referencesDir: string
}

export class UnifiedSearchEngine {
  private engine: ChromaSearchEngine | FuzzySearchAdapter | null = null
  private options: UnifiedSearchOptions

  constructor(options: UnifiedSearchOptions) {
    this.options = options
  }

  private async getEngine(): Promise<ChromaSearchEngine | FuzzySearchAdapter> {
    if (!this.engine) {
      const engineType = this.determineEngineType()

      if (engineType === 'chroma') {
        this.engine = new ChromaSearchEngine({
          dbPath: this.options.dbPath,
          collectionName: this.options.collectionName,
        })
      } else {
        this.engine = new FuzzySearchAdapter()
      }
    }
    return this.engine
  }

  private determineEngineType(): 'chroma' | 'fuzzy' {
    if (this.options.type !== 'auto') {
      return this.options.type
    }

    // Auto mode: intelligent selection based on query characteristics
    // For now, default to fuzzy search as it's more reliable
    // Future enhancements could include:
    // - Query length analysis (short queries -> fuzzy, long queries -> chroma)
    // - Keyword detection (code snippets -> fuzzy, conceptual queries -> chroma)
    // - Performance metrics and fallback logic
    return 'fuzzy'
  }

  /**
   * Intelligent search engine selection based on query characteristics
   */
  private analyzeQueryAndSelectEngine(query: string): {
    engine: 'chroma' | 'fuzzy'
    reason: string
  } {
    const lowerQuery = query.toLowerCase().trim()

    // Code-related patterns - use simple search for exact matching
    const codePatterns = [
      /\bfunction\s+\w+\s*\(/,
      /\bclass\s+\w+/,
      /\bimport\s+.*from/,
      /\bconst\s+\w+\s*=/,
      /\blet\s+\w+\s*=/,
      /\bvar\s+\w+\s*=/,
      /=>\s*{/,
      /\.js$/,
      /\.ts$/,
      /\.jsx$/,
      /\.tsx$/,
      /\.py$/,
      /\.java$/,
      /\.cpp$/,
      /\.c$/,
      /\.go$/,
      /\.rs$/,
    ]

    const hasCodePattern = codePatterns.some((pattern) => pattern.test(query))

    // Short keyword searches - use simple search
    const isShortQuery = lowerQuery.length <= 10

    // Exact phrase searches (in quotes) - use simple search
    const hasExactPhrase = /^".*"$/.test(query.trim())

    // File extension searches - use simple search
    const hasFileExtension = /\.[a-zA-Z0-9]+$/.test(query)

    // Conceptual/semantic indicators - use chroma search
    const conceptualPatterns = [
      /\bhow\s+to\b/i,
      /\bwhat\s+is\b/i,
      /\bexplain\b/i,
      /\bconcept\b/i,
      /\btheory\b/i,
      /\bprinciple\b/i,
      /\barchitecture\b/i,
      /\bdesign\s+pattern\b/i,
      /\bbest\s+practice\b/i,
      /\bwhy\s+does\b/i,
      /\bwhen\s+to\b/i,
    ]

    const hasConceptualPattern = conceptualPatterns.some((pattern) => pattern.test(query))

    // Decision logic
    if (hasCodePattern) {
      return { engine: 'fuzzy', reason: 'Code pattern detected - using fuzzy text matching' }
    }

    if (hasExactPhrase) {
      return { engine: 'fuzzy', reason: 'Exact phrase search - using fuzzy text matching' }
    }

    if (hasFileExtension) {
      return { engine: 'fuzzy', reason: 'File extension search - using fuzzy text matching' }
    }

    if (isShortQuery) {
      return { engine: 'fuzzy', reason: 'Short keyword search - using fuzzy text matching' }
    }

    if (hasConceptualPattern) {
      return { engine: 'chroma', reason: 'Conceptual query detected - using semantic search' }
    }

    // Default: use fuzzy search for reliability
    return { engine: 'fuzzy', reason: 'Default - using fuzzy text search' }
  }

  async searchWithMode(
    query: string,
    mode: 'fuzzy' | 'chroma' | 'auto' = 'auto',
    topK: number = 5,
    where?: Record<string, any>
  ): Promise<{ results: SearchResult[]; engine: string; reason: string }> {
    let engineType: 'chroma' | 'fuzzy'
    let reason: string

    if (mode === 'auto') {
      const analysis = this.analyzeQueryAndSelectEngine(query)
      engineType = analysis.engine
      reason = analysis.reason
    } else {
      engineType = mode
      reason = `Manual selection - using ${mode} search`
    }

    let results: SearchResult[]

    if (engineType === 'chroma') {
      const chromaEngine = new ChromaSearchEngine({
        dbPath: this.options.dbPath,
        collectionName: this.options.collectionName,
      })
      results = await chromaEngine.search(query, topK, where)
    } else {
      const fuzzyEngine = new FuzzySearchAdapter()
      results = await fuzzyEngine.search(query, { topK, where })
    }

    return { results, engine: engineType, reason }
  }

  async buildIndex(referencesDir: string, hashFile: string): Promise<void> {
    const engine = await this.getEngine()
    await engine.buildIndex(referencesDir, hashFile)
  }

  async search(
    query: string,
    topK: number = 5,
    where?: Record<string, any>
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
