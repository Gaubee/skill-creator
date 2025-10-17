import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { SimpleSearchEngine } from '../../src/core/simpleSearch.js'
import { createTempDir, cleanupTempDir } from '../test-utils.js'

describe('SimpleSearchEngine', () => {
  let tempDir: string
  let referencesDir: string
  let engine: SimpleSearchEngine

  beforeEach(() => {
    tempDir = createTempDir('simple-search-test-')
    referencesDir = join(tempDir, 'references')
    mkdirSync(referencesDir, { recursive: true })

    engine = new SimpleSearchEngine({
      referencesDir,
      collectionName: 'test-collection',
    })
  })

  afterEach(() => {
    cleanupTempDir(tempDir)
  })

  describe('buildIndex', () => {
    it('should handle empty directory', async () => {
      const hashFile = join(tempDir, 'hash')
      await engine.buildIndex(referencesDir, hashFile)

      const stats = await engine.getStats()
      expect(stats.totalDocuments).toBe(0)
    })

    it('should index markdown files', async () => {
      // Create test documents
      writeFileSync(
        join(referencesDir, 'doc1.md'),
        `# Introduction
This is an introduction to TypeScript.

## Features
TypeScript provides static typing for JavaScript.

## Benefits
- Type safety
- Better IDE support
- Catch errors at compile time`
      )

      writeFileSync(
        join(referencesDir, 'doc2.md'),
        `# React Guide
React is a popular JavaScript library.

## Components
Components are the building blocks of React apps.

## Hooks
Hooks let you use state in functional components.`
      )

      const hashFile = join(tempDir, 'hash')
      await engine.buildIndex(referencesDir, hashFile)

      const stats = await engine.getStats()
      expect(stats.totalDocuments).toBeGreaterThan(0)
    })

    it('should skip rebuilding if hash is unchanged', async () => {
      writeFileSync(
        join(referencesDir, 'doc1.md'),
        '# Test Document\nThis is a test.'
      )

      const hashFile = join(tempDir, 'hash')

      // First build
      await engine.buildIndex(referencesDir, hashFile)
      const firstStats = await engine.getStats()

      // Second build (should skip)
      await engine.buildIndex(referencesDir, hashFile)
      const secondStats = await engine.getStats()

      expect(firstStats.totalDocuments).toBe(secondStats.totalDocuments)
    })
  })

  describe('search', () => {
    beforeEach(async () => {
      // Create test documents with longer content
      writeFileSync(
        join(referencesDir, 'typescript.md'),
        `# TypeScript Guide
TypeScript is a typed superset of JavaScript that compiles to plain JavaScript. It provides static typing, classes, and interfaces which help developers write more maintainable and error-free code.

## Type System
TypeScript adds static types to JavaScript, allowing you to catch errors during development rather than at runtime. This includes primitive types like string, number, and boolean, as well as complex types like arrays, tuples, and enums.

## Interfaces
Interfaces define the shape of objects and provide a way to enforce consistent structure across your codebase. They can be extended, implemented, and used to describe the structure of data objects and function parameters.`
      )

      writeFileSync(
        join(referencesDir, 'react.md'),
        `# React Components
React components are the building blocks of modern web applications. They allow you to break down complex UIs into independent, reusable pieces that can be managed in isolation.

## Functional Components
Functional components are JavaScript functions that accept props and return React elements. They are simpler and more concise than class components, and with hooks, they can now manage state and side effects.

## Class Components
Class components are ES6 classes that extend React.Component. They have lifecycle methods and can hold state, but with the introduction of hooks, functional components have become more popular in the React ecosystem.`
      )

      const hashFile = join(tempDir, 'hash')
      await engine.buildIndex(referencesDir, hashFile)
    })

    it('should search documents by query', async () => {
      const results = await engine.search('TypeScript types', 5)

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].title).toContain('Type')
      expect(results[0].source).toBe('user')
      expect(results[0].score).toBeGreaterThan(0)
    })

    it('should return empty results for non-matching query', async () => {
      const results = await engine.search('nonexistent term', 5)

      expect(results.length).toBe(0)
    })

    it('should filter by source', async () => {
      const results = await engine.search('components', 5, { source: 'user' })

      expect(results.length).toBeGreaterThan(0)
      results.forEach(result => {
        expect(result.source).toBe('user')
      })
    })

    it('should prioritize title matches', async () => {
      const results = await engine.search('TypeScript', 5)

      // Title match should have higher score
      const typeScriptResults = results.filter(r =>
        r.title.toLowerCase().includes('typescript')
      )
      const contentResults = results.filter(r =>
        !r.title.toLowerCase().includes('typescript') &&
        r.content.toLowerCase().includes('typescript')
      )

      expect(typeScriptResults.length).toBeGreaterThan(0)
      if (contentResults.length > 0) {
        expect(typeScriptResults[0].score).toBeGreaterThan(contentResults[0].score)
      }
    })
  })

  describe('searchByPriority', () => {
    beforeEach(async () => {
      // Create user content directory
      mkdirSync(join(referencesDir, 'user'), { recursive: true })
      writeFileSync(
        join(referencesDir, 'user', 'guide.md'),
        `# User Guide
This is user-generated content about React hooks. React hooks provide a way to use state and other React features in functional components. They were introduced in React 16.8 and have since become a fundamental part of modern React development. Hooks allow you to reuse stateful logic without changing your component hierarchy.`
      )

      // Create context7 content directory
      mkdirSync(join(referencesDir, 'context7'), { recursive: true })
      writeFileSync(
        join(referencesDir, 'context7', 'docs.md'),
        `# Official Docs
This is official documentation about React hooks. React Hooks are functions that let you "hook into" React state and lifecycle features from function components. They enable you to use React without classes. Hooks provide a more direct API to the React concepts you already know: props, state, context, refs, and lifecycle.`
      )

      const hashFile = join(tempDir, 'hash')
      await engine.buildIndex(referencesDir, hashFile)
    })

    it('should prioritize user content over context7', async () => {
      const results = await engine.searchByPriority('React hooks', 5)

      expect(results.length).toBeGreaterThan(0)

      // User content should appear first
      const userResults = results.filter(r => r.source === 'user')
      const contextResults = results.filter(r => r.source === 'context7')

      if (userResults.length > 0 && contextResults.length > 0) {
        expect(results[0].source).toBe('user')
      }
    })
  })

  describe('splitIntoSections', () => {
    it('should split markdown into sections', async () => {
      const content = `# Introduction
This is the introduction to the documentation system. It provides comprehensive information about the features and capabilities.

## Getting Started
Step 1: Install the required dependencies and packages.
Step 2: Configure the system according to your needs.

### Installation
Run the install command to get started with the setup process.

## Advanced Topics
Here are advanced topics that cover more complex use cases and scenarios.`

      writeFileSync(join(referencesDir, 'test.md'), content)

      const hashFile = join(tempDir, 'hash')
      await engine.buildIndex(referencesDir, hashFile)

      const stats = await engine.getStats()
      // Should be 4 sections: Introduction, Getting Started, Installation, Advanced Topics
      expect(stats.totalDocuments).toBe(4)
    })

    it('should filter out very short sections', async () => {
      const content = `# Title
Short.

## Another Title
This section has more content to meet the minimum length requirement for indexing.`

      writeFileSync(join(referencesDir, 'test.md'), content)

      const hashFile = join(tempDir, 'hash')
      await engine.buildIndex(referencesDir, hashFile)

      // Should only index the section with sufficient content
      const stats = await engine.getStats()
      expect(stats.totalDocuments).toBe(1)
    })
  })
})