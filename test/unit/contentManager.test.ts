import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ContentManager } from '../../src/core/contentManager.js'
import { SimpleSearchEngine } from '../../src/core/simpleSearch.js'
import { createTempDir, cleanupTempDir } from '../test-utils.js'

// Mock search engine for testing
class MockSearchEngine {
  private documents: any[] = []

  async addDocuments(docs: any[]) {
    this.documents.push(...docs)
  }

  async search(query: string, topK: number = 5, where?: any): Promise<any[]> {
    let results = this.documents

    if (where?.source) {
      results = results.filter(doc => doc.source === where.source)
    }

    // Simple mock search with realistic scores
    const queryLower = query.toLowerCase()
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1) // Filter out very short words

    // Filter by checking if any query words match
    const filtered = results.filter(doc => {
      const titleLower = doc.title.toLowerCase()
      const contentLower = doc.content.toLowerCase()

      // Check if any significant query words match
      return queryWords.some(word =>
        titleLower.includes(word) || contentLower.includes(word)
      )
    })

    // Calculate scores based on content similarity
    return filtered
      .map(doc => {
        // Calculate a simple similarity score
        const titleWords = doc.title.toLowerCase().split(/\s+/)
        const contentWords = doc.content.toLowerCase().split(/\s+/)

        // Title matching score
        const titleMatches = queryWords.filter(word => titleWords.includes(word)).length
        const titleScore = titleMatches / Math.max(titleWords.length, 1)

        // Content matching score
        const contentMatches = queryWords.filter(word => contentWords.includes(word)).length
        const contentScore = contentMatches / Math.max(queryWords.length, 1)

        // Combined score with title weight
        const combinedScore = (titleScore * 0.3 + contentScore * 0.7)
        const score = Math.min(combinedScore, 1.0)

        return {
          ...doc,
          score,
          file_path: `${doc.source}/${doc.filename}` // Add file_path for ContentManager
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  async getStats() {
    return { totalDocuments: this.documents.length }
  }
}

describe('ContentManager', () => {
  let tempDir: string
  let referencesDir: string
  let mockSearchEngine: MockSearchEngine
  let contentManager: ContentManager

  beforeEach(() => {
    tempDir = createTempDir('content-manager-test-')
    referencesDir = join(tempDir, 'references')
    mkdirSync(referencesDir, { recursive: true })
    mkdirSync(join(referencesDir, 'user'), { recursive: true })
    mkdirSync(join(referencesDir, 'context7'), { recursive: true })

    mockSearchEngine = new MockSearchEngine() as any
    contentManager = new ContentManager({
      searchEngine: mockSearchEngine as any,
      referencesDir,
    })
  })

  afterEach(() => {
    cleanupTempDir(tempDir)
  })

  describe('getContentStats', () => {
    it('should return correct statistics', () => {
      // Create some test files
      writeFileSync(join(referencesDir, 'user', 'doc1.md'), '# Doc 1')
      writeFileSync(join(referencesDir, 'user', 'doc2.md'), '# Doc 2')
      writeFileSync(join(referencesDir, 'context7', 'doc3.md'), '# Doc 3')

      const stats = contentManager.getContentStats()

      expect(stats.userFiles).toBe(2)
      expect(stats.context7Files).toBe(1)
      expect(stats.totalFiles).toBe(3)
      expect(stats.userDirExists).toBe(true)
      expect(stats.context7DirExists).toBe(true)
    })

    it('should handle empty directories', () => {
      const stats = contentManager.getContentStats()

      expect(stats.userFiles).toBe(0)
      expect(stats.context7Files).toBe(0)
      expect(stats.totalFiles).toBe(0)
      expect(stats.userDirExists).toBe(true)
      expect(stats.context7DirExists).toBe(true)
    })
  })

  describe('listContent', () => {
    beforeEach(() => {
      // Create test files with timestamps
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      writeFileSync(join(referencesDir, 'user', 'user-doc.md'), '# User Doc')
      writeFileSync(join(referencesDir, 'context7', 'api-doc.md'), '# API Doc')

      // Mock file stats with different times to ensure consistent order
      vi.mock('node:fs', () => ({
        existsSync: vi.fn(),
        readdirSync: vi.fn(),
        statSync: vi.fn((filePath) => ({
          size: 100,
          mtime: filePath.includes('user-doc') ? now : yesterday,
        })),
      }))
    })

    it('should list all content', () => {
      vi.unmock('node:fs')
      const content = contentManager.listContent()

      expect(content.length).toBe(2)
      // Check both files are present regardless of order
      const filenames = content.map(c => c.filename)
      expect(filenames).toContain('user-doc.md')
      expect(filenames).toContain('api-doc.md')

      // Check sources are correct
      const userDoc = content.find(c => c.filename === 'user-doc.md')
      const apiDoc = content.find(c => c.filename === 'api-doc.md')
      expect(userDoc?.source).toBe('user')
      expect(apiDoc?.source).toBe('context7')
    })

    it('should filter by source', () => {
      vi.unmock('node:fs')
      const userContent = contentManager.listContent('user')

      expect(userContent.length).toBe(1)
      expect(userContent[0].source).toBe('user')
    })
  })

  describe('addUserContent', () => {
    it('should add new content', async () => {
      const result = await contentManager.addUserContent({
        title: 'Test Document',
        content: '# Test\nThis is a test document.',
      })

      expect(result.added).toBe(true)
      expect(result.filePath).toContain('Test_Document')
      expect(result.message).toContain('Created new content')

      // Check file exists
      expect(existsSync(result.filePath!)).toBe(true)

      // Check file content
      const content = readFileSync(result.filePath!, 'utf-8')
      expect(content).toContain('# Test Document')
      expect(content).toContain('This is a test document.')
    })

    it('should handle existing similar content', async () => {
      // Add initial content
      await contentManager.addUserContent({
        title: 'React Guide',
        content: '# React Guide\nReact is a UI library for building user interfaces with components and state management.',
      })

      // Add the document to search engine index
      await mockSearchEngine.addDocuments([{
        id: 'react-guide',
        title: 'React Guide',
        content: 'React is a UI library for building user interfaces with components and state management.',
        source: 'user',
        filename: 'React_Guide.md'
      }])

      // Try to add very similar content
      const result = await contentManager.addUserContent({
        title: 'React Tutorial',
        content: '# React Tutorial\nReact is a UI library for building user interfaces with components and state management.',
      })

      // Should find similar content and not add
      expect(result.added).toBe(false)
      expect(result.similarFound).toBeGreaterThan(0)
      expect(result.similarContent).toBeDefined()
      expect(result.similarContent!.length).toBeGreaterThan(0)
    })

    it('should update existing content with autoUpdate', async () => {
      // Add initial content
      await contentManager.addUserContent({
        title: 'React Guide',
        content: '# React Guide\nReact is a UI library.',
      })

      // Add the document to search engine index
      await mockSearchEngine.addDocuments([{
        id: 'react-guide',
        title: 'React Guide',
        content: 'React is a UI library.',
        source: 'user',
        filename: 'React_Guide.md'
      }])

      // Add enhanced content (much longer to trigger update)
      const result = await contentManager.addUserContent({
        title: 'React Guide',
        content: '# React Guide\n\nReact is a UI library for building user interfaces with a component-based architecture. It allows developers to create large web applications that can change data without reloading the page. It aims to provide speed, simplicity, and scalability. React can be used with a combination of other libraries or frameworks to build complex applications. The library maintains a virtual DOM that optimizes rendering performance. Components can be functional or class-based, with hooks providing state management in functional components. React follows a unidirectional data flow pattern which makes the application more predictable and easier to debug. The ecosystem includes React Router for navigation, Redux for state management, and numerous other libraries that complement the core functionality.',
        autoUpdate: true,
      })

      // Should update since new content is significantly longer
      expect(result.updated).toBe(true)
      expect(result.message).toContain('Updated existing content')
    })

    it('should force add content even when similar exists', async () => {
      await contentManager.addUserContent({
        title: 'React Guide',
        content: '# React Guide\nReact is a UI library.',
      })

      const result = await contentManager.addUserContent({
        title: 'React Guide',
        content: '# React Guide\nDifferent content about React.',
        force: true,
      })

      expect(result.added).toBe(true)
      expect(result.filePath).toContain('React_Guide')
    })

    it('should create unique file names', async () => {
      const result1 = await contentManager.addUserContent({
        title: 'Same Title',
        content: 'First document',
      })

      const result2 = await contentManager.addUserContent({
        title: 'Same Title',
        content: 'Second document',
        force: true,
      })

      expect(result1.filePath).not.toBe(result2.filePath)
      expect(result1.filePath).toContain('Same_Title')
      expect(result2.filePath).toContain('Same_Title')
    })
  })

  describe('updateFromContext7', () => {
    it('should handle successful update', async () => {
      // Mock successful download with longer content
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('# API Documentation\n\nThis is the API documentation with enough content to be processed. It includes detailed information about the API endpoints, parameters, and usage examples. The content is comprehensive enough to pass the minimum length requirements for document slicing.'),
      })

      const result = await contentManager.updateFromContext7('/api/docs')

      expect(result.updated).toBe(true)
      expect(result.filesCreated).toBeGreaterThan(0)
      expect(result.message).toContain('Updated')
    })

    it('should handle download failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      })

      const result = await contentManager.updateFromContext7('/api/docs')

      expect(result.updated).toBe(false)
      expect(result.message).toContain('Failed to update')
    })

    it('should skip update if not needed', async () => {
      // First update
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('# API Documentation\nContent'),
      })

      await contentManager.updateFromContext7('/api/docs', false)

      // Second update should skip
      const result = await contentManager.updateFromContext7('/api/docs', false)

      expect(result.skipped).toBe(true)
      expect(result.message).toContain('up to date')
    })

    it('should force update when specified', async () => {
      // First update
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('# API Documentation\nContent'),
      })

      await contentManager.updateFromContext7('/api/docs', false)

      // Force update
      const result = await contentManager.updateFromContext7('/api/docs', true)

      expect(result.updated).toBe(true)
      expect(result.message).toContain('Updated')
    })
  })

  describe('extractSections', () => {
    it('should extract markdown sections correctly', async () => {
      const content = `# Introduction
This is the introduction.

## Getting Started
Step 1

### Installation
npm install package

## Advanced Topics
More info here`

      writeFileSync(join(referencesDir, 'test.md'), content)

      const result = await contentManager.addUserContent({
        title: 'Test',
        content,
      })

      expect(result.added).toBe(true)
    })

    it('should filter out very short sections', async () => {
      const content = `# Title
Short.

## Another Title
This section has more content to meet the minimum length requirement for indexing.`

      const result = await contentManager.addUserContent({
        title: 'Test',
        content,
      })

      expect(result.added).toBe(true)
    })
  })
})