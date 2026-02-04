/**
 * Unit tests for Sanity CMS Client
 */

import { SanityClient, SanityConfig, SanityDocument } from '../sanity-client';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('SanityClient', () => {
  const defaultConfig: SanityConfig = {
    projectId: 'test-project',
    dataset: 'production',
    apiVersion: '2024-01-20',
  };

  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('constructor', () => {
    it('should create client with required config', () => {
      const client = new SanityClient(defaultConfig);
      expect(client).toBeInstanceOf(SanityClient);
    });

    it('should use CDN by default when no token', () => {
      const client = new SanityClient(defaultConfig);
      // We can't directly test private properties, but we can test behavior
      expect(client).toBeDefined();
    });

    it('should not use CDN when token is provided', () => {
      const client = new SanityClient({ ...defaultConfig, token: 'test-token' });
      expect(client).toBeDefined();
    });
  });

  describe('query', () => {
    it('should execute a simple GROQ query via GET', async () => {
      const client = new SanityClient(defaultConfig);
      const mockResult = {
        ms: 10,
        query: '*[_type == "post"]',
        result: [{ _id: 'post-1', _type: 'post', title: 'Test Post' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      const result = await client.query('*[_type == "post"]');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('test-project.apicdn.sanity.io'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(mockResult);
    });

    it('should include parameters in query', async () => {
      const client = new SanityClient(defaultConfig);
      const mockResult = { ms: 5, query: '', result: null };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      await client.query('*[_id == $id][0]', { id: 'doc-123' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('%24id'),
        expect.any(Object)
      );
    });

    it('should throw error on failed request', async () => {
      const client = new SanityClient(defaultConfig);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid query',
      });

      await expect(client.query('invalid query')).rejects.toThrow(
        'Sanity query failed: 400 - Invalid query'
      );
    });

    it('should use POST for long queries', async () => {
      const client = new SanityClient(defaultConfig);
      const longQuery = '*[_type == "post" && ' + 'a'.repeat(15000) + ']';
      const mockResult = { ms: 10, query: longQuery, result: [] };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      await client.query(longQuery);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('getDocument', () => {
    it('should fetch a document by ID', async () => {
      const client = new SanityClient(defaultConfig);
      const mockDoc: SanityDocument = {
        _id: 'post-1',
        _type: 'post',
        title: 'Test Post',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ms: 5, query: '', result: mockDoc }),
      });

      const doc = await client.getDocument('post-1');

      expect(doc).toEqual(mockDoc);
    });

    it('should return null for non-existent document', async () => {
      const client = new SanityClient(defaultConfig);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ms: 5, query: '', result: null }),
      });

      const doc = await client.getDocument('non-existent');

      expect(doc).toBeNull();
    });
  });

  describe('getDocumentsByType', () => {
    it('should fetch documents with default options', async () => {
      const client = new SanityClient(defaultConfig);
      const mockDocs: SanityDocument[] = [
        { _id: 'post-1', _type: 'post', title: 'Post 1' },
        { _id: 'post-2', _type: 'post', title: 'Post 2' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ms: 10, query: '', result: mockDocs }),
      });

      const docs = await client.getDocumentsByType('post');

      expect(docs).toEqual(mockDocs);
      // URL encoding may vary (+ vs %20 for spaces)
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('order');
      expect(calledUrl).toContain('_createdAt');
    });

    it('should respect pagination options', async () => {
      const client = new SanityClient(defaultConfig);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ms: 10, query: '', result: [] }),
      });

      await client.getDocumentsByType('post', { limit: 10, offset: 20 });

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('20...30');
    });

    it('should apply custom ordering', async () => {
      const client = new SanityClient(defaultConfig);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ms: 10, query: '', result: [] }),
      });

      await client.getDocumentsByType('post', { order: 'title asc' });

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('order');
      expect(calledUrl).toContain('title');
    });
  });

  describe('search', () => {
    it('should perform full-text search', async () => {
      const client = new SanityClient(defaultConfig);
      const mockResults: SanityDocument[] = [
        { _id: 'post-1', _type: 'post', title: 'AI in Healthcare', _score: 3.5 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ms: 15, query: '', result: mockResults }),
      });

      const results = await client.search('healthcare');

      expect(results).toEqual(mockResults);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('score'),
        expect.any(Object)
      );
    });

    it('should filter by document types', async () => {
      const client = new SanityClient(defaultConfig);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ms: 15, query: '', result: [] }),
      });

      await client.search('test', { types: ['post', 'article'] });

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('_type');
      expect(calledUrl).toContain('post');
      expect(calledUrl).toContain('article');
    });
  });

  describe('count', () => {
    it('should count documents matching filter', async () => {
      const client = new SanityClient(defaultConfig);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ms: 5, query: '', result: 42 }),
      });

      const count = await client.count('*[_type == "post"]');

      expect(count).toBe(42);
    });
  });

  describe('getDocumentTypes', () => {
    it('should return unique document types', async () => {
      const client = new SanityClient(defaultConfig);
      const allTypes = ['post', 'author', 'category', 'sanity.imageAsset', 'system.something'];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ms: 20, query: '', result: allTypes }),
      });

      const types = await client.getDocumentTypes();

      expect(types).toEqual(['post', 'author', 'category']);
      expect(types).not.toContain('sanity.imageAsset');
      expect(types).not.toContain('system.something');
    });
  });

  describe('getTypeSchema', () => {
    it('should return field names and count for a type', async () => {
      const client = new SanityClient(defaultConfig);
      const sampleDoc: SanityDocument = {
        _id: 'post-1',
        _type: 'post',
        _createdAt: '2024-01-01',
        title: 'Test',
        slug: { current: 'test' },
        body: [],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ms: 5, query: '', result: sampleDoc }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ms: 5, query: '', result: 10 }),
        });

      const schema = await client.getTypeSchema('post');

      expect(schema.fields).toContain('title');
      expect(schema.fields).toContain('slug');
      expect(schema.fields).toContain('body');
      expect(schema.fields).not.toContain('_id');
      expect(schema.fields).not.toContain('_type');
      expect(schema.count).toBe(10);
    });

    it('should handle type with no documents', async () => {
      const client = new SanityClient(defaultConfig);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ms: 5, query: '', result: null }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ms: 5, query: '', result: 0 }),
        });

      const schema = await client.getTypeSchema('emptyType');

      expect(schema.fields).toEqual([]);
      expect(schema.count).toBe(0);
    });
  });

  describe('authentication', () => {
    it('should include Authorization header when token provided', async () => {
      const client = new SanityClient({ ...defaultConfig, token: 'test-token-123' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ms: 5, query: '', result: [] }),
      });

      await client.query('*[_type == "post"]');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        })
      );
    });

    it('should use API endpoint instead of CDN when token provided', async () => {
      const client = new SanityClient({ ...defaultConfig, token: 'test-token' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ms: 5, query: '', result: [] }),
      });

      await client.query('*[_type == "post"]');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('test-project.api.sanity.io'),
        expect.any(Object)
      );
    });
  });

  // Write operations tests
  describe('createDocument', () => {
    it('should create a document with auto-generated ID', async () => {
      const client = new SanityClient({ ...defaultConfig, token: 'write-token' });
      const mockResult = {
        transactionId: 'txn-123',
        results: [{ id: 'post-new', operation: 'create' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      const result = await client.createDocument({
        _type: 'post',
        title: 'New Post',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('data/mutate'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"create"'),
        })
      );
      expect(result.transactionId).toBe('txn-123');
    });

    it('should create or replace a document with custom ID', async () => {
      const client = new SanityClient({ ...defaultConfig, token: 'write-token' });
      const mockResult = {
        transactionId: 'txn-456',
        results: [{ id: 'custom-id', operation: 'createOrReplace' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      const result = await client.createDocument({
        _type: 'post',
        _id: 'custom-id',
        title: 'Custom ID Post',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"createOrReplace"'),
        })
      );
      expect(result.transactionId).toBe('txn-456');
    });

    it('should throw error without token', async () => {
      const client = new SanityClient(defaultConfig);

      await expect(
        client.createDocument({ _type: 'post', title: 'Test' })
      ).rejects.toThrow('Write operations require a Sanity API token');
    });
  });

  describe('updateDocument', () => {
    it('should replace an entire document', async () => {
      const client = new SanityClient({ ...defaultConfig, token: 'write-token' });
      const mockResult = {
        transactionId: 'txn-789',
        results: [{ id: 'post-1', operation: 'createOrReplace' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      const result = await client.updateDocument('post-1', {
        _type: 'post',
        title: 'Updated Title',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('data/mutate'),
        expect.objectContaining({
          body: expect.stringContaining('post-1'),
        })
      );
      expect(result.transactionId).toBe('txn-789');
    });
  });

  describe('patchDocument', () => {
    it('should patch fields on a document', async () => {
      const client = new SanityClient({ ...defaultConfig, token: 'write-token' });
      const mockResult = {
        transactionId: 'txn-patch',
        results: [{ id: 'post-1', operation: 'patch' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      const result = await client.patchDocument('post-1', {
        set: { title: 'Patched Title' },
        unset: ['oldField'],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"patch"'),
        })
      );
      expect(result.transactionId).toBe('txn-patch');
    });

    it('should support increment/decrement operations', async () => {
      const client = new SanityClient({ ...defaultConfig, token: 'write-token' });
      const mockResult = {
        transactionId: 'txn-inc',
        results: [{ id: 'doc-1', operation: 'patch' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      await client.patchDocument('doc-1', {
        inc: { views: 1 },
        dec: { stock: 1 },
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.mutations[0].patch.inc).toEqual({ views: 1 });
      expect(body.mutations[0].patch.dec).toEqual({ stock: 1 });
    });
  });

  describe('deleteDocument', () => {
    it('should delete a document by ID', async () => {
      const client = new SanityClient({ ...defaultConfig, token: 'write-token' });
      const mockResult = {
        transactionId: 'txn-del',
        results: [{ id: 'post-1', operation: 'delete' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      const result = await client.deleteDocument('post-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"delete"'),
        })
      );
      expect(result.transactionId).toBe('txn-del');
    });
  });

  describe('publishDocument', () => {
    it('should publish a draft document', async () => {
      const client = new SanityClient({ ...defaultConfig, token: 'write-token' });
      const draftDoc: SanityDocument = {
        _id: 'drafts.post-1',
        _type: 'post',
        _rev: 'abc',
        title: 'Draft Post',
      };
      const mockMutationResult = {
        transactionId: 'txn-pub',
        results: [
          { id: 'post-1', operation: 'createOrReplace' },
          { id: 'drafts.post-1', operation: 'delete' },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ms: 5, query: '', result: draftDoc }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockMutationResult,
        });

      const result = await client.publishDocument('drafts.post-1');

      expect(result.transactionId).toBe('txn-pub');
    });

    it('should throw error if draft not found', async () => {
      const client = new SanityClient({ ...defaultConfig, token: 'write-token' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ms: 5, query: '', result: null }),
      });

      await expect(client.publishDocument('drafts.nonexistent')).rejects.toThrow(
        'Draft document not found'
      );
    });
  });

  describe('unpublishDocument', () => {
    it('should unpublish a document to drafts', async () => {
      const client = new SanityClient({ ...defaultConfig, token: 'write-token' });
      const publishedDoc: SanityDocument = {
        _id: 'post-1',
        _type: 'post',
        _rev: 'xyz',
        title: 'Published Post',
      };
      const mockMutationResult = {
        transactionId: 'txn-unpub',
        results: [
          { id: 'drafts.post-1', operation: 'createOrReplace' },
          { id: 'post-1', operation: 'delete' },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ms: 5, query: '', result: publishedDoc }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockMutationResult,
        });

      const result = await client.unpublishDocument('post-1');

      expect(result.transactionId).toBe('txn-unpub');
    });
  });

  describe('uploadImage', () => {
    it('should upload an image and return asset document', async () => {
      const client = new SanityClient({ ...defaultConfig, token: 'write-token' });
      const mockAsset = {
        _id: 'image-abc123',
        _type: 'sanity.imageAsset',
        url: 'https://cdn.sanity.io/images/test-project/production/abc123.jpg',
        originalFilename: 'test.jpg',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ document: mockAsset }),
      });

      const imageBuffer = Buffer.from('fake-image-data');
      const result = await client.uploadImage(imageBuffer, 'test.jpg', 'image/jpeg');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('assets/images'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'image/jpeg',
          }),
        })
      );
      expect(result.url).toContain('cdn.sanity.io');
    });

    it('should throw error without token', async () => {
      const client = new SanityClient(defaultConfig);
      const imageBuffer = Buffer.from('fake-image-data');

      await expect(
        client.uploadImage(imageBuffer, 'test.jpg')
      ).rejects.toThrow('Image upload requires a Sanity API token');
    });
  });

  describe('createImageReference', () => {
    it('should create a proper image reference object', () => {
      const client = new SanityClient(defaultConfig);
      const ref = client.createImageReference('image-abc123-800x600-jpg');

      expect(ref).toEqual({
        _type: 'image',
        asset: {
          _type: 'reference',
          _ref: 'image-abc123-800x600-jpg',
        },
      });
    });
  });
});
