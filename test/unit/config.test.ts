import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { Config } from '../../src/utils/config.js'
import { createTempDir, cleanupTempDir } from '../test-utils.js'

describe('Config', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempDir('config-test-')
  })

  afterEach(() => {
    cleanupTempDir(tempDir)
  })

  describe('createDefault', () => {
    it('should create default config with required fields', () => {
      const config = Config.createDefault({
        skillName: 'test-skill',
        context7Id: '/test/docs',
      })

      expect(config.packageName).toBe('test-skill')
      expect(config.context7LibraryId).toBe('/test/docs')
    })

    it('should create default config with empty context7Id when not provided', () => {
      const config = Config.createDefault({
        skillName: 'test-skill',
      })

      expect(config.packageName).toBe('test-skill')
      expect(config.context7LibraryId).toBe('')
    })
  })

  describe('save and load', () => {
    it('should save and load config correctly', () => {
      const config = Config.createDefault({
        skillName: 'test-skill',
        context7Id: '/test/docs',
      })

      const configPath = join(tempDir, 'config.json')
      Config.save(config, configPath)

      expect(existsSync(configPath)).toBe(true)

      const loadedConfig = Config.load(configPath)
      expect(loadedConfig).toEqual(config)
    })

    it('should convert between snake_case and camelCase', () => {
      const config = Config.createDefault({
        skillName: 'test-skill',
        context7Id: '/test/docs',
      })

      const configPath = join(tempDir, 'config.json')
      Config.save(config, configPath)

      const content = require('node:fs').readFileSync(configPath, 'utf-8')
      const jsonConfig = JSON.parse(content)

      // Check that saved JSON uses snake_case
      expect(jsonConfig.context7_library_id).toBe('/test/docs')

      // Check that loaded config uses camelCase
      const loadedConfig = Config.load(configPath)
      expect(loadedConfig.context7LibraryId).toBe('/test/docs')
    })

    it('should throw error when loading non-existent file', () => {
      const nonExistentPath = join(tempDir, 'non-existent.json')

      expect(() => {
        Config.load(nonExistentPath)
      }).toThrow()
    })

    it('should throw error when loading invalid JSON', () => {
      const invalidPath = join(tempDir, 'invalid.json')
      writeFileSync(invalidPath, 'invalid json content')

      expect(() => {
        Config.load(invalidPath)
      }).toThrow()
    })
  })
})
