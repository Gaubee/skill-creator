/**
 * Content management with Context7 integration
 */

import { join } from 'node:path'
import { existsSync, mkdirSync, readdirSync, writeFileSync, rmSync, statSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import MarkdownIt from 'markdown-it'
import type {
  ContentStats,
  ContentItem,
  UpdateContext7Result,
  AddContentResult
} from '../types/index.js'

export interface ContentManagerOptions {
  searchEngine: {
    search(query: string, topK?: number, where?: any): Promise<any[]>
  }
  referencesDir: string
}

export class ContentManager {
  private options: ContentManagerOptions
  private userDir: string
  private context7Dir: string
  private md: MarkdownIt

  constructor(options: ContentManagerOptions) {
    this.options = options
    this.userDir = join(options.referencesDir, 'user')
    this.context7Dir = join(options.referencesDir, 'context7')
    this.md = new MarkdownIt()
  }

  async updateFromContext7(
    libraryId: string,
    force: boolean = false,
  ): Promise<UpdateContext7Result> {
    const result: UpdateContext7Result = {
      updated: false,
      skipped: false,
      filesCreated: 0,
      message: '',
    }

    try {
      // Download content
      const content = await this.downloadContext7Doc(libraryId)

      // Check if update needed
      if (!force && !this.needsUpdate(content)) {
        result.skipped = true
        result.message = 'Context7 documentation is up to date'
        return result
      }

      // Clear existing context7 docs
      if (existsSync(this.context7Dir)) {
        const files = readdirSync(this.context7Dir)
        for (const file of files) {
          if (file.endsWith('.md')) {
            rmSync(join(this.context7Dir, file))
          }
        }
      }

      // Ensure directory exists
      mkdirSync(this.context7Dir, { recursive: true })

      // Slice and save
      const savedFiles = await this.sliceDocument(content, this.context7Dir)
      result.filesCreated = savedFiles.length

      // Save hash
      this.saveContentHash(content)

      // Trigger reindex
      this.triggerReindex()

      result.updated = true
      result.message = `Updated ${savedFiles.length} documentation slices`
    } catch (error) {
      result.message = `Failed to update Context7 docs: ${error}`
    }

    return result
  }

  async addUserContent(options: {
    title: string
    content: string
    force?: boolean
    autoUpdate?: boolean
  }): Promise<AddContentResult> {
    const result: AddContentResult = {
      added: false,
      updated: false,
      skipped: false,
      message: '',
      similarFound: 0,
    }

    try {
      // Search for similar content
      const similar = await this.findSimilarContent(options.content)

      if (similar.length > 0 && !options.force) {
        const bestMatch = similar[0]

        if (options.autoUpdate && bestMatch.source === 'user') {
          // Update user file
          const filePath = join(this.options.referencesDir, bestMatch.file_path)

          if (this.isContentEnhanced(bestMatch, options.content)) {
            writeFileSync(
              filePath,
              `# ${options.title}\n\n${options.content}`,
            )

            result.updated = true
            result.filePath = filePath
            result.message = `Updated existing content: ${bestMatch.file_path}`

            // Trigger index update
            this.triggerReindex()
          } else {
            result.skipped = true
            result.message = 'Existing content is comprehensive enough'
          }
        } else {
          // Similar content found but not updating
          result.message = `Found ${similar.length} similar documents`
          result.similarContent = similar.slice(0, 3).map(s => ({
            title: s.title,
            score: s.score,
            source: s.source,
            preview: s.content.slice(0, 200) + '...',
          }))
          result.similarFound = similar.length
        }
      } else if (!result.added && !result.updated && !result.skipped) {
        // Create new file only if no similar content was found
        mkdirSync(this.userDir, { recursive: true })
        const filePath = this.createUniqueFilePath(options.title, this.userDir)

        writeFileSync(filePath, `# ${options.title}\n\n${options.content}`)

        result.added = true
        result.filePath = filePath
        result.message = `Created new content: ${filePath.split('/').pop()}`

        // Trigger index update
        this.triggerReindex()
      }
    } catch (error) {
      result.message = `Failed to add content: ${error}`
    }

    result.similarFound = result.similarContent?.length || 0
    return result
  }

  getContentStats(): ContentStats {
    const stats: ContentStats = {
      userFiles: 0,
      context7Files: 0,
      totalFiles: 0,
      userDirExists: existsSync(this.userDir),
      context7DirExists: existsSync(this.context7Dir),
    }

    if (stats.userDirExists) {
      stats.userFiles = readdirSync(this.userDir).filter(f =>
        f.endsWith('.md')
      ).length
    }

    if (stats.context7DirExists) {
      stats.context7Files = readdirSync(this.context7Dir).filter(f =>
        f.endsWith('.md')
      ).length
    }

    stats.totalFiles = stats.userFiles + stats.context7Files
    return stats
  }

  listContent(source?: 'user' | 'context7'): ContentItem[] {
    const contentList: ContentItem[] = []

    const dirsToSearch = []
    if (source === 'user' || !source) dirsToSearch.push(['user', this.userDir])
    if (source === 'context7' || !source) dirsToSearch.push(['context7', this.context7Dir])

    for (const [sourceName, dirPath] of dirsToSearch) {
      if (existsSync(dirPath)) {
        const files = readdirSync(dirPath)
        for (const file of files) {
          if (!file.endsWith('.md')) continue

          const filePath = join(dirPath, file)
          const stat = statSync(filePath)

          let title = file.replace('.md', '')
          try {
            const content = readFileSync(filePath, 'utf-8')
            const firstLine = content.split('\n')[0]
            if (firstLine?.startsWith('# ')) {
              title = firstLine.slice(2)
            }
          } catch {
            // Use filename if can't read
          }

          contentList.push({
            title,
            filename: file,
            source: sourceName as 'user' | 'context7',
            path: filePath,
            size: stat.size,
            modified: stat.mtime || new Date(),
          })
        }
      }
    }

    return contentList.sort((a, b) => b.modified.getTime() - a.modified.getTime())
  }

  private async downloadContext7Doc(libraryId: string): Promise<string> {
    const url = `https://context7.com${libraryId}/llms.txt?token=100000000`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`)
    }

    return await response.text()
  }

  private async sliceDocument(content: string, outputDir: string): Promise<string[]> {
    const sections = this.extractSections(content)
    const savedFiles: string[] = []

    for (let i = 0; i < sections.length; i++) {
      const { title, content: sectionContent } = sections[i]
      if (!sectionContent.trim()) continue

      const filename = this.createUniqueFileName(title, i, outputDir)
      const filePath = join(outputDir, filename)

      writeFileSync(filePath, `# ${title}\n\n${sectionContent}`)
      savedFiles.push(filePath)
    }

    return savedFiles
  }

  private extractSections(content: string): Array<{ title: string; content: string }> {
    const sections: Array<{ title: string; content: string }> = []
    const lines = content.split('\n')
    let currentSection = { title: 'Introduction', content: '' }
    let sectionContent: string[] = []

    const headingPattern = /^(#{1,6})\s+(.+)$/

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const match = headingPattern.exec(line)

      if (match) {
        // Save previous section if it has content
        if (sectionContent.length > 0) {
          currentSection.content = sectionContent.join('\n').trim()

          // Only add section if it meets minimum content threshold
          if (currentSection.content.length > 50) {
            sections.push({ ...currentSection })
          }

          sectionContent = []
        }

        // Start new section
        currentSection = {
          title: match[2].trim(),
          content: '',
        }
      } else {
        // Add non-heading lines to current section
        if (line.trim() || sectionContent.length > 0) {
          sectionContent.push(line)
        }
      }
    }

    // Add the last section
    if (sectionContent.length > 0) {
      currentSection.content = sectionContent.join('\n').trim()
      if (currentSection.content.length > 50) {
        sections.push(currentSection)
      }
    }

    // Post-process sections to merge very short ones
    return this.mergeShortSections(sections)
  }

  private mergeShortSections(sections: Array<{ title: string; content: string }>): Array<{ title: string; content: string }> {
    const merged: Array<{ title: string; content: string }> = []

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]

      // If section is very short and not the last, consider merging with next
      if (section.content.length < 200 && i < sections.length - 1) {
        const nextSection = sections[i + 1]

        // Merge if next section is not a major section
        if (!this.isMajorSection(nextSection.title)) {
          merged.push({
            title: section.title,
            content: section.content + '\n\n' + nextSection.content,
          })
          i++ // Skip next section
        } else {
          merged.push(section)
        }
      } else {
        merged.push(section)
      }
    }

    return merged
  }

  private isMajorSection(title: string): boolean {
    const majorKeywords = [
      'introduction', 'getting started', 'installation', 'setup',
      'api', 'reference', 'examples', 'tutorial', 'guide',
      'overview', 'quick start', 'basics', 'advanced'
    ]

    const titleLower = title.toLowerCase()
    return majorKeywords.some(keyword => titleLower.includes(keyword))
  }

  private createUniqueFileName(title: string, index: number, dir: string): string {
    // Clean up the title for use in filename
    const safeTitle = title
      .replace(/[^\w\s-]/g, '')
      .replace(/[-\s]+/g, '_')
      .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
      .slice(0, 50) || 'section'

    // Create hierarchical naming based on heading level if possible
    const headingLevel = this.extractHeadingLevel(title)
    const prefix = headingLevel > 1 ? `${'0'.repeat(Math.min(headingLevel - 1, 3))}${index}` : index.toString()

    // Use both index and title for better organization
    const baseName = `${prefix.padStart(4, '0')}_${safeTitle}`
    let filename = `${baseName}.md`
    let counter = 1

    while (existsSync(join(dir, filename))) {
      filename = `${baseName}_${counter.toString().padStart(2, '0')}.md`
      counter++
    }

    return filename
  }

  private extractHeadingLevel(title: string): number {
    // Try to extract heading level from title if it contains markdown-like indicators
    const match = title.match(/^(#{1,6})\s*(.+)$/)
    if (match) {
      return match[1].length
    }

    // Look for other indicators in the title
    if (/^(Chapter|Section|Part)\s+\d+/i.test(title)) return 1
    if (/^\d+\.\d+/i.test(title)) return 2
    if (/^\d+\.\d+\.\d+/i.test(title)) return 3

    return 1 // Default to level 1
  }

  private createUniqueFilePath(title: string, dir: string): string {
    const now = new Date()
    const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`

    const safeTitle = title
      .replace(/[^\w\s-]/g, '')
      .replace(/[-\s]+/g, '_')
      .slice(0, 50) || 'content'

    const baseName = `${safeTitle}.${timestamp}`
    let filename = `${baseName}.md`
    let counter = 1

    while (existsSync(join(dir, filename))) {
      filename = `${baseName}_${counter.toString().padStart(2, '0')}.md`
      counter++
    }

    return join(dir, filename)
  }

  private async findSimilarContent(
    content: string,
    threshold: number = 0.85,
    maxResults: number = 10,
  ): Promise<any[]> {
    const results = await this.options.searchEngine.search(content, maxResults)
    return results.filter((r: any) => r.score >= threshold)
  }

  private isContentEnhanced(existing: any, newContent: string): boolean {
    const existingWords = existing.content.split(/\s+/).length
    const newWords = newContent.split(/\s+/).length
    return newWords > existingWords * 1.3
  }

  private saveContentHash(content: string): void {
    const hash = createHash('md5').update(content).digest('hex')
    const hashFile = join(this.options.referencesDir, '..', '.context7_hash')
    writeFileSync(hashFile, hash)
  }

  private needsUpdate(content: string): boolean {
    const hashFile = join(this.options.referencesDir, '..', '.context7_hash')

    if (!existsSync(hashFile)) {
      return true
    }

    const currentHash = createHash('md5').update(content).digest('hex')
    const storedHash = readFileSync(hashFile, 'utf-8')

    return currentHash !== storedHash
  }

  private async triggerReindex(): Promise<void> {
    const hashFile = join(this.options.referencesDir, '..', '.last_index_hash')
    if (existsSync(hashFile)) {
      rmSync(hashFile)
    }
  }
}