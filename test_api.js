const http = require('http');

const data = JSON.stringify({ message: "Please start the HR interview for Apple." });

const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/ai/hr-interviewer',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': 'Bearer ' // maybe no token?
    }
}, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => console.log("Status:", res.statusCode, "Body:", body));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
