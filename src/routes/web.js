const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const page    = require('../controllers/pageController');
const blog    = require('../controllers/blogController');
const admin   = require('../controllers/adminController');
const jupix   = require('../jobs/jupixRetrieve');
const Post    = require('../models/Post');

const upload        = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const uploadMag     = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const uploadAny     = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Sitemap
router.get('/sitemap.xml', async (req, res) => {
    const base = 'https://www.urbanvillagehomes.com';
    const today = new Date().toISOString().split('T')[0];

    const staticUrls = [
        { loc: '/',                          priority: '1.0', changefreq: 'daily' },
        { loc: '/property/buyers',           priority: '0.9', changefreq: 'daily' },
        { loc: '/property/tenants',          priority: '0.9', changefreq: 'daily' },
        { loc: '/book-a-valuation',          priority: '0.9', changefreq: 'monthly' },
        { loc: '/new-aboutus',               priority: '0.8', changefreq: 'monthly' },
        { loc: '/meet-the-team',             priority: '0.7', changefreq: 'monthly' },
        { loc: '/sellers',                   priority: '0.8', changefreq: 'monthly' },
        { loc: '/landlords',                 priority: '0.8', changefreq: 'monthly' },
        { loc: '/contact',                   priority: '0.7', changefreq: 'monthly' },
        { loc: '/blog',                      priority: '0.8', changefreq: 'weekly' },
        { loc: '/areas',                     priority: '0.7', changefreq: 'monthly' },
        { loc: '/camberwell',                priority: '0.8', changefreq: 'monthly' },
        { loc: '/brixton',                   priority: '0.8', changefreq: 'monthly' },
        { loc: '/herne-hill',                priority: '0.8', changefreq: 'monthly' },
        { loc: '/denmark-hill',              priority: '0.8', changefreq: 'monthly' },
        { loc: '/dulwich',                   priority: '0.8', changefreq: 'monthly' },
        { loc: '/peckham',                   priority: '0.8', changefreq: 'monthly' },
        { loc: '/stockwell',                 priority: '0.8', changefreq: 'monthly' },
        { loc: '/waterloo',                  priority: '0.8', changefreq: 'monthly' },
        { loc: '/loughborough-junction',     priority: '0.8', changefreq: 'monthly' },
        { loc: '/free-home-staging-consultation', priority: '0.6', changefreq: 'monthly' },
        { loc: '/mortgage-calculator',       priority: '0.6', changefreq: 'monthly' },
        { loc: '/stamp-duty-calculator',     priority: '0.6', changefreq: 'monthly' },
        { loc: '/market-updates',            priority: '0.7', changefreq: 'weekly' },
        { loc: '/privacy-policy',            priority: '0.3', changefreq: 'yearly' },
        { loc: '/terms-and-condition',       priority: '0.3', changefreq: 'yearly' },
        { loc: '/cookie-policy',             priority: '0.3', changefreq: 'yearly' },
        { loc: '/complaints-procedure',      priority: '0.3', changefreq: 'yearly' },
        { loc: '/full-scale-charges',        priority: '0.4', changefreq: 'yearly' },
        { loc: '/vacancies',                 priority: '0.4', changefreq: 'monthly' },
    ];

    const posts = await Post.find({ status: 'PUBLISHED' }).select('slug updatedAt').lean();

    const urlTags = [
        ...staticUrls.map(u => `
  <url>
    <loc>${base}${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`),
        ...posts.map(p => `
  <url>
    <loc>${base}/blog/view/${p.slug}</loc>
    <lastmod>${p.updatedAt ? new Date(p.updatedAt).toISOString().split('T')[0] : today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`),
    ].join('');

    res.setHeader('Content-Type', 'application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlTags}
</urlset>`);
});

// Sitemap index (alias)
router.get('/sitemap_index.xml', (req, res) => {
    res.setHeader('Content-Type', 'application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://www.urbanvillagehomes.com/sitemap.xml</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </sitemap>
</sitemapindex>`);
});

// Homepage
router.get('/', page.showHome);

// Properties
router.get('/property/:url_type',           page.showProperties);
router.get('/property/:property_id/:slug',  page.getSingleProperty);
router.get('/more_details.php',             page.getSinglePropertyJupix);
router.get('/listings',                     page.showProperties);
router.get('/properties_view',              page.showProperties);

// Blog
router.get('/blog',              blog.showAll);
router.get('/blog/:slug',        blog.showCategory);
router.get('/blog/view/:slug',   blog.showSingle);

// Market updates
router.get('/market-updates',        page.showMarketUpdates);
router.get('/market-updates/:slug',  page.showMarketUpdatesView);

// Life magazines
router.get('/life-magazines', page.showLifeMagazines);

// Area pages
router.get('/areas',                    page.showAreas);
router.get('/herne-hill',               page.showHerneHill);
router.get('/brixton',                  page.showBrixton);
router.get('/peckham',                  page.showPeckham);
router.get('/dulwich',                  page.showDulwich);
router.get('/loughborough-junction',    page.showLoughborough);
router.get('/camberwell',               page.showCamberwell);
router.get('/denmark-hill',             page.showDenmarkHill);
router.get('/stockwell',                page.showStockwell);
router.get('/waterloo',                 page.showWaterloo);

// About & Company
router.get('/about',            page.showAbout);
router.get('/new-aboutus',      page.showNewAboutUs);
router.get('/new_aboutus_view', page.showNewAboutUs);
router.get('/who-we-are',       page.showWhoWeAre);
router.get('/meet-the-team',    page.showMeetTheTeam);

// Services
router.get('/sellers',      page.showSellers);
router.get('/landlords',    page.showLandlords);

// Contact
router.get('/contact',              page.showContact);
router.post('/send-contact-request', page.sendContactRequest);

// Valuations
router.get('/book-a-valuation',          page.showBookValuation);
router.get('/valuation-request',         page.showValuationRequest);
router.post('/send-valuation-request',   page.sendValuationRequest);
router.post('/property-valuation-submit', page.sendValuationRequest);

// Home staging
router.get('/free-home-staging-consultation',               page.showHomeStaging);
router.get('/home-staging-consultation-request',            page.showHomeStagingRequest);
router.post('/send-home-staging-consultation-request',      page.sendHomeStagingRequest);

// Class list
router.get('/class-list',               page.showClassList);
router.post('/send-class-list-request', page.sendClassListRequest);

// Calculators
router.get('/mortgage-calculator',   page.showMortgageCalc);
router.get('/stamp-duty-calculator', page.showStampDutyCalc);
router.get('/calculate-stamp-duty',  page.ajaxStampDuty);
router.post('/calculate-stamp-duty', page.ajaxStampDuty);

// Legal pages
router.get('/terms-and-condition',      page.showTerms);
router.get('/privacy-policy',           page.showPrivacy);
router.get('/cookie-policy',            page.showCookiePolicy);
router.get('/complaints-procedure',     page.showComplaints);

// Misc
router.get('/ebook',              page.showEbook);
router.get('/vacancies',          page.showVacancies);
router.get('/full-scale-charges', page.showFullCharges);

// Thank you
router.get('/thankyoucontact',    page.showThankyouContact);
router.get('/thankyouvaluation',  page.showThankyouValuation);

// File viewer
router.get('/view-resource/:file', page.viewResource);

// Back office — auth
router.get('/uvh-back-office',                              admin.loginPage);
router.post('/uvh-back-office',                             admin.loginPost, (req, res) => res.redirect('/uvh-back-office/posts'));
router.get('/uvh-back-office/logout',                       admin.logout);

// Posts
router.get('/uvh-back-office/posts',                        ...admin.dashboard);
router.get('/uvh-back-office/posts/new',                    ...admin.newPost);
router.post('/uvh-back-office/posts/new',                   upload.single('image'), ...admin.createPost);
router.get('/uvh-back-office/posts/:id/edit',               ...admin.editPost);
router.post('/uvh-back-office/posts/:id/edit',              upload.single('image'), ...admin.updatePost);
router.post('/uvh-back-office/posts/:id/delete',            ...admin.deletePost);

// Categories
router.get('/uvh-back-office/categories',                   ...admin.categoriesList);
router.get('/uvh-back-office/categories/new',               ...admin.newCategory);
router.post('/uvh-back-office/categories/new',              ...admin.createCategory);
router.get('/uvh-back-office/categories/:id/edit',          ...admin.editCategory);
router.post('/uvh-back-office/categories/:id/edit',         ...admin.updateCategory);
router.post('/uvh-back-office/categories/:id/delete',       ...admin.deleteCategory);

// Pages
router.get('/uvh-back-office/pages',                        ...admin.pagesList);
router.get('/uvh-back-office/pages/new',                    ...admin.newPage);
router.post('/uvh-back-office/pages/new',                   upload.single('image'), ...admin.createPage);
router.get('/uvh-back-office/pages/:id/edit',               ...admin.editPage);
router.post('/uvh-back-office/pages/:id/edit',              upload.single('image'), ...admin.updatePage);
router.post('/uvh-back-office/pages/:id/delete',            ...admin.deletePage);

// Life Magazines
router.get('/uvh-back-office/magazines',                    ...admin.magazinesList);
router.get('/uvh-back-office/magazines/new',                ...admin.newMagazine);
router.post('/uvh-back-office/magazines/new',               uploadMag.fields([{name:'image',maxCount:1},{name:'pdf',maxCount:1}]), ...admin.createMagazine);
router.get('/uvh-back-office/magazines/:id/edit',           ...admin.editMagazine);
router.post('/uvh-back-office/magazines/:id/edit',          uploadMag.fields([{name:'image',maxCount:1},{name:'pdf',maxCount:1}]), ...admin.updateMagazine);
router.post('/uvh-back-office/magazines/:id/delete',        ...admin.deleteMagazine);

// Settings
router.get('/uvh-back-office/settings',                     ...admin.settingsPage);
router.post('/uvh-back-office/settings',                    uploadAny.any(), ...admin.updateSettings);

// Menus
router.get('/uvh-back-office/menus',                        ...admin.menusList);
router.get('/uvh-back-office/menus/new',                    ...admin.newMenu);
router.post('/uvh-back-office/menus/new',                   ...admin.createMenu);
router.get('/uvh-back-office/menus/:id/edit',               ...admin.editMenu);
router.post('/uvh-back-office/menus/:id/edit',              ...admin.updateMenu);
router.post('/uvh-back-office/menus/:id/delete',            ...admin.deleteMenu);

// Users
router.get('/uvh-back-office/users',                        ...admin.usersList);
router.get('/uvh-back-office/users/new',                    ...admin.newUser);
router.post('/uvh-back-office/users/new',                   ...admin.createUser);
router.get('/uvh-back-office/users/:id/edit',               ...admin.editUser);
router.post('/uvh-back-office/users/:id/edit',              ...admin.updateUser);
router.post('/uvh-back-office/users/:id/delete',            ...admin.deleteUser);

// Jupix retrieve (external cron trigger — protected by secret)
router.get('/retrieve', async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.query.secret !== secret) {
        return res.status(401).send('Unauthorized');
    }

    const html = req.query.html === '1';

    if (html) {
        // Full progress UI — only when opened in a browser manually
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.write(`<!DOCTYPE html><html><head><title>Jupix Retrieve</title>
<style>body{font-family:monospace;background:#111;color:#0f0;padding:20px;font-size:14px;}
.summary{background:#222;border:1px solid #0f0;padding:20px;margin-top:20px;border-radius:6px;}
.summary h2{color:#ff0;margin:0 0 12px;}
.stat{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #333;}
.stat span:last-child{color:#ff0;font-weight:bold;}
.done{color:#ff0;font-size:18px;margin-top:20px;}
.error{color:#f00;}
</style></head><body>
<h2 style="color:#0f0">Jupix Retrieve Running...</h2>
<pre id="log">`);
        try {
            const stats = await jupix.run(msg => res.write(msg + '\n'));
            if (stats.error) {
                res.write(`</pre><p class="error">Error: ${stats.error}</p>`);
            } else {
                res.write(`</pre><div class="summary"><h2>Retrieve Complete</h2>
  <div class="stat"><span>Fetched</span><span>${stats.fetched}</span></div>
  <div class="stat"><span>Updated</span><span>${stats.updated}</span></div>
  <div class="stat"><span>Images</span><span>${stats.images}</span></div>
  <div class="stat"><span>Floorplans</span><span>${stats.floorplans}</span></div>
  <div class="stat"><span>Brochures</span><span>${stats.brochures}</span></div>
  <div class="stat"><span>Deleted</span><span>${stats.deleted}</span></div>
  <div class="stat"><span>Errors</span><span>${stats.errors}</span></div>
</div><p class="done">Done! <a href="/" style="color:#0af">Go to site</a></p>`);
            }
        } catch (err) {
            res.write(`</pre><p class="error">Fatal: ${err.message}</p>`);
        }
        res.write('</body></html>');
        res.end();
    } else {
        // Minimal JSON response for cron-job.org — no wasted data transfer
        try {
            const stats = await jupix.run(null);
            res.json({ ok: true, ...stats });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    }
});

module.exports = router;
