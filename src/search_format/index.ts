/**
 * Search result formatting module
 * Provides various formatting options for search results
 */

export type {
  FormattableSearchResult,
  FormattingOptions,
  FormattedResult,
  SearchFormatter,
} from './types.js'

export { ListFormatter } from './listFormatter.js'
export { EnhancedFormatter } from './enhancedFormatter.js'

/**
 * Factory function to create appropriate formatter
 */
import { ListFormatter } from './listFormatter.js'
import { EnhancedFormatter } from './enhancedFormatter.js'
import type { SearchFormatter } from './types.js'

export function createFormatter(type: 'list' | 'enhanced'): SearchFormatter {
  switch (type) {
    case 'list':
      return new ListFormatter()
    case 'enhanced':
      return new EnhancedFormatter()
    default:
      throw new Error(`Unknown formatter type: ${type}`)
  }
}
