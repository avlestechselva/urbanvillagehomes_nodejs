#!/usr/bin/env node
/**
 * Import posts from SQL dump to MongoDB
 * Uses Python to extract posts (handles smart quotes in SQL), then imports via Mongoose
 */
const { execSync } = require('child_process');
const path = require('path');
const { MongoClient } = require('mongodb');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;

async function main() {
    // Extract posts via Python script
    console.log('Extracting posts from SQL...');
    const json = execSync('python3 ' + path.join(__dirname, 'import_posts.py'), { maxBuffer: 50 * 1024 * 1024 }).toString();
    const posts = JSON.parse(json);
    console.log(`Extracted ${posts.length} posts`);

    const client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();

    // Drop slug index so we can insert posts with null slugs
    try { await db.collection('posts').dropIndex('slug_1'); } catch(e) {}

    await db.collection('posts').deleteMany({});

    // Map SQL fields to what the app expects
    const docs = posts.map(p => ({
        sql_id:           p.id,
        title:            p.title || '',
        slug:             p.slug || null,
        excerpt:          p.excerpt || '',
        body:             p.body || '',
        image:            p.image || null,
        status:           p.status === 'PUBLISHED' ? 'PUBLISHED' : (p.status === 'DRAFT' ? 'DRAFT' : 'DRAFT'),
        featured:         p.featured === 1,
        meta_description: p.meta_description || '',
        meta_keywords:    p.meta_keywords || '',
        seo_title:        p.seo_title || '',
        category_id:      p.category_id,  // keep raw for reference
        author_id:        p.author_id,
        createdAt:        p.created_at ? new Date(p.created_at) : new Date(),
        updatedAt:        p.updated_at ? new Date(p.updated_at) : new Date(),
    }));

    const result = await db.collection('posts').insertMany(docs, { ordered: false });
    console.log(`Inserted ${result.insertedCount} posts`);

    // Show summary
    const published = await db.collection('posts').countDocuments({ status: 'PUBLISHED' });
    console.log(`Published: ${published}, Total: ${docs.length}`);

    // Recreate sparse unique index
    await db.collection('posts').createIndex({ slug: 1 }, { unique: true, sparse: true });

    await client.close();
    console.log('Done!');
}

main().catch(err => { console.error(err.message); process.exit(1); });
