// Zoho Mail API wrapper
// API Documentation: https://www.zoho.com/mail/help/api/
// Uses local proxy server to bypass Zoho's browser restrictions

// Local proxy server URL
const PROXY_BASE = 'http://127.0.0.1:3847/api';

// Get the API base URL (uses local proxy)
async function getApiBase() {
    return PROXY_BASE;
}

// Make authenticated API request through proxy
async function apiRequest(endpoint, options = {}) {
    const { accessToken, region } = await chrome.storage.local.get(['accessToken', 'region']);

    if (!accessToken) {
        throw new Error('Not authenticated');
    }

    const apiBase = await getApiBase();
    const url = `${apiBase}${endpoint}`;

    console.log('API Request (via proxy):', url);
    console.log('Token (first 20 chars):', accessToken.substring(0, 20) + '...');

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Zoho-Region': region || 'in',
                ...options.headers
            }
        });

        console.log('API Response status:', response.status);

        if (response.status === 401) {
            // Token expired, try to refresh
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                return apiRequest(endpoint, options);
            }
            throw new Error('Authentication expired');
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText };
            }
            throw new Error(errorData.data?.errorMessage || errorData.error || `API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('API Response data:', data);
        return data;
    } catch (error) {
        // Check if proxy server is running
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            throw new Error('Proxy server not running. Please start the server first.');
        }
        throw error;
    }
}

// Get all user accounts
async function getAccounts() {
    const response = await apiRequest('/accounts');
    return response.data || [];
}

// Get all folders for an account
async function getFolders(accountId) {
    const response = await apiRequest(`/accounts/${accountId}/folders`);
    return response.data || [];
}

// Get inbox folder ID
// Get inbox folder ID
async function getInboxFolderId(accountId) {
    try {
        const folders = await getFolders(accountId);
        const inbox = folders.find(f => f.folderName?.toLowerCase() === 'inbox' || f.path?.toLowerCase() === '/inbox');
        return inbox?.folderId;
    } catch (error) {
        console.warn('Failed to get folders, defaulting to null:', error);
        return null;
    }
}

// Get list of emails
async function getEmails(accountId, options = {}) {
    const {
        folderId,
        limit = 20,
        start = 1,
        status = 'all', // 'read', 'unread', 'all'
        includeto = true
    } = options;

    const params = new URLSearchParams({
        limit: limit.toString(),
        start: start.toString(),
        status,
        includeto: includeto.toString(),
        sortBy: 'date',
        sortorder: 'false' // false = descending (newest first)
    });

    if (folderId) {
        params.append('folderId', folderId);
    }

    const response = await apiRequest(`/accounts/${accountId}/messages/view?${params}`);
    return response.data || [];
}

// Get email content
async function getEmailContent(accountId, folderId, messageId) {
    const response = await apiRequest(
        `/accounts/${accountId}/folders/${folderId}/messages/${messageId}/content?includeBlockContent=true`
    );
    return response.data || {};
}

// Get email details/headers
async function getEmailDetails(accountId, messageId) {
    const response = await apiRequest(`/accounts/${accountId}/messages/${messageId}`);
    return response.data || {};
}

// Search emails
async function searchEmails(accountId, searchKey) {
    // Determine sort order
    // Default to dateDesc (Newest first)
    return apiRequest(`/accounts/${accountId}/messages/search?searchKey=${encodeURIComponent(searchKey)}&sortorder=false&limit=25`);
}

// Send email
async function sendEmail(accountId, emailData) {
    const { to, subject, content } = emailData;

    return apiRequest(`/accounts/${accountId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
            toAddress: to,
            subject: subject,
            content: content
        })
    });
}

// Mark emails as read
async function markAsRead(accountId, messageIds) {
    if (!Array.isArray(messageIds)) messageIds = [messageIds];

    return apiRequest(`/accounts/${accountId}/updatemessage`, {
        method: 'PUT',
        body: JSON.stringify({
            mode: 'markAsRead',
            messageId: messageIds
        })
    });
}

// Mark emails as unread
async function markAsUnread(accountId, messageIds) {
    if (!Array.isArray(messageIds)) messageIds = [messageIds];

    return apiRequest(`/accounts/${accountId}/updatemessage`, {
        method: 'PUT',
        body: JSON.stringify({
            mode: 'markAsUnread',
            messageId: messageIds
        })
    });
}

// Delete emails (move to trash)
// Delete emails (move to trash)
async function deleteEmails(accountId, messageIds, folderId) {
    if (!Array.isArray(messageIds)) messageIds = [messageIds];

    try {
        // Get trash folder ID
        // Get trash folder ID - check multiple common names
        const folders = await getFolders(accountId);
        const trash = folders.find(f => {
            const name = f.folderName?.toLowerCase();
            const path = f.path?.toLowerCase();
            return name === 'trash' || name === 'bin' || name === 'deleted items' ||
                path === '/trash' || path === '/bin';
        });

        if (!trash) {
            console.error('Available folders:', folders.map(f => f.folderName));
            throw new Error('Trash folder not found. Please check your folder names.');
        }

        return apiRequest(`/accounts/${accountId}/updatemessage`, {
            method: 'PUT',
            body: JSON.stringify({
                mode: 'moveMessage',
                messageId: messageIds,
                destfolderId: trash.folderId
            })
        });
    } catch (error) {
        console.error('Delete failed:', error);
        throw error;
    }
}

// Archive emails
async function archiveEmails(accountId, messageIds) {
    if (!Array.isArray(messageIds)) messageIds = [messageIds];

    return apiRequest(`/accounts/${accountId}/updatemessage`, {
        method: 'PUT',
        body: JSON.stringify({
            mode: 'archive',
            messageId: messageIds
        })
    });
}

// Mark as spam
async function markAsSpam(accountId, messageIds) {
    if (!Array.isArray(messageIds)) messageIds = [messageIds];

    return apiRequest(`/accounts/${accountId}/updatemessage`, {
        method: 'PUT',
        body: JSON.stringify({
            mode: 'markAsSpam',
            messageId: messageIds
        })
    });
}

// Set/remove flag (star)
async function setFlag(accountId, messageIds, flagId = 2) {
    // flagId: 0 = no flag, 1 = info, 2 = important, 3 = followup
    if (!Array.isArray(messageIds)) messageIds = [messageIds];

    return apiRequest(`/accounts/${accountId}/updatemessage`, {
        method: 'PUT',
        body: JSON.stringify({
            mode: 'setFlag',
            messageId: messageIds,
            flagid: flagId
        })
    });
}

// Refresh access token using stored credentials
async function refreshAccessToken() {
    const { refreshToken, region, zohoClientId, zohoClientSecret } = await chrome.storage.local.get([
        'refreshToken', 'region', 'zohoClientId', 'zohoClientSecret'
    ]);

    if (!refreshToken || !zohoClientId || !zohoClientSecret) {
        console.error('Missing credentials for token refresh');
        return false;
    }

    try {
        const tokenUrl = region === 'in'
            ? 'https://accounts.zoho.in/oauth/v2/token'
            : 'https://accounts.zoho.com/oauth/v2/token';

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                refresh_token: refreshToken,
                client_id: zohoClientId,
                client_secret: zohoClientSecret,
                grant_type: 'refresh_token'
            })
        });

        const data = await response.json();
        console.log('Token refresh response:', data);

        if (data.access_token) {
            await chrome.storage.local.set({
                accessToken: data.access_token,
                tokenExpiry: Date.now() + ((data.expires_in || 3600) * 1000)
            });
            return true;
        }

        return false;
    } catch (error) {
        console.error('Failed to refresh token:', error);
        return false;
    }
}

// Export functions
export {
    getAccounts,
    getFolders,
    getInboxFolderId,
    getEmails,
    getEmailContent,
    getEmailDetails,
    markAsRead,
    markAsUnread,
    deleteEmails,
    archiveEmails,
    markAsSpam,
    setFlag,
    refreshAccessToken,
    searchEmails,
    sendEmail
};
