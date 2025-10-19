/**
 * Update Context7 documentation command
 */

import { join } from 'node:path'
import { loadSkillConfig, parseArgs, createSearchEngine } from './shared.js'

export async function updateContext7(args: string[]): Promise<void> {
  const config = loadSkillConfig()
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
  ])

  const projectId = options['project-id'] || config.context7LibraryId
  if (!projectId) {
    console.error('❌ No Context7 project ID provided')
    console.error('   Use --project-id <id> or set context7LibraryId in config.json')
    process.exit(1)
  }

  const result = await contentManager.updateFromContext7(projectId, options.force)

  console.log(result.message)
}
