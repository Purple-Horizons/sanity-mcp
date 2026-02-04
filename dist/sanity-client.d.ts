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
export interface MutationResult {
    transactionId: string;
    results: Array<{
        id: string;
        operation: string;
    }>;
}
export interface AssetDocument {
    _id: string;
    _type: 'sanity.imageAsset' | 'sanity.fileAsset';
    url: string;
    originalFilename?: string;
    mimeType?: string;
    size?: number;
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
    /**
     * Get the mutations API URL (always uses api, never cdn)
     */
    private get mutateUrl();
    /**
     * Get the assets API URL
     */
    private get assetsUrl();
    /**
     * Execute mutations against the Sanity Content Lake
     */
    private mutate;
    /**
     * Create a new document
     */
    createDocument<T extends Omit<SanityDocument, '_id' | '_rev' | '_createdAt' | '_updatedAt'>>(document: T & {
        _type: string;
        _id?: string;
    }): Promise<MutationResult>;
    /**
     * Update an existing document (replaces the entire document)
     */
    updateDocument(id: string, document: Record<string, unknown>): Promise<MutationResult>;
    /**
     * Patch a document (partial update)
     */
    patchDocument(id: string, patches: {
        set?: Record<string, unknown>;
        unset?: string[];
        inc?: Record<string, number>;
        dec?: Record<string, number>;
        insert?: {
            before?: string;
            after?: string;
            replace?: string;
            items: unknown[];
        };
    }): Promise<MutationResult>;
    /**
     * Delete a document
     */
    deleteDocument(id: string): Promise<MutationResult>;
    /**
     * Upload an image asset
     */
    uploadImage(imageBuffer: Buffer, filename: string, contentType?: string): Promise<AssetDocument>;
    /**
     * Create an image reference from an asset ID
     */
    createImageReference(assetId: string): {
        _type: 'image';
        asset: {
            _type: 'reference';
            _ref: string;
        };
    };
    /**
     * Publish a draft document (remove drafts. prefix)
     */
    publishDocument(draftId: string): Promise<MutationResult>;
    /**
     * Unpublish a document (move to drafts)
     */
    unpublishDocument(publishedId: string): Promise<MutationResult>;
    /**
     * Find all documents that reference a given document
     */
    findReferences(documentId: string, options?: {
        limit?: number;
    }): Promise<DocumentReference[]>;
    /**
     * Get revision history for a document
     */
    getHistory(documentId: string, options?: {
        limit?: number;
    }): Promise<HistoryEntry[]>;
    /**
     * Compare two documents and return the differences
     */
    compareDocuments(idA: string, idB: string): Promise<{
        added: string[];
        removed: string[];
        changed: string[];
        unchanged: string[];
    }>;
    /**
     * Execute multiple mutations in a single atomic transaction
     */
    bulkMutate(operations: BulkOperation[], options?: {
        dryRun?: boolean;
    }): Promise<MutationResult>;
    /**
     * Get the draft/publish status of a document
     */
    getDraftStatus(documentId: string): Promise<{
        published: SanityDocument | null;
        draft: SanityDocument | null;
        hasUnpublishedChanges: boolean;
        status: 'published' | 'draft' | 'both' | 'none';
    }>;
}
/**
 * Reference information for a document
 */
export interface DocumentReference {
    _id: string;
    _type: string;
}
/**
 * History entry for document revisions
 */
export interface HistoryEntry {
    _id: string;
    _rev: string;
    _updatedAt: string;
    author?: string;
}
/**
 * Bulk operation for transactional updates
 */
export type BulkOperation = {
    create: Record<string, unknown>;
} | {
    createOrReplace: Record<string, unknown>;
} | {
    createIfNotExists: Record<string, unknown>;
} | {
    patch: {
        id: string;
        set?: Record<string, unknown>;
        unset?: string[];
        inc?: Record<string, number>;
    };
} | {
    delete: {
        id: string;
    };
};
/**
 * Create a Sanity client from environment variables
 */
export declare function createClientFromEnv(): SanityClient;
//# sourceMappingURL=sanity-client.d.ts.map