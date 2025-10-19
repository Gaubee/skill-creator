#!/usr/bin/env node
/**
 * CLI interface for skill creator
 */

import { Command } from 'commander'
import gradient from 'gradient-string'
import inquirer from 'inquirer'
import { SkillCreator } from './core/skillCreator.js'
import { PackageUtils } from './utils/package.js'
import type { CreateSkillOptions } from './types/index.js'
import { join } from 'node:path'
import { homedir } from 'node:os'

const program = new Command()

/**
 * Helper function to create a skill for a package with interactive confirmation
 */
async function createSkillForPackage(
  skillDirName: string,
  skillDisplayName: string,
  scope: 'project' | 'user',
  force: boolean = false
): Promise<string> {
  const creator = new SkillCreator()

  // Extract package name from skillDirName if it's in format "package@version"
  // Otherwise, use the skillDirName as is
  const lastAtSignIndex = skillDirName.lastIndexOf('@')
  const packageName =
    lastAtSignIndex > 0 ? skillDirName.substring(0, lastAtSignIndex) : skillDirName

  const createOptions: CreateSkillOptions = {
    packageName: packageName, // Extract package name from skillDirName
    path: scope === 'user' ? undefined : '.claude/skills',
    storage: scope,
    noInitDocs: true, // Docs are downloaded in a separate step in the new flow
    force: force, // Pass force option to SkillCreator
  }

  console.log(gradient('cyan', 'magenta')('\n🚀 Creating skill...'))

  const result = await creator.createSkill(createOptions)

  if (result.created) {
    console.log(gradient('green', 'cyan')(`\n✅ ${result.message}`))
    console.log(gradient('blue', 'cyan')(`📍 Skill Path: ${result.skillPath}`))
    console.log('\n🎉 Skill created successfully!')
    console.log('\nNext steps:')
    console.log(
      `1. Add content: skill-creator add-skill --pwd "${result.skillPath}" --title "My Note" --content "Your content"`
    )
    console.log(`2. Search skill: skill-creator search-skill --pwd "${result.skillPath}" "query"`)
    console.log(
      `3. Download docs: skill-creator download-context7 --pwd "${result.skillPath}" <context7_library_id>`
    )
    return result.skillPath!
  } else {
    throw new Error(result.message || 'Failed to create skill')
  }
}

program
  .name('skill-creator')
  .description('Create claude-code-skills with documentation management')
  .version('2.0.0')

// Add create-cc-skill command
program
  .command('create-cc-skill')
  .requiredOption('--scope <scope>', 'Storage scope (project or user)')
  .option('--interactive', 'Enable interactive confirmation prompts')
  .option('--force', 'Force overwrite existing files in the skill directory')
  .argument('<skill_dir_name>', 'The name of the skill directory to create')
  .action(async (skillDirName, options) => {
    try {
      const { scope, interactive, force } = options

      // Import inquirer for interactive prompts
      const { default: inquirer } = await import('inquirer')

      let finalSkillName = skillDirName

      if (interactive) {
        // 1. 确认存储位置
        console.log('Skill Creation Configuration:')
        console.log(`- Skill directory name: ${skillDirName}`)
        console.log(`- Storage scope: ${scope}`)
        const { confirmLocation } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmLocation',
            message: `Create skill in ${scope === 'project' ? './.claude/skills/' : '~/.claude/skills/'}?`,
            default: true,
          },
        ])

        if (!confirmLocation) {
          console.log('Skill creation cancelled.')
          process.exit(0)
        }

        // 2. 询问技能命名
        const { skillNameConfirmed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'skillNameConfirmed',
            message: `Use '${skillDirName}' as the skill name?`,
            default: true,
          },
        ])

        if (!skillNameConfirmed) {
          const { customSkillName } = await inquirer.prompt([
            {
              type: 'input',
              name: 'customSkillName',
              message: 'Enter a new skill name:',
              validate: (input) => input.trim() !== '' || 'Skill name cannot be empty',
            },
          ])
          finalSkillName = customSkillName.trim()
        }

        // 3. 确认最终配置
        console.log('\nFinal Configuration:')
        console.log(`- Skill directory name: ${skillDirName}`)
        console.log(`- Skill display name: ${finalSkillName}`)
        console.log(
          `- Storage location: ${scope === 'project' ? './.claude/skills/' : '~/.claude/skills/'}`
        )

        const { confirmFinal } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmFinal',
            message: 'Proceed with skill creation?',
            default: true,
          },
        ])

        if (!confirmFinal) {
          console.log('Skill creation cancelled.')
          process.exit(0)
        }
      }

      // Create the skill with confirmed configuration
      const skillPath = await createSkillForPackage(
        skillDirName,
        finalSkillName,
        scope as 'project' | 'user',
        force
      )
      console.log(`Skill created successfully at: ${skillPath}`)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// Add init command to install subagents
program
  .command('init-cc')
  .description('Install skill-creator as subagent in ~/.claude/agents/')
  .action(async () => {
    const { homedir } = await import('node:os')
    const { join } = await import('node:path')
    const { mkdirSync, writeFileSync } = await import('node:fs')

    const agentsDir = join(homedir(), '.claude', 'agents')
    const skillCreatorDir = join(agentsDir, 'skill-creator')

    // Create directories
    mkdirSync(agentsDir, { recursive: true })
    mkdirSync(skillCreatorDir, { recursive: true })

    // Create subagent manifest
    const manifest = {
      name: 'skill-creator',
      version: '2.0.0',
      description: 'Claude Code skill creation agent',
      main: process.cwd(),
      commands: ['search', 'get-name', 'download-context7', 'addSkill'],
    }

    writeFileSync(join(skillCreatorDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

    console.log(gradient('green', 'cyan')('\n✅ Skill-creator subagent installed successfully!'))
    console.log(`📍 Location: ${skillCreatorDir}`)
  })

// Add search command for package searching
program
  .command('search')
  .argument('<keywords>', 'Search keywords for npm packages')
  .option('-l, --limit <limit>', 'Number of results to show', '10')
  .action(async (keywords: string, options) => {
    const query = keywords
    const suggestions = await PackageUtils.suggestPackages(query, {
      limit: parseInt(options.limit),
    })
    console.log(JSON.stringify(suggestions, null, 2))
  })

// Add get-info command for package information
program
  .command('get-info')
  .argument('<package_name>', 'The npm package name to get information for')
  .action(async (packageName: string) => {
    const packageInfo = await PackageUtils.getPackageInfo(packageName)

    if (!packageInfo) {
      console.error(`❌ Package "${packageName}" not found or API error occurred.`)
      process.exit(1)
    }

    const version = packageInfo.version
    const skillDirName = PackageUtils.createSkillFolderName(packageName, version)

    const result = {
      skill_dir_name: skillDirName,
      name: packageInfo.name,
      version: version,
      description: packageInfo.description || '',
      keywords: packageInfo.keywords || [],
      license: packageInfo.license || '',
      author: packageInfo.author || '',
      maintainers: packageInfo.maintainers || [],
      homepage: packageInfo.homepage || '',
      repository: {
        url: packageInfo.repository?.url || '',
        type: packageInfo.repository?.type || '',
      },
      bugs: {
        url: packageInfo.bugs?.url || '',
      },
      funding: packageInfo.funding || '',
      scripts: packageInfo.scripts || {},
      engines: packageInfo.engines || {},
      types: packageInfo.types || '',
      dependencies: packageInfo.dependencies || {},
      devDependencies: packageInfo.devDependencies || {},
      time: {
        created: packageInfo.time?.created || '',
        modified: packageInfo.time?.modified || '',
      },
    }

    console.log(JSON.stringify(result, null, 2))
  })

// Add search-skill command
program
  .command('search-skill')
  .argument('<query>', 'Search query')
  .option('--pwd <path>', 'Path to the skill directory')
  .option('--package <name>', 'Package name to find skill directory for')
  .option('--mode <mode>', 'Search mode: auto, fuzzy, or chroma', 'auto')
  .option('--list', 'Show simplified list view (basic info only)', false)
  .action(async (query, options) => {
    let skillDir: string | undefined

    if (options.pwd) {
      skillDir = options.pwd
    } else if (options.package) {
      const { join } = await import('node:path')
      const { homedir } = await import('node:os')
      const { readdirSync, existsSync } = await import('node:fs')

      const findDir = (base: string) => {
        if (!existsSync(base)) return undefined
        const dirs = readdirSync(base, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => dirent.name)
          .filter((name) => name.includes(options.package.replace(/[^a-z0-9]/gi, '')))
        return dirs.length > 0 ? join(base, dirs[0]) : undefined
      }

      skillDir =
        findDir(join(process.cwd(), '.claude', 'skills')) ||
        findDir(join(homedir(), '.claude', 'skills'))
    }

    if (!skillDir) {
      console.error('❌ Could not find skill directory. Please provide --pwd or a valid --package.')
      process.exit(1)
    }

    console.log(gradient('cyan', 'magenta')('\n🔍 Searching in skill...'))
    console.log(`Skill Path: ${skillDir}`)
    console.log(`Query: ${query}`)

    const { chdir } = await import('node:process')
    const originalCwd = process.cwd()
    chdir(skillDir)

    try {
      const { runScript } = await import('./core/runScript.js')
      const args = ['--query', query]
      if (options.mode !== 'auto') args.push('--mode', options.mode)
      if (options.list) args.push('--list')
      // Enhanced search is now enabled by default, no need for --enhanced flag
      await runScript('search-skill', args)
    } finally {
      chdir(originalCwd)
    }
  })

// Add download-context7 command
program
  .command('download-context7')
  .argument('<project_id>', 'Context7 library ID')
  .option('--pwd <path>', 'Path to the skill directory')
  .option('--package <name>', 'Package name to find skill directory for')
  .option('-f, --force', 'Force update even if up to date')
  .action(async (projectId, options) => {
    let skillDir: string | undefined

    if (options.pwd) {
      skillDir = options.pwd
    } else if (options.package) {
      const { join } = await import('node:path')
      const { homedir } = await import('node:os')
      const { readdirSync, existsSync } = await import('node:fs')

      const findDir = (base: string) => {
        if (!existsSync(base)) return undefined
        const dirs = readdirSync(base, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => dirent.name)
          .filter((name) => name.includes(options.package.replace(/[^a-z0-9]/gi, '')))
        return dirs.length > 0 ? join(base, dirs[0]) : undefined
      }

      skillDir =
        findDir(join(process.cwd(), '.claude', 'skills')) ||
        findDir(join(homedir(), '.claude', 'skills'))
    }

    if (!skillDir) {
      console.error('❌ Could not find skill directory. Please provide --pwd or a valid --package.')
      process.exit(1)
    }

    console.log(gradient('cyan', 'magenta')('\n📥 Downloading Context7 documentation...'))
    console.log(`Skill Path: ${skillDir}`)
    console.log(`Context7 ID: ${projectId}`)

    const { chdir } = await import('node:process')
    const originalCwd = process.cwd()
    chdir(skillDir)

    try {
      const { runScript } = await import('./core/runScript.js')
      const args = options.force ? ['--force'] : []
      args.push('--project-id', projectId)
      await runScript('update-context7', args)
    } finally {
      chdir(originalCwd)
    }

    console.log(gradient('green', 'cyan')('\n✅ Documentation downloaded and sliced!'))
  })

// Add add-skill command
program
  .command('add-skill')
  .option('--pwd <path>', 'Path to the skill directory')
  .option('--package <name>', 'Package name to find skill directory for')
  .option('-t, --title <title>', 'Content title')
  .option('-c, --content <content>', 'Content text')
  .option('-f, --file <file>', 'Read content from file')
  .option('--force', 'Force overwrite existing content')
  .option('--force-append', 'Append content to existing file instead of creating new file')
  .action(async (options) => {
    if (!options.title && !options.file) {
      console.error('❌ Please provide either --title or --file')
      process.exit(1)
    }

    let skillDir: string | undefined

    if (options.pwd) {
      skillDir = options.pwd
    } else if (options.package) {
      const { join } = await import('node:path')
      const { homedir } = await import('node:os')
      const { readdirSync, existsSync } = await import('node:fs')

      const findDir = (base: string) => {
        if (!existsSync(base)) return undefined
        const dirs = readdirSync(base, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => dirent.name)
          .filter((name) => name.includes(options.package.replace(/[^a-z0-9]/gi, '')))
        return dirs.length > 0 ? join(base, dirs[0]) : undefined
      }

      skillDir =
        findDir(join(process.cwd(), '.claude', 'skills')) ||
        findDir(join(homedir(), '.claude', 'skills'))
    }

    if (!skillDir) {
      console.error('❌ Could not find skill directory. Please provide --pwd or a valid --package.')
      process.exit(1)
    }

    console.log(gradient('cyan', 'magenta')('\n📝 Adding content to skill...'))
    console.log(`Skill Path: ${skillDir}`)

    const { chdir } = await import('node:process')
    const originalCwd = process.cwd()
    chdir(skillDir)

    try {
      const { runScript } = await import('./core/runScript.js')
      const args = []

      if (options.title) args.push('--title', options.title)
      if (options.content) args.push('--content', options.content)
      if (options.file) args.push('--file', options.file)
      if (options.force) args.push('--force')
      if (options.forceAppend) args.push('--force-append')

      await runScript('add', args)
    } finally {
      chdir(originalCwd)
    }

    console.log(gradient('green', 'cyan')('\n✅ Content added successfully!'))
  })

// Add sub-commands for script execution
program
  .command('run-script')
  .argument('<script>', 'Script to run (search, add, update-context7, build-index, list-content)')
  .allowUnknownOption(true)
  .action(async (script: string) => {
    const { runScript } = await import('./core/runScript.js')
    await runScript(script, process.argv.slice(4))
  })

// Export for testing
export { program }

// Run CLI if this file is executed directly
// Always parse for now since we're using this as the main CLI entry point
program.parse()
