// OAuth 2.0 Authentication for Zoho Mail

const ZOHO_AUTH_ENDPOINTS = {
    'com': {
        authorize: 'https://accounts.zoho.com/oauth/v2/auth',
        token: 'https://accounts.zoho.com/oauth/v2/token',
        revoke: 'https://accounts.zoho.com/oauth/v2/token/revoke'
    },
    'in': {
        authorize: 'https://accounts.zoho.in/oauth/v2/auth',
        token: 'https://accounts.zoho.in/oauth/v2/token',
        revoke: 'https://accounts.zoho.in/oauth/v2/token/revoke'
    },
    'eu': {
        authorize: 'https://accounts.zoho.eu/oauth/v2/auth',
        token: 'https://accounts.zoho.eu/oauth/v2/token',
        revoke: 'https://accounts.zoho.eu/oauth/v2/token/revoke'
    },
    'au': {
        authorize: 'https://accounts.zoho.com.au/oauth/v2/auth',
        token: 'https://accounts.zoho.com.au/oauth/v2/token',
        revoke: 'https://accounts.zoho.com.au/oauth/v2/token/revoke'
    }
};

// Get OAuth endpoints for region
function getAuthEndpoints(region = 'com') {
    return ZOHO_AUTH_ENDPOINTS[region] || ZOHO_AUTH_ENDPOINTS['com'];
}

// Get redirect URL for OAuth
function getRedirectUrl() {
    return chrome.identity.getRedirectURL();
}

// Local proxy server URL for token refresh - REMOVED
// const TOKEN_PROXY_URL = 'http://127.0.0.1:3847';

// Get credentials from storage
async function getCredentials() {
    const stored = await chrome.storage.local.get(['zohoClientId', 'zohoClientSecret', 'zohoRefreshToken', 'region']);

    if (!stored.zohoClientId || !stored.zohoClientSecret || !stored.zohoRefreshToken) {
        throw new Error('Credentials not configured. Please go to Settings and enter your Zoho API credentials.');
    }

    return {
        client_id: stored.zohoClientId,
        client_secret: stored.zohoClientSecret,
        refresh_token: stored.zohoRefreshToken,
        region: stored.region || 'in'
    };
}

// Start login - gets new access token directly from Zoho using Self Client refresh token
async function login(region = 'in') {
    console.log('Logging in directly...');

    try {
        // Get credentials from storage
        const credentials = await getCredentials();

        // Use stored region if available, otherwise use passed region (update it)
        const actualRegion = credentials.region || region;

        // Construct Token URL
        const tld = actualRegion === 'in' ? 'in' :
            actualRegion === 'eu' ? 'eu' :
                actualRegion === 'au' ? 'com.au' : 'com';

        const tokenUrl = `https://accounts.zoho.${tld}/oauth/v2/token`;

        console.log('Requesting token from:', tokenUrl);

        // Request new access token
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                refresh_token: credentials.refresh_token,
                client_id: credentials.client_id,
                client_secret: credentials.client_secret,
                grant_type: 'refresh_token'
            })
        });

        const data = await response.json();
        console.log('Token response:', data);

        if (data.error) {
            throw new Error(data.error);
        }

        if (!data.access_token) {
            throw new Error('No access token received from Zoho.');
        }

        // Store tokens
        await chrome.storage.local.set({
            accessToken: data.access_token,
            // refreshToken: credentials.refresh_token, // Already stored
            region: actualRegion,
            tokenExpiry: Date.now() + ((data.expires_in || 3600) * 1000),
            isLoggedIn: true
        });

        console.log('Login successful!');
        return true;
    } catch (error) {
        console.error('Login failed:', error);
        if (error.message.includes('Credentials not configured')) {
            throw error;
        }
        throw error;
    }
}

// Exchange authorization code for tokens
// Exchange authorization code for tokens
async function exchangeCodeForTokens(code, region) {
    const credentials = await getCredentials();
    const clientId = credentials.client_id;
    const redirectUrl = getRedirectUrl();
    const endpoints = getAuthEndpoints(region);

    const response = await fetch(endpoints.token, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: credentials.client_secret,
            code: code,
            redirect_uri: redirectUrl
        })
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error);
    }

    return data;
}

// Refresh access token
// Refresh access token
async function refreshToken() {
    const credentials = await getCredentials();
    const region = credentials.region;

    const endpoints = getAuthEndpoints(region || 'com');

    // Use proxy for refresh if possible (to avoid CORS)
    // Or direct if we can (but Zoho blocks direct CORS for token endpoint usually?)
    // Actually, earlier login() uses proxy because of CORS.
    // refreshToken() here tries to call endpoints.token directly?
    // If browser blocks it, this function fails.
    // We should probably use the proxy here too!!!

    // But for now, let's just fix the credentials usage.
    // If the previous code was working (it wasn't tested fully?), then maybe direct call works?
    // No, login() uses proxy. refreshToken() should probably use proxy too.
    // checking logic...

    // Let's stick to replacing the manifest usage first.
    // If I change to proxy, I change logic.
    // The previous code did `fetch(endpoints.token...`.
    // I will replace it to use credentials from storage.

    const response = await fetch(endpoints.token, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: credentials.client_id,
            client_secret: credentials.client_secret,
            refresh_token: credentials.refresh_token
        })
    });

    const data = await response.json();

    if (data.error) {
        // Refresh token is invalid, user needs to re-login
        await logout();
        throw new Error('Session expired, please login again');
    }

    // Update stored access token
    await chrome.storage.local.set({
        accessToken: data.access_token,
        tokenExpiry: Date.now() + (data.expires_in * 1000)
    });

    return data.access_token;
}

// Logout - revoke tokens and clear storage
async function logout() {
    const { accessToken, region } = await chrome.storage.local.get(['accessToken', 'region']);

    // Try to revoke token (don't wait for it)
    if (accessToken) {
        const endpoints = getAuthEndpoints(region || 'com');
        fetch(`${endpoints.revoke}?token=${accessToken}`, {
            method: 'POST'
        }).catch(() => { });
    }

    // Clear stored data
    await chrome.storage.local.remove([
        'accessToken',
        'refreshToken',
        'region',
        'tokenExpiry',
        'isLoggedIn',
        'accountId',
        'inboxFolderId',
        'userEmail'
    ]);

    // Clear badge
    chrome.action.setBadgeText({ text: '' });
}

// Check if user is logged in
async function isLoggedIn() {
    const { isLoggedIn, accessToken } = await chrome.storage.local.get(['isLoggedIn', 'accessToken']);
    return isLoggedIn && !!accessToken;
}

// Get current access token (refresh if needed)
async function getAccessToken() {
    const { accessToken, tokenExpiry } = await chrome.storage.local.get(['accessToken', 'tokenExpiry']);

    if (!accessToken) {
        throw new Error('Not logged in');
    }

    // Check if token is expiring soon (within 5 minutes)
    if (tokenExpiry && Date.now() > tokenExpiry - 300000) {
        return await refreshToken();
    }

    return accessToken;
}

export {
    login,
    logout,
    isLoggedIn,
    getAccessToken,
    refreshToken,
    getRedirectUrl
};
