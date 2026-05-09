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
const cloudinary = require('../config/cloudinary');

function uploadToCloudinary(url, folder) {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload(url, {
            folder,
            resource_type: 'auto',
        }, (error, result) => {
            if (error) return reject(error);
            resolve(result.secure_url);
        });
    });
}

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

            // Updated — delete old from Cloudinary, re-upload
            await Resource.deleteOne({ _id: existing._id });
            if (existing.cloudinaryPublicId) {
                await cloudinary.uploader.destroy(existing.cloudinaryPublicId, { resource_type: 'auto' }).catch(() => {});
            }
        }

        // Upload to Cloudinary
        try {
            const folder = `urbanvillagehomes/properties/${propertyID}/${subDir}`;
            console.log(`[Jupix] Uploading ${type} for ${propertyID}: ${fileUrl}`);
            const cloudinaryUrl = await uploadToCloudinary(fileUrl, folder);
            const publicId = `${folder}/${fileUrl.split('/').pop().split('?')[0].split('.')[0]}`;
            console.log(`[Jupix] Uploaded to Cloudinary: ${cloudinaryUrl}`);

            await Resource.create({
                propertyID,
                modified:           item.modified,
                url:                fileUrl,
                type,
                path:               cloudinaryUrl,
                cloudinaryPublicId: publicId,
                sort_order:         k + 1,
                createdAt:          now,
                updatedAt:          now,
            });
        } catch (err) {
            console.error(`[Jupix] Error uploading ${type} for ${propertyID}: ${err.message}`, err);
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

    await processMediaType(propertyID, images,     'image',    'image',    'images',     now);
    await processMediaType(propertyID, floorplans, 'floorplan','floorplan','floorplans', now);
    await processMediaType(propertyID, epcGraphs,  'epcGraph', 'epcGraph', 'epcGraphs',  now);
    await processMediaType(propertyID, brochures,  'brochure', 'brochure', 'brochures',  now);
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
            else if (name === 'image'     && inImages)     { currentMedia = {}; }
            else if (name === 'floorplan' && inFloorplans) { currentMedia = {}; }
            else if (name === 'epcGraph'  && inEpcGraphs)  { currentMedia = {}; }
            else if (name === 'brochure'  && inBrochures)  { currentMedia = {}; }

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

async function run() {
    const url = process.env.JUPIX_URL;
    if (!url) {
        console.error('[Jupix] JUPIX_URL not set');
        return;
    }

    const now = new Date();
    console.log(`[Jupix] Starting retrieve at ${now.toISOString()}`);

    try {
        const properties = await fetchAndParseXML(url);
        console.log(`[Jupix] Fetched ${properties.length} properties`);

        for (const propData of properties) {
            try {
                await processProperty(propData, now);
            } catch (err) {
                console.error(`[Jupix] Error processing property ${propData.propertyID}: ${err.message}`);
            }
        }

        // Mark missing properties as deleted
        const activePropertyIDs = properties.map(p => p.propertyID).filter(Boolean);
        await Property.updateMany(
            { status: 1, propertyID: { $nin: activePropertyIDs } },
            { $set: { status: 0, deleted_at: now } }
        );

        console.log(`[Jupix] Retrieve complete at ${new Date().toISOString()}`);
    } catch (err) {
        console.error('[Jupix] Fatal error:', err.message);
    }
}

module.exports = { run };
