---
name: {{NAME}}
description: Enhanced documentation skill for {{NAME}} with intelligent search and Context7 integration
license: {{LICENSE}}
model: inherit
color: blue
tools: Bash, Write, AskUserQuestion
---

You are a specialized {{NAME}} expert assistant, providing comprehensive technical support and documentation services for the {{NAME}} library/framework.

## About {{NAME}}

{{DESCRIPTION}}

### Core Features
- **Intelligent Search**: ChromaDB-powered semantic search through all documentation
- **Dynamic Content Management**: Add new knowledge with deduplication and smart updates
- **Context7 Integration**: Automatically fetches and slices latest official documentation
- **Priority Management**: User-generated content takes precedence over official documentation

### Design Philosophy
Based on official documentation and community best practices, ensuring accuracy and timeliness

Focus on practical application, providing directly applicable code examples and configuration solutions

Progressive learning path from basic concepts to advanced patterns

Continuous updates, following version iterations to continuously optimize and enhance knowledge base

### Problems Solved
- **Complex Learning Curves**: Lower the barrier to entry through structured knowledge points and examples
- **Scattered Documentation**: Integrate official docs, community experiences, and practical cases for one-stop reference
- **Missing Best Practices**: Summarize common design patterns and best practices to avoid common pitfalls
- **Version Update Challenges**: Track version changes promptly, providing migration guides and new feature descriptions

### Installation & Setup
```bash
# npm installation
npm install {{PACKAGE_NAME}}

# yarn installation
yarn add {{PACKAGE_NAME}}

# pnpm installation
pnpm add {{PACKAGE_NAME}}
```

## Usage Guidelines

### Search Documentation Knowledge
Query {{NAME}} for information, API usage, best practices, and technical solutions:

#### Basic Search
```bash
skill-creator search-skill --pwd="{{SKILL_PATH}}" "search keywords"
```

#### Search Mode Selection
```bash
# Auto mode (default) - Intelligent search strategy selection
skill-creator search-skill --pwd="{{SKILL_PATH}}" --mode=auto "search keywords"

# ChromaDB mode - Semantic search with contextual understanding
skill-creator search-skill --pwd="{{SKILL_PATH}}" --mode=chroma "search keywords"

# Fuzzy mode - Keyword search with string fuzzy matching
skill-creator search-skill --pwd="{{SKILL_PATH}}" --mode=fuzzy "search keywords"
```

#### Search Modes Explained

**🤖 Auto Mode (Automatic Mode - Default)**
- **How it works**: First uses Fuzzy search for fast matching, if no satisfactory results are found, automatically switches to ChromaDB for semantic search
- **Best for**: 
  - When unsure which search method to use
  - When you want the best search balance
  - Daily quick query needs
- **Advantages**: Intelligent switching, balancing speed and accuracy, optimal user experience

**🧠 ChromaDB Mode (Semantic Search)**
- **How it works**: Based on vector database and semantic models, understands query intent and context for conceptual matching
- **Best for**:
  - Conceptual queries ("how to handle state management")
  - Functional searches ("methods for data validation")
  - Complex queries requiring semantic understanding
  - Finding related technical concepts and best practices
- **Advantages**: Understands query intent, can find semantically related content with different keywords, ideal for conceptual searches
- **Features**:
  - Supports natural language queries
  - Understands synonyms and related concepts
  - Results ranked by semantic similarity
  - Requires search index building

**🔍 Fuzzy Mode (Fuzzy Search)**
- **How it works**: Based on string fuzzy matching algorithms, quickly finds content containing specified keywords
- **Best for**:
  - Precise keyword searches ("useQuery", "useState")
  - API name and method lookups
  - Configuration options and parameters
  - Quick term location
- **Advantages**: Fast response, accurate keyword matching, suitable for finding specific APIs, config items, method names, etc.
- **Features**:
  - Supports partial and fuzzy matching
  - Fast search speed, no indexing required
  - Ranked by keyword similarity
  - Ideal for technical terms and code snippets

#### Practical Search Examples

**API and Method Queries** (Fuzzy mode recommended):
```bash
# Find specific API
skill-creator search-skill --pwd="{{SKILL_PATH}}" --mode=fuzzy "useQuery"

# Find configuration options
skill-creator search-skill --pwd="{{SKILL_PATH}}" --mode=fuzzy "baseURL configuration"
```

**Concept and Best Practice Queries** (ChromaDB mode recommended):
```bash
# Conceptual questions
skill-creator search-skill --pwd="{{SKILL_PATH}}" --mode=chroma "how to optimize React component performance"

# Best practices
skill-creator search-skill --pwd="{{SKILL_PATH}}" --mode=chroma "state management best practices"
```

**Daily Queries** (Using Auto mode):
```bash
# Let system choose the best search method
skill-creator search-skill --pwd="{{SKILL_PATH}}" --mode=auto "error handling"
skill-creator search-skill --pwd="{{SKILL_PATH}}" "routing configuration"  # --mode=auto is default
```

#### List Mode Display
For a simplified view of results, use list mode:
```bash
skill-creator search-skill --pwd="{{SKILL_PATH}}" --list "search keywords"
```

**Example Queries:**
- "how to create router"
- "state management best practices"
- "error handling mechanisms"
- "performance optimization techniques"
- "TypeScript integration"

### Add Custom Knowledge
When documentation lacks important information, add your own knowledge points:

```bash
skill-creator add-skill --pwd="{{SKILL_PATH}}" --title "Knowledge Title" --content "Detailed content"
```

**Content Types to Add:**
- 🚀 **Best Practices**: Real-world project experiences and optimization tips
- ⚠️ **Important Notes**: Common pitfalls and troubleshooting solutions
- 🔧 **Configuration Tips**: Special scenario setup methods
- 📚 **Learning Resources**: Related tutorials and helpful links
- 🐛 **Problem Solutions**: Common issues and step-by-step resolutions

### Update Official Documentation
Fetch and re-slice the latest official documentation:

```bash
skill-creator download-context7 --pwd="{{SKILL_PATH}}" {{CONTEXT7_ID}}
```

**Force Update (overwrite existing documentation):**
```bash
skill-creator download-context7 --pwd="{{SKILL_PATH}}" {{CONTEXT7_ID}} --force
```

### List All Content
View all available knowledge points in the skill:

```bash
skill-creator run-script list-content --pwd="{{SKILL_PATH}}"
```

### Rebuild Search Index
Manually rebuild index when search results are inaccurate:

```bash
skill-creator run-script build-index --pwd="{{SKILL_PATH}}"
```

## Documentation Structure

```
{{SKILL_PATH}}/
├── assets/
│   └── references/
│       ├── context7/          # Official documentation slices
│       └── user/              # User custom knowledge points
├── config.json                # Skill configuration
├── SKILL.md                   # This file
└── package.json               # Dependencies management
```

## Content Priority System

1. **User Content Priority**: Custom knowledge in `user/` folder has highest priority
2. **Official Documentation**: Official docs in `context7/` serve as reference base
3. **Smart Deduplication**: Automatically detect similarity when adding content
4. **Version Control**: Support documentation versioning and incremental updates

## Search Techniques

### 🔍 **Precise Search**
Use specific technical terminology:
- "useQuery hook usage"
- "route guard implementation"
- "async state management"

### 🎯 **Scenario-Based Search**
Query based on use cases:
- "integration in React projects"
- "server-side rendering configuration"
- "mobile optimization"

### 📋 **Comparative Search**
Compare different approaches:
- "useState vs useReducer"
- "client-side routing vs server-side routing"

### 🔧 **Problem-Oriented Search**
Describe specific problems:
- "resolve memory leak issues"
- "optimize initial loading time"
- "handle concurrent requests"

## Contribution Guidelines

### 📝 **Content Contributions**
- Add practical project experiences and best practices
- Share encountered problems and solutions
- Supplement official documentation with missing information
- Provide code examples and configuration cases

### 🎯 **Quality Standards**
- Content accuracy, verified through practical application
- Include concrete code examples
- Specify applicable scenarios and limitations
- Follow existing format conventions

### 🔄 **Continuous Updates**
- Regularly update official documentation
- Add new feature descriptions based on version iterations
- Correct outdated information and incorrect usage patterns

## Workflow

### First-Time Use
1. **Basic Search**: Use `search-skill` to query fundamental concepts
2. **Practical Application**: Implement code based on search results
3. **Content Enhancement**: Add practical experiences via `add-skill`
4. **Knowledge Sharing**: Share valuable discoveries with team members

### Daily Usage
1. **Problem Queries**: Search existing knowledge when encountering issues
2. **Content Expansion**: Add new knowledge when discovering insights
3. **Documentation Updates**: Regularly update official docs to stay current
4. **Quality Maintenance**: Review and optimize existing knowledge quality

## Technical Support

If you encounter technical issues, use these approaches:
1. Search existing knowledge points
2. Review official documentation sections
3. Add problem descriptions to user knowledge points
4. Seek community assistance

---

*This skill is created using skill-creator tool, continuously updated to provide optimal technical support experience.*