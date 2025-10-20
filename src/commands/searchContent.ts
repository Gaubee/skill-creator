/**
 * Search skill content command
 */

import { join } from 'node:path'
import { loadSkillConfig, parseArgs, createSearchEngine } from './shared.js'
import type { EnhancedSearchOptions } from '../core/fuzzySearchAdapter.js'

export async function searchContent(args: string[]): Promise<void> {
  const config = loadSkillConfig()

  // Parse arguments
  const options = parseArgs(args, [
    { name: 'query', alias: 'q', type: 'string', required: true },
    { name: 'top-k', type: 'number', default: 5 },
    { name: 'source', type: 'string', default: 'all' },
    { name: 'mode', type: 'string', default: 'auto' },
    { name: 'list', type: 'boolean', default: false },
  ])

  // Validate search mode
  if (!['auto', 'fuzzy', 'chroma'].includes(options.mode)) {
    console.error('❌ Invalid search mode. Use: auto, fuzzy, or chroma')
    process.exit(1)
  }

  const searchEngine = await createSearchEngine(config, options.mode as 'auto' | 'fuzzy' | 'chroma')

  // Build index if needed
  const referencesDir = join(process.cwd(), 'assets', 'references')
  const hashFile = join(process.cwd(), 'assets', '.last_index_hash')
  await searchEngine.buildIndex(referencesDir, hashFile)

  // Prepare search options
  const searchOptions: EnhancedSearchOptions = {
    topK: options['top-k'],
  }

  // Add source filter if specified
  if (options.source !== 'all') {
    searchOptions.where = { source: options.source }
  }

  // Enhanced search is now enabled by default
  searchOptions.skillPath = process.cwd()
  searchOptions.showFullContentThreshold = 0.8
  searchOptions.minScoreForPreview = 0.3

  // Perform search
  const results = await searchEngine.search(
    options.query,
    searchOptions.topK || 5,
    searchOptions.where
  )

  // Display results
  console.log(`\n🔍 Searching in skill...`)
  console.log(`Skill Path: ${process.cwd()}`)
  console.log(`Query: ${options.query}`)

  console.log(`\nSearch Results for: '${options.query}'`)
  console.log('='.repeat(50))

  if (results.length === 0) {
    console.log('No results found.')
    return
  }

  for (let i = 0; i < results.length; i++) {
    const result = results[i]

    // Enhanced result formatting
    const isEnhanced = result.metadata && result.metadata.maxScore !== undefined
    const relativePath = isEnhanced
      ? (result as any).relativePath || result.file_path
      : result.file_path

    console.log(`\n${i + 1}. [Score: ${result.score.toFixed(2)}] ${result.title}`)
    console.log(`   Source: ${result.source} (${result.metadata.priority || 'unknown'})`)
    console.log(`   File: ${relativePath}`)

    // Handle display based on list mode
    if (options.list) {
      // --list mode: simplified display with basic preview only
      // For enhanced results, extract original content from fullContent if available
      let previewContent = result.content
      if (isEnhanced && (result as any).fullContent) {
        // Extract original content from <content lines="N">...</content> format
        const fullContent = (result as any).fullContent
        const match = fullContent.match(/^<content lines="\d+">\n(.*)\n<\/content>$/s)
        if (match) {
          previewContent = match[1] // Extract the original content
        }
      }
      console.log(`   Preview: ${previewContent.slice(0, 200).replace(/\n/g, ' ')}...`)
    } else if (isEnhanced) {
      // Enhanced mode: three-tier display strategy
      const displayTier = (result as any).metadata?.displayTier
      const fullContent = (result as any).fullContent
      const preview = (result as any).preview

      if (displayTier === 'full' && fullContent) {
        // Tier 1: 显示FileContent - 完整的<content lines="N">格式
        console.log(`   FileContent:`)
        console.log(`   ${fullContent}`)
      } else if (displayTier === 'preview' && preview) {
        // Tier 2: 显示Preview - 基于uFuzzy ranges的匹配行内容
        console.log(`   Preview:`)
        // Extract content from <limit-content lines-indexs="1,3,45">...</limit-content> format
        const limitContentMatch = preview.match(
          /^<limit-content lines-indexs="([^"]+)">\n(.*)\n<\/limit-content>$/s
        )
        if (limitContentMatch) {
          const [, lineIndexes, content] = limitContentMatch
          console.log(`   ${content}`)
        } else {
          console.log(`   ${preview}`)
        }
      } else {
        // Tier 3: 不显示任何内容 - 只提供文件元数据
        console.log(`   Content: (No preview - metadata only)`)
      }
    } else {
      // Standard preview for non-enhanced results
      console.log(`   Preview: ${result.content.slice(0, 200).replace(/\n/g, ' ')}...`)
    }
  }
}
