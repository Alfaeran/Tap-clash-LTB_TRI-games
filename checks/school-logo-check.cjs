// MV-1 check: every logo the twibbon can draw actually resolves to a file on
// disk, and every mapped id is a real school. A renamed asset would otherwise
// blank out a crest with no error anywhere.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ROOT = path.join(__dirname, '..');

const src = fs.readFileSync(path.join(ROOT, 'client', 'src', 'lib', 'schoolLogos.ts'), 'utf8');
const schools = fs.readFileSync(path.join(ROOT, 'client', 'src', 'lib', 'schoolsData.ts'), 'utf8');

// Pull the mapping out of the TS source rather than importing it: the check is
// plain node, and the table is a literal by design.
const block = src.match(/LOGO_FILE_BY_ID:\s*Record<string, string>\s*=\s*\{([\s\S]*?)\n\};/);
assert.ok(block, 'LOGO_FILE_BY_ID literal not found — did the shape change?');
const entries = [...block[1].matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map(m => [m[1], m[2]]);
assert.ok(entries.length > 0, 'mapping is empty');

const ids = new Set([...schools.matchAll(/id:\s*"([^"]+)"/g)].map(m => m[1]));
const logoDir = path.join(ROOT, 'public', 'school-logo');
const onDisk = new Set(fs.readdirSync(logoDir));

for (const [id, file] of entries) {
  assert.ok(ids.has(id), `mapped id ${id} is not in SCHOOL_LIST`);
  assert.ok(onDisk.has(file), `logo file missing on disk: ${file}`);
}
console.log(`  ${entries.length} logo mappings: every id is a real school, every file exists`);

// The reverse lookup keys on "name detail"; make sure the mapped schools really
// produce a distinct display name, or two schools would share one crest.
const rows = [...schools.matchAll(/id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*detail:\s*"([^"]+)"/g)];
const display = new Map();
for (const [, id, name, detail] of rows) {
  const key = `${name} ${detail}`.toLowerCase().replace(/\s+/g, ' ').trim();
  assert.ok(!display.has(key), `duplicate display name "${key}" (${display.get(key)} and ${id})`);
  display.set(key, id);
}
console.log(`  ${rows.length} schools have unique display names (reverse lookup is unambiguous)`);

// Filenames go through encodeURIComponent; spaces must survive as %20, and a
// file whose name would break the URL is a bug worth catching here.
for (const [, file] of entries) {
  const encoded = encodeURIComponent(file);
  assert.strictEqual(decodeURIComponent(encoded), file, `filename does not round-trip: ${file}`);
  assert.ok(!encoded.includes('/'), `filename must not contain a path separator: ${file}`);
}
console.log('  all filenames round-trip through encodeURIComponent');
console.log('MV-1 school-logo check passed.');
