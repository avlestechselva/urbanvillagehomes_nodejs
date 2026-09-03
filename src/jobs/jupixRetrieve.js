/**
 * Jupix XML Feed Retrieval Job
 * Replaces: app/Console/Commands/JupixRetrieve.php
 * Runs every 3 hours via cron
 */
const https   = require('https');
const http    = require('http');
const sax     = require('sax');
const Property = require('../models/Property');
const Resource = require('../models/Resource');

async function processMediaType(propertyID, items, type, urlKey, subDir, now) {
    for (let k = 0; k < items.length; k++) {
        const item = items[k];
        const fileUrl = item[urlKey];
        if (!fileUrl) continue;

        const existing = await Resource.findOne({ propertyID, url: fileUrl, type });

        if (existing) {
            const dbMod  = new Date(existing.modified);
            const apiMod = new Date(item.modified);
            if (apiMod <= dbMod) continue; // not changed
            await Resource.deleteOne({ _id: existing._id });
        }

        try {
            await Resource.create({
                propertyID,
                modified:   item.modified,
                url:        fileUrl,
                type,
                path:       fileUrl, // use Jupix URL directly
                sort_order: k + 1,
                createdAt:  now,
                updatedAt:  now,
            });
        } catch (err) {
            console.error(`[Jupix] Error saving ${type} for ${propertyID}: ${err.message}`);
        }
    }
}

async function processProperty(data, now) {
    const propertyID = data.propertyID;
    if (!propertyID) return;

    const propertyData = { ...data, status: 1, updatedAt: now };
    delete propertyData.images;
    delete propertyData.floorplans;
    delete propertyData.epcGraphs;
    delete propertyData.epcFrontPages;
    delete propertyData.brochures;
    delete propertyData.virtualTours;
    delete propertyData.externalLinks;

    // Store media as JSON strings
    if (data.images)       propertyData.images       = data.images;
    if (data.floorplans)   propertyData.floorplans   = data.floorplans;
    if (data.epcGraphs)    propertyData.epcGraphs    = data.epcGraphs;
    if (data.epcFrontPages) propertyData.epcFrontPages = data.epcFrontPages;
    if (data.brochures)    propertyData.brochures    = data.brochures;
    if (data.virtualTours) propertyData.virtualTours = data.virtualTours;
    if (data.externalLinks) propertyData.externalLinks = data.externalLinks;

    await Property.findOneAndUpdate(
        { propertyID },
        { $set: propertyData },
        { upsert: true, new: true }
    );

    // Process media resources
    const images     = Array.isArray(data.images)     ? data.images     : [];
    const floorplans = Array.isArray(data.floorplans) ? data.floorplans : [];
    const epcGraphs  = Array.isArray(data.epcGraphs)  ? data.epcGraphs  : [];
    const brochures  = Array.isArray(data.brochures)  ? data.brochures  : [];

    // Wipe existing resources for this property and re-insert fresh — prevents
    // duplicates caused by multiple <images> blocks in the Jupix XML feed
    await Resource.deleteMany({ propertyID });

    // Deduplicate by URL before inserting
    const uniqueImages     = images.filter((v,i,a) => a.findIndex(x => x.image === v.image) === i);
    const uniqueFloorplans = floorplans.filter((v,i,a) => a.findIndex(x => x.floorplan === v.floorplan) === i);
    const uniqueEpcGraphs  = epcGraphs.filter((v,i,a) => a.findIndex(x => x.epcGraph === v.epcGraph) === i);
    const uniqueBrochures  = brochures.filter((v,i,a) => a.findIndex(x => x.brochure === v.brochure) === i);

    await processMediaType(propertyID, uniqueImages,     'image',    'image',    'images',     now);
    await processMediaType(propertyID, uniqueFloorplans, 'floorplan','floorplan','floorplans', now);
    await processMediaType(propertyID, uniqueEpcGraphs,  'epcGraph', 'epcGraph', 'epcGraphs',  now);
    await processMediaType(propertyID, uniqueBrochures,  'brochure', 'brochure', 'brochures',  now);

    return { images: images.length, floorplans: floorplans.length, brochures: brochures.length };
}

function fetchAndParseXML(url) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https : http;
        const properties = [];
        const parser = sax.createStream(true, { lowercase: false });

        let currentProperty = null;
        let currentTag      = null;
        let currentText     = '';
        let inImages        = false;
        let inFloorplans    = false;
        let inEpcGraphs     = false;
        let inBrochures     = false;
        let currentMedia    = null;

        parser.on('opentag', node => {
            const name = node.name;
            currentText = '';

            if (name === 'property') {
                currentProperty = { images: [], floorplans: [], epcGraphs: [], brochures: [] };
            } else if (name === 'images')     { inImages    = true; }
            else if (name === 'floorplans')   { inFloorplans = true; }
            else if (name === 'epcGraphs')    { inEpcGraphs = true; }
            else if (name === 'brochures')    { inBrochures = true; }
            else if (name === 'image'     && inImages)     { currentMedia = { modified: node.attributes.modified }; }
            else if (name === 'floorplan' && inFloorplans) { currentMedia = { modified: node.attributes.modified }; }
            else if (name === 'epcGraph'  && inEpcGraphs)  { currentMedia = { modified: node.attributes.modified }; }
            else if (name === 'brochure'  && inBrochures)  { currentMedia = { modified: node.attributes.modified }; }

            currentTag = name;
        });

        parser.on('text', text => { currentText += text; });
        parser.on('cdata', text => { currentText += text; });

        parser.on('closetag', name => {
            if (!currentProperty) { currentText = ''; return; }

            if (name === 'property') {
                properties.push(currentProperty);
                currentProperty = null;
            } else if (name === 'images')     { inImages    = false; }
            else if (name === 'floorplans')   { inFloorplans = false; }
            else if (name === 'epcGraphs')    { inEpcGraphs = false; }
            else if (name === 'brochures')    { inBrochures = false; }
            else if ((name === 'image' || name === 'floorplan' || name === 'epcGraph' || name === 'brochure') && currentMedia) {
                // URL is the text content of the tag itself
                if (currentText.trim()) currentMedia[name] = currentText.trim();
                if (name === 'image')     currentProperty.images.push(currentMedia);
                if (name === 'floorplan') currentProperty.floorplans.push(currentMedia);
                if (name === 'epcGraph')  currentProperty.epcGraphs.push(currentMedia);
                if (name === 'brochure')  currentProperty.brochures.push(currentMedia);
                currentMedia = null;
            } else if (currentMedia && currentText.trim()) {
                currentMedia[name] = currentText.trim();
            } else if (currentProperty && currentText.trim()) {
                currentProperty[name] = currentText.trim();
            }

            currentText = '';
        });

        parser.on('end', () => resolve(properties));
        parser.on('error', reject);

        proto.get(url, res => res.pipe(parser)).on('error', reject);
    });
}

async function run(onProgress) {
    const url = process.env.JUPIX_URL;
    if (!url) {
        console.error('[Jupix] JUPIX_URL not set');
        return { error: 'JUPIX_URL not set' };
    }

    const now = new Date();
    const log = (msg) => { console.log(msg); if (onProgress) onProgress(msg); };

    log(`Starting retrieve at ${now.toISOString()}`);

    const stats = { fetched: 0, updated: 0, images: 0, floorplans: 0, brochures: 0, errors: 0, deleted: 0 };

    try {
        const properties = await fetchAndParseXML(url);
        stats.fetched = properties.length;
        log(`Fetched ${properties.length} properties from Jupix`);

        // Process in parallel batches of 10 to stay within Vercel timeout
        const BATCH = 10;
        for (let i = 0; i < properties.length; i += BATCH) {
            const batch = properties.slice(i, i + BATCH);
            await Promise.all(batch.map(async (propData) => {
                try {
                    const result = await processProperty(propData, now);
                    stats.updated++;
                    stats.images     += result.images     || 0;
                    stats.floorplans += result.floorplans || 0;
                    stats.brochures  += result.brochures  || 0;
                    const fullAddress = [propData.addressNumber, propData.addressStreet, propData.address3, propData.addressPostcode].filter(Boolean).join(' ');
                    log(`[${stats.updated}/${stats.fetched}] ${fullAddress || propData.displayAddress || propData.propertyID}`);
                } catch (err) {
                    stats.errors++;
                    console.error(`[Jupix] Error processing ${propData.propertyID}: ${err.message}`);
                }
            }));
        }

        // Mark missing properties as deleted
        const activePropertyIDs = properties.map(p => p.propertyID).filter(Boolean);
        const deleted = await Property.updateMany(
            { status: 1, propertyID: { $nin: activePropertyIDs } },
            { $set: { status: 0, deleted_at: now } }
        );
        stats.deleted = deleted.modifiedCount;

        log(`Retrieve complete at ${new Date().toISOString()}`);
        return stats;
    } catch (err) {
        console.error('[Jupix] Fatal error:', err.message);
        return { ...stats, error: err.message };
    }
}

module.exports = { run };
