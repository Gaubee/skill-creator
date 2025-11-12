import { createResolverByRootFile } from '@gaubee/nodekit'

/**
 * rootResolver.dirname
 * rootResolver('templates/SKILL.md')
 */
export const rootResolver = createResolverByRootFile(import.meta.url, 'package.json')
