const Post      = require('../models/Post');
const Category  = require('../models/Category');
const cloudinary = require('../config/cloudinary');
const slugify   = require('slugify');

function adminAuth(req, res, next) {
    const pw = process.env.ADMIN_PASSWORD || 'admin123';
    if (req.session && req.session.adminAuthed) return next();
    if (req.method === 'POST' && req.body && req.body.password === pw) {
        req.session.adminAuthed = true;
        return next();
    }
    res.render('admin/login', { error: req.method === 'POST' ? 'Wrong password' : null });
}

exports.loginPage  = (req, res) => res.render('admin/login', { error: null });
exports.loginPost  = adminAuth;
exports.logout     = (req, res) => { req.session.destroy(); res.redirect('/admin'); };

exports.dashboard = [adminAuth, async (req, res) => {
    const posts = await Post.find().sort({ createdAt: -1 }).limit(50);
    res.render('admin/dashboard', { posts });
}];

exports.newPost = [adminAuth, async (req, res) => {
    const categories = await Category.find().sort({ name: 1 });
    res.render('admin/post_form', { post: null, categories, error: null });
}];

exports.createPost = [adminAuth, async (req, res) => {
    try {
        const { title, excerpt, body, status, featured, meta_description, meta_keywords, seo_title, category } = req.body;
        const slug = slugify(title, { lower: true, strict: true });

        let image = null;
        if (req.file) {
            const result = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'posts', resource_type: 'image' },
                    (err, res) => err ? reject(err) : resolve(res)
                );
                stream.end(req.file.buffer);
            });
            image = result.secure_url;
        }

        await Post.create({
            title, slug, excerpt, body, image, status,
            featured: featured === 'on',
            meta_description, meta_keywords, seo_title,
            category: category || undefined,
        });

        res.redirect('/admin/posts');
    } catch (err) {
        const categories = await Category.find().sort({ name: 1 });
        res.render('admin/post_form', { post: null, categories, error: err.message });
    }
}];

exports.editPost = [adminAuth, async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).send('Not found');
    const categories = await Category.find().sort({ name: 1 });
    res.render('admin/post_form', { post, categories, error: null });
}];

exports.updatePost = [adminAuth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).send('Not found');

        const { title, excerpt, body, status, featured, meta_description, meta_keywords, seo_title, category } = req.body;

        post.title            = title;
        post.slug             = slugify(title, { lower: true, strict: true });
        post.excerpt          = excerpt;
        post.body             = body;
        post.status           = status;
        post.featured         = featured === 'on';
        post.meta_description = meta_description;
        post.meta_keywords    = meta_keywords;
        post.seo_title        = seo_title;
        post.category         = category || undefined;

        if (req.file) {
            const result = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'posts', resource_type: 'image' },
                    (err, res) => err ? reject(err) : resolve(res)
                );
                stream.end(req.file.buffer);
            });
            post.image = result.secure_url;
        }

        await post.save();
        res.redirect('/admin/posts');
    } catch (err) {
        const categories = await Category.find().sort({ name: 1 });
        res.render('admin/post_form', { post: await Post.findById(req.params.id), categories, error: err.message });
    }
}];
