/**
 * Auto Search Adapter
 * Intelligently selects and switches between search engines based on query characteristics
 * and search quality evaluation
 */

import type { SearchEngine, SearchResult, SearchOptions } from './searchAdapter.js'
import { FuzzySearchAdapter } from './fuzzySearchAdapter.js'
import { ChromaSearchAdapter } from './chromaSearchAdapter.js'

export interface AutoSearchOptions {
  /** Skill directory for ChromaDB */
  skillDir: string
  /** ChromaDB collection name */
  collectionName: string
  /** Enable ChromaDB fallback on failure */
  enableChromaFallback?: boolean
  /** ChromaDB startup timeout in milliseconds */
  chromaStartupTimeout?: number
  /** Quality threshold for switching engines */
  qualityThreshold?: number
}

/**
 * Auto Search Adapter
 * Implements intelligent search engine selection and automatic switching
 */
export class AutoSearchAdapter implements SearchEngine {
  private fuzzyAdapter: FuzzySearchAdapter
  private chromaAdapter: ChromaSearchAdapter | null = null
  private options: AutoSearchOptions

  constructor(options: AutoSearchOptions) {
    this.options = options
    this.fuzzyAdapter = new FuzzySearchAdapter()

    // ChromaDB adapter created on-demand for better performance
  }

  private async getChromaAdapter(): Promise<ChromaSearchAdapter> {
    if (!this.chromaAdapter) {
      this.chromaAdapter = new ChromaSearchAdapter({
        skillDir: this.options.skillDir,
        collectionName: this.options.collectionName,
        startupTimeout: this.options.chromaStartupTimeout || 15000,
        enableFallback: this.options.enableChromaFallback || true,
      })
    }
    return this.chromaAdapter
  }

  async buildIndex(referencesDir: string): Promise<void> {
    // Always build fuzzy index (fast and reliable)
    await this.fuzzyAdapter.buildIndex(referencesDir)

    // Build ChromaDB index only if needed (on-demand)
    // This prevents unnecessary ChromaDB startup for simple searches
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const { topK = 5, where } = options
    const qualityThreshold = this.options.qualityThreshold || 0.3

    console.log('🤖 Auto Mode: Starting with Fuzzy search...')

    // Always start with fuzzy search (fast, reliable, no external dependencies)
    const fuzzyResults = await this.fuzzyAdapter.search(query, { topK, where })

    // Evaluate search quality
    const quality = this.evaluateSearchQuality(fuzzyResults, query)
    console.log(`📊 Fuzzy search quality: ${quality.score.toFixed(2)} (${quality.reason})`)

    // If fuzzy search quality is good, return results
    if (quality.score >= qualityThreshold) {
      console.log('✅ Fuzzy search quality satisfactory, returning results')
      return fuzzyResults
    }

    // Try ChromaDB for better semantic understanding
    console.log('🔄 Fuzzy search quality below threshold, trying ChromaDB...')

    try {
      const chromaAdapter = await this.getChromaAdapter()
      const chromaResults = await chromaAdapter.search(query, { topK, where })
      console.log(`✅ ChromaDB search completed, found ${chromaResults.length} results`)
      return chromaResults
    } catch (error) {
      console.log(
        `❌ ChromaDB search failed, returning fuzzy results:`,
        error instanceof Error ? error.message : String(error)
      )
      return fuzzyResults
    }
  }

  /**
   * Evaluate search result quality
   */
  private evaluateSearchQuality(
    results: SearchResult[],
    query: string
  ): { score: number; reason: string } {
    if (results.length === 0) {
      return { score: 0, reason: 'No results found' }
    }

    // Quick win: check for exact matches
    const topResult = results[0]
    const queryLower = query.toLowerCase()

    if (topResult.title.toLowerCase().includes(queryLower)) {
      return { score: 1.0, reason: 'Exact title match found' }
    }

    // Check score distribution
    const scores = results.map((r) => r.score)
    const maxScore = Math.max(...scores)
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length

    // High score threshold
    if (maxScore >= 0.8) {
      return { score: maxScore, reason: 'High quality matches found' }
    }

    // Multiple decent results
    if (results.length >= 3 && avgScore >= 0.5) {
      return { score: avgScore, reason: 'Multiple decent quality results' }
    }

    // Low quality indicators
    if (maxScore < 0.3) {
      return { score: maxScore, reason: 'Low quality matches only' }
    }

    if (results.length < 2) {
      return { score: maxScore * 0.8, reason: 'Too few results' }
    }

    // Default: return average score
    return { score: avgScore, reason: 'Average quality results' }
  }

  isBuilt(): boolean {
    return this.fuzzyAdapter.isBuilt()
  }

  async getStats(): Promise<{ totalDocuments: number }> {
    return this.fuzzyAdapter.getStats()
  }

  async searchByPriority(query: string, topK: number = 5): Promise<SearchResult[]> {
    return this.search(query, { topK })
  }

  clearIndex(): void {
    this.fuzzyAdapter.clearIndex()
    if (this.chromaAdapter) {
      this.chromaAdapter.clearIndex()
    }
  }
}
