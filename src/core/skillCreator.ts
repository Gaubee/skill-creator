/**
 * Main skill creator class
 */

import { join, resolve } from 'node:path'
import { existsSync, mkdirSync, writeFileSync, chmodSync, readdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import type { CreateSkillOptions, CreateSkillResult } from '../types/index.js'
import { Config } from '../utils/config.js'

// Internal config interface used during skill creation
interface SkillCreateConfig {
  packageName: string
  context7LibraryId?: string
}

export class SkillCreator {
  private templateDir: string

  constructor() {
    this.templateDir = join(import.meta.dirname, '../../templates')
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
      const skillName = PackageUtils.createSkillFolderName(options.packageName, version ?? '1.0.0')

      // Determine output path
      const outputPath =
        options.scope === 'user'
          ? join(homedir(), '.claude', 'skills')
          : options.path
            ? resolve(options.path) // Ensure absolute path
            : join(process.cwd(), '.claude', 'skills')

      // Create skill directory
      const skillDir = join(outputPath, skillName)

      if (existsSync(skillDir)) {
        const files = readdirSync(skillDir)
        // Filter out .gitkeep files
        const realFiles = files.filter((f) => f !== '.gitkeep')
        if (realFiles.length > 0 && !options.force) {
          result.message = `Skill directory already exists and is not empty: ${skillDir}`
          return result
        } else if (realFiles.length > 0 && options.force) {
          console.log(
            `⚠️  Skill directory exists, forcing overwrite of existing files: ${skillDir}`
          )
        }
      }

      mkdirSync(skillDir, { recursive: true })

      // Create configuration
      const config = Config.createDefault({
        skillName,
        context7Id:
          options.context7Id ?? `/${options.packageName.replace('@', '').replace('/', '__')}/docs`,
      })

      // Create directory structure
      await this.createDirectoryStructure(skillDir)

      // Create basic config.json (minimal configuration)
      const skillConfig: SkillCreateConfig = {
        packageName: options.packageName,
        context7LibraryId:
          options.context7Id ?? `/${options.packageName.replace('@', '').replace('/', '__')}/docs`,
      }
      this.createBasicConfig(skillDir, skillConfig)

      // Create SKILL.md from template
      await this.createSkillMdFromTemplate(skillDir, skillConfig, options)

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

  private createBasicConfig(skillDir: string, config: SkillCreateConfig): void {
    const basicConfig = {
      package_name: config.packageName,
      context7_library_id: config.context7LibraryId || '',
    }

    const configPath = join(skillDir, 'config.json')
    writeFileSync(configPath, JSON.stringify(basicConfig, null, 2))
  }

  private async createSkillMdFromTemplate(
    skillDir: string,
    config: SkillCreateConfig,
    options: CreateSkillOptions
  ): Promise<void> {
    const templatePath = join(this.templateDir, 'SKILL.md')

    if (!existsSync(templatePath)) {
      throw new Error(`SKILL.md template not found at ${templatePath}`)
    }

    let templateContent = readFileSync(templatePath, 'utf-8')

    // Replace template variables with options data
    templateContent = templateContent
      .replace(/{{NAME}}/g, config.packageName)
      .replace(
        /{{DESCRIPTION}}/g,
        options.description ||
          `Specialized ${config.packageName} expert assistant providing comprehensive technical support`
      )
      .replace(/{{PACKAGE_NAME}}/g, config.packageName)
      .replace(/{{LICENSE}}/g, 'MIT')
      .replace(/{{SKILL_PATH}}/g, skillDir)
      .replace(/{{CONTEXT7_ID}}/g, options.context7Id || '{{CONTEXT7_ID}}')

    writeFileSync(join(skillDir, 'SKILL.md'), templateContent)
  }
}
