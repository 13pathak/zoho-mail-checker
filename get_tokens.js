// Token Generator for Zoho Mail Checker
// Run: node get_tokens.js "YOUR_CODE_HERE" "YOUR_CLIENT_ID" "YOUR_CLIENT_SECRET" "REGION"
// 
// Example:
// node get_tokens.js "1000.xxxxx.xxxxx" "1000.XXXXXXXXXX" "xxxxxxxxxxxxxxx" "in"

const https = require('https');
const readline = require('readline');

// Parse command line arguments
let [code, clientId, clientSecret, region] = process.argv.slice(2);

// Prompt for missing values
async function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function main() {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║     Zoho Mail Checker - Token Generator                   ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    // Get values from args or prompt
    if (!code) {
        console.log('Generate an authorization code from Zoho API Console:');
        console.log('1. Go to https://api-console.zoho.in/ (or your region)');
        console.log('2. Select Self Client → Generate Code tab');
        console.log('3. Enter scopes: ZohoMail.messages.ALL,ZohoMail.folders.ALL,ZohoMail.accounts.ALL');
        console.log('4. Click Create and copy the code\n');
        code = await prompt('Enter authorization code: ');
    }

    if (!clientId) {
        console.log('\nGet Client ID from Zoho API Console → Self Client → Client Secret tab\n');
        clientId = await prompt('Enter Client ID: ');
    }

    if (!clientSecret) {
        console.log('\nGet Client Secret from Zoho API Console → Self Client → Client Secret tab\n');
        clientSecret = await prompt('Enter Client Secret: ');
    }

    if (!region) {
        console.log('\nSelect your Zoho region:');
        console.log('  in  - India (zoho.in)');
        console.log('  com - United States (zoho.com)');
        console.log('  eu  - Europe (zoho.eu)');
        console.log('  au  - Australia (zoho.com.au)\n');
        region = await prompt('Enter region (default: in): ') || 'in';
    }

    // Validate inputs
    if (!code || !clientId || !clientSecret) {
        console.error('\n❌ Error: All fields are required!');
        process.exit(1);
    }

    // Determine the correct domain
    const domains = {
        'in': 'accounts.zoho.in',
        'com': 'accounts.zoho.com',
        'eu': 'accounts.zoho.eu',
        'au': 'accounts.zoho.com.au'
    };
    const hostname = domains[region] || domains['in'];

    // Exchange code for tokens
    const params = new URLSearchParams({
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code'
    });

    const postData = params.toString();

    const options = {
        hostname: hostname,
        port: 443,
        path: '/oauth/v2/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    console.log(`\nExchanging code for tokens via ${hostname}...\n`);

    const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.access_token) {
                    console.log('╔═══════════════════════════════════════════════════════════╗');
                    console.log('║                    ✅ SUCCESS!                            ║');
                    console.log('╚═══════════════════════════════════════════════════════════╝\n');
                    console.log('REFRESH TOKEN (copy this to Settings):');
                    console.log('─'.repeat(60));
                    console.log(json.refresh_token || 'N/A');
                    console.log('─'.repeat(60));
                    console.log('\nACCESS TOKEN (for testing, expires in', json.expires_in, 'seconds):');
                    console.log(json.access_token.substring(0, 50) + '...');
                    console.log('\n✅ Now paste the REFRESH TOKEN in the extension Settings page!');
                } else {
                    console.log('❌ Error:', JSON.stringify(json, null, 2));
                    console.log('\nCommon issues:');
                    console.log('- Code expired (codes are only valid for ~10 minutes)');
                    console.log('- Wrong Client ID or Secret');
                    console.log('- Wrong region selected');
                }
            } catch (e) {
                console.log('Response:', data);
            }
        });
    });

    req.on('error', (e) => {
        console.error('Request error:', e.message);
    });

    req.write(postData);
    req.end();
}

main().catch(console.error);
