#!/usr/bin/env node
/**
 * Purple Horizons Blog Helper
 * Easily create, update, and manage blog posts via CLI
 */

require('dotenv').config();
const { SanityClient } = require('../dist/sanity-client.js');

const client = new SanityClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  apiVersion: process.env.SANITY_API_VERSION,
  token: process.env.SANITY_TOKEN,
});

// Known IDs
const AUTHORS = {
  gianni: '2e9b03d3-400f-4ec3-9445-8d7609c409c0',
  ralph: 'f9e46048-3c9e-4ce4-a201-34ccae1bf4bb',
  luca: 'c9f44a16-fa3b-4db7-a9d1-7974c8094311',
};

const CATEGORIES = {
  'ai-automation': '04d11299-7361-4598-bc62-167123c6024e',
  'tech-futures': '3468816c-eba4-4d15-8bca-5eb2b46ef4b9',
  'ai-marketing': '6d221319-4d0f-479f-b497-f0edcc9a75ae',
  'prototyping': '783267bc-afb8-4c3b-beb9-0d5622215cd1',
  'events': '784bfd89-252b-4d20-b2f1-28d9ecface98',
  'content-innovation': 'b86cbad3-6eea-4af6-9c7a-d0a77d607a5e',
  'retail': 'fc77287b-c6b0-4b5f-be72-e6eb4178036d',
  'miami-mvps': '0NqVaDNEKv8LV2QKKSkR9J',
  'miami-calendars': '0NqVaDNEKv8LV2QKKSuwCJ',
};

/**
 * Generate a URL-friendly slug from a title
 */
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate a random key for Sanity arrays
 */
function randomKey() {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Create a blog post
 */
async function createPost({
  title,
  slug,
  excerpt,
  htmlContent,
  author = 'gianni',
  categories = ['ai-automation'],
  publishedAt = new Date().toISOString(),
}) {
  const postSlug = slug || slugify(title);
  
  const document = {
    _type: 'post',
    title,
    slug: { _type: 'slug', current: postSlug },
    excerpt,
    body: [
      {
        _key: randomKey(),
        _type: 'htmlContent',
        html: htmlContent,
      },
    ],
    author: {
      _type: 'reference',
      _ref: AUTHORS[author] || AUTHORS.gianni,
    },
    categories: categories.map((cat) => ({
      _key: randomKey(),
      _type: 'reference',
      _ref: CATEGORIES[cat] || cat,
    })),
    publishedAt,
  };

  const result = await client.createDocument(document);
  console.log('✅ Post created!');
  console.log('Transaction:', result.transactionId);
  console.log('URL: https://purplehorizons.io/blog/' + postSlug);
  return result;
}

/**
 * List recent posts
 */
async function listPosts(limit = 10) {
  const posts = await client.getDocumentsByType('post', { limit });
  console.log(`\n📝 Recent ${posts.length} posts:\n`);
  posts.forEach((p, i) => {
    console.log(`${i + 1}. ${p.title}`);
    console.log(`   Slug: ${p.slug?.current}`);
    console.log(`   Published: ${p.publishedAt?.split('T')[0] || 'draft'}`);
    console.log('');
  });
  return posts;
}

/**
 * Get a post by slug
 */
async function getPostBySlug(slug) {
  const result = await client.query(
    `*[_type == "post" && slug.current == $slug][0]`,
    { slug }
  );
  return result.result;
}

/**
 * Update a post
 */
async function updatePost(id, updates) {
  const result = await client.patchDocument(id, { set: updates });
  console.log('✅ Post updated!');
  return result;
}

/**
 * Delete a post
 */
async function deletePost(id) {
  const result = await client.deleteDocument(id);
  console.log('✅ Post deleted!');
  return result;
}

// Export for programmatic use
module.exports = {
  client,
  AUTHORS,
  CATEGORIES,
  createPost,
  listPosts,
  getPostBySlug,
  updatePost,
  deletePost,
  slugify,
};

// CLI interface
if (require.main === module) {
  const [,, command, ...args] = process.argv;

  const commands = {
    list: async () => {
      const limit = parseInt(args[0]) || 10;
      await listPosts(limit);
    },
    get: async () => {
      const slug = args[0];
      if (!slug) {
        console.log('Usage: blog-helper.js get <slug>');
        return;
      }
      const post = await getPostBySlug(slug);
      if (post) {
        console.log(JSON.stringify(post, null, 2));
      } else {
        console.log('Post not found');
      }
    },
    authors: async () => {
      console.log('\n👤 Authors:\n');
      Object.entries(AUTHORS).forEach(([key, id]) => {
        console.log(`  ${key}: ${id}`);
      });
    },
    categories: async () => {
      console.log('\n📁 Categories:\n');
      Object.entries(CATEGORIES).forEach(([key, id]) => {
        console.log(`  ${key}: ${id}`);
      });
    },
    help: async () => {
      console.log(`
Purple Horizons Blog Helper

Commands:
  list [n]        List recent n posts (default: 10)
  get <slug>      Get a post by slug
  authors         Show available authors
  categories      Show available categories
  help            Show this help

Programmatic Usage:
  const { createPost, listPosts } = require('./blog-helper.js');
  
  await createPost({
    title: 'My Post Title',
    excerpt: 'Short description...',
    htmlContent: '<p>Full HTML content...</p>',
    author: 'gianni',
    categories: ['ai-automation', 'tech-futures'],
  });
`);
    },
  };

  const fn = commands[command] || commands.help;
  Promise.resolve(fn()).catch(console.error);
}
