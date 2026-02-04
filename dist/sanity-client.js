"use strict";
/**
 * Sanity CMS HTTP Client
 * Handles all communication with the Sanity Content Lake API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SanityClient = void 0;
exports.createClientFromEnv = createClientFromEnv;
class SanityClient {
    projectId;
    dataset;
    apiVersion;
    token;
    useCdn;
    constructor(config) {
        this.projectId = config.projectId;
        this.dataset = config.dataset;
        this.apiVersion = config.apiVersion || '2024-01-20';
        this.token = config.token;
        // Default to CDN unless token is provided (authenticated requests need API endpoint)
        this.useCdn = config.useCdn ?? !config.token;
    }
    get baseUrl() {
        const subdomain = this.useCdn ? 'apicdn' : 'api';
        return `https://${this.projectId}.${subdomain}.sanity.io/v${this.apiVersion}`;
    }
    get headers() {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }
    /**
     * Execute a GROQ query against the Sanity Content Lake
     */
    async query(groqQuery, params) {
        const url = new URL(`${this.baseUrl}/data/query/${this.dataset}`);
        // For short queries, use GET; for long queries, use POST
        const queryString = encodeURIComponent(groqQuery);
        const isShortQuery = queryString.length < 10000;
        if (isShortQuery) {
            url.searchParams.set('query', groqQuery);
            if (params) {
                for (const [key, value] of Object.entries(params)) {
                    url.searchParams.set(`$${key}`, JSON.stringify(value));
                }
            }
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: this.headers,
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Sanity query failed: ${response.status} - ${error}`);
            }
            return response.json();
        }
        else {
            // Use POST for long queries
            const body = { query: groqQuery };
            if (params) {
                body.params = params;
            }
            const response = await fetch(`${this.baseUrl}/data/query/${this.dataset}`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Sanity query failed: ${response.status} - ${error}`);
            }
            return response.json();
        }
    }
    /**
     * Get a single document by ID
     */
    async getDocument(id) {
        const result = await this.query(`*[_id == $id][0]`, { id });
        return result.result;
    }
    /**
     * Get multiple documents by type
     */
    async getDocumentsByType(type, options) {
        const limit = options?.limit || 100;
        const offset = options?.offset || 0;
        const order = options?.order || '_createdAt desc';
        const query = `*[_type == $type] | order(${order}) [${offset}...${offset + limit}]`;
        const result = await this.query(query, { type });
        return result.result;
    }
    /**
     * Search documents using full-text search
     */
    async search(searchTerm, options) {
        const limit = options?.limit || 20;
        const typeFilter = options?.types?.length
            ? `&& _type in ${JSON.stringify(options.types)}`
            : '';
        const query = `*[_type != "sanity.imageAsset" && _type != "sanity.fileAsset" ${typeFilter}] | score(
      boost(title match $searchTerm, 3),
      boost(name match $searchTerm, 3),
      boost(description match $searchTerm, 2),
      boost(body match $searchTerm, 1),
      boost(pt::text(body) match $searchTerm, 1)
    ) | order(_score desc) [0...${limit}] {
      _id,
      _type,
      _score,
      title,
      name,
      slug,
      description
    }`;
        const result = await this.query(query, { searchTerm: `*${searchTerm}*` });
        return result.result;
    }
    /**
     * Count documents matching a query
     */
    async count(groqFilter, params) {
        const query = `count(${groqFilter})`;
        const result = await this.query(query, params);
        return result.result;
    }
    /**
     * Get all document types in the dataset
     */
    async getDocumentTypes() {
        const query = `array::unique(*[]._type)`;
        const result = await this.query(query);
        return result.result.filter((type) => !type.startsWith('sanity.') && !type.startsWith('system.'));
    }
    /**
     * Get schema information for a document type
     */
    async getTypeSchema(type) {
        // Get a sample document and extract field names
        const sampleQuery = `*[_type == $type][0]`;
        const countQuery = `count(*[_type == $type])`;
        const [sample, countResult] = await Promise.all([
            this.query(sampleQuery, { type }),
            this.query(countQuery, { type }),
        ]);
        const fields = sample.result
            ? Object.keys(sample.result).filter((k) => !k.startsWith('_'))
            : [];
        return {
            fields,
            count: countResult.result,
        };
    }
}
exports.SanityClient = SanityClient;
/**
 * Create a Sanity client from environment variables
 */
function createClientFromEnv() {
    const projectId = process.env.SANITY_PROJECT_ID;
    const dataset = process.env.SANITY_DATASET || 'production';
    const token = process.env.SANITY_TOKEN;
    const apiVersion = process.env.SANITY_API_VERSION || '2024-01-20';
    if (!projectId) {
        throw new Error('SANITY_PROJECT_ID environment variable is required');
    }
    return new SanityClient({
        projectId,
        dataset,
        apiVersion,
        token,
        useCdn: !token, // Use CDN for public access, API for authenticated
    });
}
//# sourceMappingURL=sanity-client.js.map