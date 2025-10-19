/**
 * List content command
 */

import { join } from 'node:path'
import { loadSkillConfig, parseArgs, createSearchEngine } from './shared.js'

export async function listContent(args: string[]): Promise<void> {
  const config = loadSkillConfig()
  const searchEngine = await createSearchEngine(config)

  const { ContentManager } = await import('../core/contentManager.js')

  const contentManager = new ContentManager({
    searchEngine,
    referencesDir: join(process.cwd(), 'assets', 'references'),
  })

  // Parse arguments
  const options = parseArgs(args, [{ name: 'source', type: 'string', default: 'all' }])

  // Get stats
  const stats = contentManager.getContentStats()
  console.log(`\nContent Statistics:`)
  console.log(`  User files: ${stats.userFiles}`)
  console.log(`  Context7 files: ${stats.context7Files}`)
  console.log(`  Total: ${stats.totalFiles}\n`)

  // List content
  const sourceFilter = options.source === 'all' ? undefined : options.source
  const contentList = contentManager.listContent(sourceFilter)

  if (contentList.length === 0) {
    console.log('No content found.')
    return
  }

  console.log(
    `${'Title'.padEnd(40)} ${'Source'.padEnd(10)} ${'Size'.padEnd(10)} ${'Modified'.padEnd(20)}`
  )
  console.log('-'.repeat(80))

  contentList.forEach((item) => {
    console.log(
      `${item.title.padEnd(40)} ${item.source.padEnd(10)} ${String(item.size).padEnd(10)} ${item.modified.toLocaleString().padEnd(20)}`
    )
  })
}
