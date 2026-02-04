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

export class SanityClient {
  private projectId: string;
  private dataset: string;
  private apiVersion: string;
  private token?: string;
  private useCdn: boolean;

  constructor(config: SanityConfig) {
    this.projectId = config.projectId;
    this.dataset = config.dataset;
    this.apiVersion = config.apiVersion || '2024-01-20';
    this.token = config.token;
    // Default to CDN unless token is provided (authenticated requests need API endpoint)
    this.useCdn = config.useCdn ?? !config.token;
  }

  private get baseUrl(): string {
    const subdomain = this.useCdn ? 'apicdn' : 'api';
    return `https://${this.projectId}.${subdomain}.sanity.io/v${this.apiVersion}`;
  }

  private get headers(): Record<string, string> {
    const headers: Record<string, string> = {
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
  async query<T = unknown>(
    groqQuery: string,
    params?: Record<string, unknown>
  ): Promise<QueryResult<T>> {
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

      return response.json() as Promise<QueryResult<T>>;
    } else {
      // Use POST for long queries
      const body: { query: string; params?: Record<string, unknown> } = { query: groqQuery };
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

      return response.json() as Promise<QueryResult<T>>;
    }
  }

  /**
   * Get a single document by ID
   */
  async getDocument<T extends SanityDocument = SanityDocument>(
    id: string
  ): Promise<T | null> {
    const result = await this.query<T | null>(`*[_id == $id][0]`, { id });
    return result.result;
  }

  /**
   * Get multiple documents by type
   */
  async getDocumentsByType<T extends SanityDocument = SanityDocument>(
    type: string,
    options?: {
      limit?: number;
      offset?: number;
      order?: string;
    }
  ): Promise<T[]> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;
    const order = options?.order || '_createdAt desc';

    const query = `*[_type == $type] | order(${order}) [${offset}...${offset + limit}]`;
    const result = await this.query<T[]>(query, { type });
    return result.result;
  }

  /**
   * Search documents using full-text search
   */
  async search<T extends SanityDocument = SanityDocument>(
    searchTerm: string,
    options?: {
      types?: string[];
      limit?: number;
    }
  ): Promise<T[]> {
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

    const result = await this.query<T[]>(query, { searchTerm: `*${searchTerm}*` });
    return result.result;
  }

  /**
   * Count documents matching a query
   */
  async count(groqFilter: string, params?: Record<string, unknown>): Promise<number> {
    const query = `count(${groqFilter})`;
    const result = await this.query<number>(query, params);
    return result.result;
  }

  /**
   * Get all document types in the dataset
   */
  async getDocumentTypes(): Promise<string[]> {
    const query = `array::unique(*[]._type)`;
    const result = await this.query<string[]>(query);
    return result.result.filter(
      (type) => !type.startsWith('sanity.') && !type.startsWith('system.')
    );
  }

  /**
   * Get schema information for a document type
   */
  async getTypeSchema(type: string): Promise<{ fields: string[]; count: number }> {
    // Get a sample document and extract field names
    const sampleQuery = `*[_type == $type][0]`;
    const countQuery = `count(*[_type == $type])`;

    const [sample, countResult] = await Promise.all([
      this.query<SanityDocument | null>(sampleQuery, { type }),
      this.query<number>(countQuery, { type }),
    ]);

    const fields = sample.result
      ? Object.keys(sample.result).filter((k) => !k.startsWith('_'))
      : [];

    return {
      fields,
      count: countResult.result,
    };
  }

  /**
   * Get the mutations API URL (always uses api, never cdn)
   */
  private get mutateUrl(): string {
    return `https://${this.projectId}.api.sanity.io/v${this.apiVersion}/data/mutate/${this.dataset}`;
  }

  /**
   * Get the assets API URL
   */
  private get assetsUrl(): string {
    return `https://${this.projectId}.api.sanity.io/v${this.apiVersion}/assets/images/${this.dataset}`;
  }

  /**
   * Execute mutations against the Sanity Content Lake
   */
  private async mutate(
    mutations: Array<Record<string, unknown>>,
    options?: { returnDocuments?: boolean }
  ): Promise<MutationResult> {
    if (!this.token) {
      throw new Error('Write operations require a Sanity API token');
    }

    const response = await fetch(this.mutateUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        mutations,
        returnDocuments: options?.returnDocuments ?? false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Sanity mutation failed: ${response.status} - ${error}`);
    }

    return response.json() as Promise<MutationResult>;
  }

  /**
   * Create a new document
   */
  async createDocument<T extends Omit<SanityDocument, '_id' | '_rev' | '_createdAt' | '_updatedAt'>>(
    document: T & { _type: string; _id?: string }
  ): Promise<MutationResult> {
    const mutation = document._id
      ? { createOrReplace: document }
      : { create: document };
    
    return this.mutate([mutation]);
  }

  /**
   * Update an existing document (replaces the entire document)
   */
  async updateDocument(
    id: string,
    document: Record<string, unknown>
  ): Promise<MutationResult> {
    return this.mutate([
      {
        createOrReplace: {
          _id: id,
          ...document,
        },
      },
    ]);
  }

  /**
   * Patch a document (partial update)
   */
  async patchDocument(
    id: string,
    patches: {
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
    }
  ): Promise<MutationResult> {
    return this.mutate([
      {
        patch: {
          id,
          ...patches,
        },
      },
    ]);
  }

  /**
   * Delete a document
   */
  async deleteDocument(id: string): Promise<MutationResult> {
    return this.mutate([{ delete: { id } }]);
  }

  /**
   * Upload an image asset
   */
  async uploadImage(
    imageBuffer: Buffer,
    filename: string,
    contentType: string = 'image/jpeg'
  ): Promise<AssetDocument> {
    if (!this.token) {
      throw new Error('Image upload requires a Sanity API token');
    }

    const url = `${this.assetsUrl}?filename=${encodeURIComponent(filename)}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Authorization': `Bearer ${this.token}`,
      },
      body: imageBuffer,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Image upload failed: ${response.status} - ${error}`);
    }

    const result = await response.json() as { document: AssetDocument };
    return result.document;
  }

  /**
   * Create an image reference from an asset ID
   */
  createImageReference(assetId: string): { _type: 'image'; asset: { _type: 'reference'; _ref: string } } {
    return {
      _type: 'image',
      asset: {
        _type: 'reference',
        _ref: assetId,
      },
    };
  }

  /**
   * Publish a draft document (remove drafts. prefix)
   */
  async publishDocument(draftId: string): Promise<MutationResult> {
    // Get the draft document
    const draft = await this.getDocument(draftId);
    if (!draft) {
      throw new Error(`Draft document not found: ${draftId}`);
    }

    // Determine the published ID
    const publishedId = draftId.startsWith('drafts.')
      ? draftId.replace('drafts.', '')
      : draftId;

    // Create the published version and delete the draft
    const { _id, _rev, ...documentData } = draft;
    
    return this.mutate([
      {
        createOrReplace: {
          _id: publishedId,
          ...documentData,
        },
      },
      {
        delete: {
          id: draftId,
        },
      },
    ]);
  }

  /**
   * Unpublish a document (move to drafts)
   */
  async unpublishDocument(publishedId: string): Promise<MutationResult> {
    // Get the published document
    const published = await this.getDocument(publishedId);
    if (!published) {
      throw new Error(`Published document not found: ${publishedId}`);
    }

    // Determine the draft ID
    const draftId = publishedId.startsWith('drafts.')
      ? publishedId
      : `drafts.${publishedId}`;

    // Create the draft version and delete the published
    const { _id, _rev, ...documentData } = published;
    
    return this.mutate([
      {
        createOrReplace: {
          _id: draftId,
          ...documentData,
        },
      },
      {
        delete: {
          id: publishedId,
        },
      },
    ]);
  }

  /**
   * Find all documents that reference a given document
   */
  async findReferences(
    documentId: string,
    options?: { limit?: number }
  ): Promise<DocumentReference[]> {
    const limit = options?.limit || 100;
    
    // GROQ query to find all documents that reference this document
    const query = `*[references($id)][0...${limit}] {
      _id,
      _type
    }`;
    
    const result = await this.query<DocumentReference[]>(query, { id: documentId });
    return result.result;
  }

  /**
   * Get revision history for a document
   */
  async getHistory(
    documentId: string,
    options?: { limit?: number }
  ): Promise<HistoryEntry[]> {
    if (!this.token) {
      throw new Error('History access requires a Sanity API token');
    }
    
    const limit = options?.limit || 25;
    
    // Use the history API
    const url = `https://${this.projectId}.api.sanity.io/v${this.apiVersion}/data/history/${this.dataset}/documents/${documentId}?limit=${limit}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers,
    });
    
    if (!response.ok) {
      // History API might not be available, fall back to basic info
      const doc = await this.getDocument(documentId);
      if (doc) {
        return [{
          _id: doc._id,
          _rev: doc._rev || 'unknown',
          _updatedAt: doc._updatedAt || new Date().toISOString(),
        }];
      }
      return [];
    }
    
    const result = await response.json() as { documents: HistoryEntry[] };
    return result.documents || [];
  }

  /**
   * Compare two documents and return the differences
   */
  async compareDocuments(
    idA: string,
    idB: string
  ): Promise<{
    added: string[];
    removed: string[];
    changed: string[];
    unchanged: string[];
  }> {
    const [docA, docB] = await Promise.all([
      this.getDocument(idA),
      this.getDocument(idB),
    ]);
    
    if (!docA) throw new Error(`Document not found: ${idA}`);
    if (!docB) throw new Error(`Document not found: ${idB}`);
    
    const keysA = new Set(Object.keys(docA).filter(k => !k.startsWith('_')));
    const keysB = new Set(Object.keys(docB).filter(k => !k.startsWith('_')));
    
    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];
    const unchanged: string[] = [];
    
    // Fields in B but not in A
    for (const key of keysB) {
      if (!keysA.has(key)) added.push(key);
    }
    
    // Fields in A but not in B
    for (const key of keysA) {
      if (!keysB.has(key)) {
        removed.push(key);
      } else {
        // Both have it - compare values
        const valA = JSON.stringify((docA as Record<string, unknown>)[key]);
        const valB = JSON.stringify((docB as Record<string, unknown>)[key]);
        if (valA === valB) {
          unchanged.push(key);
        } else {
          changed.push(key);
        }
      }
    }
    
    return { added, removed, changed, unchanged };
  }

  /**
   * Execute multiple mutations in a single atomic transaction
   */
  async bulkMutate(
    operations: BulkOperation[],
    options?: { dryRun?: boolean }
  ): Promise<MutationResult> {
    if (!this.token) {
      throw new Error('Bulk operations require a Sanity API token');
    }
    
    if (options?.dryRun) {
      // Validate without executing
      return {
        transactionId: 'dry-run',
        results: operations.map((op, i) => ({
          id: `operation-${i}`,
          operation: Object.keys(op)[0],
        })),
      };
    }
    
    return this.mutate(operations);
  }

  /**
   * Get the draft/publish status of a document
   */
  async getDraftStatus(
    documentId: string
  ): Promise<{
    published: SanityDocument | null;
    draft: SanityDocument | null;
    hasUnpublishedChanges: boolean;
    status: 'published' | 'draft' | 'both' | 'none';
  }> {
    const publishedId = documentId.startsWith('drafts.') 
      ? documentId.replace('drafts.', '') 
      : documentId;
    const draftId = `drafts.${publishedId}`;
    
    const [published, draft] = await Promise.all([
      this.getDocument(publishedId),
      this.getDocument(draftId),
    ]);
    
    let status: 'published' | 'draft' | 'both' | 'none';
    if (published && draft) status = 'both';
    else if (published) status = 'published';
    else if (draft) status = 'draft';
    else status = 'none';
    
    return {
      published,
      draft,
      hasUnpublishedChanges: !!draft,
      status,
    };
  }
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
export type BulkOperation =
  | { create: Record<string, unknown> }
  | { createOrReplace: Record<string, unknown> }
  | { createIfNotExists: Record<string, unknown> }
  | { patch: { id: string; set?: Record<string, unknown>; unset?: string[]; inc?: Record<string, number> } }
  | { delete: { id: string } };

/**
 * Create a Sanity client from environment variables
 */
export function createClientFromEnv(): SanityClient {
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
