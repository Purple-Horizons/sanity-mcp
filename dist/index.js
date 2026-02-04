#!/usr/bin/env node
"use strict";
/**
 * Sanity CMS MCP Server
 * Provides tools for querying and managing Sanity CMS content via MCP protocol
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const sanity_client_js_1 = require("./sanity-client.js");
// Tool definitions
const TOOLS = [
    {
        name: 'sanity_query',
        description: 'Execute a GROQ query against Sanity CMS. GROQ is a query language similar to GraphQL but designed for JSON documents. Examples: `*[_type == "post"]` gets all posts, `*[_type == "post" && slug.current == "my-post"][0]` gets a specific post.',
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
    server;
    client;
    constructor() {
        this.client = (0, sanity_client_js_1.createClientFromEnv)();
        this.server = new index_js_1.Server({
            name: 'sanity-mcp',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupHandlers();
    }
    setupHandlers() {
        // List available tools
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
            tools: TOOLS,
        }));
        // Handle tool calls
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case 'sanity_query':
                        return await this.handleQuery(args);
                    case 'sanity_get_document':
                        return await this.handleGetDocument(args);
                    case 'sanity_list_documents':
                        return await this.handleListDocuments(args);
                    case 'sanity_search':
                        return await this.handleSearch(args);
                    case 'sanity_get_types':
                        return await this.handleGetTypes();
                    case 'sanity_get_type_info':
                        return await this.handleGetTypeInfo(args);
                    case 'sanity_count':
                        return await this.handleCount(args);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: 'text', text: `Error: ${message}` }],
                    isError: true,
                };
            }
        });
    }
    async handleQuery(args) {
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
    async handleGetDocument(args) {
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
    async handleListDocuments(args) {
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
                    text: JSON.stringify({
                        type: args.type,
                        count: docs.length,
                        documents: docs,
                    }, null, 2),
                },
            ],
        };
    }
    async handleSearch(args) {
        const results = await this.client.search(args.searchTerm, {
            types: args.types,
            limit: args.limit,
        });
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        searchTerm: args.searchTerm,
                        count: results.length,
                        results,
                    }, null, 2),
                },
            ],
        };
    }
    async handleGetTypes() {
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
    async handleGetTypeInfo(args) {
        const info = await this.client.getTypeSchema(args.type);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        type: args.type,
                        ...info,
                    }, null, 2),
                },
            ],
        };
    }
    async handleCount(args) {
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
    async run() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        console.error('Sanity MCP server running on stdio');
    }
}
// Run the server
const server = new SanityMCPServer();
server.run().catch(console.error);
//# sourceMappingURL=index.js.map