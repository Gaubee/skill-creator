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

program
  .argument('<package_name>', 'Package name to create documentation skill for (e.g., tanstack-router)')
  .option('-p, --path <path>', 'Output path (default: current directory)', '.')
  .option('-d, --description <description>', 'Description of the skill')
  .option('-c, --context7-id <id>', 'Context7 library ID (e.g., /tanstack/router/docs)')
  .option('--no-init-docs', 'Skip initial documentation download')
  .option('-s, --storage <storage>', 'Where to store the skill', 'project')
  .option('--package-version <version>', 'Specific version to use')
  .option('--no-interactive', 'Skip interactive prompts')
  .option('--search', 'Enable interactive package search')
  .action(async (packageName: string, options, _command) => {
    // Validate package name
    if (!packageName || packageName.trim().length === 0) {
      console.error('❌ Error: Package name is required')
      process.exit(1)
    }

    console.log(gradient('cyan', 'magenta')('\n🔍 Searching for package:'))
    console.log(gradient('yellow', 'orange')(packageName))
    console.log(gradient('cyan', 'magenta')('='.repeat(50)))

    let selectedPackage = { name: packageName, version: options.packageVersion }

    // If not a valid package name or search is enabled, search for suggestions
    if (!PackageUtils.validatePackageName(packageName) || options.search) {
      const suggestions = await PackageUtils.suggestPackages(packageName, { limit: 10 })

      if (suggestions.length === 0) {
        console.error(`❌ No packages found for "${packageName}"`)
        process.exit(1)
      }

      if (suggestions.length > 1 && !options.noInteractive) {
        console.log(`\n📦 Found ${suggestions.length} package(s):`)

        const choices = suggestions.map((pkg) => ({
          name: `${pkg.name} (${pkg.version}) - ${pkg.description.slice(0, 80)}${pkg.description.length > 80 ? '...' : ''}`,
          value: pkg.name,
          short: pkg.name,
        }))

        const { selectedPkg } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedPkg',
            message: 'Select a package:',
            choices,
            pageSize: 10,
          },
        ])

        selectedPackage.name = selectedPkg
        selectedPackage.version = await PackageUtils.getPackageVersion(selectedPkg) || suggestions.find(s => s.name === selectedPkg)?.version
      } else {
        selectedPackage.name = suggestions[0].name
        selectedPackage.version = suggestions[0].version
      }
    }

    // Get version if not specified
    if (!selectedPackage.version) {
      selectedPackage.version = await PackageUtils.getPackageVersion(selectedPackage.name)
    }

    if (!selectedPackage.version) {
      console.warn(`⚠️  Could not determine version for ${selectedPackage.name}`)
    }

    console.log(gradient('green', 'cyan')(`\n✅ Selected package: ${selectedPackage.name}@${selectedPackage.version || 'latest'}`))

    // Ask for storage location if not specified
    let storage = options.storage as 'project' | 'user'
    let path = options.path

    if (!options.noInteractive && !options.storage) {
      const { storageLocation } = await inquirer.prompt([
        {
          type: 'list',
          name: 'storageLocation',
          message: 'Where would you like to store this skill?',
          choices: [
            {
              name: '📁 Current project (./.claude/skills/)',
              value: 'project',
            },
            {
              name: '🏠 User directory (~/.claude/skills/)',
              value: 'user',
            },
          ],
          default: 'project',
        },
      ])
      storage = storageLocation

      if (storage === 'project' && path === '.') {
        const { useDefaultPath } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'useDefaultPath',
            message: 'Use current directory for skill storage?',
            default: true,
          },
        ])

        if (!useDefaultPath) {
          const { customPath } = await inquirer.prompt([
            {
              type: 'input',
              name: 'customPath',
              message: 'Enter custom path:',
              default: './',
            },
          ])
          path = customPath
        }
      }
    }

    console.log(gradient('cyan', 'magenta')('\n📝 Creating skill...'))
    console.log(gradient('cyan', 'magenta')('='.repeat(50)))

    const creator = new SkillCreator()

    // Create skill folder name
    const skillName = PackageUtils.createSkillFolderName(
      selectedPackage.name,
      selectedPackage.version ?? '1.0.0',
    )
    console.log(`\n📁 Skill folder name: ${skillName}`)

    // Create skill
    const createOptions: CreateSkillOptions = {
      packageName: selectedPackage.name,
      path,
      description: options.description,
      context7Id: options.context7Id,
      noInitDocs: options.noInitDocs,
      storage,
      version: selectedPackage.version,
    }

    const result = await creator.createSkill(createOptions)

    // Print result
    if (result.created) {
      console.log(gradient('green', 'cyan')(`\n✅ ${result.message}`))
      if (result.docsInitialized) {
        console.log(`✅ Documentation downloaded and indexed`)
      }

      console.log(`\n📋 Next steps:`)
      console.log(`1. cd ${result.skillPath}`)
      console.log(`2. npm install`)

      if (!result.docsInitialized) {
        console.log(`\n📚 To initialize documentation:`)
        console.log(`   Option A: Use Context7 (requires MCP)`)
        console.log(`   - First, resolve library ID with AI help or Context7 search`)
        console.log(`   - Update config.json with the correct context7_library_id`)
        console.log(`   - Run: npm run update-context7`)
        console.log(`\n   Option B: Add documentation manually`)
        console.log(`   - Run: npm run add -- --title 'Topic' --content 'Your content'`)
      }

      console.log(`\n3. npm run build-index`)
      console.log(`4. npm run search -- --query 'test query'`)

      if (options.context7Id) {
        console.log(`\n💡 Note: Context7 library ID set to: ${options.context7Id}`)
        console.log(`   If this is incorrect, edit config.json and update context7_library_id`)
      }
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
      commands: [
        'search',
        'get-name',
        'download-context7',
        'addSkill'
      ]
    }

    writeFileSync(
      join(skillCreatorDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    )

    console.log(gradient('green', 'cyan')('\n✅ Skill-creator subagent installed successfully!'))
    console.log(`📍 Location: ${skillCreatorDir}`)
  })

// Add search command for package searching
program
  .command('search')
  .argument('<keywords>', 'Search keywords for npm packages')
  .option('-l, --limit <limit>', 'Number of results to show', '10')
  .action(async (keywords: string, options) => {
    // Handle multiple keywords by splitting
    const query = keywords
    console.log(gradient('cyan', 'magenta')('\n🔍 Searching npm packages...'))
    console.log(gradient('yellow', 'orange')(query))
    console.log(gradient('cyan', 'magenta')('='.repeat(50)))

    const suggestions = await PackageUtils.suggestPackages(query, {
      limit: parseInt(options.limit)
    })

    if (suggestions.length === 0) {
      console.error(`❌ No packages found for "${query}"`)
      return
    }

    console.log(`\n📦 Found ${suggestions.length} package(s):`)
    suggestions.forEach((pkg, index) => {
      console.log(`\n${index + 1}. ${gradient('green', 'cyan')(pkg.name)} (${pkg.version})`)
      console.log(`   ${pkg.description.slice(0, 100)}${pkg.description.length > 100 ? '...' : ''}`)
      console.log(`   👤 ${pkg.publisher} | ⭐ ${pkg.score.toFixed(2)}`)
    })
  })

// Add get-name command to generate skill name
program
  .command('get-name')
  .argument('<package_name>', 'Package name')
  .option('-v, --version <version>', 'Specific version')
  .action(async (packageName, options) => {
    const version = options.version || await PackageUtils.getPackageVersion(packageName)

    if (!version) {
      console.error(`❌ Could not determine version for ${packageName}`)
      process.exit(1)
    }

    const skillName = PackageUtils.createSkillFolderName(packageName, version)
    console.log(gradient('green', 'cyan')(`\n✅ Skill name: ${skillName}`))
    console.log(`   Package: ${packageName}@${version}`)
  })

// Add download-context7 command
program
  .command('download-context7')
  .argument('<package_name>', 'Package name')
  .argument('<context7_id>', 'Context7 library ID')
  .option('-f, --force', 'Force update even if up to date')
  .option('-s, --storage <storage>', 'Storage location (project|user)', 'project')
  .action(async (packageName, context7Id, options) => {
    console.log(gradient('cyan', 'magenta')('\n📥 Downloading Context7 documentation...'))
    console.log(`Package: ${packageName}`)
    console.log(`Context7 ID: ${context7Id}`)

    // Find existing skill
    const { join } = await import('node:path')
    const { homedir } = await import('node:os')

    const baseDir = options.storage === 'user'
      ? join(homedir(), '.claude', 'skills')
      : join(process.cwd(), '.claude', 'skills')

    // Find skill directory
    const { readdirSync } = await import('node:fs')
    const dirs = readdirSync(baseDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .filter(name => name.includes(packageName.replace(/[^a-z0-9]/gi, '')))

    if (dirs.length === 0) {
      console.error(`❌ No skill found for package ${packageName}`)
      console.log(`💡 Create a skill first with: skill-creator ${packageName}`)
      process.exit(1)
    }

    const _skillDir = join(baseDir, dirs[0])

    // Run update script
    const { runScript } = await import('./core/runScript.js')
    const args = ['--force']
    await runScript('update-context7', args)

    console.log(gradient('green', 'cyan')('\n✅ Documentation downloaded and sliced!'))
  })

// Add search-in-skill command
program
  .command('search-in-skill')
  .argument('<package_name>', 'Package name')
  .argument('<query>', 'Search query')
  .action(async (packageName, query) => {
    console.log(gradient('cyan', 'magenta')('\n🔍 Searching in skill...'))
    console.log(`Package: ${packageName}`)
    console.log(`Query: ${query}`)

    // Find and run search script
    const { runScript } = await import('./core/runScript.js')
    const args = ['--query', query]
    await runScript('search', args)
  })

// Add add-skill-content command
program
  .command('addSkill')
  .argument('<package_name>', 'Package name')
  .option('-t, --title <title>', 'Content title')
  .option('-c, --content <content>', 'Content text')
  .option('-f, --file <file>', 'Read content from file')
  .action(async (packageName, options) => {
    if (!options.title && !options.file) {
      console.error('❌ Please provide either --title or --file')
      process.exit(1)
    }

    console.log(gradient('cyan', 'magenta')('\n📝 Adding content to skill...'))
    console.log(`Package: ${packageName}`)

    // Find and run add script
    const { runScript } = await import('./core/runScript.js')
    const args = []

    if (options.title) args.push('--title', options.title)
    if (options.content) args.push('--content', options.content)
    if (options.file) args.push('--file', options.file)

    await runScript('add', args)

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
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse()
}