/**
 * Enhanced formatter for search results
 * Implements three-tier display strategy based on search quality scores
 */

import type {
  SearchResult,
  FormattableSearchResult,
  FormattingOptions,
  FormattedResult,
  SearchFormatter
} from './types.js'
import { relative } from 'node:path'

/**
 * Enhanced formatter - three-tier display based on search quality
 *
 * Tier 1 (score >= maxScore): Show full content
 * Tier 2 (score >= modifiedAverageScore): Show preview with line numbers
 * Tier 3 (score < modifiedAverageScore): Show metadata only
 */
export class EnhancedFormatter implements SearchFormatter {
  getName(): string {
    return 'enhanced'
  }

  getDescription(): string {
    return 'Three-tier enhanced format with intelligent content display'
  }

  format(
    results: SearchResult[],
    options: FormattingOptions
  ): FormattedResult[] {
    if (results.length === 0) {
      return []
    }

    // Calculate search quality metrics
    const qualityMetrics = this.calculateQualityMetrics(results)

    // Enhance results with quality information
    const enhancedResults = this.enhanceResults(results, qualityMetrics, options)

    // Format based on display tiers
    return enhancedResults.map((result, index) => {
      const formattedContent = this.formatByTier(result, options)
      const contentType = this.getContentType(result)

      return {
        result,
        content: formattedContent,
        contentType,
        priority: index
      }
    })
  }

  /**
   * Calculate quality metrics for search results
   */
  private calculateQualityMetrics(results: SearchResult[]) {
    if (results.length === 0) {
      return { maxScore: 0, averageScore: 0, modifiedAverageScore: 0 }
    }

    const scores = results.map(r => r.score)
    const maxScore = Math.max(...scores)

    // Calculate modified average (remove highest and lowest scores)
    const sortedScores = [...scores].sort((a, b) => a - b)
    let modifiedAverageScore = maxScore

    if (sortedScores.length >= 3) {
      // Remove highest and lowest, then average
      const middleScores = sortedScores.slice(1, -1)
      modifiedAverageScore = middleScores.reduce((sum, score) => sum + score, 0) / middleScores.length
    } else if (sortedScores.length === 2) {
      // With only 2 scores, use the lower one as modified average
      modifiedAverageScore = sortedScores[0]
    }

    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length

    return {
      maxScore,
      averageScore,
      modifiedAverageScore
    }
  }

  /**
   * Enhance search results with quality information
   */
  private enhanceResults(
    results: SearchResult[],
    qualityMetrics: ReturnType<typeof this.calculateQualityMetrics>,
    options: FormattingOptions
  ): FormattableSearchResult[] {
    const { maxScore, modifiedAverageScore } = qualityMetrics
    const { skillPath, showFullContentThreshold = 0.8, minScoreForPreview = 0.3 } = options

    return results.map(result => {
      const enhancedResult = result as FormattableSearchResult
      const score = result.score

      // Determine display tier
      let displayTier: FormattableSearchResult['metadata']['displayTier']
      let fullContent: string | undefined
      let preview: string | undefined

      if (score >= maxScore * showFullContentThreshold) {
        // Tier 1: High quality - show full content
        displayTier = 'full'
        fullContent = this.wrapContent(result.content, 'content')
      } else if (score >= modifiedAverageScore) {
        // Tier 2: Medium quality - show preview with line numbers
        displayTier = 'preview'
        preview = this.createEnhancedPreview(result.content)
      } else {
        // Tier 3: Low quality - metadata only
        displayTier = 'metadata-only'
      }

      // Set relative path
      enhancedResult.relativePath = relative(skillPath, result.file_path)

      // Add quality metadata
      enhancedResult.metadata = {
        ...result.metadata,
        displayTier,
        maxScore,
        averageScore: qualityMetrics.averageScore
      }

      if (fullContent) enhancedResult.fullContent = fullContent
      if (preview) enhancedResult.preview = preview

      return enhancedResult
    })
  }

  /**
   * Format content based on display tier
   */
  private formatByTier(result: FormattableSearchResult, options: FormattingOptions): string {
    switch (result.metadata.displayTier) {
      case 'full':
        return result.fullContent || ''

      case 'preview':
        return result.preview || ''

      case 'metadata-only':
        return 'Content: (No preview - metadata only)'

      default:
        return result.content.substring(0, 200).replace(/\n/g, ' ') + '...'
    }
  }

  /**
   * Get content type for styling
   */
  private getContentType(result: FormattableSearchResult): FormattedResult['contentType'] {
    switch (result.metadata.displayTier) {
      case 'full':
        return 'full-content'
      case 'preview':
        return 'preview'
      default:
        return 'metadata-only'
    }
  }

  /**
   * Create enhanced preview with line numbers
   */
  private createEnhancedPreview(content: string): string {
    const lines = content.split('\n')
    const lineNumbers: number[] = []

    // Select representative lines (first, middle, last)
    const selectedLines: string[] = []
    if (lines.length > 0) {
      selectedLines.push(lines[0])
      lineNumbers.push(1)
    }

    if (lines.length > 2) {
      const middleLine = Math.floor(lines.length / 2)
      selectedLines.push(lines[middleLine])
      lineNumbers.push(middleLine + 1)
    }

    if (lines.length > 1) {
      selectedLines.push(lines[lines.length - 1])
      lineNumbers.push(lines.length)
    }

    const previewContent = selectedLines.join('\n')
    const lineIndexes = lineNumbers.join(',')

    return this.wrapContent(previewContent, 'limit-content', lineIndexes)
  }

  /**
   * Wrap content in appropriate tags
   */
  private wrapContent(content: string, tag: string, lineIndexes?: string): string {
    if (tag === 'limit-content' && lineIndexes) {
      return `<${tag} lines-indexs="${lineIndexes}">\n${content}\n</${tag}>`
    } else if (tag === 'content') {
      const lines = content.split('\n').length
      return `<${tag} lines="${lines}">\n${content}\n</${tag}>`
    }
    return content
  }
}
