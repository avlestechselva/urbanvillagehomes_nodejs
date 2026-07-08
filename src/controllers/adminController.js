const Post        = require('../models/Post');
const Category    = require('../models/Category');
const Page        = require('../models/Page');
const Setting     = require('../models/Setting');
const Menu        = require('../models/Menu');
const User        = require('../models/User');
const { LifeMagazine } = require('../models/Lookups');
const cloudinary  = require('../config/cloudinary');
const slugify     = require('slugify');
const bcrypt      = require('bcryptjs');

// ─── Auth ─────────────────────────────────────────────────────────────────────

function adminAuth(req, res, next) {
    if (req.session && req.session.adminAuthed) return next();
    const pw = process.env.ADMIN_PASSWORD || 'admin123';
    if (req.method === 'POST' && req.body && req.body.password === pw) {
        req.session.adminAuthed = true;
        return next();
    }
    res.render('admin/login', { error: req.method === 'POST' ? 'Wrong password' : null });
}

exports.loginPage = (req, res) => res.render('admin/login', { error: null });
exports.loginPost = adminAuth;
exports.logout    = (req, res) => { req.session.destroy(); res.redirect('/uvh-back-office'); };

// ─── Cloudinary upload helper ─────────────────────────────────────────────────

async function uploadToCloudinary(buffer, opts) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(opts, (err, result) =>
            err ? reject(err) : resolve(result));
        stream.end(buffer);
    });
}

// ─── Posts ────────────────────────────────────────────────────────────────────

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
            const result = await uploadToCloudinary(req.file.buffer, { folder: 'posts', resource_type: 'image' });
            image = result.secure_url;
        }

        await Post.create({
            title, slug, excerpt, body, image, status,
            featured: featured === 'on',
            meta_description, meta_keywords, seo_title,
            category: category || undefined,
        });

        res.redirect('/uvh-back-office/posts');
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
            const result = await uploadToCloudinary(req.file.buffer, { folder: 'posts', resource_type: 'image' });
            post.image = result.secure_url;
        }

        await post.save();
        res.redirect('/uvh-back-office/posts');
    } catch (err) {
        const categories = await Category.find().sort({ name: 1 });
        res.render('admin/post_form', { post: await Post.findById(req.params.id), categories, error: err.message });
    }
}];

exports.deletePost = [adminAuth, async (req, res) => {
    await Post.findByIdAndDelete(req.params.id);
    res.redirect('/uvh-back-office/posts');
}];

// ─── Categories ───────────────────────────────────────────────────────────────

exports.categoriesList = [adminAuth, async (req, res) => {
    const categories = await Category.find().sort({ name: 1 }).populate('parent', 'name');
    res.render('admin/categories', { categories, error: null, saved: false });
}];

exports.newCategory = [adminAuth, async (req, res) => {
    const parents = await Category.find().sort({ name: 1 });
    res.render('admin/category_form', { category: null, parents, error: null });
}];

exports.createCategory = [adminAuth, async (req, res) => {
    try {
        const { name, parent, order } = req.body;
        const slug = slugify(name, { lower: true, strict: true });
        await Category.create({ name, slug, parent: parent || null, order: order || 0 });
        res.redirect('/uvh-back-office/categories');
    } catch (err) {
        const parents = await Category.find().sort({ name: 1 });
        res.render('admin/category_form', { category: null, parents, error: err.message });
    }
}];

exports.editCategory = [adminAuth, async (req, res) => {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).send('Not found');
    const parents = await Category.find({ _id: { $ne: req.params.id } }).sort({ name: 1 });
    res.render('admin/category_form', { category, parents, error: null });
}];

exports.updateCategory = [adminAuth, async (req, res) => {
    try {
        const { name, parent, order } = req.body;
        const slug = slugify(name, { lower: true, strict: true });
        await Category.findByIdAndUpdate(req.params.id, { name, slug, parent: parent || null, order: order || 0 });
        res.redirect('/uvh-back-office/categories');
    } catch (err) {
        const parents = await Category.find({ _id: { $ne: req.params.id } }).sort({ name: 1 });
        const category = await Category.findById(req.params.id);
        res.render('admin/category_form', { category, parents, error: err.message });
    }
}];

exports.deleteCategory = [adminAuth, async (req, res) => {
    await Category.findByIdAndDelete(req.params.id);
    res.redirect('/uvh-back-office/categories');
}];

// ─── Pages ────────────────────────────────────────────────────────────────────

exports.pagesList = [adminAuth, async (req, res) => {
    const pages = await Page.find().sort({ createdAt: -1 });
    res.render('admin/pages_list', { pages });
}];

exports.newPage = [adminAuth, async (req, res) => {
    res.render('admin/page_form', { page: null, error: null });
}];

exports.createPage = [adminAuth, async (req, res) => {
    try {
        const { title, excerpt, body, status, meta_description, meta_keywords } = req.body;
        const slug = slugify(title, { lower: true, strict: true });

        let image = null;
        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer, { folder: 'pages', resource_type: 'image' });
            image = result.secure_url;
        }

        await Page.create({ title, slug, excerpt, body, image, status, meta_description, meta_keywords });
        res.redirect('/uvh-back-office/pages');
    } catch (err) {
        res.render('admin/page_form', { page: null, error: err.message });
    }
}];

exports.editPage = [adminAuth, async (req, res) => {
    const page = await Page.findById(req.params.id);
    if (!page) return res.status(404).send('Not found');
    res.render('admin/page_form', { page, error: null });
}];

exports.updatePage = [adminAuth, async (req, res) => {
    try {
        const page = await Page.findById(req.params.id);
        if (!page) return res.status(404).send('Not found');

        const { title, excerpt, body, status, meta_description, meta_keywords } = req.body;
        page.title            = title;
        page.slug             = slugify(title, { lower: true, strict: true });
        page.excerpt          = excerpt;
        page.body             = body;
        page.status           = status;
        page.meta_description = meta_description;
        page.meta_keywords    = meta_keywords;

        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer, { folder: 'pages', resource_type: 'image' });
            page.image = result.secure_url;
        }

        await page.save();
        res.redirect('/uvh-back-office/pages');
    } catch (err) {
        res.render('admin/page_form', { page: await Page.findById(req.params.id), error: err.message });
    }
}];

exports.deletePage = [adminAuth, async (req, res) => {
    await Page.findByIdAndDelete(req.params.id);
    res.redirect('/uvh-back-office/pages');
}];

// ─── Life Magazines ───────────────────────────────────────────────────────────

exports.magazinesList = [adminAuth, async (req, res) => {
    const magazines = await LifeMagazine.find().sort({ createdAt: -1 });
    res.render('admin/magazines', { magazines });
}];

exports.newMagazine = [adminAuth, async (req, res) => {
    res.render('admin/magazine_form', { magazine: null, error: null });
}];

exports.createMagazine = [adminAuth, async (req, res) => {
    try {
        const { title, description, status } = req.body;
        const files = req.files || {};

        let image = null, pdf = null;
        if (files.image && files.image[0]) {
            const result = await uploadToCloudinary(files.image[0].buffer, { folder: 'magazines', resource_type: 'image' });
            image = result.secure_url;
        }
        if (files.pdf && files.pdf[0]) {
            const result = await uploadToCloudinary(files.pdf[0].buffer, { folder: 'magazines', resource_type: 'raw' });
            pdf = result.secure_url;
        }

        await LifeMagazine.create({ title, description, image, pdf, status: status === 'ACTIVE' ? 1 : 0 });
        res.redirect('/uvh-back-office/magazines');
    } catch (err) {
        res.render('admin/magazine_form', { magazine: null, error: err.message });
    }
}];

exports.editMagazine = [adminAuth, async (req, res) => {
    const magazine = await LifeMagazine.findById(req.params.id);
    if (!magazine) return res.status(404).send('Not found');
    res.render('admin/magazine_form', { magazine, error: null });
}];

exports.updateMagazine = [adminAuth, async (req, res) => {
    try {
        const magazine = await LifeMagazine.findById(req.params.id);
        if (!magazine) return res.status(404).send('Not found');

        const { title, description, status } = req.body;
        magazine.title       = title;
        magazine.description = description;
        magazine.status      = status === 'ACTIVE' ? 1 : 0;

        const files = req.files || {};
        if (files.image && files.image[0]) {
            const result = await uploadToCloudinary(files.image[0].buffer, { folder: 'magazines', resource_type: 'image' });
            magazine.image = result.secure_url;
        }
        if (files.pdf && files.pdf[0]) {
            const result = await uploadToCloudinary(files.pdf[0].buffer, { folder: 'magazines', resource_type: 'raw' });
            magazine.pdf = result.secure_url;
        }

        await magazine.save();
        res.redirect('/uvh-back-office/magazines');
    } catch (err) {
        res.render('admin/magazine_form', { magazine: await LifeMagazine.findById(req.params.id), error: err.message });
    }
}];

exports.deleteMagazine = [adminAuth, async (req, res) => {
    await LifeMagazine.findByIdAndDelete(req.params.id);
    res.redirect('/uvh-back-office/magazines');
}];

// ─── Settings ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = [
    { key: 'site_title',       label: 'Site Title',          type: 'text',     group: 'General',   order: 1 },
    { key: 'site_tagline',     label: 'Site Tagline',        type: 'text',     group: 'General',   order: 2 },
    { key: 'site_logo',        label: 'Site Logo',           type: 'image',    group: 'General',   order: 3 },
    { key: 'footer_text',      label: 'Footer Text',         type: 'textarea', group: 'General',   order: 4 },
    { key: 'contact_email',    label: 'Contact Email',       type: 'text',     group: 'Contact',   order: 1 },
    { key: 'contact_phone',    label: 'Contact Phone',       type: 'text',     group: 'Contact',   order: 2 },
    { key: 'contact_address',  label: 'Contact Address',     type: 'textarea', group: 'Contact',   order: 3 },
    { key: 'ga_tracking_id',   label: 'Google Analytics ID', type: 'text',     group: 'Analytics', order: 1 },
    { key: 'social_facebook',  label: 'Facebook URL',        type: 'text',     group: 'Social',    order: 1 },
    { key: 'social_instagram', label: 'Instagram URL',       type: 'text',     group: 'Social',    order: 2 },
    { key: 'social_twitter',   label: 'Twitter / X URL',     type: 'text',     group: 'Social',    order: 3 },
    { key: 'social_linkedin',  label: 'LinkedIn URL',        type: 'text',     group: 'Social',    order: 4 },
];

async function getGroupedSettings() {
    const settings = await Setting.find().sort({ group: 1, order: 1 });
    const grouped = {};
    for (const s of settings) {
        if (!grouped[s.group]) grouped[s.group] = [];
        grouped[s.group].push(s);
    }
    return grouped;
}

exports.settingsPage = [adminAuth, async (req, res) => {
    // Seed defaults that don't exist yet
    for (const s of DEFAULT_SETTINGS) {
        await Setting.findOneAndUpdate({ key: s.key }, { $setOnInsert: s }, { upsert: true });
    }
    const grouped = await getGroupedSettings();
    res.render('admin/settings', { grouped, error: null, saved: false });
}];

exports.updateSettings = [adminAuth, async (req, res) => {
    try {
        const settings = await Setting.find();
        const uploadedFiles = req.files || [];

        for (const s of settings) {
            if (s.type === 'image') {
                const file = uploadedFiles.find(f => f.fieldname === `file_${s.key}`);
                if (file) {
                    const result = await uploadToCloudinary(file.buffer, { folder: 'settings', resource_type: 'image' });
                    s.value = result.secure_url;
                    await s.save();
                }
            } else {
                const val = req.body[s.key];
                if (val !== undefined) { s.value = val; await s.save(); }
            }
        }

        const grouped = await getGroupedSettings();
        res.render('admin/settings', { grouped, error: null, saved: true });
    } catch (err) {
        const grouped = await getGroupedSettings();
        res.render('admin/settings', { grouped, error: err.message, saved: false });
    }
}];

// ─── Menus ────────────────────────────────────────────────────────────────────

exports.menusList = [adminAuth, async (req, res) => {
    const menus = await Menu.find().sort({ name: 1 });
    res.render('admin/menus', { menus });
}];

exports.newMenu = [adminAuth, async (req, res) => {
    res.render('admin/menu_form', { menu: null, error: null });
}];

exports.createMenu = [adminAuth, async (req, res) => {
    try {
        const { name } = req.body;
        const slug  = slugify(name, { lower: true, strict: true });
        const items = parseMenuItems(req.body.items);
        await Menu.create({ name, slug, items });
        res.redirect('/uvh-back-office/menus');
    } catch (err) {
        res.render('admin/menu_form', { menu: null, error: err.message });
    }
}];

exports.editMenu = [adminAuth, async (req, res) => {
    const menu = await Menu.findById(req.params.id);
    if (!menu) return res.status(404).send('Not found');
    res.render('admin/menu_form', { menu, error: null });
}];

exports.updateMenu = [adminAuth, async (req, res) => {
    try {
        const { name } = req.body;
        const slug  = slugify(name, { lower: true, strict: true });
        const items = parseMenuItems(req.body.items);
        await Menu.findByIdAndUpdate(req.params.id, { name, slug, items });
        res.redirect('/uvh-back-office/menus');
    } catch (err) {
        const menu = await Menu.findById(req.params.id);
        res.render('admin/menu_form', { menu, error: err.message });
    }
}];

exports.deleteMenu = [adminAuth, async (req, res) => {
    await Menu.findByIdAndDelete(req.params.id);
    res.redirect('/uvh-back-office/menus');
}];

function parseMenuItems(raw) {
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : Object.values(raw);
    return arr
        .filter(i => i && i.label && i.url)
        .map((i, idx) => ({
            label:  i.label.trim(),
            url:    i.url.trim(),
            target: i.target || '_self',
            order:  parseInt(i.order) || idx,
        }))
        .sort((a, b) => a.order - b.order);
}

// ─── Users ────────────────────────────────────────────────────────────────────

exports.usersList = [adminAuth, async (req, res) => {
    const users = await User.find().sort({ createdAt: -1 }).select('-password');
    res.render('admin/users', { users });
}];

exports.newUser = [adminAuth, async (req, res) => {
    res.render('admin/user_form', { user: null, error: null });
}];

exports.createUser = [adminAuth, async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');
        await User.create({ name, email, password, role });
        res.redirect('/uvh-back-office/users');
    } catch (err) {
        res.render('admin/user_form', { user: null, error: err.message });
    }
}];

exports.editUser = [adminAuth, async (req, res) => {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).send('Not found');
    res.render('admin/user_form', { user, error: null });
}];

exports.updateUser = [adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).send('Not found');

        const { name, email, role, password } = req.body;
        user.name  = name;
        user.email = email;
        user.role  = role;
        if (password && password.trim()) {
            if (password.length < 6) throw new Error('Password must be at least 6 characters');
            user.password = password; // pre-save hook hashes it
        }

        await user.save();
        res.redirect('/uvh-back-office/users');
    } catch (err) {
        const user = await User.findById(req.params.id).select('-password');
        res.render('admin/user_form', { user, error: err.message });
    }
}];

exports.deleteUser = [adminAuth, async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/uvh-back-office/users');
}];
