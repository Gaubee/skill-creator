import { describe, it, expect, beforeEach } from 'vitest'
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
        description: 'Test description',
        context7Id: '/test/docs',
      })

      expect(config.name).toBe('test-skill')
      expect(config.description).toBe('Test description')
      expect(config.context7LibraryId).toBe('/test/docs')
      expect(config.version).toBe('1.0.0')
      expect(config.chunkSize).toBe(1000)
      expect(config.chunkOverlap).toBe(200)
      expect(config.embeddingModel).toBe('all-MiniLM-L6-v2')
      expect(config.similarityThreshold).toBe(0.85)
      expect(config.maxSearchResults).toBe(10)
    })
  })

  describe('save and load', () => {
    it('should save and load config correctly', () => {
      const config = Config.createDefault({
        skillName: 'test-skill',
        description: 'Test description',
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
        description: 'Test description',
        context7Id: '/test/docs',
      })

      const configPath = join(tempDir, 'config.json')
      Config.save(config, configPath)

      const content = require('node:fs').readFileSync(configPath, 'utf-8')
      const jsonConfig = JSON.parse(content)

      // Check that saved JSON uses snake_case
      expect(jsonConfig.context7_library_id).toBe('/test/docs')
      expect(jsonConfig.chunk_size).toBe(1000)

      // Check that loaded config uses camelCase
      const loadedConfig = Config.load(configPath)
      expect(loadedConfig.context7LibraryId).toBe('/test/docs')
      expect(loadedConfig.chunkSize).toBe(1000)
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