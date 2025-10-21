import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { SkillCreator } from '../../src/core/skillCreator.js'
import { Config } from '../../src/utils/config.js'
import { createTempDir, cleanupTempDir, createMockConfig } from '../test-utils.js'

describe('SkillCreator', () => {
  let tempDir: string
  let skillCreator: SkillCreator

  beforeEach(() => {
    tempDir = createTempDir('skill-creator-test-')
    skillCreator = new SkillCreator()
  })

  afterEach(() => {
    cleanupTempDir(tempDir)
  })

  describe('createSkill', () => {
    it('should create a skill with default options', async () => {
      const options = {
        packageName: 'test-package',
        path: tempDir,
      }

      const result = await skillCreator.createSkill(options)

      expect(result.created).toBe(true)
      expect(result.skillPath).toContain('test-package@')
      expect(existsSync(result.skillPath!)).toBe(true)

      // Check required files
      expect(existsSync(join(result.skillPath!, 'config.json'))).toBe(true)
      expect(existsSync(join(result.skillPath!, 'SKILL.md'))).toBe(true)
      expect(existsSync(join(result.skillPath!, 'assets'))).toBe(true)
      // package.json should not exist anymore
      expect(existsSync(join(result.skillPath!, 'package.json'))).toBe(false)
      // scripts folder should not exist
      expect(existsSync(join(result.skillPath!, 'scripts'))).toBe(false)
    })

    it('should create skill with custom options', async () => {
      const options = {
        packageName: '@tanstack/router',
        path: tempDir,
        description: 'Custom description',
        context7Id: '/tanstack/router/docs',
        version: '1.0.0',
      }

      const result = await skillCreator.createSkill(options)

      expect(result.created).toBe(true)

      // Check config - simplified structure
      const configPath = join(result.skillPath!, 'config.json')
      const config = Config.load(configPath)
      expect(config.name).toContain('@tanstack__router@1')
      expect(config.context7LibraryId).toBe('/tanstack/router/docs')
      expect(config.packageName).toBe('@tanstack/router')
    })

    it('should handle storage in user directory', async () => {
      // Clean up any existing skill first
      const existingSkillPath = join(homedir(), '.claude', 'skills', 'user-skill@1')
      if (existsSync(existingSkillPath)) {
        rmSync(existingSkillPath, { recursive: true, force: true })
      }

      const options = {
        packageName: 'user-skill',
        scope: 'user' as const,
      }

      const result = await skillCreator.createSkill(options)

      expect(result.created).toBe(true)
      // The skill should be created in the user's home directory under .claude/skills
      const expectedPath = join(homedir(), '.claude', 'skills')
      expect(result.skillPath).toContain(expectedPath)
      expect(result.skillPath).toContain('user-skill@')

      // Clean up created skill
      rmSync(result.skillPath!, { recursive: true, force: true })
    }, 10000)

    it('should reject if directory exists and is not empty', async () => {
      // Use a specific version so we know the exact folder name
      const options = {
        packageName: 'test-package',
        path: tempDir,
        version: '1.0.0', // Specify version to avoid npm lookup
      }

      // Calculate the expected skill folder name
      const { PackageUtils } = await import('../../src/utils/package.js')
      const expectedSkillName = PackageUtils.createSkillFolderName('test-package', '1.0.0') // Should be 'test-package@1'
      const skillDir = join(tempDir, expectedSkillName)

      // Create the directory with a file
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(join(skillDir, 'existing.txt'), 'exists')

      const result = await skillCreator.createSkill(options)

      expect(result.created).toBe(false)
      expect(result.message).toContain('already exists and is not empty')
    })

    it('should create correct directory structure', async () => {
      const options = {
        packageName: 'test-structure',
        path: tempDir,
      }

      const result = await skillCreator.createSkill(options)
      const skillDir = result.skillPath!

      // Check directory structure
      const expectedDirs = [
        'assets/references/context7',
        'assets/references/user',
        'assets/chroma_db',
        'assets/logs',
      ]

      expectedDirs.forEach((dir) => {
        expect(existsSync(join(skillDir, dir))).toBe(true)
      })

      // scripts folder should not exist
      expect(existsSync(join(skillDir, 'scripts'))).toBe(false)
    })

    it('should not create scripts folder', async () => {
      const options = {
        packageName: 'test-no-scripts',
        path: tempDir,
      }

      const result = await skillCreator.createSkill(options)
      const scriptsDir = join(result.skillPath!, 'scripts')

      // scripts folder should not exist
      expect(existsSync(scriptsDir)).toBe(false)
    })

    it('should create proper SKILL.md content', async () => {
      const options = {
        packageName: 'test-docs',
        path: tempDir,
        description: 'Test documentation skill',
      }

      const result = await skillCreator.createSkill(options)
      const skillMdPath = join(result.skillPath!, 'SKILL.md')
      const content = readFileSync(skillMdPath, 'utf-8')

      expect(content).toContain('name: test-docs@')
      expect(content).toContain('Test documentation skill')
      expect(content).toContain('You are a specialized test-docs@')
      expect(content).toContain('Search Documentation Knowledge')
      expect(content).toContain('Search Mode Selection')
      expect(content).toContain('## Usage Guidelines')
      // 验证包含绝对路径 - 应该以 / 开头的完整路径
      expect(content).toMatch(
        /skill-creator (search-skill --pwd=.*|add-skill --pwd=.*|download-context7 --pwd=.*)/
      ) // 匹配新的命令格式
      expect(content).toMatch(/search-skill --pwd=.*? "search keywords"/)
      expect(content).toMatch(
        /add-skill --pwd=.*? --title "Knowledge Title" --content "Detailed content"/
      )
      expect(content).toContain('download-context7')
      // 确保不是示例路径
      expect(content).not.toContain('/path/to/your/skill')
    })

    it('should not create package.json file', async () => {
      const options = {
        packageName: 'test-pkg',
        path: tempDir,
      }

      const result = await skillCreator.createSkill(options)
      const packageJsonPath = join(result.skillPath!, 'package.json')

      // package.json should not exist anymore
      expect(existsSync(packageJsonPath)).toBe(false)
    })

    it('should create proper config.json', async () => {
      const options = {
        packageName: 'test-config',
        path: tempDir,
        description: 'Test config',
      }

      const result = await skillCreator.createSkill(options)
      const configPath = join(result.skillPath!, 'config.json')
      const config = Config.load(configPath)

      expect(config.name).toContain('test-config@')
      expect(config.context7LibraryId).toBe('/test-config/docs')
      expect(config.packageName).toBe('test-config')
    })
  })

  describe('createSkill with version', () => {
    it('should use provided version in folder name', async () => {
      const options = {
        packageName: 'test-version',
        path: tempDir,
        version: '2.5.0',
      }

      const result = await skillCreator.createSkill(options)

      // Version 2.5.0 should be formatted to just "2" (major version for v2+)
      expect(result.skillPath).toContain('test-version@2')

      const configPath = join(result.skillPath!, 'config.json')
      const config = Config.load(configPath)
      expect(config.name).toContain('test-version@2')
    })
  })

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      // Create a readonly directory to trigger error
      const readonlyDir = join(tempDir, 'readonly')
      mkdirSync(readonlyDir, { recursive: true })

      // Make it read-only (this might not work on all systems)
      try {
        const { constants } = await import('node:fs')
        const { chmodSync } = await import('node:fs')
        chmodSync(readonlyDir, constants.S_IRUSR | constants.S_IRGRP | constants.S_IROTH)
      } catch {
        // Skip this test if we can't change permissions
        return
      }

      const options = {
        packageName: 'test-error',
        path: readonlyDir,
      }

      const result = await skillCreator.createSkill(options)

      // Should handle errors gracefully
      if (!result.created) {
        expect(result.message).toContain('Failed to create skill')
      }
    })

    it('should succeed with force option when directory exists', async () => {
      const options = {
        packageName: 'test-force-unique',
        path: tempDir,
        force: true,
        version: '1.0.0',
      }

      // Create an existing directory with files
      const expectedSkillName = 'test-force-unique@1'
      const skillDir = join(tempDir, expectedSkillName)
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(join(skillDir, 'existing.txt'), 'existing content')

      const result = await skillCreator.createSkill(options)

      expect(result.created).toBe(true)
      expect(result.skillPath).toBe(skillDir)
      expect(existsSync(join(skillDir, 'config.json'))).toBe(true)
      expect(existsSync(join(skillDir, 'SKILL.md'))).toBe(true)
      expect(existsSync(join(skillDir, 'package.json'))).toBe(false)
      // The existing file should still exist
      expect(existsSync(join(skillDir, 'existing.txt'))).toBe(true)
    })
  })
})
