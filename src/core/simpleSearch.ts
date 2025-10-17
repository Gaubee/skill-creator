/**
 * Simple search engine implementation (without ChromaDB)
 */

import { join } from 'node:path'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { glob } from 'glob'
import type { SearchResult } from '../types/index.js'

export interface SimpleSearchOptions {
  referencesDir: string
  collectionName: string
}

export class SimpleSearchEngine {
  private options: SimpleSearchOptions
  private documents: Array<{
    id: string
    title: string
    content: string
    source: 'user' | 'context7'
    file_path: string
    metadata: any
  }> = []

  constructor(options: SimpleSearchOptions) {
    this.options = options
  }

  async buildIndex(referencesDir: string, hashFile: string): Promise<void> {
    console.log('Building simple search index...')

    // Get all markdown files
    const files = await glob('**/*.md', { cwd: referencesDir })

    if (files.length === 0) {
      console.log('No documentation files found to index')
      return
    }

    console.log(`Indexing ${files.length} documents...`)

    // Load all documents
    this.documents = []

    for (const file of files) {
      const content = readFileSync(join(referencesDir, file), 'utf-8')
      const sections = this.splitIntoSections(content)

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i]
        const source: 'user' | 'context7' = file.includes('context7/') ? 'context7' : 'user'

        this.documents.push({
          id: `${file}_${i}`,
          title: section.title,
          content: section.content,
          source,
          file_path: file,
          metadata: {
            source,
            file_path: file,
            section_index: i,
            title: section.title,
            priority: source === 'user' ? 10 : 1,
          }
        })
      }
    }

    console.log(`✅ Indexed ${this.documents.length} sections from ${files.length} files`)
  }

  async search(
    query: string,
    topK: number = 5,
    where?: Record<string, any>,
  ): Promise<SearchResult[]> {
    let results = this.documents

    // Filter by source if specified
    if (where?.source) {
      results = results.filter(doc => doc.source === where.source)
    }

    // Simple text matching search
    const queryTerms = query.toLowerCase().split(/\s+/)
    const scoredResults = results.map(doc => {
      const content = doc.content.toLowerCase()
      const title = doc.title.toLowerCase()

      let score = 0
      for (const term of queryTerms) {
        if (title.includes(term)) {
          score += 10 // Title matches are worth more
        }
        if (content.includes(term)) {
          score += 1
        }
      }

      return {
        ...doc,
        score: score / queryTerms.length // Normalize score
      }
    })

    // Sort by score and take top K
    return scoredResults
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
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
    return { totalDocuments: this.documents.length }
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