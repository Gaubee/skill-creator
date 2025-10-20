/**
 * Search skill content command
 */

import { join } from 'node:path'
import { loadSkillConfig, parseArgs, createSearchEngine } from './shared.js'
import { createFormatter } from '../search_format/index.js'
import type { FormattingOptions } from '../search_format/types.js'

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

  // Create search engine
  const searchEngine = await createSearchEngine(
    config,
    options.mode as 'auto' | 'fuzzy' | 'chroma',
    false // We'll handle formatting manually for now
  )

  // Initialize search engine
  await searchEngine.initialize()

  // Build index if needed
  const referencesDir = join(process.cwd(), 'assets', 'references')
  const hashFile = join(process.cwd(), 'assets', '.last_index_hash')
  await searchEngine.buildIndex(referencesDir, hashFile)

  // Prepare search options
  const topK = options['top-k']
  const whereFilter = options.source !== 'all' ? { source: options.source } : undefined

  // Perform search
  const results = await searchEngine.search(options.query, topK || 5, whereFilter)

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

  // Create formatter based on options
  const formatterType = options.list ? 'list' : 'enhanced'
  const formatter = createFormatter(formatterType)

  // Prepare formatting options
  const formattingOptions: FormattingOptions = {
    skillPath: process.cwd(),
    showFullContentThreshold: 0.8,
    minScoreForPreview: 0.3,
    maxPreviewLength: 200,
    showLineNumbers: true,
  }

  // Format and display results
  const formattedResults = formatter.format(results, formattingOptions)

  for (let i = 0; i < formattedResults.length; i++) {
    const formattedResult = formattedResults[i]
    const result = formattedResult.result

    console.log(`\n${i + 1}. [Score: ${result.score.toFixed(2)}] ${result.title}`)
    console.log(`   Source: ${result.source} (${result.metadata.priority || 'unknown'})`)
    console.log(`   File: ${result.relativePath || result.file_path}`)

    // Display formatted content based on content type
    switch (formattedResult.contentType) {
      case 'full-content':
        console.log(`   FileContent:`)
        console.log(`   ${formattedResult.content}`)
        break

      case 'preview':
        if (options.list) {
          // --list mode: simple preview
          console.log(`   Preview: ${formattedResult.content}`)
        } else {
          // --enhanced mode (default): enhanced preview with line numbers
          console.log(`   Preview:`)
          // Extract content from <limit-content lines-indexs="1,3,45">...</limit-content> format
          const limitContentMatch = formattedResult.content.match(
            /^<limit-content lines-indexs="([^"]+)">\n(.*)\n<\/limit-content>$/s
          )
          if (limitContentMatch) {
            const [, lineIndexes, content] = limitContentMatch
            console.log(`   ${content}`)
          } else {
            console.log(`   ${formattedResult.content}`)
          }
        }
        break

      case 'metadata-only':
        console.log(`   Content: (No preview - metadata only)`)
        break

      default:
        // Fallback to simple preview
        console.log(`   Preview: ${formattedResult.content}`)
    }
  }
}
