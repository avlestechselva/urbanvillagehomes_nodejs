const Property = require('../models/Property');
const Resource  = require('../models/Resource');
const Post      = require('../models/Post');
const { PropertyType, PropertyAvailability, ResidentialPropertyStyle, RentFrequency } = require('../models/Lookups');
const nodemailer = require('nodemailer');
const slugify = require('slugify');

// Enrich a property with lookup data
async function enrichProperty(p) {
    const prop = p.toObject ? p.toObject() : { ...p };

    // Slug
    const slugText = prop.displayAddress || prop.address2 || prop.propertyFeature1 || '';
    prop.slug = slugify(slugText, { lower: true, strict: true });

    // First image
    try {
        const imgs = typeof prop.images === 'string' ? JSON.parse(prop.images) : prop.images;
        prop.image = imgs && imgs[0] ? imgs[0].image : null;
    } catch { prop.image = null; }

    // Property type lookup
    const pt = await PropertyType.findOne({ group_id: prop.propertyType, department: prop.department });
    if (pt) prop.propertyType = pt.type;

    // Style lookup
    const ps = await ResidentialPropertyStyle.findOne({ style_id: prop.propertyStyle });
    if (ps) prop.propertyStyle = ps.style_name;

    // Availability lookup
    const pa = await PropertyAvailability.findOne({ group_id: Number(prop.availability), department: prop.department });
    if (pa) prop.availability = pa.name;

    // Rent frequency
    if (prop.rentFrequency) {
        const rf = await RentFrequency.findOne({ id: Number(prop.rentFrequency) });
        if (rf) prop.rentFrequency = rf.frequency_type;
    }

    return prop;
}

function buildPropertyQuery(req) {
    const withdrawn = [6, 7];
    // availability can be stored as number or string, exclude both forms
    const query = { status: 1, availability: { $nin: [...withdrawn, ...withdrawn.map(String)] } };

    // Search
    const search = (req.query.search || '').replace(/\+/g, ' ').trim();
    if (search) {
        const re = new RegExp(search, 'i');
        query.$or = [
            { displayAddress: re }, { addressName: re }, { address2: re },
            { address3: re }, { address4: re }, { addressPostcode: re },
            { addressStreet: re }, { addressNumber: re },
        ];
    }

    // Rent/buy filter
    if (req.query.rent == 1 && req.query.buy != 1) {
        query.rent = { $gt: 0 };
    } else if (req.query.rent != 1 && req.query.buy == 1) {
        query.price = { $gt: 0 };
    }

    // Price range
    const min = req.query.min_amount ? Number(req.query.min_amount) : null;
    const max = req.query.max_amount ? Number(req.query.max_amount) : null;
    if (min !== null || max !== null) {
        if (req.query.rent == 1 && req.query.buy != 1) {
            if (min !== null) query.rent = { ...(query.rent || {}), $gt: min };
            if (max !== null) query.rent = { ...(query.rent || {}), $lt: max };
        } else if (req.query.rent != 1 && req.query.buy == 1) {
            if (min !== null) query.price = { ...(query.price || {}), $gt: min };
            if (max !== null) query.price = { ...(query.price || {}), $lt: max };
        }
    }

    // Availability filter
    if (req.query.availability) {
        query['availability_name'] = req.query.availability;
    }

    return query;
}

exports.showHome = async (req, res) => {
    try {
        const posts = await Post.find({ status: 'PUBLISHED' })
            .sort({ createdAt: -1 })
            .limit(3);

        const query = buildPropertyQuery(req);
        const perPage = req.query.property_per_page ? Number(req.query.property_per_page) : 6;
        const page = req.query.page ? Number(req.query.page) : 1;

        const total = await Property.countDocuments(query);
        const propertiesRaw = await Property.find(query)
            .sort({ rent: -1, price: -1 })
            .skip((page - 1) * perPage)
            .limit(perPage);

        const properties = await Promise.all(propertiesRaw.map(enrichProperty));

        const pagination = {
            total, perPage, page,
            lastPage: Math.ceil(total / perPage),
        };

        res.render('pages/index', {
            page_title: 'Estate Agents and Letting Agents in Camberwell, Brixton, SE5',
            posts, properties, pagination, query: req.query,
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('errors/500');
    }
};

exports.showProperties = async (req, res) => {
    try {
        const query = buildPropertyQuery(req);
        const perPage = req.query.property_per_page ? Number(req.query.property_per_page) : 6;
        const page = req.query.page ? Number(req.query.page) : 1;

        const total = await Property.countDocuments(query);
        const propertiesRaw = await Property.find(query)
            .sort({ rent: -1, price: -1 })
            .skip((page - 1) * perPage)
            .limit(perPage);

        const properties = await Promise.all(propertiesRaw.map(enrichProperty));
        const pagination = { total, perPage, page, lastPage: Math.ceil(total / perPage) };

        const urlType = req.params.url_type || 'all';
        res.render('pages/properties_view', {
            page_title: 'Properties',
            properties, pagination, query: req.query, urlType,
            css_files: ['about'], js_files: [],
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('errors/500');
    }
};

exports.getSingleProperty = async (req, res) => {
    try {
        const { property_id } = req.params;

        const propertyRaw = await Property.findOne({ status: 1, propertyID: isNaN(property_id) ? property_id : Number(property_id) });
        if (!propertyRaw) return res.status(404).render('errors/404');

        const property = propertyRaw.toObject();

        // Fallback displayAddress
        if (!property.displayAddress) {
            property.displayAddress = property.address2 || property.propertyFeature1 || '';
        }

        // Decode JSON fields
        if (property.virtualTours && typeof property.virtualTours === 'string') {
            property.virtualTours = JSON.parse(property.virtualTours);
        }
        if (property.externalLinks && typeof property.externalLinks === 'string') {
            property.externalLinks = JSON.parse(property.externalLinks);
        }

        // Resources
        const resources = await Resource.find({ propertyID: property.propertyID }).sort({ sort_order: 1 });
        const images = [], floorplans = [], epcGraphs = [], brochures = [];
        for (const r of resources) {
            if (r.type === 'image') images.push(r.path);
            else if (r.type === 'floorplan') floorplans.push(Buffer.from(r.path).toString('base64'));
            else if (r.type === 'epcGraph') epcGraphs.push(Buffer.from(r.path).toString('base64'));
            else if (r.type === 'brochure') brochures.push(Buffer.from(r.path).toString('base64'));
        }

        // Raw images from JSON field as fallback
        try {
            const rawImgs = typeof property.images === 'string' ? JSON.parse(property.images) : property.images;
            property.images = rawImgs ? rawImgs.map(i => i.image) : [];
        } catch { property.images = []; }

        if (images.length) property.images = images;
        property.floorplans = floorplans;
        property.epcGraphs  = epcGraphs;
        property.brochures  = brochures;

        // Lookups
        const pt = await PropertyType.findOne({ group_id: property.propertyType, department: property.department });
        if (pt) property.propertyType = pt.type;
        const ps = await ResidentialPropertyStyle.findOne({ style_id: property.propertyStyle });
        if (ps) property.propertyStyle = ps.style_name;
        const pa = await PropertyAvailability.findOne({ group_id: Number(property.availability), department: property.department });
        if (pa) property.availability = pa.name;
        if (property.rentFrequency) {
            const rf = await RentFrequency.findOne({ id: property.rentFrequency });
            if (rf) property.rentFrequency = rf.frequency_type;
        }

        res.render('pages/property_single', {
            page_title: property.displayAddress,
            property,
            css_files: ['about', 'single', 'single_responsive'],
            js_files: ['single', 'slider'],
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('errors/500');
    }
};

exports.getSinglePropertyJupix = (req, res) => {
    const propertyId = req.query.profileID;
    if (!propertyId) return res.status(404).render('errors/404');
    return res.redirect(301, `/property/${propertyId}/${propertyId}`);
};

// Simple page renderers
const simplePage = (view, title, opts = {}) => async (req, res) => {
    try { res.render(`pages/${view}`, { page_title: title, ...opts }); }
    catch (err) { console.error(err); res.status(500).render('errors/500'); }
};

exports.showAbout          = simplePage('about', 'About Us');

exports.showNewAboutUs = async (req, res) => {
    try {
        const posts = await Post.find({ status: 'PUBLISHED' }).sort({ createdAt: -1 }).limit(3);
        res.render('pages/new_aboutus_view', { page_title: 'About Us', posts });
    } catch (err) { console.error(err); res.status(500).render('errors/500'); }
};

exports.showWhoWeAre       = simplePage('who_we_are', 'Who We Are');
exports.showMeetTheTeam    = simplePage('meet_the_team', 'Meet the Team');

exports.showSellers = async (req, res) => {
    try {
        const posts = await Post.find({ status: 'PUBLISHED' }).sort({ createdAt: -1 }).limit(3);
        const propertiesRaw = await Property.find({ status: 1, price: { $gt: 0 } })
            .sort({ price: -1 }).limit(10);
        const properties = await Promise.all(propertiesRaw.map(enrichProperty));
        res.render('pages/sellers', { page_title: 'Sellers', posts, properties });
    } catch (err) { console.error(err); res.status(500).render('errors/500'); }
};

exports.showLandlords = async (req, res) => {
    try {
        const posts = await Post.find({ status: 'PUBLISHED' }).sort({ createdAt: -1 }).limit(3);
        const propertiesRaw = await Property.find({ status: 1, rent: { $gt: 0 } })
            .sort({ rent: -1 }).limit(10);
        const properties = await Promise.all(propertiesRaw.map(enrichProperty));
        res.render('pages/landlords', { page_title: 'Landlords', posts, properties });
    } catch (err) { console.error(err); res.status(500).render('errors/500'); }
};
exports.showContact        = simplePage('contact', 'Contact Us', { css_files: ['contact'], js_files: ['contact'] });
exports.showTerms          = simplePage('terms_and_condition', 'Terms and Conditions');
exports.showPrivacy        = simplePage('privacy_policy', 'Privacy Policy');
exports.showCookiePolicy   = simplePage('cookie_policy', 'Cookie Policy');
exports.showComplaints     = simplePage('complaints_procedure', 'Complaints Procedure');
exports.showEbook          = simplePage('ebook', 'eBook');
exports.showVacancies      = simplePage('vacancies', 'Vacancies');
exports.showFullCharges    = simplePage('full_scale_charges', 'Full Scale Charges');
exports.showMortgageCalc   = simplePage('mortgage_calculator', 'Mortgage Calculator');
exports.showStampDutyCalc  = simplePage('stamp_duty_calculator', 'Stamp Duty Calculator');
exports.showAreas          = simplePage('areas', 'Areas We Cover');
exports.showHerneHill      = simplePage('herne_hill', 'Herne Hill');
exports.showBrixton        = simplePage('brixton', 'Brixton');
exports.showPeckham        = simplePage('peckham', 'Peckham');
exports.showDulwich        = simplePage('dulwich', 'Dulwich');
exports.showLoughborough   = simplePage('loughborough_junction', 'Loughborough Junction');
exports.showCamberwell     = simplePage('camberwell', 'Camberwell');
exports.showDenmarkHill    = simplePage('denmark_hill', 'Denmark Hill');
exports.showStockwell      = simplePage('stockwell', 'Stockwell');
exports.showWaterloo       = simplePage('waterloo', 'Waterloo');
exports.showBookValuation  = simplePage('book_a_valuation', 'Book a Valuation');
exports.showValuationRequest = simplePage('valuation_request', 'Valuation Request');
exports.showHomeStaging    = simplePage('free_home_staging_consultation', 'Free Home Staging Consultation');
exports.showHomeStagingRequest = simplePage('home_staging_valuation_request', 'Home Staging Request');
exports.showClassList      = simplePage('class_list', 'Class List');
exports.showThankyouContact    = simplePage('thankyou_contact', 'Thank You');
exports.showThankyouValuation  = simplePage('thankyou_valuation', 'Thank You');

exports.showMarketUpdates = async (req, res) => {
    try {
        const posts = await Post.find({ status: 'PUBLISHED' })
            .sort({ createdAt: -1 })
            .limit(10);
        res.render('pages/market_updates', { page_title: 'Market Updates', posts });
    } catch (err) { res.status(500).render('errors/500'); }
};

exports.showMarketUpdatesView = async (req, res) => {
    try {
        const post = await Post.findOne({ status: 'PUBLISHED', slug: req.params.slug });
        if (!post) return res.status(404).render('errors/404');
        res.render('pages/market_updates_view', { page_title: post.title, post });
    } catch (err) { res.status(500).render('errors/500'); }
};

exports.showLifeMagazines = async (req, res) => {
    try {
        const { LifeMagazine } = require('../models/Lookups');
        const magazines = await LifeMagazine.find({ status: 1 }).sort({ createdAt: -1 });
        res.render('pages/life_magazines_view', { page_title: 'Life Magazines', magazines });
    } catch (err) { res.status(500).render('errors/500'); }
};

// Mail transporter
function createTransporter() {
    return nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT),
        auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    });
}

exports.sendContactRequest = async (req, res) => {
    try {
        const { name, email, phone, message } = req.body;
        const transporter = createTransporter();
        await transporter.sendMail({
            from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM}>`,
            to: process.env.MAIL_TO,
            subject: 'New Contact Request - Urban Village Homes',
            html: `<p><strong>Name:</strong> ${name}</p>
                   <p><strong>Email:</strong> ${email}</p>
                   <p><strong>Phone:</strong> ${phone}</p>
                   <p><strong>Message:</strong> ${message}</p>`,
        });
        res.redirect('/thankyoucontact');
    } catch (err) {
        console.error(err);
        res.redirect('/contact');
    }
};

exports.sendValuationRequest = async (req, res) => {
    try {
        const transporter = createTransporter();
        await transporter.sendMail({
            from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM}>`,
            to: process.env.MAIL_TO,
            subject: 'New Valuation Request - Urban Village Homes',
            html: `<pre>${JSON.stringify(req.body, null, 2)}</pre>`,
        });
        res.redirect('/thankyouvaluation');
    } catch (err) {
        console.error(err);
        res.redirect('/valuation-request');
    }
};

exports.sendHomeStagingRequest = async (req, res) => {
    try {
        const transporter = createTransporter();
        await transporter.sendMail({
            from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM}>`,
            to: process.env.MAIL_TO,
            subject: 'New Home Staging Request - Urban Village Homes',
            html: `<pre>${JSON.stringify(req.body, null, 2)}</pre>`,
        });
        res.redirect('/thankyoucontact');
    } catch (err) {
        console.error(err);
        res.redirect('/home-staging-consultation-request');
    }
};

exports.sendClassListRequest = async (req, res) => {
    try {
        const transporter = createTransporter();
        await transporter.sendMail({
            from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM}>`,
            to: process.env.MAIL_TO,
            subject: 'New Class List Request - Urban Village Homes',
            html: `<pre>${JSON.stringify(req.body, null, 2)}</pre>`,
        });
        res.redirect('/thankyoucontact');
    } catch (err) {
        console.error(err);
        res.redirect('/class-list');
    }
};

exports.ajaxStampDuty = async (req, res) => {
    try {
        const axios = require('axios');
        const { value, country, additional } = req.body;
        const url = `${process.env.PROPERTY_DATA_API}&value=${value}&country=${country}&additional=${additional}`;
        const response = await axios.get(url);
        res.json(response.data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Calculation failed' });
    }
};

exports.viewResource = (req, res) => {
    let fileParam = req.params.file;
    // Decode base64 encoded paths/URLs
    try {
        const decoded = Buffer.from(fileParam, 'base64').toString('utf8');
        if (decoded && !decoded.includes('\x00')) fileParam = decoded;
    } catch {}
    // If it's a Cloudinary URL, redirect directly
    if (fileParam.startsWith('http://') || fileParam.startsWith('https://')) {
        return res.redirect(fileParam);
    }
    res.status(404).send('File not found');
};
