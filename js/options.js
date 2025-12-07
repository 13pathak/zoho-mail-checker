// options.js

// Tab navigation
document.addEventListener('DOMContentLoaded', () => {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    function switchTab(tabId) {
        // Remove active from all
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        // Add active to clicked button and content
        const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        const activeContent = document.getElementById(tabId);
        if (activeContent) activeContent.classList.add('active');
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            switchTab(tabId);
        });
    });

    // Load settings
    loadSettings();

    // Event Listeners for Buttons
    const saveCredsBtn = document.getElementById('saveCredentialsBtn');
    if (saveCredsBtn) saveCredsBtn.addEventListener('click', saveCredentials);

    const savePrefsBtn = document.getElementById('savePreferencesBtn');
    if (savePrefsBtn) savePrefsBtn.addEventListener('click', savePreferences);

    const testNotifBtn = document.getElementById('testNotificationBtn');
    if (testNotifBtn) testNotifBtn.addEventListener('click', sendTestNotification);

    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) signOutBtn.addEventListener('click', signOut);

    const clearDataBtn = document.getElementById('clearDataBtn');
    if (clearDataBtn) clearDataBtn.addEventListener('click', clearData);

    // Input listeners
    ['clientId', 'clientSecret', 'refreshToken'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateCredentialsStatus);
    });
});

async function loadSettings() {
    const creds = await chrome.storage.local.get(['zohoClientId', 'zohoClientSecret', 'zohoRefreshToken', 'region']);
    if (creds.zohoClientId) document.getElementById('clientId').value = creds.zohoClientId;
    if (creds.zohoClientSecret) document.getElementById('clientSecret').value = creds.zohoClientSecret;
    if (creds.zohoRefreshToken) document.getElementById('refreshToken').value = creds.zohoRefreshToken;
    if (creds.region) document.getElementById('region').value = creds.region;
    updateCredentialsStatus();

    const prefs = await chrome.storage.sync.get({
        notificationsEnabled: true, soundEnabled: false, checkInterval: 5, maxEmails: 25
    });
    document.getElementById('notificationsEnabled').checked = prefs.notificationsEnabled;
    document.getElementById('soundEnabled').checked = prefs.soundEnabled;
    document.getElementById('checkInterval').value = prefs.checkInterval;
    document.getElementById('maxEmails').value = prefs.maxEmails;

    const { userEmail } = await chrome.storage.local.get('userEmail');
    document.getElementById('accountEmail').textContent = userEmail || 'Not signed in';
}

function updateCredentialsStatus() {
    const hasAll = document.getElementById('clientId').value &&
        document.getElementById('clientSecret').value &&
        document.getElementById('refreshToken').value;
    const el = document.getElementById('credentialsStatus');
    if (el) {
        el.className = hasAll ? 'status-badge configured' : 'status-badge not-configured';
        el.innerHTML = hasAll ? '✓ Configured' : '⚠️ Not Configured';
    }
}

async function saveCredentials() {
    await chrome.storage.local.set({
        zohoClientId: document.getElementById('clientId').value.trim(),
        zohoClientSecret: document.getElementById('clientSecret').value.trim(),
        zohoRefreshToken: document.getElementById('refreshToken').value.trim(),
        region: document.getElementById('region').value
    });
    updateCredentialsStatus();
    showSavedMessage('credentialsSavedMessage');
}

async function savePreferences() {
    await chrome.storage.sync.set({
        notificationsEnabled: document.getElementById('notificationsEnabled').checked,
        soundEnabled: document.getElementById('soundEnabled').checked,
        checkInterval: parseInt(document.getElementById('checkInterval').value),
        maxEmails: parseInt(document.getElementById('maxEmails').value)
    });

    // Update alarm
    chrome.alarms.clear('checkMail');
    chrome.alarms.create('checkMail', { periodInMinutes: parseInt(document.getElementById('checkInterval').value) });

    showSavedMessage('preferencesSavedMessage');
}

async function signOut() {
    if (confirm('Sign out?')) {
        await chrome.storage.local.remove(['accessToken', 'accountId', 'inboxFolderId', 'userEmail', 'isLoggedIn']);
        document.getElementById('accountEmail').textContent = 'Not signed in';
        alert('Signed out!');
    }
}

async function clearData() {
    if (confirm('Clear ALL data including credentials?')) {
        await chrome.storage.local.clear();
        await chrome.storage.sync.clear();
        location.reload();
    }
}

function showSavedMessage(elementId) {
    const msg = document.getElementById(elementId);
    if (msg) {
        msg.classList.add('show');
        setTimeout(() => msg.classList.remove('show'), 2000);
    }
}

// Send test notification
function sendTestNotification() {
    chrome.notifications.create('test_notification', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Test Notification',
        message: 'This is a test notification from Zoho Mail Checker.',
        contextMessage: 'If you see this, notifications are working!',
        priority: 2
    }, (id) => {
        if (chrome.runtime.lastError) {
            alert('Error: ' + chrome.runtime.lastError.message);
        } else {
            console.log('Test notification sent:', id);
        }
    });
}
