/**
 * Package utilities
 */

import type { PackageVersion } from '../types/index.js'

export interface SearchResult {
  name: string
  description: string
  version: string
  date: string
  publisher: string
  score: number
}

export interface SearchOptions {
  limit?: number
  minScore?: number
}

export class PackageUtils {
  /**
   * Get package version from npm registry
   */
  static async getPackageVersion(packageName: string): Promise<string | null> {
    try {
      const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`)
      if (!response.ok) return null

      const data = await response.json()
      return data.version as string
    } catch {
      return null
    }
  }

  /**
   * Get full package info from npm registry for the latest version
   */
  static async getPackageInfo(packageName: string): Promise<{
    name: string
    version: string
    description: string
    homepage?: string
    repository?: { type: string; url: string }
    [key: string]: any
  } | null> {
    try {
      const response = await fetch(`https://registry.npmjs.org/${packageName}`)
      if (!response.ok) return null

      const data = await response.json()
      const latestVersionTag = data['dist-tags']?.latest
      if (!latestVersionTag) return null

      const latestVersionInfo = data.versions?.[latestVersionTag]
      if (!latestVersionInfo) return null

      return latestVersionInfo
    } catch {
      return null
    }
  }

  /**
   * Format version according to doc-downloader rules
   */
  static formatVersion(version: string): string {
    if (!version) return ''

    // Remove 'v' prefix if present
    if (version.startsWith('v')) {
      version = version.slice(1)
    }

    const parts = version.split('.')
    if (parts.length >= 2) {
      const major = parseInt(parts[0], 10)
      if (major >= 1) {
        return String(major)
      } else {
        return `${major}.${parts[1]}`
      }
    }

    return version
  }

  /**
   * Create skill folder name according to spec
   */
  static createSkillFolderName(packageName: string, version: string): string {
    // Replace / with __ as specified in doc-downloader.md
    const safePackage = packageName.replace(/\//g, '__')
    const formattedVersion = this.formatVersion(version)

    if (formattedVersion) {
      return `${safePackage}@${formattedVersion}`
    } else {
      return safePackage
    }
  }

  /**
   * Normalize package name (remove @ prefix)
   */
  static normalizePackageName(packageName: string): string {
    if (packageName.startsWith('@')) {
      return packageName.slice(1)
    }
    return packageName
  }

  /**
   * Validate package name format
   */
  static validatePackageName(packageName: string): boolean {
    if (!packageName || packageName.length === 0) {
      return false
    }

    // Basic validation for npm package names
    const validNamePattern = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/
    return validNamePattern.test(packageName)
  }

  /**
   * Search for packages on npm registry
   */
  static async searchPackages(
    keywords: string[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { limit = 10, minScore = 0.3 } = options

    try {
      const query = keywords.join(' ')
      const response = await fetch(
        `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${limit * 2}`
      )

      if (!response.ok) return []

      const data = await response.json()
      const results: SearchResult[] = []

      for (const pkg of data.objects || []) {
        const score = pkg.score?.detail?.popularity || 0
        if (score >= minScore) {
          results.push({
            name: pkg.package.name,
            description: pkg.package.description || '',
            version: pkg.package.version,
            date: pkg.package.date,
            publisher: pkg.package.publisher?.username || 'unknown',
            score,
          })
        }
      }

      return results.slice(0, limit)
    } catch {
      return []
    }
  }

  /**
   * Find exact package match
   */
  static async findExactPackage(packageName: string): Promise<SearchResult | null> {
    try {
      const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`)
      if (!response.ok) return null

      const data = await response.json()

      return {
        name: data.name,
        description: data.description || '',
        version: data.version,
        date: data.time?.modified || new Date().toISOString(),
        publisher: data.publisher?.username || 'unknown',
        score: 1.0,
      }
    } catch {
      return null
    }
  }

  /**
   * Suggest packages based on keywords
   */
  static async suggestPackages(
    input: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    // Check if input looks like an exact package name
    if (PackageUtils.validatePackageName(input)) {
      const exact = await PackageUtils.findExactPackage(input)
      if (exact) return [exact]
    }

    // Extract keywords from input
    const keywords = input
      .split(/[\s-]+/)
      .filter((word) => word.length > 2)
      .slice(0, 3)

    if (keywords.length === 0) {
      // Fallback: search with the whole input
      keywords.push(input)
    }

    return PackageUtils.searchPackages(keywords, options)
  }

  /**
   * Select package from multiple options
   */
  static async selectPackage(input: string): Promise<{ name: string; version: string } | null> {
    const suggestions = await PackageUtils.suggestPackages(input, { limit: 5 })

    if (suggestions.length === 0) {
      return null
    }

    if (suggestions.length === 1) {
      const pkg = suggestions[0]
      const version = await PackageUtils.getPackageVersion(pkg.name)
      return { name: pkg.name, version: version || pkg.version }
    }

    // Multiple options found - would need interactive selection in CLI
    // For now, return the highest scored package
    const best = suggestions.reduce((prev, curr) => (curr.score > prev.score ? curr : prev))

    const version = await PackageUtils.getPackageVersion(best.name)
    return { name: best.name, version: version || best.version }
  }
}
