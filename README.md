# 🔮 Sanity MCP Server

**The self-hosted Sanity MCP that Sanity deprecated.** Full CRUD, atomic transactions, reference tracking, and tools the official server doesn't have.

[![npm version](https://img.shields.io/npm/v/@purple-horizons/sanity-mcp)](https://www.npmjs.com/package/@purple-horizons/sanity-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)

---

## Why This Exists

Sanity's official MCP server (`@sanity/mcp-server`) is **archived**. They want you to use their hosted solution at `mcp.sanity.io` with OAuth.

That's fine if you want:
- OAuth flows for every AI tool
- Dependency on Sanity's infrastructure
- No offline or air-gapped usage
- Whatever tools they decide to expose

**This MCP gives you:**
- 🔑 Simple token auth — one env var, done
- 🏠 Self-hosted — runs anywhere, no external dependencies
- 🛠️ More tools — reference tracking, diff, history, bulk ops
- ⚡ Works offline — no OAuth dance, no hosted service required

---

## Quick Start

```bash
npx @purple-horizons/sanity-mcp
```

Or install globally:

```bash
npm install -g @purple-horizons/sanity-mcp
```

### MCP Configuration

Add to your Claude Desktop, Cursor, or VS Code config:

```json
{
  "mcpServers": {
    "sanity": {
      "command": "npx",
      "args": ["@purple-horizons/sanity-mcp"],
      "env": {
        "SANITY_PROJECT_ID": "your-project-id",
        "SANITY_DATASET": "production",
        "SANITY_TOKEN": "sk-your-token"
      }
    }
  }
}
```

---

## Tools

### 📖 Read Operations

| Tool | Description |
|------|-------------|
| `sanity_query` | Execute any GROQ query |
| `sanity_get_document` | Fetch a single document by ID |
| `sanity_list_documents` | List documents by type with pagination |
| `sanity_search` | Full-text search across content |
| `sanity_get_types` | Discover all document types |
| `sanity_get_type_info` | Get schema info for a type |
| `sanity_count` | Count documents matching a filter |

### ✏️ Write Operations

| Tool | Description |
|------|-------------|
| `sanity_create` | Create a new document |
| `sanity_update` | Replace an entire document |
| `sanity_patch` | Partially update specific fields |
| `sanity_delete` | Delete a document |
| `sanity_publish` | Publish a draft |
| `sanity_unpublish` | Move published to draft |

### 🚀 Unique Tools (Not in Sanity's Official MCP)

| Tool | Description |
|------|-------------|
| `sanity_references` | **Find all documents referencing a given doc** — essential before deleting |
| `sanity_diff` | **Compare two documents** — draft vs published, or any two docs |
| `sanity_history` | **Get revision history** — see who changed what |
| `sanity_bulk` | **Atomic batch operations** — all succeed or all fail |
| `sanity_draft_status` | **Check publish state** — draft, published, or both |

---

## What Makes This Better

### 1. Reference Tracking

Before you delete that image asset, you probably want to know what's using it:

```
sanity_references id="image-abc123"
→ Shows all 47 blog posts using that image
```

Sanity's official MCP doesn't have this. You'd find out the hard way.

### 2. Document Diffing

Content editor made changes. What changed?

```
sanity_diff idA="drafts.post-xyz" idB="post-xyz"
→ Shows exactly which fields differ
```

See the diff before you publish. Or compare any two documents.

### 3. Atomic Bulk Operations

Update 50 documents and they all need to succeed together? One transaction:

```
sanity_bulk operations=[
  { "patch": { "id": "post-1", "set": { "featured": true }}},
  { "patch": { "id": "post-2", "set": { "featured": false }}},
  ...
]
→ All or nothing. No partial states.
```

With `dryRun: true`, validate before executing.

### 4. Draft Status at a Glance

Is there a draft? Is it published? Both?

```
sanity_draft_status id="post-abc123"
→ { status: "both", hasUnpublishedChanges: true }
```

No more manually checking `drafts.{id}` vs `{id}`.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SANITY_PROJECT_ID` | ✅ | — | Your Sanity project ID |
| `SANITY_DATASET` | ❌ | `production` | Dataset name |
| `SANITY_TOKEN` | ❌ | — | API token (required for writes) |
| `SANITY_API_VERSION` | ❌ | `2024-01-20` | API version |

### Getting Your Token

1. Go to [sanity.io/manage](https://sanity.io/manage)
2. Select your project → API → Tokens
3. Add new token with Editor or higher permissions
4. Copy and set as `SANITY_TOKEN`

---

## GROQ Examples

```groq
// All posts, newest first
*[_type == "post"] | order(_createdAt desc)

// Specific post by slug
*[_type == "post" && slug.current == "hello-world"][0]

// Posts with expanded author
*[_type == "post"]{
  title,
  slug,
  "author": author->name,
  "category": category->title
}

// Count by category
{
  "total": count(*[_type == "post"]),
  "published": count(*[_type == "post" && !(_id in path("drafts.**"))])
}

// Full-text search
*[_type == "post" && title match "AI*"]
```

---

## Development

```bash
# Clone
git clone https://github.com/Purple-Horizons/sanity-mcp.git
cd sanity-mcp

# Install
npm install

# Build
npm run build

# Test
npm test

# Run locally
npm run dev
```

---

## Comparison

| Feature | This MCP | Sanity Official |
|---------|----------|-----------------|
| Self-hosted | ✅ | ❌ (archived) |
| Simple token auth | ✅ | OAuth only |
| Works offline | ✅ | ❌ |
| Reference tracking | ✅ | ❌ |
| Document diff | ✅ | ❌ |
| Bulk transactions | ✅ | ❌ |
| Draft status | ✅ | ❌ |
| Revision history | ✅ | ❌ |
| Schema discovery | ✅ | ✅ |
| Full CRUD | ✅ | ✅ |
| GROQ queries | ✅ | ✅ |
| Release management | ❌ | ✅ |
| Semantic search | ❌ | ✅ |

**tl;dr:** We're better for self-hosting, developer tooling, and content operations. They're better if you need releases and semantic search with embeddings.

---

## License

MIT © [Purple Horizons](https://purplehorizons.io)

---

## Links

- [Sanity GROQ Docs](https://www.sanity.io/docs/groq)
- [MCP Protocol](https://modelcontextprotocol.io)
- [Purple Horizons](https://purplehorizons.io)
- [Report Issues](https://github.com/Purple-Horizons/sanity-mcp/issues)
