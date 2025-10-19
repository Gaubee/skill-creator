/**
 * Unified search engine that uses adapter pattern for different search implementations
 *
 * This implementation follows the adapter pattern to provide a unified interface
 * for different search engines while maintaining type safety and extensibility.
 */

import { join } from 'node:path'
import type { SearchResult } from '../types/index.js'
import { ChromaSearchAdapter } from './chromaSearchAdapter.js'
import { FuzzySearchAdapter } from './fuzzySearchAdapter.js'

export interface UnifiedSearchOptions {
  type: 'chroma' | 'fuzzy' | 'auto'
  skillDir: string
  collectionName: string
  referencesDir: string
  enableChromaFallback?: boolean
  chromaStartupTimeout?: number
}

export class UnifiedSearchEngine {
  private engine: ChromaSearchAdapter | FuzzySearchAdapter | null = null
  private options: UnifiedSearchOptions

  constructor(options: UnifiedSearchOptions) {
    this.options = options
  }

  private async getEngine(): Promise<ChromaSearchAdapter | FuzzySearchAdapter> {
    if (!this.engine) {
      const engineType = this.determineEngineType()

      if (engineType === 'chroma') {
        this.engine = new ChromaSearchAdapter({
          skillDir: this.options.skillDir,
          collectionName: this.options.collectionName,
          startupTimeout: this.options.chromaStartupTimeout,
          enableFallback: this.options.enableChromaFallback,
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
    // ChromaDB 现在支持按需启动，可以正常使用
    // Default to fuzzy for reliability, but ChromaDB is available
    console.log('🤖 自动选择搜索引擎: 使用 fuzzy search（默认策略）')
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
      const chromaEngine = new ChromaSearchAdapter({
        skillDir: this.options.skillDir,
        collectionName: this.options.collectionName,
        startupTimeout: this.options.chromaStartupTimeout,
        enableFallback: this.options.enableChromaFallback,
      })
      results = await chromaEngine.search(query, { topK, where })
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
    // 如果是 auto 模式，先尝试 fuzzy 搜索，结果不佳时自动切换到 chroma
    if (this.options.type === 'auto') {
      console.log('🤖 Auto 模式: 先尝试 Fuzzy 搜索...')

      const fuzzyEngine = new FuzzySearchAdapter()
      const fuzzyResults = await fuzzyEngine.search(query, { topK, where })

      // 评估搜索结果质量
      const searchQuality = this.evaluateSearchQuality(fuzzyResults)
      console.log(
        `📊 Fuzzy 搜索质量评估: ${searchQuality.score.toFixed(2)} (${searchQuality.reason})`
      )

      // 如果搜索质量不佳，自动切换到 ChromaDB
      if (searchQuality.score < 0.3) {
        console.log('🔄 Fuzzy 搜索质量不佳，自动切换到 ChromaDB 搜索...')

        try {
          const chromaEngine = new ChromaSearchAdapter({
            skillDir: this.options.skillDir,
            collectionName: this.options.collectionName,
            startupTimeout: this.options.chromaStartupTimeout,
            enableFallback: this.options.enableChromaFallback,
          })

          const chromaResults = await chromaEngine.search(query, { topK, where })
          console.log(`✅ ChromaDB 搜索完成，找到 ${chromaResults.length} 个结果`)
          return chromaResults
        } catch (error) {
          console.log(
            '❌ ChromaDB 搜索失败，返回 Fuzzy 搜索结果:',
            error instanceof Error ? error.message : String(error)
          )
          return fuzzyResults
        }
      } else {
        console.log('✅ Fuzzy 搜索质量良好，直接返回结果')
        return fuzzyResults
      }
    }

    // 非 auto 模式，使用指定的引擎
    const engine = await this.getEngine()
    return engine.search(query, { topK, where })
  }

  /**
   * 评估搜索结果质量
   */
  private evaluateSearchQuality(results: SearchResult[]): { score: number; reason: string } {
    if (results.length === 0) {
      return { score: 0, reason: '没有搜索结果' }
    }

    // 检查最高分
    const topScore = results[0].score
    if (topScore < 0.2) {
      return { score: topScore, reason: '最高分太低' }
    }

    // 检查结果数量
    if (results.length < 2) {
      return { score: 0.25, reason: '结果数量太少' }
    }

    // 检查平均分
    const avgScore = results.reduce((sum, result) => sum + result.score, 0) / results.length
    if (avgScore < 0.3) {
      return { score: avgScore, reason: '平均分太低' }
    }

    // 综合评分
    const qualityScore = topScore * 0.6 + avgScore * 0.4
    return { score: qualityScore, reason: '搜索质量良好' }
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
