const fs = require('fs');
let html = fs.readFileSync('frontend/app.html', 'utf8');

// 1. Remove the tab nav button for AI Knowledge Lab
const knowledgeTabBtn = `            <button class="tab-btn" id="tab-knowledge-lab-btn" role="tab" aria-selected="false"
                aria-controls="knowledge-lab"
                onclick="switchTab('knowledge-lab', this); if(window.initKnowledgeLab) window.initKnowledgeLab();">
                🧠 AI Knowledge Lab
            </button>
`;
html = html.replace(knowledgeTabBtn, '');

// 2. Remove the tab nav button for Subscription
const subscriptionTabBtn = `            <button class="tab-btn" id="tab-subscription-btn" role="tab" aria-selected="false"
                aria-controls="subscription"
                onclick="switchTab('subscription', this)">
                💳 Subscription
            </button>
`;
html = html.replace(subscriptionTabBtn, '');

// 3. Remove the full knowledge-lab section (find by unique markers)
const klStart = html.indexOf('<!-- ================================================================\n         AI KNOWLEDGE LAB TAB');
const klEnd = html.indexOf('        <!-- TAB: Subscription -->');
if (klStart !== -1 && klEnd !== -1) {
    html = html.substring(0, klStart) + html.substring(klEnd);
    console.log('Removed AI Knowledge Lab section');
} else {
    console.warn('Could not find AI Knowledge Lab section bounds. klStart:', klStart, 'klEnd:', klEnd);
}

// 4. Remove the full subscription section (find by unique markers)
const subStart = html.indexOf('        <!-- TAB: Subscription -->');
// Find the closing </section> after subscription
const afterSub = html.substring(subStart);
// The subscription section ends before the floating AI chat widget
const subEnd = html.indexOf('        <!-- Floating AI Assistant -->');
if (subStart !== -1 && subEnd !== -1) {
    html = html.substring(0, subStart) + html.substring(subEnd);
    console.log('Removed Subscription section');
} else {
    // fallback: try to find by closing tag count
    console.warn('Could not find Subscription section end. Trying fallback...');
    const subStartIdx = html.indexOf('        <!-- TAB: Subscription -->');
    if (subStartIdx !== -1) {
        // Find the next </section> after the <section> opening
        const secOpenIdx = html.indexOf('<section id="subscription"', subStartIdx);
        if (secOpenIdx !== -1) {
            let depth = 0;
            let i = secOpenIdx;
            while (i < html.length) {
                if (html.startsWith('<section', i)) depth++;
                else if (html.startsWith('</section>', i)) { depth--; if (depth === 0) { i += '</section>'.length; break; } }
                i++;
            }
            html = html.substring(0, subStartIdx) + html.substring(i);
            console.log('Removed Subscription section via fallback');
        }
    }
}

fs.writeFileSync('frontend/app.html', html, 'utf8');
console.log('Done! Removed AI Knowledge Lab and Subscription tabs.');
