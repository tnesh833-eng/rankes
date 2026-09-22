const fs = require('fs');

let html = fs.readFileSync('frontend/app.html', 'utf8');

// 1. Update the setup screen to include the textarea
const oldSetupScreen = `                    <!-- Resume Upload -->
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
                    </button>`;

const newSetupScreen = `                    <!-- Context Inputs -->
                    <div style="width:100%; max-width:500px; display:flex; flex-direction:column; gap:16px;">
                        <!-- Job Description -->
                        <div>
                            <label style="display:block; font-size:0.8rem; color:#94a3b8; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.05em;">📝 Job Description / Profile</label>
                            <textarea id="hrJobDescription" placeholder="Paste the job description or specific role requirements here..." style="width:100%; height:80px; padding:12px; border-radius:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; font-family:inherit; font-size:0.85rem; outline:none; resize:none;"></textarea>
                        </div>
                        
                        <!-- Resume Upload -->
                        <div>
                            <label style="display:block; font-size:0.8rem; color:#94a3b8; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.05em;">📄 Upload Resume (Optional)</label>
                            <div id="hrResumeDropZone" style="border:2px dashed rgba(99,102,241,0.4); border-radius:12px; padding:16px; text-align:center; cursor:pointer; background:rgba(99,102,241,0.05); transition:all 0.2s;" onclick="document.getElementById('hrResumeFile').click()" ondragover="event.preventDefault(); this.style.borderColor='#6366f1'; this.style.background='rgba(99,102,241,0.12)'" ondragleave="this.style.borderColor='rgba(99,102,241,0.4)'; this.style.background='rgba(99,102,241,0.05)'" ondrop="handleHrResumeDrop(event)">
                                <div style="font-size:1.4rem; margin-bottom:4px;">📎</div>
                                <div id="hrResumeLabel" style="color:#94a3b8; font-size:0.8rem;">Drag & drop resume</div>
                            </div>
                            <input type="file" id="hrResumeFile" accept=".pdf,.docx,.txt" style="display:none;" onchange="handleHrResumeSelect(this)">
                        </div>
                    </div>

                    <button id="hrStartBtn" onclick="startHrInterview()" style="padding:14px 40px; border-radius:12px; background:linear-gradient(135deg,#6366f1,#8b5cf6); border:none; color:#fff; font-size:1rem; font-weight:800; cursor:pointer; box-shadow:0 4px 24px rgba(99,102,241,0.4); transition:all 0.2s; letter-spacing:0.03em;" onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'">
                        ▶ Start Interview
                    </button>`;

html = html.replace(oldSetupScreen, newSetupScreen);

// 2. Update the speech recognition init and logic
const oldSpeechInit = `                // Speech Recognition Setup
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
                })();`;

const newSpeechInit = `                // Speech Recognition Setup
                (function() {
                    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
                    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
                    hrRecognition = new SR();
                    hrRecognition.continuous = true;
                    hrRecognition.interimResults = true;
                    hrRecognition.lang = 'en-US';

                    hrRecognition.onstart = function() {
                        hrRecognizing = true;
                        const btn = document.getElementById('hrMicBtn');
                        btn.style.background = 'rgba(244,63,94,0.5)';
                        btn.style.boxShadow = '0 0 24px rgba(244,63,94,0.8)';
                        btn.innerHTML = '⏹️';
                        btn.title = "Click to stop recording and send";
                        document.getElementById('hrMicIndicator').textContent = '🟢';
                        document.getElementById('hrUserMicStatus').style.color = '#10b981';
                    };
                    hrRecognition.onresult = function(e) {
                        let finalTrans = '';
                        let interimTrans = '';
                        for (let i = e.resultIndex; i < e.results.length; ++i) {
                            if (e.results[i].isFinal) finalTrans += e.results[i][0].transcript;
                            else interimTrans += e.results[i][0].transcript;
                        }
                        const inp = document.getElementById('aiHrInput');
                        // Just append or replace text while speaking
                        if (finalTrans) {
                            inp.value = (inp.value + ' ' + finalTrans).trim();
                        } else if (interimTrans) {
                            // Show interim in a slightly hacky way or just update input if it's empty
                            // Actually it's better to just set input value to whatever we have + interim
                            if (!inp.dataset.baseVal) inp.dataset.baseVal = inp.value;
                            inp.value = (inp.dataset.baseVal + ' ' + interimTrans).trim();
                        }
                        if (finalTrans) inp.dataset.baseVal = inp.value;
                    };
                    hrRecognition.onerror = function(e) {
                        console.error('HR mic error:', e.error);
                        stopHrMicUI();
                    };
                    hrRecognition.onend = function() {
                        stopHrMicUI();
                        // If there is text, send it automatically when voice session ends manually
                        const inp = document.getElementById('aiHrInput');
                        if (inp.value.trim().length > 0) {
                            sendHrMeetingMessage();
                        }
                    };
                })();`;

html = html.replace(oldSpeechInit, newSpeechInit);

// 3. Update the toggleHrMic logic
const oldToggleMic = `                function toggleHrMic() {
                    if (!hrRecognition) return alert('Speech recognition not supported in your browser. Please use Chrome.');
                    hrRecognizing ? hrRecognition.stop() : hrRecognition.start();
                }`;

const newToggleMic = `                function toggleHrMic() {
                    if (!hrRecognition) return alert('Speech recognition not supported in your browser. Please use Chrome.');
                    const inp = document.getElementById('aiHrInput');
                    if (hrRecognizing) {
                        hrRecognition.stop();
                    } else {
                        inp.dataset.baseVal = inp.value;
                        hrRecognition.start();
                    }
                }`;
html = html.replace(oldToggleMic, newToggleMic);

// 4. Update the stopHrMicUI
const oldStopMicUI = `                function stopHrMicUI() {
                    hrRecognizing = false;
                    const btn = document.getElementById('hrMicBtn');
                    if (!btn) return;
                    btn.style.background = 'rgba(244,63,94,0.15)';
                    btn.style.boxShadow = '0 4px 16px rgba(244,63,94,0.2)';
                    btn.innerHTML = '🎤';
                    document.getElementById('hrMicIndicator').textContent = '🔴';
                    document.getElementById('hrUserMicStatus').style.color = '#64748b';
                }`;

const newStopMicUI = `                function stopHrMicUI() {
                    hrRecognizing = false;
                    const btn = document.getElementById('hrMicBtn');
                    if (!btn) return;
                    btn.style.background = 'rgba(244,63,94,0.15)';
                    btn.style.boxShadow = '0 4px 16px rgba(244,63,94,0.2)';
                    btn.innerHTML = '🎤';
                    btn.title = "Click to speak your answer";
                    document.getElementById('hrMicIndicator').textContent = '🔴';
                    document.getElementById('hrUserMicStatus').style.color = '#64748b';
                    document.getElementById('aiHrInput').dataset.baseVal = '';
                }`;
html = html.replace(oldStopMicUI, newStopMicUI);

// 5. Update startHrInterview
const oldStart = `                function startHrInterview() {
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
                }`;

const newStart = `                async function startHrInterview() {
                    const btn = document.getElementById('hrStartBtn');
                    btn.disabled = true;
                    btn.innerHTML = '⏳ Saving context...';
                    
                    const company = document.getElementById('aiHrCompany').value;
                    const jd = document.getElementById('hrJobDescription').value.trim();
                    let fullContext = jd;
                    if (hrResumeText) fullContext += "\\n\\n--- RESUME ---\\n" + hrResumeText;
                    
                    try {
                        const token = localStorage.getItem('rh_auth_token') || '';
                        await fetch('/api/ai/hr-context', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                            body: JSON.stringify({ company: company, context: fullContext })
                        });
                    } catch(e) {
                        console.error('Failed to save context', e);
                    }

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
                    const initialMsg = 'Please start the HR interview for ' + company + '.';
                    sendHrToApi(initialMsg, true);
                }`;

html = html.replace(oldStart, newStart);

// 6. Update error handler in sendHrToApi to not show generic "Error — please try again."
const oldSendApi = `                        const data = await res.json();
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
                    }`;

const newSendApi = `                        const data = await res.json();
                        if (data.reply) {
                            if (!isSystemMessage) hrChatHistory.push({ role: 'user', content: text });
                            hrChatHistory.push({ role: 'ai', content: data.reply });
                            setAiSpeaking(true, data.reply);
                            addHrTranscript('HR', data.reply);
                            playHrVoice(data.reply);
                            setTimeout(() => setAiSpeaking(false, data.reply), Math.min(data.reply.length * 60, 8000));
                        } else {
                            document.getElementById('hrAiStatus').textContent = '🟠 Error';
                            document.getElementById('hrAiSubtitle').textContent = data.error || 'Server error. Please try again.';
                            addHrTranscript('System', 'Failed to get response: ' + (data.error || 'Unknown error'));
                        }
                    } catch(e) {
                        document.getElementById('hrAiStatus').textContent = '🔴 Connection error';
                        document.getElementById('hrAiSubtitle').textContent = 'Network error. Please refresh and try again.';
                        addHrTranscript('System', 'Network error while contacting AI server.');
                    }`;

html = html.replace(oldSendApi, newSendApi);

fs.writeFileSync('frontend/app.html', html, 'utf8');
console.log('Successfully patched app.html for voice and DB context.');
