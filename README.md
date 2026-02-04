# Sanity CMS MCP Server

An MCP (Model Context Protocol) server for Sanity CMS, enabling AI agents to query and interact with Sanity content using GROQ.

## Features

- **GROQ Query Execution**: Run any GROQ query against your Sanity dataset
- **Document Operations**: Get documents by ID, list by type, search
- **Schema Discovery**: Explore document types and their fields
- **Full-text Search**: Search across titles, descriptions, and content
- **Pagination Support**: Handle large datasets efficiently
- **CDN Support**: Automatic CDN usage for public datasets

## Installation

```bash
npm install @purple-horizons/sanity-mcp
```

Or run directly:

```bash
npx @purple-horizons/sanity-mcp
```

## Configuration

Set the following environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `SANITY_PROJECT_ID` | Yes | Your Sanity project ID |
| `SANITY_DATASET` | No | Dataset name (default: `production`) |
| `SANITY_TOKEN` | No | API token for authenticated access |
| `SANITY_API_VERSION` | No | API version (default: `2024-01-20`) |

### Example `.env`

```env
SANITY_PROJECT_ID=your-project-id
SANITY_DATASET=production
SANITY_TOKEN=sk-your-token-here
SANITY_API_VERSION=2024-01-20
```

## MCP Configuration

Add to your MCP settings (e.g., Claude Desktop config):

```json
{
  "mcpServers": {
    "sanity": {
      "command": "npx",
      "args": ["@purple-horizons/sanity-mcp"],
      "env": {
        "SANITY_PROJECT_ID": "your-project-id",
        "SANITY_DATASET": "production"
      }
    }
  }
}
```

## Available Tools

### `sanity_query`

Execute any GROQ query against the Sanity Content Lake.

```
Query: *[_type == "post" && publishedAt < now()] | order(publishedAt desc) [0...10]
```

### `sanity_get_document`

Fetch a single document by ID.

```
ID: post-abc123
```

### `sanity_list_documents`

List documents of a specific type with pagination.

```
Type: post
Limit: 20
Offset: 0
Order: _createdAt desc
```

### `sanity_search`

Full-text search across document content.

```
Search Term: AI consulting
Types: ["post", "service"]
Limit: 10
```

### `sanity_get_types`

Discover all document types in the dataset.

### `sanity_get_type_info`

Get field names and document count for a type.

```
Type: post
```

### `sanity_count`

Count documents matching a GROQ filter.

```
Filter: *[_type == "post" && featured == true]
```

## GROQ Query Examples

```groq
// Get all posts
*[_type == "post"]

// Get a specific post by slug
*[_type == "post" && slug.current == "my-post"][0]

// Get posts with author expanded
*[_type == "post"]{
  title,
  slug,
  "author": author->name
}

// Count posts by category
{
  "total": count(*[_type == "post"]),
  "featured": count(*[_type == "post" && featured == true])
}

// Full-text search
*[_type == "post" && title match "AI*"]
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run locally
npm run dev
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm test -- --coverage
```

## License

MIT © Purple Horizons

## Links

- [Sanity GROQ Documentation](https://www.sanity.io/docs/groq)
- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [Purple Horizons](https://purplehorizons.io)
