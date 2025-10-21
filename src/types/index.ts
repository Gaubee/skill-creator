/**
 * Core type definitions for skill creator
 */

export interface SkillConfig {
  name: string
  packageName?: string
  context7LibraryId?: string
}

export interface SearchResult {
  id: string
  title: string
  content: string
  score: number
  source: 'user' | 'context7'
  file_path: string
  metadata: Record<string, unknown>
}

export interface ContentStats {
  userFiles: number
  context7Files: number
  totalFiles: number
  userDirExists: boolean
  context7DirExists: boolean
}

export interface ContentItem {
  title: string
  filename: string
  source: 'user' | 'context7'
  path: string
  size: number
  modified: Date
}

export interface CreateSkillOptions {
  packageName: string
  path?: string
  description?: string
  context7Id?: string
  noInitDocs?: boolean
  scope?: 'current' | 'user' | 'project'
  version?: string
  force?: boolean
}

export interface CreateSkillResult {
  created: boolean
  skillPath?: string
  message: string
  docsInitialized: boolean
}

export interface UpdateContext7Result {
  updated: boolean
  skipped: boolean
  filesCreated: number
  message: string
}

export interface AddContentResult {
  added: boolean
  updated: boolean
  skipped: boolean
  filePath?: string
  message: string
  similarFound: number
  similarContent?: Array<{
    title: string
    score: number
    source: string
    preview: string
  }>
  existingFile?: {
    path: string
    content: string
  }
}

export interface PackageVersion {
  version: string
  formatted: string
}

export interface Context7Library {
  context7_compatible_library_id: string
  name: string
  description: string
  code_snippets: number
  trust_score: number
  versions?: string[]
}
