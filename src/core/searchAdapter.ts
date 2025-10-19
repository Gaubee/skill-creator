/**
 * Search Engine Adapter Interface
 * Provides a unified interface for different search implementations
 */

export interface SearchResult {
  id: string
  title: string
  content: string
  source: 'user' | 'context7'
  file_path: string
  score: number
  metadata: any
}

export interface SearchOptions {
  topK?: number
  where?: Record<string, any>
  fuzzyThreshold?: number
}

export interface SearchEngine {
  /**
   * Build search index from files
   */
  buildIndex(referencesDir: string, hashFile: string): Promise<void>

  /**
   * Search for documents matching the query
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>

  /**
   * Check if the search index is built and ready
   */
  isBuilt(): boolean

  /**
   * Get search engine statistics
   */
  getStats(): any

  /**
   * Clear the search index
   */
  clearIndex(): void
}

/**
 * Simple fuzzy search function for testing
 * Should return array of indices, not undefined values
 */
export interface FuzzySearchFunction {
  (haystack: string[], needle: string): number[]
}
