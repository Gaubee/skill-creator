/**
 * Template system for framework-specific skill enhancements
 */

import { join } from 'node:path'
import { existsSync, writeFileSync, mkdirSync, chmodSync, readFileSync } from 'node:fs'
import type { CreateSkillOptions, SkillConfig } from '../types/index.js'

export interface FrameworkTemplate {
  name: string
  description: string
  context7Ids?: string[]
  additionalDependencies?: Record<string, string>
  additionalScripts?: Record<string, string>
  customConfig?: Record<string, any>
  postCreateScript?: string
}

export class TemplateManager {
  private templatesDir: string
  private templates: Map<string, FrameworkTemplate> = new Map()

  constructor() {
    const __filename = new URL(import.meta.url).pathname
    const __dirname = join(__filename, '..')
    this.templatesDir = join(__dirname, 'templates', 'frameworks')
    this.loadTemplates()
  }

  private loadTemplates() {
    // Define built-in templates
    this.templates.set('react', {
      name: 'React',
      description: 'React JavaScript library for building user interfaces',
      context7Ids: ['/react/docs', '/reactjs/react/docs'],
      additionalDependencies: {
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
      },
      customConfig: {
        embeddingModel: 'all-MiniLM-L6-v2',
        chunkSize: 800,
        chunkOverlap: 150,
      },
    })

    this.templates.set('vue', {
      name: 'Vue.js',
      description: 'Progressive JavaScript framework',
      context7Ids: ['/vuejs/core/docs', '/vuejs/vue/docs'],
      additionalDependencies: {
        '@types/node': '^20.0.0',
      },
      customConfig: {
        embeddingModel: 'all-MiniLM-L6-v2',
        chunkSize: 1000,
        chunkOverlap: 200,
      },
    })

    this.templates.set('angular', {
      name: 'Angular',
      description: 'Platform for building mobile and desktop web applications',
      context7Ids: ['/angular/angular/docs'],
      additionalDependencies: {
        '@angular/common': '^17.0.0',
        '@angular/core': '^17.0.0',
      },
      customConfig: {
        embeddingModel: 'all-MiniLM-L6-v2',
        chunkSize: 1200,
        chunkOverlap: 250,
      },
    })

    this.templates.set('express', {
      name: 'Express.js',
      description: 'Fast, unopinionated, minimalist web framework for Node.js',
      context7Ids: ['/expressjs/express/docs'],
      additionalDependencies: {
        '@types/express': '^4.17.0',
        cors: '^2.8.5',
        helmet: '^7.0.0',
      },
      additionalScripts: {
        'server-example': 'node scripts/server-example.js',
      },
    })

    this.templates.set('nextjs', {
      name: 'Next.js',
      description: 'The React Framework for Production',
      context7Ids: ['/vercel/next.js/docs'],
      additionalDependencies: {
        next: '^14.0.0',
        react: '^18.0.0',
        'react-dom': '^18.0.0',
      },
      customConfig: {
        embeddingModel: 'all-MiniLM-L6-v2',
        chunkSize: 1000,
        chunkOverlap: 200,
      },
    })

    this.templates.set('tanstack', {
      name: 'TanStack',
      description: 'Quality open-source software for web developers',
      context7Ids: [
        '/tanstack/query/docs',
        '/tanstack/router/docs',
        '/tanstack/table/docs',
        '/tanstack/react-store/docs',
      ],
      additionalDependencies: {
        '@tanstack/react-query': '^5.0.0',
        '@tanstack/react-router': '^1.0.0',
        '@tanstack/react-table': '^8.0.0',
      },
    })

    this.templates.set('typeorm', {
      name: 'TypeORM',
      description: 'Modern ORM for TypeScript and JavaScript',
      context7Ids: ['/typeorm/typeorm/docs'],
      additionalDependencies: {
        typeorm: '^0.3.17',
        'reflect-metadata': '^0.1.13',
      },
      additionalScripts: {
        'generate-entity': 'node scripts/generate-entity.js',
      },
    })

    this.templates.set('prisma', {
      name: 'Prisma',
      description: 'Next-generation Node.js and TypeScript ORM',
      context7Ids: ['/prisma/prisma/docs'],
      additionalDependencies: {
        '@prisma/client': '^5.0.0',
        prisma: '^5.0.0',
      },
      additionalScripts: {
        'generate-schema': 'node scripts/generate-schema.js',
      },
    })

    this.templates.set('nestjs', {
      name: 'NestJS',
      description: 'A progressive Node.js framework for building efficient applications',
      context7Ids: ['/nestjs/nest/docs'],
      additionalDependencies: {
        '@nestjs/core': '^10.0.0',
        '@nestjs/common': '^10.0.0',
        '@nestjs/platform-express': '^10.0.0',
      },
      customConfig: {
        embeddingModel: 'all-MiniLM-L6-v2',
        chunkSize: 1200,
        chunkOverlap: 250,
      },
    })

    this.templates.set('fastify', {
      name: 'Fastify',
      description: 'Fast and low overhead web framework, for Node.js',
      context7Ids: ['/fastify/fastify/docs'],
      additionalDependencies: {
        fastify: '^4.0.0',
        '@fastify/cors': '^8.0.0',
        '@fastify/helmet': '^11.0.0',
      },
    })
  }

  getTemplate(name: string): FrameworkTemplate | undefined {
    return this.templates.get(name.toLowerCase())
  }

  getAllTemplates(): FrameworkTemplate[] {
    return Array.from(this.templates.values())
  }

  detectFramework(packageName: string): FrameworkTemplate | null {
    const keywords = packageName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)

    for (const [templateName, template] of this.templates) {
      // Check if template name matches package keywords
      if (keywords.includes(templateName)) {
        return template
      }

      // Check for common aliases
      const aliases: Record<string, string[]> = {
        react: ['react', 'reactjs', 'react-dom'],
        vue: ['vue', 'vuejs'],
        angular: ['angular', 'angularjs', '@angular'],
        express: ['express', 'expressjs'],
        nextjs: ['next', 'nextjs', '@next'],
        tanstack: ['tanstack', '@tanstack'],
        typeorm: ['typeorm', '@typeorm'],
        prisma: ['prisma', '@prisma'],
        nestjs: ['nestjs', '@nestjs'],
        fastify: ['fastify', '@fastify'],
      }

      for (const [key, values] of Object.entries(aliases)) {
        if (key === templateName && values.some((v) => keywords.includes(v))) {
          return template
        }
      }
    }

    return null
  }

  applyTemplate(template: FrameworkTemplate, skillPath: string, config: SkillConfig): void {
    // Update package.json with additional dependencies
    if (template.additionalDependencies) {
      const packageJsonPath = join(skillPath, 'package.json')
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
        packageJson.dependencies = {
          ...packageJson.dependencies,
          ...template.additionalDependencies,
        }

        // Add additional scripts
        if (template.additionalScripts) {
          packageJson.scripts = {
            ...packageJson.scripts,
            ...template.additionalScripts,
          }
        }

        writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
      }
    }

    // Update config with template-specific settings
    if (template.customConfig) {
      const configPath = join(skillPath, 'config.json')
      let existingConfig = {}

      if (existsSync(configPath)) {
        existingConfig = JSON.parse(readFileSync(configPath, 'utf-8'))
      }

      const updatedConfig = { ...existingConfig, ...template.customConfig }
      writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2))
    }

    // Create additional script files
    if (template.additionalScripts) {
      const scriptsDir = join(skillPath, 'scripts')
      mkdirSync(scriptsDir, { recursive: true })

      // Generate framework-specific scripts
      this.generateFrameworkScripts(template.name.toLowerCase(), scriptsDir)
    }
  }

  private generateFrameworkScripts(framework: string, scriptsDir: string): void {
    switch (framework) {
      case 'express':
        this.createExpressServerExample(scriptsDir)
        break
      case 'typeorm':
        this.createTypeormEntityGenerator(scriptsDir)
        break
      case 'prisma':
        this.createPrismaSchemaGenerator(scriptsDir)
        break
      case 'react':
      case 'nextjs':
        this.createReactExampleScripts(scriptsDir)
        break
    }
  }

  private createExpressServerExample(scriptsDir: string): void {
    const content = `#!/usr/bin/env node
/**
 * Example Express server setup
 */

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json())

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Express server is running!' })
})

// Start server
app.listen(PORT, () => {
  console.log(\`Server is running on port \${PORT}\`)
})
`
    const serverScriptPath = join(scriptsDir, 'server-example.js')
    writeFileSync(serverScriptPath, content)
    chmodSync(serverScriptPath, 0o755)
  }

  private createTypeormEntityGenerator(scriptsDir: string): void {
    const content = `#!/usr/bin/env node
/**
 * TypeORM entity generator helper
 */

const inquirer = require('inquirer')
const fs = require('fs')
const path = require('path')

inquirer
  .prompt([
    {
      type: 'input',
      name: 'entityName',
      message: 'Entity name:',
      validate: input => input.length > 0 || 'Entity name is required'
    },
    {
      type: 'checkbox',
      name: 'columns',
      message: 'Select columns:',
      choices: [
        { name: 'id (primary key)', value: 'id', checked: true },
        { name: 'createdAt', value: 'createdAt', checked: true },
        { name: 'updatedAt', value: 'updatedAt', checked: true },
        { name: 'name (string)', value: 'name' },
        { name: 'email (string)', value: 'email' },
        { name: 'description (text)', value: 'description' },
        { name: 'isActive (boolean)', value: 'isActive' }
      ]
    }
  ])
  .then(answers => {
    const { entityName, columns } = answers
    const className = entityName.charAt(0).toUpperCase() + entityName.slice(1)

    let entity = \`import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity()
export class \${className} {\`

    if (columns.includes('id')) {
      entity += \`
  @PrimaryGeneratedColumn()
  id: number\`
    }

    if (columns.includes('name')) {
      entity += \`
  @Column()
  name: string\`
    }

    if (columns.includes('email')) {
      entity += \`
  @Column({ unique: true })
  email: string\`
    }

    if (columns.includes('description')) {
      entity += \`
  @Column('text')
  description: string\`
    }

    if (columns.includes('isActive')) {
      entity += \`
  @Column({ default: true })
  isActive: boolean\`
    }

    if (columns.includes('createdAt')) {
      entity += \`
  @CreateDateColumn()
  createdAt: Date\`
    }

    if (columns.includes('updatedAt')) {
      entity += \`
  @UpdateDateColumn()
  updatedAt: Date\`
    }

    entity += '\n}'

    const outputPath = path.join(process.cwd(), 'src', 'entities', \`\${entityName}.ts\`)

    // Ensure directory exists
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })

    // Write entity file
    fs.writeFileSync(outputPath, entity)

    console.log(\`✅ Entity created: \${outputPath}\`)
  })
`
    const entityScriptPath = join(scriptsDir, 'generate-entity.js')
    writeFileSync(entityScriptPath, content)
    chmodSync(entityScriptPath, 0o755)
  }

  private createPrismaSchemaGenerator(scriptsDir: string): void {
    const content = `#!/usr/bin/env node
/**
 * Prisma schema helper
 */

const inquirer = require('inquirer')
const fs = require('fs')

inquirer
  .prompt([
    {
      type: 'input',
      name: 'modelName',
      message: 'Model name:',
      validate: input => input.length > 0 || 'Model name is required'
    },
    {
      type: 'checkbox',
      name: 'fields',
      message: 'Select fields:',
      choices: [
        { name: 'id (Int @id @default(autoincrement()))', value: 'id', checked: true },
        { name: 'email (String @unique)', value: 'email' },
        { name: 'name (String)', value: 'name' },
        { name: 'title (String)', value: 'title' },
        { name: 'content (String)', value: 'content' },
        { name: 'published (Boolean @default(false))', value: 'published' },
        { name: 'createdAt (DateTime @default(now()))', value: 'createdAt', checked: true },
        { name: 'updatedAt (DateTime @updatedAt)', value: 'updatedAt', checked: true }
      ]
    }
  ])
  .then(answers => {
    const { modelName, fields } = answers
    const capitalizedName = modelName.charAt(0).toUpperCase() + modelName.slice(1)

    let model = \`model \${capitalizedName} {\`

    if (fields.includes('id')) {
      model += '\\n  id    Int     @id @default(autoincrement())'
    }

    if (fields.includes('email')) {
      model += '\\n  email String  @unique'
    }

    if (fields.includes('name')) {
      model += '\\n  name  String'
    }

    if (fields.includes('title')) {
      model += '\\n  title String'
    }

    if (fields.includes('content')) {
      model += '\\n  content String'
    }

    if (fields.includes('published')) {
      model += '\\n  published Boolean @default(false)'
    }

    if (fields.includes('createdAt')) {
      model += '\\n  createdAt DateTime @default(now())'
    }

    if (fields.includes('updatedAt')) {
      model += '\\n  updatedAt DateTime @updatedAt'
    }

    model += '\\n}'

    const schemaPath = 'prisma/schema.prisma'

    // Read existing schema or create new
    let existingSchema = ''
    if (fs.existsSync(schemaPath)) {
      existingSchema = fs.readFileSync(schemaPath, 'utf-8')
    }

    // Append model to schema
    const updatedSchema = existingSchema + '\\n\\n' + model

    fs.writeFileSync(schemaPath, updatedSchema)

    console.log(\`✅ Model added to schema.prisma\`)
    console.log('\\nRun: npx prisma migrate dev --name init')
    console.log('Then: npx prisma generate')
  })
`
    const schemaScriptPath = join(scriptsDir, 'generate-schema.js')
    writeFileSync(schemaScriptPath, content)
    chmodSync(schemaScriptPath, 0o755)
  }

  private createReactExampleScripts(scriptsDir: string): void {
    // Component generator
    const componentContent = `#!/usr/bin/env node
/**
 * React component generator
 */

const inquirer = require('inquirer')
const fs = require('fs')
const path = require('path')

inquirer
  .prompt([
    {
      type: 'input',
      name: 'componentName',
      message: 'Component name:',
      validate: input => /^[A-Z][a-zA-Z0-9]*$/.test(input) || 'Component name must start with uppercase letter'
    },
    {
      type: 'list',
      name: 'componentType',
      message: 'Component type:',
      choices: [
        { name: 'Functional Component', value: 'functional' },
        { name: 'Functional Component with Hooks', value: 'hooks' },
        { name: 'TypeScript Functional Component', value: 'ts-functional' }
      ]
    },
    {
      type: 'checkbox',
      name: 'features',
      message: 'Include features:',
      choices: [
        { name: 'Props interface', value: 'props' },
        { name: 'React hooks (useState, useEffect)', value: 'hooks' },
        { name: 'CSS Modules', value: 'css' },
        { name: 'Storybook story', value: 'storybook' }
      ]
    }
  ])
  .then(answers => {
    const { componentName, componentType, features } = answers
    let component = ''

    if (componentType.includes('ts')) {
      component = \`import React from 'react'\`

      if (features.includes('props')) {
        component += \`
interface \${componentName}Props {
  // Define props here
}

export const \${componentName}: React.FC<\${componentName}Props> = (props) => {
  return (
    <div className="\${componentName.toLowerCase()}">
      <h1>\${componentName} Component</h1>
    </div>
  )
}

export default \${componentName}\`
      } else {
        component = \`
export const \${componentName}: React.FC = () => {
  return (
    <div className="\${componentName.toLowerCase()}">
      <h1>\${componentName} Component</h1>
    </div>
  )
}

export default \${componentName}\`
      }
    } else {
      component = \`import React from 'react'

export const \${componentName} = () => {
  return (
    <div className="\${componentName.toLowerCase()}">
      <h1>\${componentName} Component</h1>
    </div>
  )
}

export default \${componentName}\`
    }

    const outputPath = path.join(process.cwd(), 'src', 'components', \`\${componentName}.tsx\`)

    // Ensure directory exists
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })

    // Write component file
    fs.writeFileSync(outputPath, component)

    console.log(\`✅ Component created: \${outputPath}\`)

    // Create CSS module if requested
    if (features.includes('css')) {
      const cssContent = \`.\${componentName.toLowerCase()} {
  /* Add your styles here */
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.\${componentName.toLowerCase()} h1 {
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
}\`

      const cssPath = outputPath.replace('.tsx', '.module.css')
      fs.writeFileSync(cssPath, cssContent)
      console.log(\`✅ CSS module created: \${cssPath}\`)
    }

    // Create Storybook story if requested
    if (features.includes('storybook')) {
      const storyContent = \`import type { Meta, StoryObj } from '@storybook/react'
import \${componentName} from './\${componentName}'

const meta: Meta<typeof \${componentName}> = {
  title: 'Components/\${componentName}',
  component: \${componentName},
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {}\`

      const storyPath = outputPath.replace('.tsx', '.stories.tsx')
      fs.writeFileSync(storyPath, storyContent)
      console.log(\`✅ Storybook story created: \${storyPath}\`)
    }
  })
`
    const componentScriptPath = join(scriptsDir, 'generate-component.js')
    writeFileSync(componentScriptPath, componentContent)
    chmodSync(componentScriptPath, 0o755)

    // Note: The package.json update is handled by the script itself
    console.log('✅ React component generator created')
  }
}
