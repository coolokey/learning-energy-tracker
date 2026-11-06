const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const idMatches = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map(m => m[1]);
const idSet = new Set(idMatches);

const refMatches = [...html.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
const missing = [...new Set(refMatches)].filter(id => !idSet.has(id));

console.log('Total IDs declared:', idSet.size);
console.log('Total unique IDs referenced with $():', new Set(refMatches).size);
if (missing.length > 0) {
  console.log('Missing IDs:', missing);
} else {
  console.log('✓ All referenced IDs are present in index.html!');
}
