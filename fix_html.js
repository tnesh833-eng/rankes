const fs = require('fs');

let lines = fs.readFileSync('frontend/app.html', 'utf8').split('\n');

// The new corporate section content
const newCorporateContent = `        <section id="corporate" class="tab-content" role="tabpanel">
            <div class="card" style="display:flex; flex-direction:column; height:80vh; max-height:800px;">
                <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div>
                        <h2 class="card-title">👔 Corporate Readiness</h2>
                        <p style="font-size:0.88rem; color:var(--text-secondary); margin-top:4px;">
                            Practice behavioral and HR interviews with AI tailored to top global companies.
                        </p>
                    </div>
                    <div style="display:flex; gap:12px; align-items:center;">
                        <select id="aiHrCompany" style="padding:8px 12px; border-radius:8px; background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.3); color:var(--text-primary); font-size:0.9rem; outline:none; font-weight:600;">
                            <option value="Nvidia">Nvidia</option>
                            <option value="Apple">Apple</option>
                            <option value="Meta">Meta</option>
                            <option value="Adobe">Adobe</option>
                            <option value="Spotify">Spotify</option>
                        </select>
                        <button id="aiHrVoiceToggle" onclick="toggleHrVoice()" style="padding:8px 14px; border-radius:8px; background:rgba(16,185,129,0.15); border:1px solid #10b981; color:#34d399; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px;">
                            🔊 Voice On
                        </button>
                    </div>
                </div>

                <!-- Chat Window -->
                <div id="aiHrChatBox" style="flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:16px; background:rgba(0,0,0,0.15); border-radius:12px; border:1px solid var(--border-subtle); margin-bottom:16px;">
                    <div style="display:flex; gap:12px; align-items:flex-start;">
                        <div style="width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,#6366f1,#8b5cf6); display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0;">👔</div>
                        <div style="background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25); border-radius:0 12px 12px 12px; padding:12px 16px; color:#e2e8f0; font-size:0.9rem; line-height:1.6; max-width:85%;">
                            Welcome! I'm your AI HR Interviewer. Please select a company from the dropdown above, and send a message or start speaking to begin our interview!
                        </div>
                    </div>
                </div>

                <!-- Input Area -->
                <div style="display:flex; gap:10px; align-items:center;">
                    <button id="aiHrMicBtn" onclick="toggleHrMic()" style="width:50px; height:50px; border-radius:50%; background:rgba(244,63,94,0.15); border:1px solid #f43f5e; color:#fb7185; font-size:1.4rem; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s;" title="Hold to speak or click to toggle">
                        🎤
                    </button>
                    <input type="text" id="aiHrInput" placeholder="Type your answer here..." style="flex:1; padding:14px 18px; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:0.95rem; outline:none;" onkeypress="if(event.key === 'Enter') sendHrMessage()">
                    <button id="aiHrSendBtn" onclick="sendHrMessage()" style="padding:0 24px; height:50px; border-radius:12px; background:linear-gradient(135deg,#6366f1,#8b5cf6); border:none; color:#fff; font-size:1rem; font-weight:700; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 16px rgba(99,102,241,0.4);">
                        Send
                    </button>
                </div>
            </div>

            <script>
                let hrChatHistory = [];
                let hrVoiceEnabled = true;
                let hrRecognizing = false;
                let hrRecognition = null;

                if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                    hrRecognition = new SpeechRecognition();
                    hrRecognition.continuous = false;
                    hrRecognition.interimResults = false;
                    hrRecognition.lang = 'en-US';

                    hrRecognition.onstart = function() {
                        hrRecognizing = true;
                        document.getElementById('aiHrMicBtn').style.background = 'rgba(244,63,94,0.4)';
                        document.getElementById('aiHrMicBtn').style.boxShadow = '0 0 16px rgba(244,63,94,0.6)';
                    };

                    hrRecognition.onresult = function(event) {
                        const transcript = event.results[0][0].transcript;
                        document.getElementById('aiHrInput').value = transcript;
                        sendHrMessage();
                    };

                    hrRecognition.onerror = function(event) {
                        console.error("Speech recognition error", event.error);
                        stopHrMicUI();
                    };

                    hrRecognition.onend = function() {
                        stopHrMicUI();
                    };
                } else {
                    document.getElementById('aiHrMicBtn').style.display = 'none';
                }

                function stopHrMicUI() {
                    hrRecognizing = false;
                    document.getElementById('aiHrMicBtn').style.background = 'rgba(244,63,94,0.15)';
                    document.getElementById('aiHrMicBtn').style.boxShadow = 'none';
                }

                function toggleHrMic() {
                    if (!hrRecognition) return alert("Speech recognition not supported in your browser.");
                    if (hrRecognizing) {
                        hrRecognition.stop();
                    } else {
                        hrRecognition.start();
                    }
                }

                function toggleHrVoice() {
                    hrVoiceEnabled = !hrVoiceEnabled;
                    const btn = document.getElementById('aiHrVoiceToggle');
                    if (hrVoiceEnabled) {
                        btn.innerHTML = '🔊 Voice On';
                        btn.style.background = 'rgba(16,185,129,0.15)';
                        btn.style.border = '1px solid #10b981';
                        btn.style.color = '#34d399';
                    } else {
                        btn.innerHTML = '🔇 Voice Off';
                        btn.style.background = 'rgba(244,63,94,0.15)';
                        btn.style.border = '1px solid #f43f5e';
                        btn.style.color = '#fb7185';
                        window.speechSynthesis.cancel();
                    }
                }

                function playHrVoice(text) {
                    if (!hrVoiceEnabled || !('speechSynthesis' in window)) return;
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(text);
                    const voices = window.speechSynthesis.getVoices();
                    const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Female')));
                    if (preferredVoice) utterance.voice = preferredVoice;
                    utterance.rate = 1.0;
                    utterance.pitch = 1.0;
                    window.speechSynthesis.speak(utterance);
                }

                function addHrMessage(role, content) {
                    const box = document.getElementById('aiHrChatBox');
                    const div = document.createElement('div');
                    div.style.display = 'flex';
                    div.style.gap = '12px';
                    div.style.alignItems = 'flex-start';
                    
                    if (role === 'user') {
                        div.style.flexDirection = 'row-reverse';
                        div.innerHTML = \`
                            <div style="width:36px; height:36px; border-radius:50%; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0;">👤</div>
                            <div style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:12px 0 12px 12px; padding:12px 16px; color:#f1f5f9; font-size:0.9rem; line-height:1.6; max-width:85%;">
                                \${content}
                            </div>
                        \`;
                    } else {
                        div.innerHTML = \`
                            <div style="width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,#6366f1,#8b5cf6); display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0;">👔</div>
                            <div style="background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25); border-radius:0 12px 12px 12px; padding:12px 16px; color:#e2e8f0; font-size:0.9rem; line-height:1.6; max-width:85%;">
                                \${content}
                            </div>
                        \`;
                    }
                    box.appendChild(div);
                    box.scrollTop = box.scrollHeight;
                }

                async function sendHrMessage() {
                    const inp = document.getElementById('aiHrInput');
                    const text = inp.value.trim();
                    if (!text) return;

                    const company = document.getElementById('aiHrCompany').value;
                    const btn = document.getElementById('aiHrSendBtn');
                    
                    addHrMessage('user', text);
                    hrChatHistory.push({ role: 'user', content: text });
                    inp.value = '';
                    btn.disabled = true;
                    btn.innerHTML = '...';

                    try {
                        const token = localStorage.getItem("rh_auth_token") || "";
                        const res = await fetch("/api/ai/hr-interviewer", {
                            method: "POST",
                            headers: { 
                                "Content-Type": "application/json",
                                "Authorization": "Bearer " + token
                            },
                            body: JSON.stringify({ 
                                message: text, 
                                company: company, 
                                history: hrChatHistory.slice(-6)
                            })
                        });
                        const data = await res.json();
                        if (data.reply) {
                            addHrMessage('ai', data.reply);
                            hrChatHistory.push({ role: 'ai', content: data.reply });
                            playHrVoice(data.reply);
                        } else {
                            addHrMessage('ai', "I'm sorry, I encountered an error parsing your response.");
                        }
                    } catch (e) {
                        addHrMessage('ai', "Connection error. Please try again.");
                    } finally {
                        btn.disabled = false;
                        btn.innerHTML = 'Send';
                    }
                }
            </script>
        </section>`;

let startIndex = -1;
let endIndex = -1;

// Find corporate section bounds (1490 to 1742 approx)
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<section id="corporate" class="tab-content" role="tabpanel">')) {
        startIndex = i;
    }
    // Search for </section> after the start
    if (startIndex !== -1 && i > startIndex && lines[i].includes('</section>')) {
        // Double check it's the right section end (before english section)
        if (i < lines.length - 1 && lines[i+1].includes('TAB 3: English Communication') || lines[i+2] && lines[i+2].includes('TAB 3: English Communication') || lines[i+3] && lines[i+3].includes('TAB 3: English Communication')) {
            endIndex = i;
            break;
        }
    }
}

if (startIndex !== -1 && endIndex !== -1) {
    console.log(`Replacing corporate section from line ${startIndex} to ${endIndex}`);
    lines.splice(startIndex, endIndex - startIndex + 1, newCorporateContent);
} else {
    console.error('Could not find corporate section');
}

// Now find ai-hr section and remove it (around 3059 to 3258)
let aiHrStart = -1;
let aiHrEnd = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<!-- TAB 9: AI HR Interviewer -->')) {
        aiHrStart = i;
    }
    if (aiHrStart !== -1 && i > aiHrStart && lines[i].includes('</section>')) {
        aiHrEnd = i;
        break;
    }
}

if (aiHrStart !== -1 && aiHrEnd !== -1) {
    console.log(`Removing ai-hr section from line ${aiHrStart} to ${aiHrEnd}`);
    lines.splice(aiHrStart, aiHrEnd - aiHrStart + 1);
} else {
    console.error('Could not find ai-hr section');
}

fs.writeFileSync('frontend/app.html', lines.join('\n'), 'utf8');
console.log('Done!');
