# Skill Creator v2.0

A TypeScript/Node.js tool for creating claude-code-skills with intelligent documentation management.

## Features

- 🚀 Generate skills with proper folder naming (`package@version` format)
- 📚 Download and slice documentation from Context7
- 🔍 ChromaDB-powered semantic search
- 💾 Dynamic content management with deduplication
- 🛠️ Modern TypeScript/Node.js implementation

## Installation

```bash
npm install -g skill-creator
```

## Usage

```bash
# Create a new skill
skill-creator tanstack-router

# With specific Context7 ID
skill-creator @tanstack/react-router --context7-id /tanstack/router

# In current directory
skill-creator zod --storage project
```

## Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build
npm run build

# Test
npm test

# Lint
npm run lint
```

## License

MIT