/**
 * Search skill command
 */

import { join } from 'node:path'
import { loadSkillConfig, parseArgs, createSearchEngine } from './shared.js'

export async function searchSkill(args: string[]): Promise<void> {
  const config = loadSkillConfig()
  const searchEngine = await createSearchEngine(config)

  // Parse arguments
  const options = parseArgs(args, [
    { name: 'query', alias: 'q', type: 'string', required: true },
    { name: 'top-k', type: 'number', default: 5 },
    { name: 'source', type: 'string', default: 'all' },
  ])

  // Build index if needed
  const referencesDir = join(process.cwd(), 'assets', 'references')
  const hashFile = join(process.cwd(), 'assets', '.last_index_hash')
  await searchEngine.buildIndex(referencesDir, hashFile)

  // Search
  const results = await searchEngine.search(
    options.query,
    options['top-k'],
    options.source !== 'all' ? { source: options.source } : undefined,
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
    console.log(`\n${i + 1}. [Score: ${result.score.toFixed(2)}] ${result.title}`)
    console.log(`   Source: ${result.source} (${result.metadata.priority || 'unknown'})`)
    console.log(`   File: ${result.file_path}`)
    console.log(`   Preview: ${result.content.slice(0, 200).replace(/\n/g, ' ')}...`)
  }
}
