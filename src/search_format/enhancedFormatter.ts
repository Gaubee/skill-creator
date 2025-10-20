/**
 * Enhanced formatter for search results
 * Implements three-tier display strategy based on search quality scores
 *
 * ===================== ENHANCED MODE 客观需求标准 =====================
 *
 * 用户明确要求的三层显示策略：
 *
 * 🔴 Tier 1 (高分结果): 显示 FileContent (完整内容)
 * - 标准: 匹配度最高的结果
 * - 显示: 完整的文档内容，不做截断
 * - 格式: <content lines="N">完整内容</content>
 *
 * 🟡 Tier 2 (中等分数): 显示 Preview with line numbers (带行号的部分内容)
 * - 标准: 部分匹配的结果
 * - 显示: 文档的关键片段，带行号指示
 * - 格式: <limit-content lines-indexs="1,5,10">片段内容</limit-content>
 *
 * 🟢 Tier 3 (低分数): 显示 Metadata only (只显示元数据)
 * - 标准: 匹配度较低的结果
 * - 显示: 仅标题、文件路径等元数据信息
 * - 格式: Content: (No preview - metadata only)
 *
 * ===================== 关键要求 =====================
 * 1. 必须基于实际的搜索质量分数进行分层
 * 2. 不能所有结果都显示为 "metadata-only"
 * 3. 高质量结果必须显示完整内容，不能截断
 * 4. 中等质量结果必须显示带行号的预览
 * 5. 阈值设置要合理，确保三层都有分布
 *
 * ===================== 实现要点 =====================
 * - 基于用户的中位数思路：去掉一个最高分和最低分，再取平均值
 * - 边缘情况处理：当结果<=2个时，直接使用最低分作为平均值
 * - maxScore必然显示完整内容：score == maxScore 时显示 FileContent
 * - 动态阈值：不使用固定阈值，基于实际分数分布计算
 *
 * ===================== 具体算法 =====================
 * 1. modifiedAverageScore = 去掉最高分和最低分后，剩余分数的平均值
 * 2. 只有1-2个结果时：modifiedAverageScore = 最低分
 * 3. 3个以上结果时：sortedScores.slice(1, -1) 去掉首尾后平均
 *
 * ===================== 分层标准 =====================
 * - Tier 1 (score == maxScore): FileContent (完整内容)
 * - Tier 2 (score >= modifiedAverageScore): Preview with line numbers (带行号预览)
 * - Tier 3 (score < modifiedAverageScore): Metadata only (只显示元数据)
 *
 * ===================== 关键要求 =====================
 * 1. maxScore 必然显示完整内容，这是最高优先级策略
 * 2. 不使用固定阈值，避免全部落入某一层
 * 3. 基于实际分数分布动态调整分层
 * 4. 确保三层都有合理分布
 *
 * ===================== 当前修复重点 =====================
 * - 修复 Score 计算问题（从 0.00 到合理的 0.1-1.0 范围）
 * - 实现中位数算法的阈值计算
 * - 确保 maxScore 的结果显示完整内容
 * - 移除固定阈值依赖，使用动态算法
 *
 * ===================== 用户反馈问题 =====================
 * - "默认enhanced模式，没有如期工作"
 * - "Score居然是负数/0.00，太不合理"
 * - 所有结果都显示 "(No preview - metadata only)"
 *
 * ===================== 验收标准 =====================
 * - 高分结果显示完整文档内容
 * - 中等分数结果显示带行号的预览
 * - 低分结果显示元数据
 * - 三层都有合理分布，不是全部落在某一层
 *
 * ======================================================================
 */

import type {
  SearchResult,
  FormattableSearchResult,
  FormattingOptions,
  FormattedResult,
  SearchFormatter,
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

  format(results: SearchResult[], options: FormattingOptions): FormattedResult[] {
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
        priority: index,
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

    const scores = results.map((r) => r.score)
    const maxScore = Math.max(...scores)

    // 用户要求：使用中位数思路，去掉一个最高分和最低分
    let modifiedAverageScore: number

    if (scores.length <= 2) {
      // 如果只有2个或更少的结果，直接使用较低的分数作为平均分
      modifiedAverageScore = Math.min(...scores)
    } else {
      // 去掉最高分和最低分，然后计算平均分
      const sortedScores = [...scores].sort((a, b) => a - b)
      const middleScores = sortedScores.slice(1, -1) // 去掉第一个(最低)和最后一个(最高)
      modifiedAverageScore =
        middleScores.reduce((sum, score) => sum + score, 0) / middleScores.length
    }

    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length

    console.log(
      `📊 质量指标计算: maxScore=${maxScore.toFixed(3)}, modifiedAverageScore=${modifiedAverageScore.toFixed(3)}, averageScore=${averageScore.toFixed(3)}`
    )

    return {
      maxScore,
      averageScore,
      modifiedAverageScore,
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
    const { skillPath } = options

    return results.map((result) => {
      const enhancedResult = result as FormattableSearchResult
      const score = result.score

      // 用户要求的三层显示策略
      let displayTier: FormattableSearchResult['metadata']['displayTier']
      let fullContent: string | undefined
      let preview: string | undefined

      console.log(
        `🔍 Enhanced分层判断: Score=${score.toFixed(3)}, maxScore=${maxScore.toFixed(3)}, modifiedAverageScore=${modifiedAverageScore.toFixed(3)}`
      )

      // 最高优先级：maxScore 必然显示完整内容
      if (score === maxScore) {
        // Tier 1: 最高分 - 显示完整内容
        displayTier = 'full'
        fullContent = this.wrapContent(result.content, 'content')
        console.log(`✅ score == maxScore，分配到完整内容模式`)
      } else if (score >= modifiedAverageScore) {
        // Tier 2: 中等分数 - 显示带行号的预览
        displayTier = 'preview'
        preview = this.createEnhancedPreview(result.content)
        console.log(`✅ score >= modifiedAverageScore，分配到预览模式`)
      } else {
        // Tier 3: 低分数 - 仅显示元数据
        displayTier = 'metadata-only'
        console.log(`⚠️ score < modifiedAverageScore，分配到元数据模式`)
      }

      // 设置相对路径
      enhancedResult.relativePath = relative(skillPath, result.file_path)

      // 添加质量元数据
      enhancedResult.metadata = {
        ...result.metadata,
        displayTier,
        maxScore,
        averageScore: qualityMetrics.averageScore,
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
    const score = result.score
    const tier = result.metadata.displayTier
    const contentLength = result.content?.length || 0

    // 添加调试信息显示分数和层级
    const debugInfo = `<!-- Score: ${score.toFixed(3)}, Tier: ${tier}, ContentLength: ${contentLength} -->`

    console.log(
      `🔍 Enhanced格式化: Score=${score.toFixed(3)}, Tier=${tier}, ContentLength=${contentLength}`
    )

    switch (tier) {
      case 'full':
        console.log(`📝 使用完整内容模式，内容长度: ${result.fullContent?.length || 0}`)
        return `${debugInfo}\n${result.fullContent || ''}`

      case 'preview':
        console.log(`👁️ 使用预览模式，预览长度: ${result.preview?.length || 0}`)
        return `${debugInfo}\n${result.preview || ''}`

      case 'metadata-only':
        console.log(`📋 使用元数据模式`)
        return `${debugInfo}\nContent: (No preview - metadata only)`

      default:
        console.log(`⚠️ 未知层级，使用默认模式`)
        return `${debugInfo}\n${result.content.substring(0, 200).replace(/\n/g, ' ')}...`
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
