import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { rmSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { createTempDir, cleanupTempDir } from '../test-utils.js'

// NOTE: These tests assume `npm run build` has been run and `dist/cli.js` is up to date.
describe('Skill Creation Integration Tests', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempDir('integration-test-')
  })

  afterEach(() => {
    cleanupTempDir(tempDir)
  })

  describe('Full Skill Creation Workflow', () => {
    it('should create and use a complete skill following the new CLI structure', () => {
      const packageName = 'zod' // Using a real, simple package
      const cliCmd = `node ${process.cwd()}/dist/cli.js`

      // 1. Search for package
      const searchOutput = execSync(`${cliCmd} search ${packageName}`, { encoding: 'utf-8' })
      const searchResults = JSON.parse(searchOutput)
      expect(searchResults).toBeInstanceOf(Array)
      expect(searchResults.length).toBeGreaterThan(0)
      expect(searchResults[0].name).toBe(packageName)

      // 2. Get package info
      const getInfoOutput = execSync(`${cliCmd} get-info ${packageName}`, { encoding: 'utf-8' })
      const packageInfo = JSON.parse(getInfoOutput)
      expect(packageInfo.name).toBe(packageName)
      expect(packageInfo.skill_dir_name).toBeDefined()
      expect(packageInfo.version).toBeDefined()

      const { skill_dir_name, version } = packageInfo
      const description = 'Zod is a TypeScript-first schema declaration and validation library.' // Mock description as it can be null
      const skillDir = join(tempDir, '.claude', 'skills', skill_dir_name)

      // 3. Create the skill
      const createCommand = [
        cliCmd,
        'create-cc-skill',
        `"${skill_dir_name}"`,
        `--package-name "${packageName}"`,
        `--package-version "${version}"`,
        `--description "${description}"`,
        '--scope project',
      ].join(' ')

      // The create command needs to run from within the tempDir to pick up the project scope
      const createOutput = execSync(createCommand, { encoding: 'utf-8', cwd: tempDir })
      expect(createOutput).toContain('✅ Skill created successfully:')
      expect(existsSync(skillDir)).toBe(true)

      // 4. Add documentation
      const addContent =
        "'# Zod Validation Guide\n\nZod is a TypeScript-first schema declaration and validation library. It provides powerful validation capabilities that make it easy to ensure data integrity in your applications. With Zod, you can define schemas and validate data against them with simple, intuitive syntax.'"
      const addCommand = `${cliCmd} add-skill --pwd "${skillDir}" --title "My Zod Note" --content ${addContent}`
      execSync(addCommand, { encoding: 'utf-8' })

      // 5. Build index (via run-script)
      const buildCommand = `${cliCmd} run-script build-index`
      execSync(buildCommand, { cwd: skillDir, encoding: 'utf-8' })

      // 6. Search skill
      const searchSkillCommand = `${cliCmd} search-skill --pwd "${skillDir}" "validation"`
      const searchSkillOutput = execSync(searchSkillCommand, { encoding: 'utf-8' })
      expect(searchSkillOutput).toContain('Search Results')
      expect(searchSkillOutput).toContain('Zod Validation Guide')

      // 7. Verify file structure
      const expectedFiles = [
        'config.json',
        'SKILL.md',
        'package.json',
        'scripts/search.js',
        'scripts/add.js',
        'scripts/build_index.js',
      ]
      expectedFiles.forEach((file) => {
        expect(existsSync(join(skillDir, file))).toBe(true)
      })
    })
  })

  describe('Error Cases', () => {
    it('should fail get-info for an invalid package', () => {
      const command = `node ${process.cwd()}/dist/cli.js get-info invalid-nonexistent-package-123`
      expect(() => execSync(command, { encoding: 'utf-8' })).toThrow()
    })

    it('should fail create-cc-skill without required options', () => {
      const command = `node ${process.cwd()}/dist/cli.js create-cc-skill my-skill`
      expect(() => execSync(command, { encoding: 'utf-8' })).toThrow()
    })
  })
})
