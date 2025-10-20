/**
 * Execute skill scripts - simplified version using individual command files
 */

import { searchContent } from '../commands/searchContent.js'
import { addContent } from '../commands/addContent.js'
import { downloadContext7 } from '../commands/downloadContext7.js'
import { init } from '../commands/init.js'
import { buildIndex } from '../commands/buildIndex.js'
import { listContent } from '../commands/listContent.js'

type CommandFunction = (args: string[]) => Promise<void>

const commands: Record<string, CommandFunction> = {
  'search-skill': searchContent,
  add: addContent,
  'add-skill': addContent,
  'download-context7': downloadContext7,
  init: init,
  'build-index': buildIndex,
  'list-content': listContent,
}

export async function runScript(script: string, args: string[]): Promise<void> {
  // Normalize script name
  const normalizedScript = script.toLowerCase()

  // Find the command
  const command = commands[normalizedScript] || commands[script]

  if (!command) {
    console.error(`❌ Unknown script: ${script}`)
    console.error(`Available scripts: ${Object.keys(commands).join(', ')}`)
    process.exit(1)
  }

  try {
    await command(args)
  } catch (error) {
    console.error(`❌ Error executing ${script}:`, error)
    process.exit(1)
  }
}
