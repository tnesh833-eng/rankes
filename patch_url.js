const fs = require('fs');
let html = fs.readFileSync('frontend/app.html', 'utf8');

// 1. Add URL input to setup screen
const oldInputs = `                        <!-- Job Description -->
                        <div>
                            <label style="display:block; font-size:0.8rem; color:#94a3b8; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.05em;">📝 Job Description / Profile</label>
                            <textarea id="hrJobDescription" placeholder="Paste the job description or specific role requirements here..." style="width:100%; height:80px; padding:12px; border-radius:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; font-family:inherit; font-size:0.85rem; outline:none; resize:none;"></textarea>
                        </div>
                        
                        <!-- Resume Upload -->`;

const newInputs = `                        <!-- Job Description -->
                        <div>
                            <label style="display:block; font-size:0.8rem; color:#94a3b8; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.05em;">📝 Job Description / Profile</label>
                            <textarea id="hrJobDescription" placeholder="Paste the job description or specific role requirements here..." style="width:100%; height:80px; padding:12px; border-radius:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; font-family:inherit; font-size:0.85rem; outline:none; resize:none;"></textarea>
                        </div>

                        <!-- Company URL -->
                        <div>
                            <label style="display:block; font-size:0.8rem; color:#94a3b8; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.05em;">🔗 Company URL (Optional)</label>
                            <input type="text" id="hrCompanyUrl" placeholder="https://www.example.com/about" style="width:100%; padding:12px; border-radius:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; font-family:inherit; font-size:0.85rem; outline:none;" />
                        </div>
                        
                        <!-- Resume Upload -->`;
html = html.replace(oldInputs, newInputs);

// 2. Pass URL in startHrInterview
const oldStart = `                    const company = document.getElementById('aiHrCompany').value;
                    const jd = document.getElementById('hrJobDescription').value.trim();
                    let fullContext = jd;
                    if (hrResumeText) fullContext += "\\n\\n--- RESUME ---\\n" + hrResumeText;
                    
                    try {
                        const token = localStorage.getItem('rh_auth_token') || '';
                        await fetch('/api/ai/hr-context', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                            body: JSON.stringify({ company: company, context: fullContext })
                        });`;

const newStart = `                    const company = document.getElementById('aiHrCompany').value;
                    const jd = document.getElementById('hrJobDescription').value.trim();
                    const url = document.getElementById('hrCompanyUrl') ? document.getElementById('hrCompanyUrl').value.trim() : '';
                    let fullContext = jd;
                    if (hrResumeText) fullContext += "\\n\\n--- RESUME ---\\n" + hrResumeText;
                    
                    try {
                        const token = localStorage.getItem('rh_auth_token') || '';
                        await fetch('/api/ai/hr-context', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                            body: JSON.stringify({ company: company, context: fullContext, url: url })
                        });`;
html = html.replace(oldStart, newStart);

fs.writeFileSync('frontend/app.html', html, 'utf8');
console.log('Successfully added URL feature to app.html');
