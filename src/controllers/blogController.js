const Post     = require('../models/Post');
const Category = require('../models/Category');

const STORAGE_BASE = 'https://www.urbanvillagehomes.com/storage';

function resolvePostImage(post) {
    const p = post.toObject ? post.toObject() : { ...post };
    if (p.image && !p.image.startsWith('http')) {
        p.image = `${STORAGE_BASE}/${p.image}`;
    }
    return p;
}

exports.showAll = async (req, res) => {
    try {
        const page    = Number(req.query.page) || 1;
        const perPage = 12;
        const total   = await Post.countDocuments({ status: 'PUBLISHED' });
        const postsRaw = await Post.find({ status: 'PUBLISHED' })
            .sort({ createdAt: -1 })
            .skip((page - 1) * perPage)
            .limit(perPage)
            .populate('category');
        const posts = postsRaw.map(resolvePostImage);

        const categories = await Category.find({ order: { $lt: 999 } }).sort({ createdAt: -1 });

        res.render('pages/blog', {
            page_title: 'Blog Posts',
            posts, categories,
            pagination: { total, perPage, page, lastPage: Math.ceil(total / perPage) },
            css_files: ['blog'], js_files: ['blog'],
            tag: null,
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('errors/500');
    }
};

exports.showCategory = async (req, res) => {
    try {
        const category = await Category.findOne({ slug: req.params.slug });
        if (!category) return res.status(404).render('errors/404');

        const page    = Number(req.query.page) || 1;
        const perPage = 5;
        const total   = await Post.countDocuments({ status: 'PUBLISHED', category: category._id });
        const postsRaw = await Post.find({ status: 'PUBLISHED', category: category._id })
            .sort({ createdAt: -1 })
            .skip((page - 1) * perPage)
            .limit(perPage)
            .populate('category');
        const posts = postsRaw.map(resolvePostImage);

        const categories = await Category.find({ order: { $lt: 999 } }).sort({ createdAt: -1 });

        res.render('pages/blog', {
            page_title: 'Blog Posts',
            posts, categories, tag: req.params.slug,
            pagination: { total, perPage, page, lastPage: Math.ceil(total / perPage) },
            css_files: ['blog'], js_files: ['blog'],
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('errors/500');
    }
};

exports.showSingle = async (req, res) => {
    try {
        const postRaw = await Post.findOne({ status: 'PUBLISHED', slug: req.params.slug })
            .populate('category');
        if (!postRaw) return res.status(404).render('errors/404');
        const post = resolvePostImage(postRaw);

        const categories = await Category.find({ order: { $lt: 999 } }).sort({ createdAt: -1 });

        res.render('pages/blog_view', {
            page_title:       post.title,
            post, categories,
            meta_keywords:    post.meta_keywords,
            meta_description: post.meta_description,
            css_files: ['blog'], js_files: ['blog'],
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('errors/500');
    }
};
