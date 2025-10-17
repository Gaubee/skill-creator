/**
 * Execute skill scripts
 */

import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { Config } from '../utils/config.js'

export async function runScript(script: string, args: string[]): Promise<void> {
  const configPath = join(process.cwd(), 'config.json')

  if (!existsSync(configPath)) {
    console.error('❌ config.json not found. Are you in a skill directory?')
    process.exit(1)
  }

  const config = Config.load(configPath)

  // Import and run the appropriate script
  switch (script) {
    case 'search':
      await runSearchScript(config, args)
      break
    case 'add':
      await runAddScript(config, args)
      break
    case 'update-context7':
      await runUpdateContext7Script(config, args)
      break
    case 'build-index':
      await runBuildIndexScript(config, args)
      break
    case 'list-content':
      await runListContentScript(config, args)
      break
    default:
      console.error(`❌ Unknown script: ${script}`)
      process.exit(1)
  }
}

async function runSearchScript(config: any, args: string[]): Promise<void> {
  const { UnifiedSearchEngine } = await import('./unifiedSearch.js')

  // Use ChromaDB if available, otherwise fall back to simple search
  const searchType = process.env.USE_CHROMA === 'true' ? 'chroma' : 'simple'

  const searchEngine = new UnifiedSearchEngine({
    type: searchType,
    referencesDir: join(process.cwd(), 'assets', 'references'),
    dbPath: join(process.cwd(), 'assets', 'chroma_db'),
    collectionName: `${config.name.replace(/[^a-zA-Z0-9._-]/g, '_')}_docs`,
  })

  // Parse arguments
  const options = parseArgs(args, [
    { name: 'query', alias: 'q', type: 'string', required: true },
    { name: 'top-k', type: 'number', default: 5 },
    { name: 'source', type: 'string', default: 'all' },
  ])

  if (!options.query) {
    console.error('❌ --query is required')
    process.exit(1)
  }

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

async function runAddScript(config: any, args: string[]): Promise<void> {
  const { ContentManager } = await import('./contentManager.js')
  const { UnifiedSearchEngine } = await import('./unifiedSearch.js')

  const searchType = process.env.USE_CHROMA === 'true' ? 'chroma' : 'simple'

  const searchEngine = new UnifiedSearchEngine({
    type: searchType,
    referencesDir: join(process.cwd(), 'assets', 'references'),
    dbPath: join(process.cwd(), 'assets', 'chroma_db'),
    collectionName: `${config.name.replace(/[^a-zA-Z0-9._-]/g, '_')}_docs`,
  })

  const contentManager = new ContentManager({
    searchEngine,
    referencesDir: join(process.cwd(), 'assets', 'references'),
  })

  // Parse arguments
  const options = parseArgs(args, [
    { name: 'title', type: 'string', required: true },
    { name: 'content', type: 'string', required: true },
    { name: 'force', type: 'boolean' },
    { name: 'no-update', type: 'boolean' },
  ])

  const result = await contentManager.addUserContent({
    title: options.title,
    content: options.content,
    force: options.force,
    autoUpdate: !options['no-update'],
  })

  console.log(result.message)

  if (result.similarContent && result.similarContent.length > 0) {
    console.log('\nSimilar content found:')
    result.similarContent.forEach((similar, i) => {
      console.log(`\n${i + 1}. [${similar.score.toFixed(2)}] ${similar.title}`)
      console.log(`   Source: ${similar.source}`)
      console.log(`   Preview: ${similar.preview}`)
    })
  }
}

async function runUpdateContext7Script(config: any, args: string[]): Promise<void> {
  const { ContentManager } = await import('./contentManager.js')
  const { UnifiedSearchEngine } = await import('./unifiedSearch.js')

  const searchType = process.env.USE_CHROMA === 'true' ? 'chroma' : 'simple'

  const searchEngine = new UnifiedSearchEngine({
    type: searchType,
    referencesDir: join(process.cwd(), 'assets', 'references'),
    dbPath: join(process.cwd(), 'assets', 'chroma_db'),
    collectionName: `${config.name.replace(/[^a-zA-Z0-9._-]/g, '_')}_docs`,
  })

  const contentManager = new ContentManager({
    searchEngine,
    referencesDir: join(process.cwd(), 'assets', 'references'),
  })

  // Parse arguments
  const options = parseArgs(args, [
    { name: 'force', type: 'boolean' },
  ])

  const result = await contentManager.updateFromContext7(
    config.context7LibraryId,
    options.force,
  )

  console.log(result.message)
}

async function runBuildIndexScript(config: any, args: string[]): Promise<void> {
  const { UnifiedSearchEngine } = await import('./unifiedSearch.js')

  const searchType = process.env.USE_CHROMA === 'true' ? 'chroma' : 'simple'

  const searchEngine = new UnifiedSearchEngine({
    type: searchType,
    referencesDir: join(process.cwd(), 'assets', 'references'),
    dbPath: join(process.cwd(), 'assets', 'chroma_db'),
    collectionName: `${config.name.replace(/[^a-zA-Z0-9._-]/g, '_')}_docs`,
  })

  // Build index
  const referencesDir = join(process.cwd(), 'assets', 'references')
  const hashFile = join(process.cwd(), 'assets', '.last_index_hash')
  await searchEngine.buildIndex(referencesDir, hashFile)

  // Show stats
  const stats = await searchEngine.getStats()
  console.log(`✓ Index built: ${stats.totalDocuments || 0} documents`)
}

async function runListContentScript(config: any, args: string[]): Promise<void> {
  const { ContentManager } = await import('./contentManager.js')
  const { UnifiedSearchEngine } = await import('./unifiedSearch.js')

  const searchType = process.env.USE_CHROMA === 'true' ? 'chroma' : 'simple'

  const searchEngine = new UnifiedSearchEngine({
    type: searchType,
    referencesDir: join(process.cwd(), 'assets', 'references'),
    dbPath: join(process.cwd(), 'assets', 'chroma_db'),
    collectionName: `${config.name.replace(/[^a-zA-Z0-9._-]/g, '_')}_docs`,
  })

  const contentManager = new ContentManager({
    searchEngine,
    referencesDir: join(process.cwd(), 'assets', 'references'),
  })

  // Parse arguments
  const options = parseArgs(args, [
    { name: 'source', type: 'string', default: 'all' },
  ])

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

  console.log(`${'Title'.padEnd(40)} ${'Source'.padEnd(10)} ${'Size'.padEnd(10)} ${'Modified'.padEnd(20)}`)
  console.log('-'.repeat(80))

  contentList.forEach((item) => {
    console.log(
      `${item.title.padEnd(40)} ${item.source.padEnd(10)} ${String(item.size).padEnd(10)} ${item.modified.toLocaleString().padEnd(20)}`,
    )
  })
}

function parseArgs(args: string[], definitions: any[]): Record<string, any> {
  const result: Record<string, any> = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const def = definitions.find(d => d.name === key || d.alias === key)

      if (def) {
        if (def.type === 'boolean') {
          result[key] = true
        } else {
          result[key] = args[++i]
        }
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1)
      const def = definitions.find(d => d.alias === key)

      if (def) {
        if (def.type === 'boolean') {
          result[def.name] = true
        } else {
          result[def.name] = args[++i]
        }
      }
    }
  }

  return result
}