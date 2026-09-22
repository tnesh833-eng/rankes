const fs = require('fs');
let html = fs.readFileSync('frontend/app.html', 'utf8');

// Update the fetch calls in app.html to handle 401 Authentication required
// First update startHrInterview
const oldStartFetch = `                    try {
                        const token = localStorage.getItem('rh_auth_token') || '';
                        await fetch('/api/ai/hr-context', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                            body: JSON.stringify({ company: company, context: fullContext, url: url })
                        });`;

const newStartFetch = `                    try {
                        const token = localStorage.getItem('rh_auth_token') || '';
                        if (!token) { alert('Please log in to start the interview.'); window.location.href = 'login.html'; return; }
                        const ctxRes = await fetch('/api/ai/hr-context', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                            body: JSON.stringify({ company: company, context: fullContext, url: url })
                        });
                        if (ctxRes.status === 401) { alert('Your session has expired. Please log in again.'); window.location.href = 'login.html'; return; }`;

html = html.replace(oldStartFetch, newStartFetch);


// Next update sendHrToApi
const oldSendFetch = `                    try {
                        const token = localStorage.getItem('rh_auth_token') || '';
                        const res = await fetch('/api/ai/hr-interviewer', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                            body: JSON.stringify({
                                message: text,
                                company: company,
                                history: isSystemMessage ? [] : hrChatHistory.slice(-8)
                            })
                        });
                        const data = await res.json();`;

const newSendFetch = `                    try {
                        const token = localStorage.getItem('rh_auth_token') || '';
                        if (!token) { alert('Please log in to continue.'); window.location.href = 'login.html'; return; }
                        const res = await fetch('/api/ai/hr-interviewer', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                            body: JSON.stringify({
                                message: text,
                                company: company,
                                history: isSystemMessage ? [] : hrChatHistory.slice(-8)
                            })
                        });
                        if (res.status === 401) { alert('Your session has expired. Please log in again.'); window.location.href = 'login.html'; return; }
                        const data = await res.json();`;

html = html.replace(oldSendFetch, newSendFetch);

fs.writeFileSync('frontend/app.html', html, 'utf8');
console.log('Successfully added auth handling to app.html');
