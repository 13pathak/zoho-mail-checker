// Zoho Mail API Proxy Server
// This server runs locally and proxies requests to Zoho Mail API
// Required because Zoho blocks browser-originated API requests

const http = require('http');
const https = require('https');

const PORT = 3847;

// CORS headers to allow extension requests
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Zoho-Region',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
};

// Regional domains
const ZOHO_MAIL_DOMAINS = {
    'com': 'mail.zoho.com',
    'in': 'mail.zoho.in',
    'eu': 'mail.zoho.eu',
    'au': 'mail.zoho.com.au'
};

const ZOHO_AUTH_DOMAINS = {
    'com': 'accounts.zoho.com',
    'in': 'accounts.zoho.in',
    'eu': 'accounts.zoho.eu',
    'au': 'accounts.zoho.com.au'
};

// Helper to read request body
function readBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => resolve(body));
    });
}

// Helper to make HTTPS request
function httpsRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

// Handle token refresh requests
async function handleTokenRefresh(req, res) {
    try {
        const body = await readBody(req);
        const { refresh_token, client_id, client_secret, region } = JSON.parse(body);

        const authHost = ZOHO_AUTH_DOMAINS[region] || ZOHO_AUTH_DOMAINS['in'];

        const postData = new URLSearchParams({
            refresh_token,
            client_id,
            client_secret,
            grant_type: 'refresh_token'
        }).toString();

        console.log(`[${new Date().toISOString()}] Token refresh -> ${authHost}`);

        const response = await httpsRequest({
            hostname: authHost,
            port: 443,
            path: '/oauth/v2/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, postData);

        console.log(`[${new Date().toISOString()}] Token response: ${response.status}`);
        res.writeHead(response.status, corsHeaders);
        res.end(response.data);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Token error:`, error.message);
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: error.message }));
    }
}

// Handle API proxy requests
async function handleApiProxy(req, res) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.writeHead(401, corsHeaders);
        res.end(JSON.stringify({ error: 'No authorization header' }));
        return;
    }

    const region = req.headers['x-zoho-region'] || 'in';
    const zohoHost = ZOHO_MAIL_DOMAINS[region] || ZOHO_MAIL_DOMAINS['in'];
    const zohoPath = req.url;

    console.log(`[${new Date().toISOString()}] ${req.method} ${zohoPath} -> ${zohoHost}`);

    const body = await readBody(req);

    try {
        const options = {
            hostname: zohoHost,
            port: 443,
            path: zohoPath,
            method: req.method,
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        if (body && (req.method === 'POST' || req.method === 'PUT')) {
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const response = await httpsRequest(options, body || null);
        console.log(`[${new Date().toISOString()}] Response: ${response.status}`);
        res.writeHead(response.status, corsHeaders);
        res.end(response.data);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error:`, error.message);
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: error.message }));
    }
}

// Main request handler
const server = http.createServer(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }

    // Route requests
    if (req.url === '/token' && req.method === 'POST') {
        await handleTokenRefresh(req, res);
    } else if (req.url.startsWith('/api/')) {
        await handleApiProxy(req, res);
    } else {
        res.writeHead(404, corsHeaders);
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║       Zoho Mail Checker - Local API Proxy Server          ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║  Server running at: http://127.0.0.1:${PORT}                  ║`);
    console.log('║                                                           ║');
    console.log('║  Endpoints:                                               ║');
    console.log('║    POST /token     - Refresh access token                 ║');
    console.log('║    GET  /api/*     - Proxy to Zoho Mail API               ║');
    console.log('║                                                           ║');
    console.log('║  Press Ctrl+C to stop                                     ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down proxy server...');
    server.close(() => process.exit(0));
});
