/**
 * Main skill creator class
 */

import { join } from 'node:path'
import { existsSync, mkdirSync, writeFileSync, chmodSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import type { CreateSkillOptions, CreateSkillResult } from '../types/index.js'
import { Config } from '../utils/config.js'
import { TemplateManager } from './templateManager.js'

export class SkillCreator {
  private templateDir: string
  private templateManager: TemplateManager

  constructor() {
    // Use __dirname equivalent for ES modules
    const __filename = new URL(import.meta.url).pathname
    const __dirname = join(__filename, '..')
    this.templateDir = join(__dirname, '..', 'templates')
    this.templateManager = new TemplateManager()
  }

  async createSkill(options: CreateSkillOptions): Promise<CreateSkillResult> {
    const result: CreateSkillResult = {
      created: false,
      message: '',
      docsInitialized: false,
    }

    try {
      // Get package version
      const { PackageUtils } = await import('../utils/package.js')
      const version = options.version ?? (await PackageUtils.getPackageVersion(options.packageName))

      if (!version) {
        console.warn(`⚠️  Could not determine version for ${options.packageName}`)
      }

      // Create skill folder name
      const skillName = PackageUtils.createSkillFolderName(
        options.packageName,
        version ?? '1.0.0',
      )

      // Determine output path
      const outputPath = options.storage === 'user'
        ? join(homedir(), '.claude', 'skills')
        : options.path ?? '.'

      // Create skill directory
      const skillDir = join(outputPath, skillName)

      if (existsSync(skillDir)) {
        const files = readdirSync(skillDir)
        // Filter out .gitkeep files
        const realFiles = files.filter(f => f !== '.gitkeep')
        if (realFiles.length > 0) {
          result.message = `Skill directory already exists and is not empty: ${skillDir}`
          return result
        }
      }

      mkdirSync(skillDir, { recursive: true })

      // Detect framework template
      const template = this.templateManager.detectFramework(options.packageName)

      // Create configuration
      let context7Id = options.context7Id
      if (!context7Id && template?.context7Ids?.length) {
        context7Id = template.context7Ids[0]
      }

      const config = Config.createDefault({
        skillName,
        description: options.description ?? `Documentation skill for ${options.packageName}`,
        context7Id: context7Id ?? `/${options.packageName.replace('@', '').replace('/', '__')}/docs`,
      })

      // Set the actual version (not formatted) in config
      config.version = version ?? '1.0.0'

      // Apply template if detected
      if (template) {
        console.log(`\n📋 Detected framework: ${template.name}`)
        this.templateManager.applyTemplate(template, skillDir, config)
      }

      // Create directory structure
      await this.createDirectoryStructure(skillDir)

      // Create configuration file
      const configFile = join(skillDir, 'config.json')
      Config.save(config, configFile)

      // Create SKILL.md
      await this.createSkillMd(skillDir, config)

      // Create package.json
      await this.createPackageJson(skillDir, config)

      // Create scripts
      await this.createScripts(skillDir)

      result.created = true
      result.skillPath = skillDir
      result.message = `Skill created successfully: ${skillDir}`

      // Initialize documentation if requested
      if (!options.noInitDocs && options.context7Id) {
        // Note: We'll skip auto-initialization for now to avoid dependency issues
        result.docsInitialized = false
        result.message += ' | Documentation initialization skipped - run manually'
      }

      return result
    } catch (error) {
      result.message = `Failed to create skill: ${error}`
      return result
    }
  }

  private createDirectoryStructure(skillDir: string): void {
    const dirs = [
      'scripts',
      'assets/references/context7',
      'assets/references/user',
      'assets/chroma_db',
      'assets/logs',
    ]

    for (const dir of dirs) {
      const dirPath = join(skillDir, dir)
      mkdirSync(dirPath, { recursive: true })
      writeFileSync(join(dirPath, '.gitkeep'), '')
    }
  }

  private createSkillMd(skillDir: string, config: any): void {
    const content = `---
name: ${config.name}
description: ${config.description}
license: Complete terms in LICENSE.txt
---

# ${config.name} Documentation Skill

This skill provides comprehensive documentation management for ${config.name}, featuring:

## Features

1. **Intelligent Search**: ChromaDB-powered semantic search through all documentation
2. **Dynamic Content Addition**: Add new knowledge with deduplication and smart updates
3. **Context7 Integration**: Automatically fetches and slices latest documentation
4. **Priority Management**: User-generated content takes precedence over Context7 docs

## Usage

### Search Documentation
To search through the documentation:
\`\`\`bash
node scripts/search.js --query "your search query"
\`\`\`

### Add New Knowledge
To add new documentation or knowledge:
\`\`\`bash
node scripts/add.js --content "your content" --title "content title"
\`\`\`

### Update from Context7
To refresh documentation from Context7:
\`\`\`bash
node scripts/update_context7.js
\`\`\`

### List All Content
To list all documentation files:
\`\`\`bash
node scripts/list_content.js
\`\`\`

### Rebuild Search Index
To manually rebuild the search index:
\`\`\`bash
node scripts/build_index.js
\`\`\`

## File Structure

- \`assets/references/context7/\` - Auto-generated Context7 documentation slices
- \`assets/references/user/\` - User-generated knowledge and documentation
- \`assets/chroma_db/\` - ChromaDB index for semantic search
- \`scripts/\` - Management scripts for documentation operations

## Workflow

1. Initial setup automatically downloads and slices Context7 documentation
2. ChromaDB index is built from all documentation sources
3. Search queries return ranked results with source citations
4. New content is intelligently merged with existing knowledge
5. User content always takes priority over Context7 sources

## Configuration

Edit \`config.json\` to customize:
- Context7 library ID
- Embedding model
- Chunk size and overlap
- Similarity thresholds

## Dependencies

See \`package.json\` for all required dependencies.

## Installation

Install the dependencies using npm:
\`\`\`bash
npm install
\`\`\`
`

    writeFileSync(join(skillDir, 'SKILL.md'), content)
  }

  private createPackageJson(skillDir: string, config: any): void {
    const content = {
      name: config.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      version: config.version,
      description: config.description,
      type: 'module',
      scripts: {
        'search': 'node scripts/search.js',
        'add': 'node scripts/add.js',
        'update-context7': 'node scripts/update_context7.js',
        'build-index': 'node scripts/build_index.js',
        'list-content': 'node scripts/list_content.js',
      },
      dependencies: {
        'chromadb': '^1.8.1',
        'markdown-it': '^14.1.0',
        'zod': '^3.24.0',
        'gradient-string': '^3.0.0',
        'ora': '^8.1.0',
        'inquirer': '^10.2.2',
        'dedent': '^1.5.3',
      },
      devDependencies: {
        '@types/node': '^22.10.2',
      },
    }

    writeFileSync(
      join(skillDir, 'package.json'),
      JSON.stringify(content, null, 2),
    )
  }

  private createScripts(skillDir: string): void {
    const scriptsDir = join(skillDir, 'scripts')

    // The scripts will reference the skill-creator package
    const scriptFiles = [
      'search.js',
      'add.js',
      'update_context7.js',
      'build_index.js',
      'list_content.js',
    ]

    for (const script of scriptFiles) {
      const scriptPath = join(scriptsDir, script)
      this.createScriptWrapper(scriptPath, script.replace('.js', ''))
    }
  }

  private createScriptWrapper(scriptPath: string, command: string): void {
    const content = `#!/usr/bin/env node
/**
 * Wrapper script for ${command}
 * This script forwards execution to the skill-creator package
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Find skill-creator CLI - try multiple possible paths
let skillCreatorPath = process.env.SKILL_CREATOR_PATH || ''

// If not set, try to find it
if (!skillCreatorPath) {
  const possiblePaths = [
    join(__dirname, '..', '..', '..', '..', 'dist', 'cli.js'), // Relative to skill
    join(process.cwd(), 'dist', 'cli.js'), // From current working directory
    '/usr/local/bin/skill-creator', // Global installation
    '/Users/kzf/.claude/agents/skill-creator/dist/cli.js', // Default user path
  ]

  skillCreatorPath = possiblePaths.find(p => existsSync(p)) || ''
}

if (!skillCreatorPath) {
  console.error('❌ Could not find skill-creator CLI')
  console.error('💡 Please install skill-creator or set SKILL_CREATOR_PATH environment variable')
  process.exit(1)
}

const args = process.argv.slice(2)

// Run the command
const child = spawn('node', [skillCreatorPath, 'run-script', '${command}'.replace(/_/g, '-'), ...args], {
  stdio: 'inherit',
  cwd: join(__dirname, '..'),
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
`

    writeFileSync(scriptPath, content)
    chmodSync(scriptPath, 0o755)
  }
}