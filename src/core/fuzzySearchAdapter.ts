import uFuzzy from '@leeoniya/ufuzzy'
import type {
  SearchEngine,
  SearchResult,
  SearchOptions,
  FuzzySearchFunction,
} from './searchAdapter'
import { glob } from 'glob'
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Enhanced search result with additional metadata
 */
export interface EnhancedSearchResult extends SearchResult {
  relativePath: string
  preview?: string
  fullContent?: string
  matchRanges?: number[][]
}

/**
 * Extended search options for enhanced functionality
 */
export interface EnhancedSearchOptions extends SearchOptions {
  skillPath?: string
  showFullContentThreshold?: number
  minScoreForPreview?: number
}

/**
 * uFuzzy-based Search Engine Adapter
 * Implements the SearchEngine interface using uFuzzy library
 */
export class FuzzySearchAdapter implements SearchEngine {
  private documents: Array<{
    id: string
    title: string
    content: string
    source: 'user' | 'context7'
    file_path: string
    metadata: any
  }> = []

  private fuzzy: uFuzzy
  private lastSearchInfo: Map<string, any> = new Map() // Store search info for score calculation

  constructor() {
    // Initialize uFuzzy with sensible defaults
    this.fuzzy = new uFuzzy({
      unicode: true,
    })
  }

  async buildIndex(referencesDir: string, hashFile: string): Promise<void> {
    console.log('🔨 Building fuzzy search index with uFuzzy...')

    const files = await glob('**/*.md', { cwd: referencesDir })

    if (files.length === 0) {
      console.log('No documentation files found to index')
      return
    }

    this.documents = []

    for (const filePath of files) {
      try {
        const fullPath = `${referencesDir}/${filePath}`
        const content = readFileSync(fullPath, 'utf-8')

        // Extract title from first line or filename
        const lines = content.split('\n')
        const title =
          lines[0]?.replace(/^#+\s*/, '').trim() ||
          filePath.replace(/\.md$/, '').replace(/[-_]/g, ' ')

        const source = filePath.includes('context7/') ? 'context7' : 'user'

        this.documents.push({
          id: filePath,
          title,
          content,
          source: source as 'user' | 'context7',
          file_path: fullPath,
          metadata: {
            file_name: filePath,
            file_path: fullPath,
          },
        })
      } catch (error) {
        console.warn(`Failed to process file ${filePath}:`, error)
      }
    }

    console.log(`✅ Fuzzy search index built with ${this.documents.length} documents`)
  }

  /**
   * Enhanced fuzzy search function that returns both indices and detailed info
   */
  private fuzzySearchWithInfo(
    haystack: string[],
    needle: string
  ): {
    indices: number[]
    info: any
  } {
    if (!needle || needle.length < 1) return { indices: [], info: null }
    if (!haystack || haystack.length === 0) return { indices: [], info: null }

    const idxs = this.fuzzy.filter(haystack, needle)

    if (!idxs || idxs.length === 0) {
      return { indices: [], info: null }
    }

    const info = this.fuzzy.info(idxs, haystack, needle)
    const order = this.fuzzy.sort(info, haystack, needle)

    // Store info for later score calculation
    const searchKey = `${needle}-${JSON.stringify(haystack.slice(0, 3))}` // Simple cache key
    this.lastSearchInfo.set(searchKey, info)

    const indices = order.map((sortedIdx: number) => {
      // info.idx directly contains the original haystack indices
      return info.idx[sortedIdx]
    })

    return { indices, info }
  }

  /**
   * Original fuzzy search function for backward compatibility
   */
  private fuzzySearch(haystack: string[], needle: string): number[] {
    const result = this.fuzzySearchWithInfo(haystack, needle)
    return result.indices
  }

  /**
   * Enhanced search with intelligent content extraction and scoring
   */
  async enhancedSearch(
    query: string,
    options: EnhancedSearchOptions = {}
  ): Promise<EnhancedSearchResult[]> {
    const {
      topK = 5,
      where,
      skillPath = '',
      showFullContentThreshold = 0.8,
      minScoreForPreview = 0.3,
    } = options

    if (this.documents.length === 0) {
      console.warn('Search index not built. Call buildIndex() first.')
      return []
    }

    // Filter documents by source if specified
    let searchableDocs = this.documents
    if (where?.source) {
      searchableDocs = this.documents.filter((doc) => doc.source === where.source)
    }

    if (searchableDocs.length === 0) {
      return []
    }

    const candidates: Array<{
      doc: any
      score: number
      matchType: string
      info?: any
      ranges?: number[][]
    }> = []

    // Prepare search arrays
    const titles = searchableDocs.map((doc) => doc.title)
    const contents = searchableDocs.map((doc) => doc.content)
    const fileNames = searchableDocs.map((doc) => doc.metadata.file_name)

    // Search in titles (highest priority)
    const titleResult = this.fuzzySearchWithInfo(titles, query)
    titleResult.indices.forEach((idx, i) => {
      const doc = searchableDocs[idx]
      if (doc) {
        candidates.push({
          doc,
          score: this.calculateFuzzyScore(titleResult.info, i),
          matchType: 'title',
          info: titleResult.info,
          ranges: titleResult.info?.ranges,
        })
      }
    })

    // Search in content (medium priority)
    const contentResult = this.fuzzySearchWithInfo(contents, query)
    contentResult.indices.forEach((idx, i) => {
      const doc = searchableDocs[idx]
      if (doc && !candidates.find((c) => c.doc.id === doc.id)) {
        candidates.push({
          doc,
          score: this.calculateFuzzyScore(contentResult.info, i) * 0.7, // Reduce score for content matches
          matchType: 'content',
          info: contentResult.info,
          ranges: contentResult.info?.ranges,
        })
      }
    })

    // Search in file names (lowest priority)
    const fileNameResult = this.fuzzySearchWithInfo(fileNames, query)
    fileNameResult.indices.forEach((idx, i) => {
      const doc = searchableDocs[idx]
      if (doc && !candidates.find((c) => c.doc.id === doc.id)) {
        candidates.push({
          doc,
          score: this.calculateFuzzyScore(fileNameResult.info, i) * 0.5, // Reduce score for filename matches
          matchType: 'filename',
          info: fileNameResult.info,
          ranges: fileNameResult.info?.ranges,
        })
      }
    })

    // Sort by score and convert to EnhancedSearchResult
    const sortedCandidates = candidates.sort((a, b) => b.score - a.score).slice(0, topK)

    const maxScore = sortedCandidates.length > 0 ? sortedCandidates[0].score : 0
    const modifiedAverageScore = this.calculateModifiedAverage(sortedCandidates)

    return sortedCandidates.map((candidate) => {
      const { doc, score, matchType, info, ranges } = candidate
      const relativePath = skillPath ? relative(skillPath, doc.file_path) : doc.file_path

      // User's three-tier display strategy: scope == maxScope, scope >= averageScope, scope < averageScope
      let content: string
      let preview: string | undefined
      let fullContent: string | undefined

      if (Math.abs(score - maxScore) < 0.001) {
        // Tier 1: 显示FileContent - 当scope == maxScope时（最高优先级）
        const lineCount = doc.content.split('\n').length
        fullContent = `<content lines="${lineCount}">\n${doc.content}\n</content>`
        content = fullContent
      } else if (score >= modifiedAverageScore) {
        // Tier 2: 显示Preview（提取匹配的行的内容）- 当scope >= modifiedAverage时
        const rawPreview = this.extractRangePreview(doc.content, ranges)
        if (rawPreview) {
          // Extract line numbers from preview and wrap in limit-content tag
          const lineNumbers = this.extractLineNumbersFromPreview(rawPreview)
          preview = `<limit-content lines-indexs="${lineNumbers.join(',')}">\n${rawPreview}\n</limit-content>`
          content = preview
        } else {
          content = ''
        }
      } else {
        // Tier 3: 不显示任何内容，只提供Filepath等基础的文件元数据信息 - 当scope < modifiedAverage时
        content = '' // No content, only metadata
      }

      return {
        id: doc.id,
        title: doc.title,
        content: content,
        source: doc.source,
        file_path: relativePath,
        score,
        metadata: {
          ...doc.metadata,
          matchType,
          originalScore: score,
          maxScore,
          modifiedAverageScore,
          displayTier:
            Math.abs(score - maxScore) < 0.001
              ? 'full'
              : score >= modifiedAverageScore
                ? 'preview'
                : 'metadata',
        },
        relativePath,
        preview,
        fullContent,
        matchRanges: ranges,
      }
    })
  }

  /**
   * Calculate modified average score (remove highest and lowest scores)
   * This prevents extreme values from skewing the average
   */
  private calculateModifiedAverage(candidates: Array<{ score: number }>): number {
    const scores = candidates.map((c) => c.score)
    const count = scores.length

    if (count === 0) return 0
    if (count === 1) return scores[0]
    if (count === 2) return (scores[0] + scores[1]) / 2

    // For 3 or more scores, remove highest and lowest, then average the rest
    const sortedScores = [...scores].sort((a, b) => b - a) // descending
    const filteredScores = sortedScores.slice(1, -1) // remove first (highest) and last (lowest)

    if (filteredScores.length === 0) {
      // This happens when we have 3 scores and the highest and lowest are the same value
      return sortedScores.reduce((sum, score) => sum + score, 0) / count
    }

    return filteredScores.reduce((sum, score) => sum + score, 0) / filteredScores.length
  }

  /**
   * Extract line numbers from preview text (format: "1: line content")
   */
  private extractLineNumbersFromPreview(preview: string): number[] {
    const lines = preview.split('\n')
    const lineNumbers: number[] = []

    lines.forEach((line) => {
      const match = line.match(/^(\d+):\s*/)
      if (match) {
        lineNumbers.push(parseInt(match[1], 10))
      }
    })

    return lineNumbers
  }

  /**
   * Calculate fuzzy search score based on uFuzzy info
   */
  private calculateFuzzyScore(info: any, resultIndex: number): number {
    if (!info) return 0

    const { chars, terms, interIns, intraIns } = info

    // uFuzzy chars is the number of matched characters, not a ratio
    // We need to calculate score based on match quality
    const matchedChars = chars[resultIndex] || 0
    const queryLength = 10 // "validation" has 10 characters

    // Base score: how well the query matches (0-1 scale)
    const matchQuality = Math.min(1, matchedChars / queryLength)

    // Penalty for insertions (makes match less perfect)
    const insertionPenalty = (interIns[resultIndex] + intraIns[resultIndex]) * 0.02

    // Final score (0-1)
    const finalScore = Math.max(0, Math.min(1, matchQuality - insertionPenalty))

    return finalScore
  }

  /**
   * Extract preview with line numbers based on match ranges
   */
  /**
   * Build character position to line number mapping
   */
  private buildCharToLineMap(
    content: string
  ): Array<{ charStart: number; charEnd: number; lineNum: number; line: string }> {
    const lines = content.split('\n')
    const mapping: Array<{ charStart: number; charEnd: number; lineNum: number; line: string }> = []
    let currentPos = 0

    lines.forEach((line, index) => {
      const charEnd = currentPos + line.length
      mapping.push({
        charStart: currentPos,
        charEnd: charEnd,
        lineNum: index + 1, // 1-based line numbers
        line: line,
      })
      currentPos = charEnd + 1 // +1 for \n
    })

    return mapping
  }

  /**
   * Extract preview content using uFuzzy ranges with line numbers
   * Follows user's requirement: 遍历chars(number[])，基于line与range的关系提取lines(number[])
   */
  private extractRangePreview(content: string, ranges?: number[][]): string | undefined {
    if (!ranges || ranges.length === 0) {
      return undefined
    }

    const charToLineMap = this.buildCharToLineMap(content)
    const matchedLines = new Set<number>()

    // 遍历ranges中的每个匹配 [start, end]
    ranges.forEach(([start, end]) => {
      // 基于字符位置到行号的映射关系，找到包含这个range的line
      for (const { charStart, charEnd, lineNum } of charToLineMap) {
        if (start < charEnd && end > charStart) {
          matchedLines.add(lineNum)
        }
      }
    })

    if (matchedLines.size === 0) {
      return undefined
    }

    // 构建带行号的预览内容
    const sortedLines = Array.from(matchedLines).sort((a, b) => a - b)
    const previewLines = sortedLines
      .map((lineNum) => {
        const lineData = charToLineMap.find((m) => m.lineNum === lineNum)
        return lineData ? `${lineNum}: ${lineData.line}` : ''
      })
      .filter((line) => line.length > 0)

    return previewLines.join('\n')
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    // Check if enhanced options are provided
    const enhancedOptions = options as any
    if (enhancedOptions.skillPath || enhancedOptions.showFullContentThreshold) {
      // Use enhanced search and return EnhancedSearchResult objects directly
      const enhancedResults = await this.enhancedSearch(query, enhancedOptions)
      // Cast to SearchResult[] to maintain interface compatibility
      return enhancedResults as any
    }

    // Basic search (backward compatibility)
    const { topK = 5, where } = options

    if (this.documents.length === 0) {
      console.warn('Search index not built. Call buildIndex() first.')
      return []
    }

    // Filter documents by source if specified
    let searchableDocs = this.documents
    if (where?.source) {
      searchableDocs = this.documents.filter((doc) => doc.source === where.source)
    }

    if (searchableDocs.length === 0) {
      return []
    }

    const results: SearchResult[] = []
    const seenIds = new Set<string>()

    // Prepare search arrays
    const titles = searchableDocs.map((doc) => doc.title)
    const contents = searchableDocs.map((doc) => doc.content)
    const fileNames = searchableDocs.map((doc) => doc.metadata.file_name)

    // Search in titles (highest priority - score 1.0)
    const titleMatches = this.fuzzySearch(titles, query)
    titleMatches.forEach((idx) => {
      const doc = searchableDocs[idx]
      if (doc && !seenIds.has(doc.id)) {
        seenIds.add(doc.id)
        results.push({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          source: doc.source,
          file_path: doc.file_path,
          score: 1.0,
          metadata: {
            ...doc.metadata,
            matchType: 'title',
          },
        })
      }
    })

    // Search in content (medium priority - score 0.7)
    const contentMatches = this.fuzzySearch(contents, query)
    contentMatches.forEach((idx) => {
      const doc = searchableDocs[idx]
      if (doc && !seenIds.has(doc.id)) {
        seenIds.add(doc.id)
        results.push({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          source: doc.source,
          file_path: doc.file_path,
          score: 0.7,
          metadata: {
            ...doc.metadata,
            matchType: 'content',
          },
        })
      }
    })

    // Search in file names (lowest priority - score 0.5)
    const fileNameMatches = this.fuzzySearch(fileNames, query)
    fileNameMatches.forEach((idx) => {
      const doc = searchableDocs[idx]
      if (doc && !seenIds.has(doc.id)) {
        seenIds.add(doc.id)
        results.push({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          source: doc.source,
          file_path: doc.file_path,
          score: 0.5,
          metadata: {
            ...doc.metadata,
            matchType: 'filename',
          },
        })
      }
    })

    // Sort by score and limit results
    return results.sort((a, b) => b.score - a.score).slice(0, topK)
  }

  isBuilt(): boolean {
    return this.documents.length > 0
  }

  getStats() {
    const userDocs = this.documents.filter((doc) => doc.source === 'user')
    const context7Docs = this.documents.filter((doc) => doc.source === 'context7')

    return {
      totalDocuments: this.documents.length,
      userDocuments: userDocs.length,
      context7Documents: context7Docs.length,
      engine: 'uFuzzy',
    }
  }

  clearIndex(): void {
    this.documents = []
  }

  /**
   * Public method for testing the core fuzzy search logic
   */
  testFuzzySearch: FuzzySearchFunction = (haystack: string[], needle: string) => {
    return this.fuzzySearch(haystack, needle)
  }

  async searchByPriority(query: string, topK: number = 5): Promise<SearchResult[]> {
    // Search with priority on user documents first
    const userResults = await this.search(query, {
      topK: Math.ceil(topK / 2),
      where: { source: 'user' },
    })
    const context7Results = await this.search(query, {
      topK: Math.ceil(topK / 2),
      where: { source: 'context7' },
    })

    // Combine and sort by score
    const allResults = [...userResults, ...context7Results]
      .sort((a, b) => {
        // User documents get priority boost
        const aBoost = a.source === 'user' ? 0.2 : 0
        const bBoost = b.source === 'user' ? 0.2 : 0
        return b.score + bBoost - (a.score + aBoost)
      })
      .slice(0, topK)

    return allResults
  }
}
