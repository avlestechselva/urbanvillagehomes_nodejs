#!/usr/bin/env node
/**
 * Import MySQL SQL dump to MongoDB
 * Usage: node scripts/import_sql_to_mongo.js
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SQL_FILE = path.join(process.env.HOME, 'Downloads/bh_uvh_data.sql');
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('MONGO_URI not set in .env');
  process.exit(1);
}

/**
 * Parse a single SQL value token into a JS value
 */
function parseValue(token) {
  token = token.trim();
  if (token === 'NULL') return null;
  if (token === 'TRUE' || token === '1') {
    // keep as-is (could be boolean or int depending on context)
  }
  if (/^-?\d+(\.\d+)?$/.test(token)) return Number(token);
  // Strip surrounding quotes and unescape
  if ((token.startsWith("'") && token.endsWith("'"))) {
    return token
      .slice(1, -1)
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"');
  }
  return token;
}

/**
 * Tokenize a VALUES row string like (1,'foo',NULL,2.5)
 * Handles commas inside quoted strings
 */
function tokenizeRow(rowStr) {
  const tokens = [];
  let current = '';
  let inStr = false;
  let escape = false;

  for (let i = 0; i < rowStr.length; i++) {
    const ch = rowStr[i];
    if (escape) {
      current += ch;
      escape = false;
      continue;
    }
    if (ch === '\\') {
      current += ch;
      escape = true;
      continue;
    }
    if (ch === "'" && !inStr) { inStr = true; current += ch; continue; }
    if (ch === "'" && inStr) { inStr = false; current += ch; continue; }
    if (ch === ',' && !inStr) { tokens.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

/**
 * Extract all (row1),(row2),... groups from an INSERT VALUES clause
 */
function extractRows(valuesStr) {
  const rows = [];
  let depth = 0;
  let current = '';
  let inStr = false;
  let escape = false;

  for (let i = 0; i < valuesStr.length; i++) {
    const ch = valuesStr[i];
    if (escape) { current += ch; escape = false; continue; }
    if (ch === '\\') { current += ch; escape = true; continue; }
    if (ch === "'" && !inStr) { inStr = true; current += ch; continue; }
    if (ch === "'" && inStr) { inStr = false; current += ch; continue; }
    if (!inStr && ch === '(') { depth++; if (depth === 1) { current = ''; continue; } }
    if (!inStr && ch === ')') {
      depth--;
      if (depth === 0) { rows.push(current); current = ''; continue; }
    }
    current += ch;
  }
  return rows;
}

function parseSQLFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const collections = {};

  // Extract column definitions per table
  const tableColumns = {};
  const createRegex = /CREATE TABLE `(\w+)` \(([\s\S]*?)\) ENGINE=/g;
  let match;
  while ((match = createRegex.exec(content)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const cols = [];
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      // Column lines start with backtick
      const colMatch = trimmed.match(/^`(\w+)`/);
      if (colMatch && !trimmed.startsWith('PRIMARY') && !trimmed.startsWith('UNIQUE') &&
          !trimmed.startsWith('KEY') && !trimmed.startsWith('INDEX')) {
        cols.push(colMatch[1]);
      }
    }
    tableColumns[tableName] = cols;
  }

  // Extract INSERT statements
  const insertRegex = /INSERT INTO `(\w+)` \(`([^`]+(?:`, `[^`]+)*)`\) VALUES\s*([\s\S]*?);/g;
  while ((match = insertRegex.exec(content)) !== null) {
    const tableName = match[1];
    const columns = match[2].split('`, `');
    const valuesStr = match[3];

    if (!collections[tableName]) collections[tableName] = [];

    const rows = extractRows(valuesStr);
    for (const row of rows) {
      const tokens = tokenizeRow(row);
      const doc = {};
      columns.forEach((col, i) => {
        doc[col] = parseValue(tokens[i] ?? 'NULL');
      });
      collections[tableName].push(doc);
    }
  }

  return collections;
}

async function importToMongo(collections) {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log('Connected to MongoDB Atlas\n');

  const db = client.db(); // uses DB from URI

  const tableNames = Object.keys(collections);
  let totalDocs = 0;

  for (const table of tableNames) {
    const docs = collections[table];
    if (docs.length === 0) {
      console.log(`  [SKIP] ${table} — no data`);
      continue;
    }

    try {
      const col = db.collection(table);
      await col.deleteMany({}); // clear existing
      const result = await col.insertMany(docs, { ordered: false });
      console.log(`  [OK] ${table} — ${result.insertedCount} documents`);
      totalDocs += result.insertedCount;
    } catch (err) {
      console.error(`  [ERR] ${table}: ${err.message}`);
    }
  }

  await client.close();
  return totalDocs;
}

async function main() {
  console.log(`Reading: ${SQL_FILE}\n`);
  const collections = parseSQLFile(SQL_FILE);

  const tables = Object.keys(collections);
  console.log(`Found ${tables.length} tables with data:\n`);
  tables.forEach(t => console.log(`  - ${t} (${collections[t].length} rows)`));
  console.log('');

  console.log('Importing to MongoDB...\n');
  const total = await importToMongo(collections);
  console.log(`\nDone! ${total} total documents imported.`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
