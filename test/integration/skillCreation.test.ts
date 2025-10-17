import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { createTempDir, cleanupTempDir } from '../test-utils.js'

describe('Skill Creation Integration Tests', () => {
  let tempDir: string
  let skillPath: string

  beforeEach(() => {
    tempDir = createTempDir('integration-test-')
  })

  afterEach(() => {
    cleanupTempDir(tempDir)
  })

  describe('Full Skill Creation Workflow', () => {
    it('should create and use a complete skill', async () => {
      // Create skill using CLI
      const packageName = 'react-testing'
      const command = `node ${process.cwd()}/dist/cli.js ${packageName} -d "React testing library" -p ${tempDir}`

      const output = execSync(command, {
        encoding: 'utf-8',
        cwd: process.cwd(),
      })

      // Extract skill path from output (message may contain additional text)
      const lines = output.split('\n')
      const successLine = lines.find(line => line.includes('✅ Skill created successfully:'))
      if (!successLine) {
        throw new Error(`Unexpected output: ${output}`)
      }
      const pathMatch = successLine.match(/✅ Skill created successfully:\s*(.+?)(?:\s+\||$)/)
      if (!pathMatch) {
        throw new Error(`Could not extract path from: ${successLine}`)
      }
      skillPath = pathMatch[1].trim()
      expect(existsSync(skillPath)).toBe(true)

      // Install dependencies
      execSync('npm install', {
        cwd: skillPath,
        stdio: 'pipe',
      })

      // Add some documentation
      const addScript = join(skillPath, 'scripts', 'add.js')
      const addContent = '# Testing with React\n\nThis guide covers testing React components using React Testing Library.\n\n## Setup\nInstall the dependencies:\n```bash\nnpm install --save-dev @testing-library/react @testing-library/jest-dom\n```\n\n## Basic Test Example\nA simple test example.'

      execSync(`node ${addScript} --title "Testing with React" --content "${addContent}"`, {
        cwd: skillPath,
        encoding: 'utf-8',
        stdio: 'pipe',
        env: {
          ...process.env,
          SKILL_CREATOR_PATH: join(process.cwd(), 'dist', 'cli.js')
        }
      })

      // Build index
      const buildScript = join(skillPath, 'scripts', 'build_index.js')
      execSync('node ' + buildScript, {
        cwd: skillPath,
        encoding: 'utf-8',
        env: {
          ...process.env,
          SKILL_CREATOR_PATH: join(process.cwd(), 'dist', 'cli.js')
        }
      })

      // Search functionality
      const searchScript = join(skillPath, 'scripts', 'search.js')
      const searchOutput = execSync('node ' + searchScript + ' --query "testing setup"', {
        cwd: skillPath,
        encoding: 'utf-8',
        env: {
          ...process.env,
          SKILL_CREATOR_PATH: join(process.cwd(), 'dist', 'cli.js')
        }
      })

      expect(searchOutput).toContain('Search Results')
      expect(searchOutput).toContain('Testing with React')

      // List content
      const listScript = join(skillPath, 'scripts', 'list_content.js')
      const listOutput = execSync('node ' + listScript, {
        cwd: skillPath,
        encoding: 'utf-8',
        env: {
          ...process.env,
          SKILL_CREATOR_PATH: join(process.cwd(), 'dist', 'cli.js')
        }
      })

      expect(listOutput).toContain('Content Statistics')
      expect(listOutput).toContain('Testing with React')

      // Verify file structure
      const expectedFiles = [
        'config.json',
        'SKILL.md',
        'package.json',
        'scripts/search.js',
        'scripts/add.js',
        'scripts/build_index.js',
        'scripts/list_content.js',
        'assets/references/user',
        'assets/chroma_db',
      ]

      expectedFiles.forEach(file => {
        expect(existsSync(join(skillPath, file))).toBe(true)
      })

      // Verify content files
      const userContentDir = join(skillPath, 'assets', 'references', 'user')
      const allFiles = require('node:fs').readdirSync(userContentDir)
      const contentFiles = allFiles.filter(f => f !== '.gitkeep')
      expect(contentFiles.length).toBeGreaterThan(0)
      expect(contentFiles.some(f => f.includes('Testing_with_React'))).toBe(true)
    })

    it('should create skill with custom context7 ID', async () => {
      const packageName = 'express-framework'
      const context7Id = '/expressjs/express/docs'

      const command = `node ${process.cwd()}/dist/cli.js ${packageName} -d "Express.js framework" -c ${context7Id} -p ${tempDir}`

      const output = execSync(command, {
        encoding: 'utf-8',
        cwd: process.cwd(),
      })

      // Extract skill path from output (message may contain additional text)
      const lines = output.split('\n')
      const successLine = lines.find(line => line.includes('✅ Skill created successfully:'))
      if (!successLine) {
        throw new Error(`Unexpected output: ${output}`)
      }
      const pathMatch = successLine.match(/✅ Skill created successfully:\s*(.+?)(?:\s+\||$)/)
      if (!pathMatch) {
        throw new Error(`Could not extract path from: ${successLine}`)
      }
      skillPath = pathMatch[1].trim()

      // Check config
      const configPath = join(skillPath, 'config.json')
      const config = JSON.parse(require('node:fs').readFileSync(configPath, 'utf-8'))
      expect(config.context7_library_id).toBe(context7Id)
    })
  })

  describe('Script Execution', () => {
    beforeEach(async () => {
      // Create a test skill
      const packageName = 'test-scripts'
      const command = `node ${process.cwd()}/dist/cli.js ${packageName} -p ${tempDir}`

      const output = execSync(command, {
        encoding: 'utf-8',
        cwd: process.cwd(),
      })

      // Extract skill path from output (message may contain additional text)
      const lines = output.split('\n')
      const successLine = lines.find(line => line.includes('✅ Skill created successfully:'))
      if (!successLine) {
        throw new Error(`Unexpected output: ${output}`)
      }
      const pathMatch = successLine.match(/✅ Skill created successfully:\s*(.+?)(?:\s+\||$)/)
      if (!pathMatch) {
        throw new Error(`Could not extract path from: ${successLine}`)
      }
      skillPath = pathMatch[1].trim()

      // Install dependencies
      execSync('npm install', {
        cwd: skillPath,
        stdio: 'pipe',
      })
    })

    it('should execute run-script commands', async () => {
      // Test all run-script commands
      const commands = [
        'build-index',
        'list-content',
      ]

      for (const cmd of commands) {
        const output = execSync('node ' + process.cwd() + '/dist/cli.js run-script ' + cmd, {
          cwd: skillPath,
          encoding: 'utf-8',
        })

        expect(output).toBeDefined()
        expect(output.length).toBeGreaterThan(0)
      }
    })

    it('should handle invalid run-script command', async () => {
      expect(() => {
        execSync('node ' + process.cwd() + '/dist/cli.js run-script invalid-command', {
          cwd: skillPath,
          encoding: 'utf-8',
        })
      }).toThrow()
    })
  })

  describe('Error Cases', () => {
    it('should handle invalid package names', async () => {
      const command = 'node ' + process.cwd() + '/dist/cli.js "" -p ' + tempDir

      expect(() => {
        execSync(command, {
          encoding: 'utf-8',
          cwd: process.cwd(),
        })
      }).toThrow()
    })

    it('should handle creation in non-existent directory', async () => {
      const nonExistentPath = join(tempDir, 'non-existent')

      expect(() => {
        execSync('node ' + process.cwd() + '/dist/cli.js test -p ' + nonExistentPath, {
          encoding: 'utf-8',
          cwd: process.cwd(),
        })
      }).not.toThrow() // Should create the directory
    })
  })
})