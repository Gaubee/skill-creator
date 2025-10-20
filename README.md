# Skill Creator

A TypeScript/Node.js CLI tool for creating claude-code-skills with intelligent documentation management and Context7 integration.

## Features

- 🚀 **Automated Skill Creation**: Generate skills with proper folder naming (`package@version` format)
- 📚 **Context7 Integration**: Download and slice documentation from Context7 with automatic project ID detection
- 🔍 **Intelligent Search**: ChromaDB-powered semantic search with automatic indexing
- 💾 **Dynamic Content Management**: Add custom knowledge with deduplication
- 🛠️ **Modern TypeScript**: Full type safety with ESM modules
- 🎯 **Interactive CLI**: Professional command-line interface with inquirer prompts
- 📦 **Flexible Storage**: Store skills in project or user directory

## Installation

```bash
npm install -g skill-creator
```

## Quick Start

### Install as Subagent (Recommended)

```bash
# Interactive installation
skill-creator init

# Non-interactive installation to user directory
skill-creator init-cc
```

### Create a Skill

```bash
# Search for packages
skill-creator search "react query"

# Get package information
skill-creator get-info @tanstack/react-query

# Create skill with interactive prompts
skill-creator create-cc-skill --interactive @tanstack/react-query@5

# Download documentation (automatically builds search index)
skill-creator download-context7 --package @tanstack/react-query /tanstack/react-query

# Search your skill knowledge base
skill-creator search-skill --package @tanstack/react-query "useQuery hook"
```

## Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `init` | Install skill-creator as subagent (interactive mode) |
| `init-cc` | Install skill-creator as subagent in user directory |
| `search <keywords>` | Search npm packages |
| `get-info <package>` | Get detailed package information |
| `create-cc-skill <name>` | Create a new skill directory |

### Content Management

| Command | Description |
|---------|-------------|
| `download-context7 <project_id>` | Download and slice Context7 documentation |
| `search-skill <query>` | Search in skill knowledge base |
| `add-skill` | Add custom knowledge to skill |

### Options

- `--scope <user|project>`: Storage location for skills
- `--pwd <path>`: Working directory for skill operations
- `--package <name>`: Use package name to find skill directory
- `--force`: Force overwrite existing files
- `--skip-chroma-indexing`: Skip automatic ChromaDB index building
- `--interactive`: Enable interactive prompts

## Workflow

### Complete Skill Creation Workflow

1. **Search Package**: Find the right package for your skill
   ```bash
   skill-creator search "state management"
   ```

2. **Get Package Info**: Retrieve detailed information
   ```bash
   skill-creator get-info zustand
   ```

3. **Create Skill**: Set up skill directory with interactive prompts
   ```bash
   skill-creator create-cc-skill --interactive --scope project zustand
   ```

4. **Download Documentation**: Get Context7 docs with automatic indexing
   ```bash
   skill-creator download-context7 --package zustand /zustand
   ```

5. **Add Custom Knowledge**: Enhance with your own content
   ```bash
   skill-creator add-skill --package zustand --title "Best Practices" --content "Your custom notes"
   ```

6. **Search Knowledge Base**: Query your skill
   ```bash
   skill-creator search-skill --package zustand "typescript patterns"
   ```

## Directory Structure

```
.claude/skills/
└── package@version/
    ├── assets/
    │   └── references/
    │       ├── context7/     # Auto-sliced Context7 docs
    │       └── user/         # Custom knowledge files
    ├── config.json          # Skill configuration
    ├── SKILL.md             # Skill documentation
    └── package.json         # Node.js metadata
```

## Development

```bash
# Install dependencies
npm install

# Development mode with watch
npm run dev

# Build TypeScript
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Type check
npm run type-check
```

## Configuration

Skills are configured via `config.json` in the skill directory:

```json
{
  "context7LibraryId": "/org/project",
  "searchEngine": {
    "type": "chroma",
    "chromaPath": "./chroma"
  }
}
```

## Architecture

- **TypeScript + ESM**: Modern JavaScript with full type safety
- **ChromaDB Integration**: Vector search for intelligent document retrieval
- **Context7 API**: Automated documentation downloading and slicing
- **CLI-first Design**: Professional command-line interface
- **Modular Architecture**: Clean separation of concerns

## License

MIT

---

*For detailed subagent usage, see `templates/skill-creator.md`*
