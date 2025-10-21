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

### Install skill-creator

```bash
npm install -g skill-creator
```

### Verify Installation

After installation, you can verify that the MCP servers are working:

```bash
# Check if Context7 MCP is accessible
skill-creator --help

# The help should show all commands if MCP servers are properly configured
```

### Prerequisites

Before installing skill-creator, make sure you have the required MCP (Model Context Protocol) servers installed for full functionality:

<details>
<summary>Context7 MCP - For downloading and managing documentation</summary>

```bash
# Install from npm
npm install -g @upstash/context7-mcp

# Or follow installation guide: https://github.com/upstash/context7?tab=readme-ov-file

```

</details>

<details>
<summary>Chrome DevTools MCP - For browser automation and web scraping</summary>

```bash
# Install from npm
npm install -g @chromedevtools/chrome-devtools-mcp

# Or follow installation guide: https://github.com/ChromeDevTools/chrome-devtools-mcp?tab=readme-ov-file

```

</details>

<details>
<summary>MCP Server Configuration</summary>

After installing the MCP servers, you need to configure them in your Claude Code settings. Add the following to your Claude Code configuration:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp", "--api-key", "YOUR_CONTEXT7_API_KEY"]
    },
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

> **Note**: The MCP servers are required for full functionality. Without them, some features like Context7 documentation downloading and web-based research may not work properly.

</details>

## Quick Start

### Install as Subagent (Recommended)

```bash
# Interactive installation
skill-creator init

# Non-interactive installation to user directory
skill-creator init-cc
```

### Use in claude

```
User: Let the skill-creator subagent help me create a vitest skill document

User: Just tell me some vitest knowledge
```

### Create a Skill for claude

```bash
# Search for packages
skill-creator search "react query"

# Get package information
skill-creator get-info @tanstack/react-query

# Create skill with custom package name (recommended)
skill-creator create-cc-skill --scope current --name "@tanstack/react-query" --description "React Query for data fetching" @tanstack/react-query@5

# Create skill with interactive prompts (requires --scope)
skill-creator create-cc-skill --scope current --interactive --description "React Query for data fetching" @tanstack/react-query@5

# Download documentation (automatically builds search index)
skill-creator download-context7 --package @tanstack/react-query /tanstack/react-query

# Search your skill knowledge base
skill-creator search-skill --package @tanstack/react-query "useQuery hook"
```

## Commands

### Core Commands

| Command                  | Description                                          |
| ------------------------ | ---------------------------------------------------- |
| `init`                   | Install skill-creator as subagent (interactive mode) |
| `init-cc`                | Install skill-creator as subagent in user directory  |
| `search <keywords>`      | Search npm packages                                  |
| `get-info <package>`     | Get detailed package information                     |
| `create-cc-skill <name>` | Create a new skill directory                         |

### Content Management

| Command                          | Description                               |
| -------------------------------- | ----------------------------------------- |
| `download-context7 <project_id>` | Download and slice Context7 documentation |
| `search-skill <query>`           | Search in skill knowledge base            |
| `add-skill`                      | Add custom knowledge to skill             |

### Options

- `--scope <user|current>`: Storage location for skills (required)
- `--name <name>`: Package name for the skill (recommended)
- `--pwd <path>`: Working directory for skill operations
- `--package <name>`: Use package name to find skill directory
- `--description <description>`: Custom description for the skill
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

3. **Create Skill**: Set up skill directory (requires --scope, recommended to use --name)

   ```bash
   # With custom package name (recommended)
   skill-creator create-cc-skill --scope current --name zustand --description "Zustand state management"

   # With interactive prompts
   skill-creator create-cc-skill --scope current --interactive zustand
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

### Prerequisites

Make sure you have the MCP servers installed and configured before development:

```bash
# Verify MCP servers are available
npm list -g @upstash/context7-mcp @chromedevtools/chrome-devtools-mcp
```

### Development Setup

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

### Testing MCP Integration

To test MCP server integration during development:

```bash
# Test Context7 integration
skill-creator get-info @upstash/context7

# Test Chrome DevTools integration
skill-creator download-context7 --help
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

_For detailed subagent usage, see `templates/skill-creator.md`_
