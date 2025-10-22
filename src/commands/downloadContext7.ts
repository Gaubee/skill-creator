/**
 * Download Context7 documentation command with automatic ChromaDB indexing
 */

import { join } from 'node:path'
import { loadSkillConfig, storeSkillConfig, parseArgs, createSearchEngine } from './shared.js'

export async function downloadContext7(args: string[]): Promise<void> {
  const pwd = process.cwd()
  const config = loadSkillConfig(pwd)
  const searchEngine = await createSearchEngine(config)

  const { ContentManager } = await import('../core/contentManager.js')

  const contentManager = new ContentManager({
    searchEngine,
    referencesDir: join(process.cwd(), 'assets', 'references'),
  })

  // Parse arguments
  const options = parseArgs(args, [
    { name: 'force', type: 'boolean' },
    { name: 'project-id', type: 'string' },
    { name: 'skip-chroma-indexing', type: 'boolean' },
  ])

  const projectId = options['project-id'] || config.context7ProjectId
  if (!projectId) {
    console.error('❌ No Context7 project ID provided')
    console.error('   Use --project-id <id> or set context7LibraryId in config.json')
    process.exit(1)
  }

  console.log(`📥 Downloading Context7 documentation...`)
  console.log(`Project ID: ${projectId}`)

  try {
    // Download documentation
    const result = await contentManager.updateFromContext7(projectId, options.force)
    console.log(`✅ ${result.message}`)
    config.context7ProjectId = projectId
    storeSkillConfig(pwd, config)

    // Auto-build ChromaDB index unless skipped
    if (!options['skip-chroma-indexing']) {
      console.log(`\n🔧 Building ChromaDB index...`)

      try {
        await searchEngine.initialize()
        await searchEngine.buildIndex(join(process.cwd(), 'assets', 'references'))

        const stats = await searchEngine.getStats()
        console.log(`✅ ChromaDB index built successfully!`)
        console.log(`📊 Indexed ${stats.totalDocuments || 0} documents`)

        // Check if ChromaDB was used by checking the search engine type
        const engineType = (searchEngine as any).searchEngine?.constructor?.name
        if (engineType?.includes('Chroma') || engineType?.includes('chroma')) {
          console.log(`🎯 ChromaDB search is now ready for enhanced queries`)
        }
      } catch (error) {
        console.log(
          `⚠️ ChromaDB indexing failed: ${error instanceof Error ? error.message : String(error)}`
        )
        console.log(
          `💡 You can still use fuzzy search, or retry with --skip-chroma-indexing to skip this step`
        )
      }
    } else {
      console.log(`\n⏭️ Skipping ChromaDB indexing (as requested)`)
      console.log(`💡 To build index later, run: skill-creator build-index`)
    }
  } catch (error) {
    console.error(`❌ Error downloading Context7 documentation:`, error)
    process.exit(1)
  }
}
