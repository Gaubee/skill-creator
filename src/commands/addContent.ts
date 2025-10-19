/**
 * Add content command
 */

import { join } from 'node:path'
import { loadSkillConfig, parseArgs, createSearchEngine } from './shared.js'

export async function addContent(args: string[]): Promise<void> {
  const config = loadSkillConfig()
  const searchEngine = await createSearchEngine(config)

  const { ContentManager } = await import('../core/contentManager.js')

  const contentManager = new ContentManager({
    searchEngine,
    referencesDir: join(process.cwd(), 'assets', 'references'),
  })

  // Parse arguments
  const options = parseArgs(args, [
    { name: 'title', alias: 't', type: 'string', required: false },
    { name: 'content', alias: 'c', type: 'string', required: false },
    { name: 'file', alias: 'f', type: 'string', required: false },
    { name: 'force', type: 'boolean' },
    { name: 'no-update', type: 'boolean' },
  ])

  if (!options.title && !options.file) {
    console.error('❌ Please provide either --title or --file')
    process.exit(1)
  }

  let content = options.content || ''
  let title = options.title || ''

  // Read content from file if provided
  if (options.file) {
    const { readFileSync } = await import('node:fs')
    try {
      content = readFileSync(options.file, 'utf-8')
      if (!title) {
        // Extract title from filename or first line
        const fileName =
          options.file
            .split('/')
            .pop()
            ?.replace(/\.[^/.]+$/, '') || ''
        const firstLine = content.split('\n')[0]?.replace(/^#+\s*/, '') || fileName
        title = firstLine || fileName
      }
    } catch (error) {
      console.error(`❌ Failed to read file: ${options.file}`)
      process.exit(1)
    }
  }

  const result = await contentManager.addUserContent({
    title,
    content,
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
