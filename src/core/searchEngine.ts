/**
 * ChromaDB-based search engine
 */

import type { OpenAIEmbeddingFunction } from 'chromadb'
import { DefaultEmbeddingFunction } from '@chroma-core/default-embed'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { glob } from 'glob'
import { createHash } from 'node:crypto'
import type { SearchResult } from '../types/index.js'

export interface SearchEngineOptions {
  dbPath: string
  collectionName: string
  embeddingModel: string
}

export class SearchEngine {
  private db: any | null = null
  private options: SearchEngineOptions
  private embeddingFunction: any | null = null

  constructor(options: SearchEngineOptions) {
    this.options = options
  }

  async initialize(): Promise<void> {
    const { ChromaClient } = await import('chromadb')

    // Try to use local embedded ChromaDB
    try {
      this.db = new ChromaClient({
        path: this.options.dbPath,
      })
    } catch (e) {
      // Fallback to HTTP client (requires ChromaDB server)
      console.warn('Failed to initialize embedded ChromaDB, falling back to HTTP client')
      this.db = new ChromaClient({
        path: 'http://localhost:8000',
      })
    }

    // Use default embedding function (doesn't require API keys)
    this.embeddingFunction = new DefaultEmbeddingFunction()
  }

  async buildIndex(referencesDir: string, hashFile: string): Promise<void> {
    const { hash } = await import('node:crypto')

    if (!await this.initializeIfNeeded()) {
      return
    }

    // Get all markdown files
    const files = await glob('**/*.md', { cwd: referencesDir })

    if (files.length === 0) {
      console.log('No documentation files found to index')
      return
    }

    // Calculate current hash
    const { readFileSync } = await import('node:fs')
    const fileContents = files.map(file => {
      const content = readFileSync(join(referencesDir, file), 'utf-8')
      return `${file}:${content}`
    })
    const h = createHash('sha256')
    h.update(fileContents.join('\n'))
    const currentHash = h.digest('hex')

    // Check if we need to rebuild
    if (existsSync(hashFile)) {
      const lastHash = readFileSync(hashFile, 'utf-8')
      if (lastHash === currentHash) {
        console.log('Index is up to date')
        return
      }
    }

    console.log(`Indexing ${files.length} documents...`)

    // Get or create collection
    let collection
    try {
      collection = await this.db!.getCollection({
        name: this.options.collectionName,
      })
      await collection.delete() // Clear existing data
    } catch {
      collection = await this.db!.createCollection({
        name: this.options.collectionName,
        embeddingFunction: this.embeddingFunction,
      })
    }

    // Process and add documents
    const documents: string[] = []
    const metadatas: any[] = []
    const ids: string[] = []

    for (const file of files) {
      const content = readFileSync(join(referencesDir, file), 'utf-8')
      const sections = this.splitIntoSections(content)

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i]
        documents.push(section.content)

        const source = file.includes('context7/') ? 'context7' : 'user'
        metadatas.push({
          source,
          file_path: file,
          section_index: i,
          title: section.title,
          priority: source === 'user' ? 10 : 1,
        })

        ids.push(`${file}_${i}`)
      }
    }

    // Add to collection in batches
    const batchSize = 100
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize)
      const metadataBatch = metadatas.slice(i, i + batchSize)
      const idBatch = ids.slice(i, i + batchSize)

      await collection.add({
        ids: idBatch,
        documents: batch,
        metadatas: metadataBatch,
      })
    }

    // Save hash
    const { writeFileSync } = await import('node:fs')
    writeFileSync(hashFile, currentHash)

    console.log(`✅ Indexed ${documents.length} sections from ${files.length} files`)
  }

  async search(
    query: string,
    topK: number = 5,
    where?: Record<string, any>,
  ): Promise<SearchResult[]> {
    if (!await this.initializeIfNeeded()) {
      return []
    }

    let collection
    try {
      collection = await this.db!.getCollection({
        name: this.options.collectionName,
      })
    } catch {
      return []
    }

    const results = await collection.query({
      queryTexts: [query],
      nResults: topK,
      where,
    })

    if (!results.ids[0] || results.ids[0].length === 0) {
      return []
    }

    return results.ids[0].map((id: any, index: number) => ({
      id,
      title: results.metadatas[0]?.[index]?.title || 'Untitled',
      content: results.documents[0]?.[index] || '',
      score: results.distances[0]?.[index] || 0,
      source: results.metadatas[0]?.[index]?.source || 'unknown',
      file_path: results.metadatas[0]?.[index]?.file_path || '',
      metadata: results.metadatas[0]?.[index] || {},
    }))
  }

  async searchByPriority(query: string, topK: number = 5): Promise<SearchResult[]> {
    // First try user content, then context7
    const userResults = await this.search(query, topK, { source: 'user' })
    const contextResults = await this.search(
      query,
      topK - userResults.length,
      { source: 'context7' },
    )

    return [...userResults, ...contextResults].slice(0, topK)
  }

  async getStats(): Promise<{ totalDocuments: number }> {
    if (!await this.initializeIfNeeded()) {
      return { totalDocuments: 0 }
    }

    try {
      const collection = await this.db!.getCollection({
        name: this.options.collectionName,
      })
      const count = await collection.count()
      return { totalDocuments: count }
    } catch {
      return { totalDocuments: 0 }
    }
  }

  private async initializeIfNeeded(): Promise<boolean> {
    if (!this.db) {
      await this.initialize()
    }
    return !!this.db
  }

  private splitIntoSections(content: string): Array<{ title: string; content: string }> {
    const sections: Array<{ title: string; content: string }> = []
    const lines = content.split('\n')
    let currentSection = { title: 'Introduction', content: '' }

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)

      if (headingMatch) {
        if (currentSection.content.trim()) {
          sections.push({ ...currentSection })
        }
        currentSection = {
          title: headingMatch[2],
          content: '',
        }
      } else {
        currentSection.content += line + '\n'
      }
    }

    if (currentSection.content.trim()) {
      sections.push(currentSection)
    }

    return sections.filter(s => s.content.trim().length > 50)
  }
}