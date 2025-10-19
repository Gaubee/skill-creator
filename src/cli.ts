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

const program = new Command()

program
  .name('skill-creator')
  .description('Create claude-code-skills with documentation management')
  .version('2.0.0')

// Add create-cc-skill command
program
  .command('create-cc-skill')
  .argument('<skill_dir_name>', 'The name of the skill directory to create')
  .option('--scope <scope>', 'Storage scope (project or user)', 'project')
  .option('--package-name <name>', 'The npm package name')
  .option('--package-version <ver>', 'The package version')
  .option('--description <desc>', 'The package description')
  .action(async (skillDirName, options) => {
    if (!options.packageName || !options.packageVersion) {
      console.error('❌ --package-name and --package-version are required.')
      process.exit(1)
    }

    const creator = new SkillCreator()

    const createOptions: CreateSkillOptions = {
      packageName: options.packageName,
      // For project scope, path should be .claude/skills relative to current directory
      path: options.scope === 'user' ? undefined : '.claude/skills',
      description: options.description,
      storage: options.scope,
      version: options.packageVersion,
      noInitDocs: true, // Docs are downloaded in a separate step in the new flow
    }

    const result = await creator.createSkill(createOptions)

    if (result.created) {
      console.log(gradient('green', 'cyan')(`\n✅ ${result.message}`))
      // Per the prompt, print the full path
      console.log(result.skillPath)
    } else {
      console.error(`❌ ${result.message}`)
      process.exit(1)
    }
  })

// Add init command to install subagents
program
  .command('init')
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
      homepage: packageInfo.homepage || '',
      repo: packageInfo.repository?.url || '',
      description: packageInfo.description || '',
    }

    console.log(JSON.stringify(result, null, 2))
  })

// Add search-skill command
program
  .command('search-skill')
  .argument('<query>', 'Search query')
  .option('--pwd <path>', 'Path to the skill directory')
  .option('--package <name>', 'Package name to find skill directory for')
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
