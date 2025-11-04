/**
 * SKILL.md tag management utilities
 * Manages <user-skills> and <context7-skills> tags in SKILL.md file
 */

import { readFileSync, writeFileSync } from 'node:fs'

export interface TagContent {
  tagName: string
  id?: string
  content: string
  startIndex: number
  endIndex: number
}

/**
 * Parse all tags from SKILL.md content
 */
export function parseSkillMdTags(content: string): TagContent[] {
  const tags: TagContent[] = []

  // Match <user-skills>...</user-skills>
  const userSkillsRegex = /<user-skills>([\s\S]*?)<\/user-skills>/g
  let match

  while ((match = userSkillsRegex.exec(content)) !== null) {
    tags.push({
      tagName: 'user-skills',
      content: match[1].trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
  }

  // Match <context7-skills id="xxx">...</context7-skills>
  const context7Regex = /<context7-skills\s+id="([^"]+)">([\s\S]*?)<\/context7-skills>/g

  while ((match = context7Regex.exec(content)) !== null) {
    tags.push({
      tagName: 'context7-skills',
      id: match[1],
      content: match[2].trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
  }

  return tags.sort((a, b) => a.startIndex - b.startIndex)
}

/**
 * Update or create a tag in SKILL.md content
 */
export function updateSkillMdTag(
  content: string,
  tagName: 'user-skills' | 'context7-skills',
  newContent: string,
  id?: string
): string {
  const tags = parseSkillMdTags(content)

  // Find existing tag
  const existingTag = tags.find(
    (t) => t.tagName === tagName && (tagName === 'user-skills' || t.id === id)
  )

  if (existingTag) {
    // Replace existing tag content
    const tagStart = tagName === 'user-skills' ? `<user-skills>` : `<context7-skills id="${id}">`
    const tagEnd = `</${tagName}>`
    const newTag = `${tagStart}\n${newContent}\n${tagEnd}`

    return content.slice(0, existingTag.startIndex) + newTag + content.slice(existingTag.endIndex)
  } else if (tagName === 'context7-skills' && id) {
    // Add new context7-skills tag
    // Find the Context7 Documentation section
    const context7SectionRegex = /## Context7 Documentation[\s\S]*?(?=\n##|$)/
    const sectionMatch = content.match(context7SectionRegex)

    if (sectionMatch) {
      const sectionStart = content.indexOf(sectionMatch[0])
      const sectionEnd = sectionStart + sectionMatch[0].length

      // Find the end of existing context7-skills tags
      const existingContext7Tags = tags.filter((t) => t.tagName === 'context7-skills')
      let insertPosition = sectionEnd

      if (existingContext7Tags.length > 0) {
        const lastTag = existingContext7Tags[existingContext7Tags.length - 1]
        insertPosition = lastTag.endIndex
      } else {
        // Insert after the section header and comment
        const headerEnd = content.indexOf('\n', sectionStart + sectionMatch[0].indexOf('\n'))
        const commentEnd = content.indexOf('-->', headerEnd)
        insertPosition = commentEnd > headerEnd ? commentEnd + 3 : headerEnd
      }

      const newTag = `\n\n<context7-skills id="${id}">\n${newContent}\n</context7-skills>`

      return content.slice(0, insertPosition) + newTag + content.slice(insertPosition)
    }
  }

  return content
}

/**
 * Remove a context7-skills tag from SKILL.md
 */
export function removeContext7Tag(content: string, projectId: string): string {
  const tags = parseSkillMdTags(content)
  const tagToRemove = tags.find((t) => t.tagName === 'context7-skills' && t.id === projectId)

  if (!tagToRemove) {
    return content
  }

  // Remove the tag and any surrounding whitespace
  let startIndex = tagToRemove.startIndex
  let endIndex = tagToRemove.endIndex

  // Remove leading newlines
  while (startIndex > 0 && content[startIndex - 1] === '\n') {
    startIndex--
    if (startIndex > 0 && content[startIndex - 1] === '\n') break // Keep one newline
  }

  // Remove trailing newlines
  while (endIndex < content.length && content[endIndex] === '\n') {
    endIndex++
  }

  return content.slice(0, startIndex) + content.slice(endIndex)
}

/**
 * Get all context7 project IDs from SKILL.md
 */
export function getContext7ProjectIds(content: string): string[] {
  const tags = parseSkillMdTags(content)
  return tags.filter((t) => t.tagName === 'context7-skills' && t.id).map((t) => t.id as string)
}

/**
 * Get user skills files from SKILL.md
 */
export function getUserSkillsFiles(content: string): string[] {
  const tags = parseSkillMdTags(content)
  const userSkillsTag = tags.find((t) => t.tagName === 'user-skills')

  if (!userSkillsTag || !userSkillsTag.content) {
    return []
  }

  // Parse markdown list items
  return userSkillsTag.content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-'))
    .map((line) => line.slice(1).trim())
    .filter(Boolean)
}

/**
 * Get context7 files for a specific project from SKILL.md
 */
export function getContext7Files(content: string, projectId: string): string[] {
  const tags = parseSkillMdTags(content)
  const projectTag = tags.find((t) => t.tagName === 'context7-skills' && t.id === projectId)

  if (!projectTag || !projectTag.content) {
    return []
  }

  // Parse markdown list items
  return projectTag.content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-'))
    .map((line) => line.slice(1).trim())
    .filter(Boolean)
}

/**
 * Update SKILL.md file with new tag content
 */
export function updateSkillMdFile(
  filePath: string,
  tagName: 'user-skills' | 'context7-skills',
  newContent: string,
  id?: string
): void {
  const content = readFileSync(filePath, 'utf-8')
  const updated = updateSkillMdTag(content, tagName, newContent, id)
  writeFileSync(filePath, updated, 'utf-8')
}

/**
 * Remove context7 tag from SKILL.md file
 */
export function removeContext7TagFromFile(filePath: string, projectId: string): void {
  const content = readFileSync(filePath, 'utf-8')
  const updated = removeContext7Tag(content, projectId)
  writeFileSync(filePath, updated, 'utf-8')
}
