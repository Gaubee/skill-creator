import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { rmSync, existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
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

      // 3. Create skill using new command format: skill-creator create-cc-skill --scope [current|user] --name packageName --description "desc" skill_dir_name
      const createCommand = [
        cliCmd,
        'create-cc-skill',
        '--scope',
        'current',
        '--name',
        '"zod"',
        '--description',
        `"${description}"`,
        `"${skill_dir_name}"`,
      ].join(' ')

      // The create command needs to run from within the tempDir to pick up the current scope
      const createOutput = execSync(createCommand, {
        encoding: 'utf-8',
        cwd: tempDir,
      })
      expect(createOutput).toContain('✅ Skill created successfully:')

      expect(existsSync(skillDir)).toBe(true)

      // 4. Add documentation
      const addContent =
        "'# Zod Validation Guide\n\nZod is a TypeScript-first schema declaration and validation library. It provides powerful validation capabilities that make it easy to ensure data integrity in your applications. With Zod, you can define schemas and validate data against them with simple, intuitive syntax.'"
      const addCommand = `${cliCmd} add-skill --pwd "${skillDir}" --title "My Zod Note" --content ${addContent}`
      execSync(addCommand, { encoding: 'utf-8' })

      // 5. Search skill
      const searchSkillCommand = `${cliCmd} search-skill --pwd "${skillDir}" "validation"`
      const searchSkillOutput = execSync(searchSkillCommand, { encoding: 'utf-8' })
      expect(searchSkillOutput).toContain('Search Results')
      expect(searchSkillOutput).toContain('Zod Validation Guide')

      // 7. Verify file structure
      const expectedFiles = [
        'SKILL.md',
        'assets/references/context7/.gitkeep',
        'assets/references/user/.gitkeep',
        'assets/chroma_db/.gitkeep',
        'assets/logs/.gitkeep',
      ]

      expectedFiles.forEach((file) => {
        expect(existsSync(join(skillDir, file))).toBe(true)
      })

      // config.json and package.json should not exist anymore
      expect(existsSync(join(skillDir, 'config.json'))).toBe(false)
      expect(existsSync(join(skillDir, 'package.json'))).toBe(false)

      // scripts folder should not exist
      expect(existsSync(join(skillDir, 'scripts'))).toBe(false)
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

  describe('Force Option', () => {
    it('should fail when skill directory exists without force', () => {
      const tempDir = createTempDir('force-test-')
      const skillDir = join(tempDir, '.claude', 'skills', 'test-force-skill')

      // Create an existing skill directory with some content
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(join(skillDir, 'existing-file.txt'), 'existing content')

      const command = `node ${process.cwd()}/dist/cli.js create-cc-skill --scope current test-force-skill`

      expect(() => {
        execSync(command, { encoding: 'utf-8', cwd: tempDir })
      }).toThrow('Skill directory already exists and is not empty')

      cleanupTempDir(tempDir)
    })

    it('should succeed when skill directory exists with force option', () => {
      const tempDir = createTempDir('force-test-')
      const skillDir = join(tempDir, '.claude', 'skills', 'test-force-skill')

      // Create an existing skill directory with some content
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(join(skillDir, 'existing-file.txt'), 'existing content')

      const command = `node ${process.cwd()}/dist/cli.js create-cc-skill --scope current --force test-force-skill`
      const output = execSync(command, { encoding: 'utf-8', cwd: tempDir })

      expect(output).toContain('✅ Skill created successfully')
      expect(existsSync(join(skillDir, 'SKILL.md'))).toBe(true)
      expect(existsSync(join(skillDir, 'config.json'))).toBe(false)
      expect(existsSync(join(skillDir, 'package.json'))).toBe(false)
      // The existing file should still exist (we only overwrite our files)
      expect(existsSync(join(skillDir, 'existing-file.txt'))).toBe(true)

      cleanupTempDir(tempDir)
    })
  })

  describe('init-cc Command', () => {
    it('should install skill-creator as subagent', () => {
      const tempDir = createTempDir('init-test-')
      const agentsDir = join(tempDir, '.claude', 'agents')
      const skillCreatorFile = join(agentsDir, 'skill-creator.md')

      // Mock the home directory to use our temp directory
      const originalEnv = process.env.HOME
      process.env.HOME = tempDir

      const command = `node ${process.cwd()}/dist/cli.js init-cc`
      const output = execSync(command, { encoding: 'utf-8' })

      expect(output).toContain('✅ Skill-creator subagent installed successfully!')
      expect(existsSync(skillCreatorFile)).toBe(true)

      // Check that it's a proper markdown file with frontmatter
      const content = readFileSync(skillCreatorFile, 'utf-8')
      expect(content).toContain('---')
      expect(content).toContain('name: skill-creator')

      // Restore original HOME
      process.env.HOME = originalEnv

      cleanupTempDir(tempDir)
    })
  })
})
