#!/usr/bin/env node
/**
 * CLI interface for skill creator
 */

import { Command } from 'commander'
import gradient from 'gradient-string'
import { PackageUtils } from './utils/package.js'
import path, { join } from 'node:path'
import { homedir } from 'node:os'
import { readdirSync, existsSync } from 'node:fs'
import { createSkillForPackage } from './commands/createSkill.js'

const program = new Command()

// Global options storage
interface GlobalOptions {
  pwd?: string
}

let globalOptions: GlobalOptions = {}

// Helper function to resolve skill directory from global or command options
async function resolveSkillDirectory(commandOptions: {
  pwd?: string
  package?: string
}): Promise<string> {
  // Use command options first, then global options
  const pwd = commandOptions.pwd || globalOptions.pwd

  if (pwd) {
    return pwd
  }

  if (commandOptions.package) {
    const findDir = (base: string) => {
      if (!existsSync(base)) return undefined
      const dirs = readdirSync(base, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name)
        .filter((name) => name.includes(commandOptions.package!.replace(/[^a-z0-9]/gi, '')))
      return dirs.length > 0 ? join(base, dirs[0]) : undefined
    }

    const skillDir =
      findDir(join(process.cwd(), '.claude', 'skills')) ||
      findDir(join(homedir(), '.claude', 'skills'))

    if (skillDir) {
      return skillDir
    }
  }

  throw new Error('Could not find skill directory. Please provide --pwd or a valid --package.')
}

program
  .name('skill-creator')
  .description('Create claude-code-skills with documentation management')
  .version(PackageUtils.getCurrentPackageInfo()?.version ?? '0.0.0')
  .option('--pwd <path>', 'Global path to the skill directory (used for all commands)')

// Handle global options
program.hook('preAction', (thisCommand) => {
  const options = thisCommand.opts()
  globalOptions.pwd = options.pwd
})

// Add create-cc-skill command
program
  .command('create-cc-skill')
  .option('--interactive', 'Enable interactive confirmation prompts')
  .option('--scope <scope>', 'Storage scope (user or current), or custom directory to store skills')
  .option('--name <name>', 'The skill name')
  .option('--description <description>', 'Custom description for the skill')
  .option('--force', 'Force overwrite existing files in the skill directory')
  .argument('<skill_dir_name>', 'The name of the skill directory to create')
  .action(async (skillDirName, options) => {
    try {
      let { scope, interactive, force, description, name } = options

      // Import inquirer for interactive prompts
      const { default: inquirer } = await import('inquirer')

      let finalSkillName = name || skillDirName

      if (interactive) {
        console.log('Skill Creation Configuration:')
        // 1. 确认存储位置
        if (!scope) {
          const scopeAnswer = await inquirer.prompt([
            {
              type: 'list',
              name: 'scope',
              message: 'Where would you like to store this skill?',
              choices: [
                {
                  name: 'Current directory (./.claude/skills/)',
                  value: 'current',
                },
                {
                  name: 'User home directory (~/.claude/skills)',
                  value: 'user',
                },
                new inquirer.Separator(),
                {
                  name: 'Custom directory',
                  value: 'custom',
                },
              ],
              default: existsSync(join(process.cwd(), '.claude/agents/skill-creator.md'))
                ? 'current'
                : 'user',
            },
          ])
          scope = scopeAnswer.scope
          if (scope === 'custom') {
            const scopeAnswer = await inquirer.prompt([
              {
                type: 'input',
                name: 'scope',
                message: 'Directory to store skills',
                validate: (input) => input.trim() !== '' || 'Directory cannot be empty',
              },
            ])
            scope = path.join(process.cwd(), scopeAnswer.scope)
          }
        }
        // 2. 如果没有提供--name参数，询问包名
        if (!name) {
          const { packageNameConfirmed } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'packageNameConfirmed',
              message: `Use '${skillDirName}' as the package name?`,
              default: true,
            },
          ])

          if (!packageNameConfirmed) {
            const { customSkillName } = await inquirer.prompt([
              {
                type: 'input',
                name: 'customSkillName',
                message: 'Enter the skill name:',
                validate: (input) => input.trim() !== '' || 'Skill name cannot be empty',
              },
            ])
            finalSkillName = customSkillName.trim()
          }
        }

        if (!description) {
          const { customDescription } = await inquirer.prompt([
            {
              type: 'input',
              name: 'customDescription',
              message: 'Enter the skill description:',
            },
          ])
          description = customDescription.trim()
        }
      }
      if (scope === 'user') {
        scope = path.join(homedir(), '.claude/skills')
      } else if (scope === 'current') {
        scope = path.join(process.cwd(), '.claude/skills')
      }

      if (interactive) {
        // 3. 确认最终配置
        console.log('\nFinal Configuration:')
        console.log(`- Storage location: ${scope}`)
        console.log(`- Skill directory name: ${skillDirName}`)
        console.log(`- Skill Name: ${finalSkillName}`)
        console.log(`- Skill Description: ${description}`)

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
      const skillPath = await createSkillForPackage({
        baseDir: scope,
        skillDirname: skillDirName,
        skillName: finalSkillName,
        skillDescription: description,
        force: force,
      })
      console.log(`Skill created successfully at: ${skillPath}`)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// Add interactive init command
program
  .command('init')
  .description('Install skill-creator as subagent (interactive mode)')
  .option('--scope <scope>', 'Storage scope (user or current)')
  .action(async (options) => {
    const { runScript } = await import('./core/runScript.js')
    const args = []

    // Pass scope to init command
    if (options.scope) {
      args.push('--scope', options.scope)
    }

    await runScript('init', args)
  })

// Add init command to install subagents (non-interactive version)
program
  .command('init-cc')
  .description('Install skill-creator as subagent in ~/.claude/agents/')
  .action(async () => {
    const { runScript } = await import('./core/runScript.js')
    // For init-cc, we want the non-interactive version that installs to user directory
    // Use --scope=user for consistency with other CLI commands
    await runScript('init', ['--scope', 'user'])
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
    try {
      const skillDir = await resolveSkillDirectory(options)

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
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  })

// Add download-context7 command
program
  .command('download-context7')
  .argument('<project_id>', 'Context7 library ID')
  .option('--pwd <path>', 'Path to the skill directory')
  .option('--package <name>', 'Package name to find skill directory for')
  .option('-f, --force', 'Force update even if up to date')
  .option('--skip-chroma-indexing', 'Skip automatic ChromaDB index building after download')
  .action(async (projectId, options) => {
    try {
      const skillDir = await resolveSkillDirectory(options)

      console.log(gradient('cyan', 'magenta')('\n📥 Downloading Context7 documentation...'))
      console.log(`Skill Path: ${skillDir}`)
      console.log(`Context7 ID: ${projectId}`)

      const { chdir } = await import('node:process')
      const originalCwd = process.cwd()
      chdir(skillDir)

      try {
        const { runScript } = await import('./core/runScript.js')
        const args = []

        if (options.force) args.push('--force')
        if (options['skip-chroma-indexing']) args.push('--skip-chroma-indexing')
        args.push('--project-id', projectId)

        await runScript('download-context7', args)
      } finally {
        chdir(originalCwd)
      }

      console.log(gradient('green', 'cyan')('\n✅ Documentation downloaded and sliced!'))
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
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

    try {
      const skillDir = await resolveSkillDirectory(options)

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
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  })

// Add sub-commands for script execution
program
  .command('list-content')
  .option('--pwd <path>', 'Path to the skill directory')
  .action(async (options) => {
    const { runScript } = await import('./core/runScript.js')
    await runScript('list-content', process.argv.slice(4))
  })

// Export for testing
export { program }

// Run CLI if this file is executed directly
// Always parse for now since we're using this as the main CLI entry point
program.parse()
