/**
 * Sanity CMS HTTP Client
 * Handles all communication with the Sanity Content Lake API
 */
export interface SanityConfig {
    projectId: string;
    dataset: string;
    apiVersion?: string;
    token?: string;
    useCdn?: boolean;
}
export interface QueryResult<T = unknown> {
    ms: number;
    query: string;
    result: T;
}
export interface SanityDocument {
    _id: string;
    _type: string;
    _rev?: string;
    _createdAt?: string;
    _updatedAt?: string;
    [key: string]: unknown;
}
export declare class SanityClient {
    private projectId;
    private dataset;
    private apiVersion;
    private token?;
    private useCdn;
    constructor(config: SanityConfig);
    private get baseUrl();
    private get headers();
    /**
     * Execute a GROQ query against the Sanity Content Lake
     */
    query<T = unknown>(groqQuery: string, params?: Record<string, unknown>): Promise<QueryResult<T>>;
    /**
     * Get a single document by ID
     */
    getDocument<T extends SanityDocument = SanityDocument>(id: string): Promise<T | null>;
    /**
     * Get multiple documents by type
     */
    getDocumentsByType<T extends SanityDocument = SanityDocument>(type: string, options?: {
        limit?: number;
        offset?: number;
        order?: string;
    }): Promise<T[]>;
    /**
     * Search documents using full-text search
     */
    search<T extends SanityDocument = SanityDocument>(searchTerm: string, options?: {
        types?: string[];
        limit?: number;
    }): Promise<T[]>;
    /**
     * Count documents matching a query
     */
    count(groqFilter: string, params?: Record<string, unknown>): Promise<number>;
    /**
     * Get all document types in the dataset
     */
    getDocumentTypes(): Promise<string[]>;
    /**
     * Get schema information for a document type
     */
    getTypeSchema(type: string): Promise<{
        fields: string[];
        count: number;
    }>;
}
/**
 * Create a Sanity client from environment variables
 */
export declare function createClientFromEnv(): SanityClient;
//# sourceMappingURL=sanity-client.d.ts.map