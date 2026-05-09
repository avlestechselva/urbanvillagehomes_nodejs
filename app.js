require('dotenv').config();
const express      = require('express');
const path         = require('path');
const session      = require('express-session');
const MongoStore   = require('connect-mongo');
const flash        = require('connect-flash');
const { CronJob }  = require('cron');
const connectDB    = require('./src/config/database');
const webRoutes    = require('./src/routes/web');
const jupixJob     = require('./src/jobs/jupixRetrieve');

const app = express();

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

// Jupix cron — every 3 hours (same as original: 0 */3 * * *)
const jupixCron = new CronJob('0 */3 * * *', () => {
    console.log('[Cron] Running Jupix retrieve...');
    jupixJob.run();
}, null, true);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Urban Village Homes running on port ${PORT}`);
});

module.exports = app;
