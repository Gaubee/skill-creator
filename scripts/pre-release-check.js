#!/usr/bin/env node

/**
 * Pre-release validation script
 * Run this locally to validate before pushing
 */

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

console.log('🔍 Pre-release validation started...\n')

try {
  // 1. Check if package.json exists and is valid
  console.log('1️⃣ Checking package.json...')
  const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'))
  console.log(`   ✅ Package: ${packageJson.name}@${packageJson.version}`)

  // 2. Check if all required scripts exist
  console.log('\n2️⃣ Checking required scripts...')
  const requiredScripts = ['build', 'test', 'type-check']
  for (const script of requiredScripts) {
    if (!packageJson.scripts[script]) {
      throw new Error(`Missing required script: ${script}`)
    }
    console.log(`   ✅ Script: ${script}`)
  }

  // 3. Check if dist directory exists (from build)
  console.log('\n3️⃣ Checking build output...')
  try {
    execSync('test -d dist', { stdio: 'pipe' })
    console.log('   ✅ dist directory exists')
  } catch {
    console.log('   ⚠️  dist directory not found, running build...')
    execSync('npm run build', { stdio: 'inherit' })
    console.log('   ✅ Build completed')
  }

  // 4. Check if CLI entry point exists
  console.log('\n4️⃣ Checking CLI entry point...')
  try {
    execSync('test -f dist/cli.js', { stdio: 'pipe' })
    console.log('   ✅ CLI entry point exists')
  } catch {
    throw new Error('CLI entry point not found at dist/cli.js')
  }

  // 5. Check if templates directory exists
  console.log('\n5️⃣ Checking templates...')
  try {
    execSync('test -d templates', { stdio: 'pipe' })
    console.log('   ✅ Templates directory exists')
  } catch {
    throw new Error('Templates directory not found')
  }

  // 6. Run tests
  console.log('\n6️⃣ Running tests...')
  try {
    execSync('npm test', { stdio: 'pipe' })
    console.log('   ✅ All tests passed')
  } catch (error) {
    throw new Error('Tests failed. Please fix failing tests before release.')
  }

  // 7. Run type check
  console.log('\n7️⃣ Running type check...')
  try {
    execSync('npm run type-check', { stdio: 'pipe' })
    console.log('   ✅ Type check passed')
  } catch (error) {
    throw new Error('Type check failed. Please fix type errors before release.')
  }

  // 8. Check current version vs published version
  console.log('\n8️⃣ Checking version status...')
  try {
    const currentVersion = packageJson.version
    const publishedVersion = execSync('npm view skill-creator version', {
      encoding: 'utf-8',
      stdio: 'pipe'
    }).trim()

    if (currentVersion === publishedVersion) {
      console.log(`   ⚠️  Version ${currentVersion} is already published to NPM`)
      console.log('   💡 Update version with: npm version patch|minor|major')
    } else {
      console.log(`   ✅ New version: ${currentVersion} (published: ${publishedVersion})`)
    }
  } catch {
    console.log('   ℹ️  Could not check published version (package might not exist yet)')
  }

  console.log('\n✅ All checks passed! Ready for release.')
  console.log('\n📋 Next steps:')
  console.log('   1. Update version if needed: npm version patch|minor|major')
  console.log('   2. Push to GitHub: git push origin main --tags')
  console.log('   3. Monitor GitHub Actions for automatic release')

} catch (error) {
  console.error('\n❌ Validation failed:', error.message)
  process.exit(1)
}
