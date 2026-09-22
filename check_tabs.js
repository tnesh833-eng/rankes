const fs = require('fs');
const html = fs.readFileSync('frontend/app.html', 'utf8');

// Get all tab IDs from onclick
const tabIds = [];
const tabRegex = /onclick="switchTab\('([^']+)'/g;
let match;
while ((match = tabRegex.exec(html)) !== null) {
    if (!tabIds.includes(match[1])) tabIds.push(match[1]);
}

// Get all section IDs
const sectionIds = [];
const secRegex = /id="([^"]+)" class="tab-content/g;
while ((match = secRegex.exec(html)) !== null) {
    sectionIds.push(match[1]);
}

console.log('Tab IDs in onclick:', tabIds);
console.log('Section IDs:', sectionIds);
console.log('');

let allOk = true;
tabIds.forEach(id => {
    if (!sectionIds.includes(id)) {
        console.error('BROKEN - No section found for tab ID:', id);
        allOk = false;
    } else {
        console.log('OK -', id);
    }
});

if (allOk) console.log('\nAll tabs matched to sections!');
