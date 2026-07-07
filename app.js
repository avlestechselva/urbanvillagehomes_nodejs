require('dotenv').config();
const express      = require('express');
const compression  = require('compression');
const path         = require('path');
const session      = require('express-session');
const MongoStore   = require('connect-mongo');
const flash        = require('connect-flash');
const connectDB    = require('./src/config/database');
const webRoutes    = require('./src/routes/web');

const app = express();

// Gzip compression — reduces HTML/JSON/CSS response sizes by ~60-80%
app.use(compression());

// Connect MongoDB
connectDB();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files (copy from original public/ folder)
app.use(express.static(path.join(__dirname, 'public')));
// Storage for property images
app.use('/storage', express.static(path.join(__dirname, 'storage/app/public')));

// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'uvh-secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
}));

// Flash messages
app.use(flash());

// Global template variables
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error   = req.flash('error');
    res.locals.appName = process.env.APP_NAME || 'Urban Village Homes';
    res.locals.appUrl  = process.env.APP_URL  || '';
    next();
});

// Cache-Control middleware — tells Vercel CDN to cache HTML responses
// so repeat visits serve from edge cache, not the function
app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    const path = req.path;
    // Never cache form submissions, retrieve endpoint, or dynamic POST routes
    if (path.startsWith('/retrieve') || path.startsWith('/send-') || path.startsWith('/uvh-back-office') || path.startsWith('/property-valuation-submit')) {
        res.setHeader('Cache-Control', 'no-store');
    // Single property detail page: short cache — price/status changes must show quickly
    } else if (/^\/property\/[^/]+\/[^/]+/.test(path)) {
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    // Property listing pages: cache 1 hour
    } else if (path.startsWith('/property') || path.startsWith('/listings') || path.startsWith('/properties_view')) {
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
    // Blog: cache 1 hour
    } else if (path.startsWith('/blog') || path.startsWith('/market-updates') || path.startsWith('/life-magazines')) {
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
    // Static/rarely-changing pages: cache 1 day
    } else if (['/about', '/who-we-are', '/meet-the-team', '/sellers', '/landlords',
                '/contact', '/areas', '/herne-hill', '/brixton', '/peckham',
                '/dulwich', '/loughborough-junction', '/camberwell', '/denmark-hill',
                '/stockwell', '/waterloo', '/terms-and-condition', '/privacy-policy',
                '/cookie-policy', '/complaints-procedure', '/vacancies',
                '/full-scale-charges', '/ebook', '/mortgage-calculator',
                '/stamp-duty-calculator'].includes(path)) {
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
    // Homepage: cache 1 hour
    } else if (path === '/') {
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
    }
    next();
});

// Routes
app.use('/', webRoutes);

// 404
app.use((req, res) => {
    res.status(404).render('errors/404');
});

// 500
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('errors/500');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Urban Village Homes running on port ${PORT}`);
});

module.exports = app;
