const fs = require('fs');

const newCorporateSection = `        <section id="corporate" class="tab-content" role="tabpanel">
            <!-- HR INTERVIEW MEETING ROOM -->
            <div style="background:linear-gradient(135deg,#0d0d1a 0%,#0f172a 100%); border-radius:16px; overflow:hidden; font-family:'Outfit',sans-serif; border:1px solid rgba(99,102,241,0.2); box-shadow:0 8px 40px rgba(0,0,0,0.5);">

                <!-- Top Bar: Meeting Header -->
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 20px; background:rgba(0,0,0,0.4); border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:10px; height:10px; background:#ef4444; border-radius:50%; animation:hrPulse 1.5s infinite;"></div>
                        <span style="color:#e2e8f0; font-weight:700; font-size:0.95rem;">🎙️ AI HR Interview — Live Session</span>
                        <span id="hrSessionTimer" style="font-size:0.8rem; color:#64748b; font-family:monospace; background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:6px;">00:00</span>
                    </div>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <select id="aiHrCompany" style="padding:6px 12px; border-radius:8px; background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.4); color:#e2e8f0; font-size:0.85rem; outline:none; font-weight:600; cursor:pointer;">
                            <option value="Nvidia">🟢 Nvidia</option>
                            <option value="Apple">🍎 Apple</option>
                            <option value="Meta">🔵 Meta</option>
                            <option value="Adobe">🔴 Adobe</option>
                            <option value="Spotify">🟩 Spotify</option>
                            <option value="Google">🔵 Google</option>
                            <option value="Microsoft">🪟 Microsoft</option>
                            <option value="Amazon">🟠 Amazon</option>
                        </select>
                        <button id="aiHrVoiceToggle" onclick="toggleHrVoice()" style="padding:6px 14px; border-radius:8px; background:rgba(16,185,129,0.15); border:1px solid #10b981; color:#34d399; font-size:0.8rem; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:5px;">
                            🔊 Voice On
                        </button>
                    </div>
                </div>

                <!-- Setup Screen -->
                <div id="hrSetupScreen" style="padding:32px 24px; display:flex; flex-direction:column; align-items:center; gap:20px; min-height:420px; justify-content:center;">
                    <div style="width:90px; height:90px; border-radius:50%; background:linear-gradient(135deg,#6366f1,#8b5cf6); display:flex; align-items:center; justify-content:center; font-size:2.5rem; box-shadow:0 0 40px rgba(99,102,241,0.4);">👔</div>
                    <h3 style="color:#fff; font-size:1.3rem; font-weight:700; margin:0; text-align:center;">Ready to Start Your HR Interview?</h3>
                    <p style="color:#94a3b8; font-size:0.9rem; text-align:center; max-width:420px; margin:0; line-height:1.6;">
                        Upload your resume (optional) so the AI HR can ask questions tailored to your skills. Then click <strong style="color:#8b5cf6;">Start Interview</strong> to begin your live session.
                    </p>

                    <!-- Resume Upload -->
                    <div style="width:100%; max-width:460px;">
                        <label style="display:block; font-size:0.8rem; color:#94a3b8; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.05em;">📄 Upload Resume (PDF / DOCX)</label>
                        <div id="hrResumeDropZone" style="border:2px dashed rgba(99,102,241,0.4); border-radius:12px; padding:20px; text-align:center; cursor:pointer; background:rgba(99,102,241,0.05); transition:all 0.2s;" onclick="document.getElementById('hrResumeFile').click()" ondragover="event.preventDefault(); this.style.borderColor='#6366f1'; this.style.background='rgba(99,102,241,0.12)'" ondragleave="this.style.borderColor='rgba(99,102,241,0.4)'; this.style.background='rgba(99,102,241,0.05)'" ondrop="handleHrResumeDrop(event)">
                            <div style="font-size:1.8rem; margin-bottom:6px;">📎</div>
                            <div id="hrResumeLabel" style="color:#94a3b8; font-size:0.85rem;">Drag & drop or click to upload</div>
                        </div>
                        <input type="file" id="hrResumeFile" accept=".pdf,.docx,.txt" style="display:none;" onchange="handleHrResumeSelect(this)">
                    </div>

                    <button onclick="startHrInterview()" style="padding:14px 40px; border-radius:12px; background:linear-gradient(135deg,#6366f1,#8b5cf6); border:none; color:#fff; font-size:1rem; font-weight:800; cursor:pointer; box-shadow:0 4px 24px rgba(99,102,241,0.4); transition:all 0.2s; letter-spacing:0.03em;" onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'">
                        ▶ Start Interview
                    </button>
                </div>

                <!-- Live Interview Room (hidden until started) -->
                <div id="hrInterviewRoom" style="display:none; flex-direction:column;">

                    <!-- Video Grid -->
                    <div style="display:grid; grid-template-columns:1fr 260px; gap:0; min-height:340px; position:relative;">

                        <!-- AI HR Video Panel (main) -->
                        <div style="position:relative; background:linear-gradient(145deg,#0f1629,#1a0f2e); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:28px; gap:16px;">
                            <!-- Animated Speaking Rings -->
                            <div id="hrAiSpeakingRing" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; opacity:0; transition:opacity 0.3s;">
                                <div style="width:220px; height:220px; border-radius:50%; border:2px solid rgba(99,102,241,0.5); animation:hrRingPulse 1.5s ease-out infinite;"></div>
                                <div style="position:absolute; width:240px; height:240px; border-radius:50%; border:2px solid rgba(139,92,246,0.3); animation:hrRingPulse 1.5s ease-out 0.3s infinite;"></div>
                            </div>

                            <!-- AI Avatar -->
                            <div style="width:140px; height:140px; border-radius:50%; overflow:hidden; border:3px solid #6366f1; box-shadow:0 0 30px rgba(99,102,241,0.5); flex-shrink:0; z-index:1; position:relative;">
                                <img src="3d_avatar.jpg" alt="AI HR" style="width:100%; height:100%; object-fit:cover;">
                            </div>

                            <!-- AI Name Tag -->
                            <div style="z-index:1; text-align:center;">
                                <div style="font-size:1rem; font-weight:800; color:#fff;">AI HR Manager</div>
                                <div id="hrAiStatus" style="font-size:0.8rem; color:#10b981; font-weight:600; margin-top:3px;">🟢 Online — Ready</div>
                            </div>

                            <!-- AI Speech Subtitle -->
                            <div id="hrAiSubtitle" style="position:absolute; bottom:16px; left:16px; right:16px; background:rgba(0,0,0,0.7); border-radius:8px; padding:10px 14px; font-size:0.85rem; color:#e2e8f0; line-height:1.5; text-align:center; min-height:42px; display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,0.08);">
                                <em style="color:#64748b;">Waiting to start...</em>
                            </div>
                        </div>

                        <!-- User Camera Panel (right sidebar) -->
                        <div style="background:#0a0a14; border-left:1px solid rgba(255,255,255,0.06); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; gap:10px; position:relative;">
                            <!-- User camera feed -->
                            <div style="width:100%; aspect-ratio:4/3; border-radius:10px; background:#111827; border:2px solid rgba(56,189,248,0.3); overflow:hidden; position:relative; display:flex; align-items:center; justify-content:center;">
                                <video id="hrUserCamera" autoplay muted playsinline style="width:100%; height:100%; object-fit:cover; display:none;"></video>
                                <div id="hrCameraOff" style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                                    <div style="width:56px; height:56px; border-radius:50%; background:rgba(56,189,248,0.1); border:2px solid rgba(56,189,248,0.3); display:flex; align-items:center; justify-content:center; font-size:1.5rem;">👤</div>
                                    <span style="color:#475569; font-size:0.75rem;">Camera Off</span>
                                </div>
                            </div>
                            <div style="font-size:0.85rem; font-weight:700; color:#38bdf8;">You</div>
                            <div id="hrUserMicStatus" style="font-size:0.72rem; color:#64748b; display:flex; align-items:center; gap:4px;">
                                <span id="hrMicIndicator">🔴</span> Mic off
                            </div>

                            <!-- Quick Camera Toggle -->
                            <button onclick="toggleHrCamera()" id="hrCameraBtn" style="margin-top:6px; padding:6px 14px; border-radius:8px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#94a3b8; font-size:0.78rem; cursor:pointer;">📷 Enable Camera</button>
                        </div>
                    </div>

                    <!-- Live Transcript Area -->
                    <div style="padding:14px 20px; background:rgba(0,0,0,0.25); border-top:1px solid rgba(255,255,255,0.06);">
                        <div style="font-size:0.75rem; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px; font-weight:700;">📝 Live Transcript</div>
                        <div id="hrTranscript" style="font-size:0.85rem; color:#94a3b8; min-height:52px; max-height:90px; overflow-y:auto; line-height:1.6; padding-right:8px; font-style:italic;">
                            Transcript will appear here as the interview progresses...
                        </div>
                    </div>

                    <!-- Meeting Controls Bar -->
                    <div style="display:flex; justify-content:center; align-items:center; gap:14px; padding:16px 20px; background:rgba(0,0,0,0.4); border-top:1px solid rgba(255,255,255,0.06);">

                        <!-- Mic Button -->
                        <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                            <button id="hrMicBtn" onclick="toggleHrMic()" style="width:56px; height:56px; border-radius:50%; background:rgba(244,63,94,0.15); border:2px solid #f43f5e; color:#fb7185; font-size:1.5rem; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 16px rgba(244,63,94,0.2);" title="Click to speak your answer">
                                🎤
                            </button>
                            <span style="font-size:0.7rem; color:#94a3b8;">Speak</span>
                        </div>

                        <!-- Type Answer + Send -->
                        <div style="flex:1; max-width:480px; position:relative;">
                            <input type="text" id="aiHrInput" placeholder="Or type your answer here and press Enter..." style="width:100%; padding:13px 60px 13px 18px; border-radius:28px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#fff; font-size:0.9rem; outline:none; box-sizing:border-box;" onkeypress="if(event.key === 'Enter') sendHrMeetingMessage()">
                            <button id="aiHrSendBtn" onclick="sendHrMeetingMessage()" style="position:absolute; right:6px; top:50%; transform:translateY(-50%); padding:6px 18px; border-radius:22px; background:linear-gradient(135deg,#6366f1,#8b5cf6); border:none; color:#fff; font-size:0.85rem; font-weight:700; cursor:pointer; transition:all 0.2s;">
                                Send
                            </button>
                        </div>

                        <!-- End Call -->
                        <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                            <button onclick="endHrInterview()" style="width:56px; height:56px; border-radius:50%; background:#ef4444; border:none; color:#fff; font-size:1.2rem; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 16px rgba(239,68,68,0.4);" title="End Interview">
                                📴
                            </button>
                            <span style="font-size:0.7rem; color:#94a3b8;">End</span>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                @keyframes hrPulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
                @keyframes hrRingPulse { 0%{transform:scale(0.9); opacity:0.8;} 100%{transform:scale(1.6); opacity:0;} }
            </style>

            <script>
                let hrChatHistory = [];
                let hrVoiceEnabled = true;
                let hrRecognizing = false;
                let hrRecognition = null;
                let hrResumeText = '';
                let hrSessionSeconds = 0;
                let hrTimerInterval = null;
                let hrCameraStream = null;

                // Speech Recognition Setup
                (function() {
                    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
                    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
                    hrRecognition = new SR();
                    hrRecognition.continuous = false;
                    hrRecognition.interimResults = false;
                    hrRecognition.lang = 'en-US';

                    hrRecognition.onstart = function() {
                        hrRecognizing = true;
                        const btn = document.getElementById('hrMicBtn');
                        btn.style.background = 'rgba(244,63,94,0.5)';
                        btn.style.boxShadow = '0 0 24px rgba(244,63,94,0.8)';
                        btn.innerHTML = '⏹️';
                        document.getElementById('hrMicIndicator').textContent = '🟢';
                        document.getElementById('hrUserMicStatus').style.color = '#10b981';
                    };
                    hrRecognition.onresult = function(e) {
                        const transcript = e.results[0][0].transcript;
                        document.getElementById('aiHrInput').value = transcript;
                        sendHrMeetingMessage();
                    };
                    hrRecognition.onerror = function(e) {
                        console.error('HR mic error:', e.error);
                        stopHrMicUI();
                    };
                    hrRecognition.onend = stopHrMicUI;
                })();

                function stopHrMicUI() {
                    hrRecognizing = false;
                    const btn = document.getElementById('hrMicBtn');
                    if (!btn) return;
                    btn.style.background = 'rgba(244,63,94,0.15)';
                    btn.style.boxShadow = '0 4px 16px rgba(244,63,94,0.2)';
                    btn.innerHTML = '🎤';
                    document.getElementById('hrMicIndicator').textContent = '🔴';
                    document.getElementById('hrUserMicStatus').style.color = '#64748b';
                }

                function toggleHrMic() {
                    if (!hrRecognition) return alert('Speech recognition not supported in your browser. Please use Chrome.');
                    hrRecognizing ? hrRecognition.stop() : hrRecognition.start();
                }

                function toggleHrVoice() {
                    hrVoiceEnabled = !hrVoiceEnabled;
                    const btn = document.getElementById('aiHrVoiceToggle');
                    if (hrVoiceEnabled) {
                        btn.innerHTML = '🔊 Voice On';
                        btn.style.background = 'rgba(16,185,129,0.15)';
                        btn.style.borderColor = '#10b981';
                        btn.style.color = '#34d399';
                    } else {
                        btn.innerHTML = '🔇 Voice Off';
                        btn.style.background = 'rgba(244,63,94,0.15)';
                        btn.style.borderColor = '#f43f5e';
                        btn.style.color = '#fb7185';
                        window.speechSynthesis && window.speechSynthesis.cancel();
                    }
                }

                function playHrVoice(text) {
                    if (!hrVoiceEnabled || !('speechSynthesis' in window)) return;
                    window.speechSynthesis.cancel();
                    const u = new SpeechSynthesisUtterance(text);
                    const voices = window.speechSynthesis.getVoices();
                    const v = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Female') || v.name.includes('Zira')));
                    if (v) u.voice = v;
                    u.rate = 1.0; u.pitch = 1.05;
                    window.speechSynthesis.speak(u);
                }

                function handleHrResumeDrop(e) {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) processHrResumeFile(file);
                }

                function handleHrResumeSelect(input) {
                    if (input.files[0]) processHrResumeFile(input.files[0]);
                }

                function processHrResumeFile(file) {
                    const label = document.getElementById('hrResumeLabel');
                    label.textContent = '⏳ Reading ' + file.name + '...';
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        hrResumeText = e.target.result.substring(0, 3000); // limit to 3000 chars
                        label.textContent = '✅ ' + file.name + ' ready!';
                        document.getElementById('hrResumeLabel').style.color = '#34d399';
                    };
                    reader.readAsText(file);
                }

                function startHrInterview() {
                    document.getElementById('hrSetupScreen').style.display = 'none';
                    document.getElementById('hrInterviewRoom').style.display = 'flex';
                    hrSessionSeconds = 0;
                    hrTimerInterval = setInterval(() => {
                        hrSessionSeconds++;
                        const m = String(Math.floor(hrSessionSeconds/60)).padStart(2,'0');
                        const s = String(hrSessionSeconds%60).padStart(2,'0');
                        const el = document.getElementById('hrSessionTimer');
                        if (el) el.textContent = m + ':' + s;
                    }, 1000);

                    // AI sends first message
                    const company = document.getElementById('aiHrCompany').value;
                    const initialMsg = hrResumeText
                        ? 'Please start the interview for ' + company + '. Here is the candidate resume:\\n' + hrResumeText
                        : 'Please start the HR interview for ' + company + '.';
                    sendHrToApi(initialMsg, true);
                }

                function endHrInterview() {
                    if (hrTimerInterval) clearInterval(hrTimerInterval);
                    if (hrRecognizing && hrRecognition) hrRecognition.stop();
                    if (hrCameraStream) { hrCameraStream.getTracks().forEach(t => t.stop()); hrCameraStream = null; }
                    window.speechSynthesis && window.speechSynthesis.cancel();
                    hrChatHistory = [];
                    document.getElementById('hrInterviewRoom').style.display = 'none';
                    document.getElementById('hrSetupScreen').style.display = 'flex';
                    document.getElementById('hrAiStatus').textContent = '🟢 Online — Ready';
                    document.getElementById('hrAiSubtitle').innerHTML = '<em style="color:#64748b;">Waiting to start...</em>';
                    document.getElementById('hrTranscript').textContent = 'Transcript will appear here as the interview progresses...';
                }

                async function toggleHrCamera() {
                    const video = document.getElementById('hrUserCamera');
                    const cameraOff = document.getElementById('hrCameraOff');
                    const btn = document.getElementById('hrCameraBtn');
                    if (hrCameraStream) {
                        hrCameraStream.getTracks().forEach(t => t.stop());
                        hrCameraStream = null;
                        video.style.display = 'none';
                        cameraOff.style.display = 'flex';
                        btn.textContent = '📷 Enable Camera';
                    } else {
                        try {
                            hrCameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                            video.srcObject = hrCameraStream;
                            video.style.display = 'block';
                            cameraOff.style.display = 'none';
                            btn.textContent = '📷 Disable Camera';
                        } catch(e) {
                            alert('Camera access denied. Please allow camera in browser settings.');
                        }
                    }
                }

                function addHrTranscript(who, text) {
                    const t = document.getElementById('hrTranscript');
                    const line = document.createElement('div');
                    line.style.marginBottom = '4px';
                    line.innerHTML = '<strong style="color:' + (who === 'HR' ? '#8b5cf6' : '#38bdf8') + ';">' + who + ':</strong> ' + text;
                    t.appendChild(line);
                    t.scrollTop = t.scrollHeight;
                }

                function setAiSpeaking(isSpeaking, text) {
                    const ring = document.getElementById('hrAiSpeakingRing');
                    const status = document.getElementById('hrAiStatus');
                    const subtitle = document.getElementById('hrAiSubtitle');
                    if (ring) ring.style.opacity = isSpeaking ? '1' : '0';
                    if (status) status.textContent = isSpeaking ? '🟣 Speaking...' : '🟢 Listening';
                    if (subtitle && text) subtitle.textContent = text;
                }

                async function sendHrMeetingMessage() {
                    const inp = document.getElementById('aiHrInput');
                    const text = inp.value.trim();
                    if (!text) return;
                    inp.value = '';
                    addHrTranscript('You', text);
                    hrChatHistory.push({ role: 'user', content: text });
                    await sendHrToApi(text, false);
                }

                async function sendHrToApi(text, isSystemMessage) {
                    const company = document.getElementById('aiHrCompany').value;
                    const btn = document.getElementById('aiHrSendBtn');
                    if (btn) { btn.disabled = true; btn.innerHTML = '...'; }
                    setAiSpeaking(false, '⏳ Thinking...');
                    document.getElementById('hrAiStatus').textContent = '🟡 Thinking...';

                    try {
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
                        const data = await res.json();
                        if (data.reply) {
                            if (!isSystemMessage) hrChatHistory.push({ role: 'user', content: text });
                            hrChatHistory.push({ role: 'ai', content: data.reply });
                            setAiSpeaking(true, data.reply);
                            addHrTranscript('HR', data.reply);
                            playHrVoice(data.reply);
                            setTimeout(() => setAiSpeaking(false, data.reply), Math.min(data.reply.length * 60, 8000));
                        } else {
                            document.getElementById('hrAiStatus').textContent = '🟢 Listening';
                            document.getElementById('hrAiSubtitle').textContent = 'Error — please try again.';
                        }
                    } catch(e) {
                        document.getElementById('hrAiStatus').textContent = '🔴 Connection error';
                        document.getElementById('hrAiSubtitle').textContent = 'Network error. Please refresh and try again.';
                    } finally {
                        if (btn) { btn.disabled = false; btn.innerHTML = 'Send'; }
                    }
                }
            </script>
        </section>`;

let content = fs.readFileSync('frontend/app.html', 'utf8');
const lines = content.split('\n');

let startIdx = -1, endIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<section id="corporate" class="tab-content" role="tabpanel">')) startIdx = i;
    if (startIdx !== -1 && i > startIdx && lines[i].includes('</section>')) {
        // Check next meaningful line is english tab
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === '') j++;
        if (lines[j] && lines[j].includes('TAB 3: English Communication')) {
            endIdx = i; break;
        }
    }
}

if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find corporate section. startIdx=' + startIdx + ' endIdx=' + endIdx);
    process.exit(1);
}

console.log('Replacing lines ' + startIdx + ' to ' + endIdx);
lines.splice(startIdx, endIdx - startIdx + 1, newCorporateSection);
fs.writeFileSync('frontend/app.html', lines.join('\n'), 'utf8');
console.log('Done! Total lines now: ' + lines.length);
