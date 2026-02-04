#!/usr/bin/env node
/**
 * Sanity CMS MCP Server
 * Provides tools for querying and managing Sanity CMS content via MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SanityClient, createClientFromEnv, SanityDocument } from './sanity-client.js';

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: 'sanity_query',
    description:
      'Execute a GROQ query against Sanity CMS. GROQ is a query language similar to GraphQL but designed for JSON documents. Examples: `*[_type == "post"]` gets all posts, `*[_type == "post" && slug.current == "my-post"][0]` gets a specific post.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The GROQ query to execute',
        },
        params: {
          type: 'object',
          description: 'Optional parameters for the query (referenced as $paramName in query)',
          additionalProperties: true,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'sanity_get_document',
    description: 'Get a single Sanity document by its ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The document ID (e.g., "post-123" or a Sanity-generated ID)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'sanity_list_documents',
    description: 'List documents of a specific type with pagination',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'The document type (e.g., "post", "author", "category")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of documents to return (default: 20, max: 100)',
        },
        offset: {
          type: 'number',
          description: 'Number of documents to skip (for pagination)',
        },
        order: {
          type: 'string',
          description: 'Order clause (e.g., "_createdAt desc", "title asc")',
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'sanity_search',
    description: 'Search for documents using full-text search across titles, names, descriptions, and body content',
    inputSchema: {
      type: 'object',
      properties: {
        searchTerm: {
          type: 'string',
          description: 'The search term',
        },
        types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Limit search to specific document types',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 20)',
        },
      },
      required: ['searchTerm'],
    },
  },
  {
    name: 'sanity_get_types',
    description: 'Get all document types in the Sanity dataset',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'sanity_get_type_info',
    description: 'Get information about a document type including field names and document count',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'The document type to get info for',
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'sanity_count',
    description: 'Count documents matching a GROQ filter',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'GROQ filter expression (e.g., "*[_type == \'post\']")',
        },
        params: {
          type: 'object',
          description: 'Optional parameters for the filter',
          additionalProperties: true,
        },
      },
      required: ['filter'],
    },
  },
];

class SanityMCPServer {
  private server: Server;
  private client: SanityClient;

  constructor() {
    this.client = createClientFromEnv();
    this.server = new Server(
      {
        name: 'sanity-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS,
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'sanity_query':
            return await this.handleQuery(args as { query: string; params?: Record<string, unknown> });

          case 'sanity_get_document':
            return await this.handleGetDocument(args as { id: string });

          case 'sanity_list_documents':
            return await this.handleListDocuments(
              args as { type: string; limit?: number; offset?: number; order?: string }
            );

          case 'sanity_search':
            return await this.handleSearch(
              args as { searchTerm: string; types?: string[]; limit?: number }
            );

          case 'sanity_get_types':
            return await this.handleGetTypes();

          case 'sanity_get_type_info':
            return await this.handleGetTypeInfo(args as { type: string });

          case 'sanity_count':
            return await this.handleCount(
              args as { filter: string; params?: Record<string, unknown> }
            );

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true,
        };
      }
    });
  }

  private async handleQuery(args: { query: string; params?: Record<string, unknown> }) {
    const result = await this.client.query(args.query, args.params);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.result, null, 2),
        },
      ],
    };
  }

  private async handleGetDocument(args: { id: string }) {
    const doc = await this.client.getDocument(args.id);
    if (!doc) {
      return {
        content: [{ type: 'text', text: `Document with ID "${args.id}" not found` }],
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(doc, null, 2) }],
    };
  }

  private async handleListDocuments(args: {
    type: string;
    limit?: number;
    offset?: number;
    order?: string;
  }) {
    const limit = Math.min(args.limit || 20, 100);
    const docs = await this.client.getDocumentsByType(args.type, {
      limit,
      offset: args.offset,
      order: args.order,
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              type: args.type,
              count: docs.length,
              documents: docs,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async handleSearch(args: { searchTerm: string; types?: string[]; limit?: number }) {
    const results = await this.client.search(args.searchTerm, {
      types: args.types,
      limit: args.limit,
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              searchTerm: args.searchTerm,
              count: results.length,
              results,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async handleGetTypes() {
    const types = await this.client.getDocumentTypes();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ documentTypes: types }, null, 2),
        },
      ],
    };
  }

  private async handleGetTypeInfo(args: { type: string }) {
    const info = await this.client.getTypeSchema(args.type);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              type: args.type,
              ...info,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async handleCount(args: { filter: string; params?: Record<string, unknown> }) {
    const count = await this.client.count(args.filter, args.params);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ filter: args.filter, count }, null, 2),
        },
      ],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Sanity MCP server running on stdio');
  }
}

// Run the server
const server = new SanityMCPServer();
server.run().catch(console.error);
