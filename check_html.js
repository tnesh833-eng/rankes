const fs = require('fs');
const html = fs.readFileSync('frontend/app.html', 'utf8');

// Count open and close script tags
const openTags = (html.match(/<script/g) || []).length;
const closeTags = (html.match(/<\/script>/g) || []).length;
console.log('Open <script> tags:', openTags);
console.log('Close </script> tags:', closeTags);

if (openTags !== closeTags) {
    console.error('MISMATCH: Unclosed script tag!');
} else {
    console.log('Script tags balanced OK');
}

// Count open and close section tags
const openSec = (html.match(/<section/g) || []).length;
const closeSec = (html.match(/<\/section>/g) || []).length;
console.log('Open <section> tags:', openSec);
console.log('Close </section> tags:', closeSec);
if (openSec !== closeSec) console.error('MISMATCH: Section tags unbalanced!');
else console.log('Section tags balanced OK');

// Find all .js script src references
const srcs = html.match(/src="[^"]+\.js"/g) || [];
console.log('\nScript files referenced:', srcs);
