/**
 * Import missing posts from bh_uvh_data_latest.sql into MongoDB
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { execSync } = require('child_process');
const path = require('path');
const Post = require('../src/models/Post');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const existing = await Post.find({}, 'sql_id title').lean();
    const existingIds = new Set(existing.map(p => p.sql_id).filter(Boolean));
    const existingTitles = new Set(existing.map(p => p.title));
    console.log(`Existing posts in DB: ${existing.length}`);

    const pyPath = path.join(__dirname, 'extract_new_posts.py');
    const raw = execSync(`python3 ${pyPath}`, { maxBuffer: 50 * 1024 * 1024 });
    const allPosts = JSON.parse(raw.toString());
    console.log(`Total posts in SQL: ${allPosts.length}`);

    const newPosts = allPosts.filter(p =>
        !existingIds.has(p.id) && !existingTitles.has(p.title)
    );
    console.log(`New posts to import: ${newPosts.length}`);

    let imported = 0;
    for (const p of newPosts) {
        const slug = p.slug || (p.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const status = p.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
        const createdAt = p.created_at && !isNaN(new Date(p.created_at)) ? new Date(p.created_at) : new Date();
        const updatedAt = p.updated_at && !isNaN(new Date(p.updated_at)) ? new Date(p.updated_at) : createdAt;
        const image = p.image ? (p.image.startsWith('posts/') ? p.image : `posts/${p.image}`) : null;

        try {
            await Post.create({
                sql_id:           p.id,
                title:            p.title,
                seo_title:        p.seo_title,
                excerpt:          p.excerpt,
                body:             p.body,
                image,
                slug,
                meta_description: p.meta_description,
                meta_keywords:    p.meta_keywords,
                status,
                featured:         p.featured == 1,
                createdAt,
                updatedAt,
            });
            console.log(`  ✓ [${p.id}] ${(p.title || '').slice(0, 60)}`);
            imported++;
        } catch (err) {
            console.error(`  ✗ [${p.id}] ${p.title}: ${err.message}`);
        }
    }

    console.log(`\nDone. Imported ${imported}/${newPosts.length} new posts.`);
    await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
