/**
 * Build search index command
 */

import { join } from 'node:path'
import { loadSkillConfig, createSearchEngine } from './shared.js'

export async function buildIndex(args: string[]): Promise<void> {
  const config = loadSkillConfig()
  const searchEngine = await createSearchEngine(config)

  console.log('Building simple search index...')

  // Build index
  const referencesDir = join(process.cwd(), 'assets', 'references')
  await searchEngine.buildIndex(referencesDir)

  // Show stats
  const stats = await searchEngine.getStats()
  console.log(`✅ Index built: ${stats.totalDocuments || 0} documents`)
}
