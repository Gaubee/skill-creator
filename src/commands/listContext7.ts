/**
 * List Context7 projects command
 */

import { join } from 'node:path'
import { createSearchEngine } from './shared.js'

export async function listContext7(): Promise<void> {
  const searchEngine = await createSearchEngine({})

  const { ContentManager } = await import('../core/contentManager.js')

  const contentManager = new ContentManager({
    searchEngine,
    referencesDir: join(process.cwd(), 'assets', 'references'),
  })

  const projects = contentManager.listContext7Projects()

  if (projects.length === 0) {
    console.log('📭 No Context7 projects found')
    return
  }

  console.log(`\n📦 Context7 Projects (${projects.length}):\n`)

  for (const project of projects) {
    console.log(`  🔹 ${project.projectId}`)
    console.log(`     Files: ${project.filesCount}`)
    console.log(`     Directory: ${project.directory}`)
    console.log()
  }
}
