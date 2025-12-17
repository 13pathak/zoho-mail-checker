// Popup script for Zoho Mail Checker

import { login, logout, isLoggedIn, getRedirectUrl } from './auth.js';
import { getAccounts, getEmails, getEmailContent, getInboxFolderId, getFolders, searchEmails, sendEmail } from './api.js';

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const mainScreen = document.getElementById('mainScreen');
const previewScreen = document.getElementById('previewScreen');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');
const settingsBtn = document.getElementById('settingsBtn');
const regionSelect = document.getElementById('region');
const userEmailSpan = document.getElementById('userEmail');
const emailsContainer = document.getElementById('emails');
const loadingDiv = document.getElementById('loading');
const noEmailsDiv = document.getElementById('noEmails');
const backBtn = document.getElementById('backBtn');
const toast = document.getElementById('toast');
const toolbar = document.getElementById('toolbar');
const folderSelect = document.getElementById('folderSelect');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

// Preview elements
const previewSubject = document.getElementById('previewSubject');
const previewSender = document.getElementById('previewSender');
const previewDate = document.getElementById('previewDate');
const previewTo = document.getElementById('previewTo');
const previewBody = document.getElementById('previewBody');
const previewArchiveBtn = document.getElementById('previewArchiveBtn');
const previewDeleteBtn = document.getElementById('previewDeleteBtn');
const previewMarkUnreadBtn = document.getElementById('previewMarkUnreadBtn');
const previewSpamBtn = document.getElementById('previewSpamBtn');
const previewReplyBtn = document.getElementById('previewReplyBtn');

// State
let currentEmail = null;
let accountId = null;
let inboxFolderId = null;
let currentFolderId = null;
let currentSearchTerm = '';

// Initialize popup
async function init() {
    const loggedIn = await isLoggedIn();

    if (loggedIn) {
        showMainScreen();
        await loadEmails(); // Start loading emails immediately
        await loadFolders(); // Then load folders
    } else {
        showLoginScreen();
        // Show redirect URL helper
        showRedirectUrlHelper();

        // Check if credentials are configured
        const creds = await chrome.storage.local.get(['zohoClientId', 'zohoClientSecret', 'zohoRefreshToken']);
        const setupHint = document.getElementById('setupHint');
        const settingsLink = document.getElementById('openSettingsLink');

        if (!creds.zohoClientId || !creds.zohoClientSecret || !creds.zohoRefreshToken) {
            // Show setup hint for new users
            if (setupHint) setupHint.style.display = 'block';
        }

        // Handle settings link click
        if (settingsLink) {
            settingsLink.addEventListener('click', (e) => {
                e.preventDefault();
                chrome.runtime.openOptionsPage();
            });
        }
    }
}

// Show redirect URL helper for OAuth setup
function showRedirectUrlHelper() {
    const redirectUrl = getRedirectUrl();
    const redirectHelp = document.getElementById('redirectHelp');
    const redirectUri = document.getElementById('redirectUri');
    const copyBtn = document.getElementById('copyUri');

    if (redirectHelp && redirectUri) {
        redirectUri.textContent = redirectUrl;
        redirectHelp.style.display = 'block';

        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(redirectUrl).then(() => {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => copyBtn.textContent = 'Copy', 2000);
                });
            });
        }
    }
}

// Show screens
function showLoginScreen() {
    loginScreen.classList.remove('hidden');
    mainScreen.classList.add('hidden');
    previewScreen.classList.add('hidden');
    toolbar.classList.add('hidden');
}

function showMainScreen() {
    loginScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    previewScreen.classList.add('hidden');
    toolbar.classList.remove('hidden');

    // Load user email
    chrome.storage.local.get('userEmail').then(({ userEmail }) => {
        userEmailSpan.textContent = userEmail || '';
    });
}



function showPreviewScreen() {
    loginScreen.classList.add('hidden');
    mainScreen.classList.add('hidden');
    previewScreen.classList.remove('hidden');
    toolbar.classList.add('hidden');
}

// Show toast message
function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Load emails
async function loadEmails() {
    loadingDiv.classList.remove('hidden');
    noEmailsDiv.classList.add('hidden');
    emailsContainer.innerHTML = '';

    try {
        // Get account info
        const stored = await chrome.storage.local.get(['accountId', 'inboxFolderId']);
        accountId = stored.accountId;
        inboxFolderId = stored.inboxFolderId;

        // If no account info, fetch it
        if (!accountId) {
            console.log('Fetching accounts...');
            const accounts = await getAccounts();
            console.log('Accounts response (full):', JSON.stringify(accounts, null, 2));

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found');
            }

            // Debug: log all keys in the first account
            console.log('First account keys:', Object.keys(accounts[0]));
            console.log('First account:', JSON.stringify(accounts[0], null, 2));

            // The account ID is in the URI field, e.g., "https://mail.zoho.in/api/accounts/8543245000000002002"
            // We need to extract it from the URL
            const uriMatch = accounts[0].URI?.match(/\/accounts\/(\d+)/);
            accountId = uriMatch ? uriMatch[1] : accounts[0].accountId || accounts[0].id;

            // Get email address - it might be in different fields
            const emailData = accounts[0].emailAddress;
            const email = accounts[0].primaryEmailAddress ||
                (Array.isArray(emailData) ? emailData[0]?.mailId : emailData) ||
                'Unknown';
            console.log('Extracted Account ID:', accountId, 'Email:', email);

            if (!accountId) {
                console.error('Could not find account ID in response!');
                throw new Error('Account ID not found in API response');
            }

            await chrome.storage.local.set({
                accountId,
                userEmail: email
            });
            userEmailSpan.textContent = email;
        }

        // Try to get inbox folder ID (but don't fail if it doesn't work)
        if (!inboxFolderId) {
            try {
                inboxFolderId = await getInboxFolderId(accountId);
                if (inboxFolderId) {
                    await chrome.storage.local.set({ inboxFolderId });
                }
            } catch (folderError) {
                console.warn('Could not get folder ID, trying without:', folderError.message);
                // Continue without folder ID - the API might work without it
            }
        }

        // Use selected folder or fallback to inbox
        const folderIdToUse = currentFolderId || inboxFolderId;

        let emails = [];
        if (currentSearchTerm) {
            // Search mode
            const response = await searchEmails(accountId, currentSearchTerm);
            emails = response.data || [];
        } else {
            // Normal list mode
            const response = await getEmails(accountId, {
                folderId: folderIdToUse,
                limit: 25
            });
            emails = response; // getEmails returns the array directly
            if (response.data) emails = response.data; // Handle potential different return structure
        }

        if (!Array.isArray(emails)) {
            // Safe fallback
            if (emails && emails.data) emails = emails.data;
            else emails = [];
        }

        loadingDiv.classList.add('hidden');

        if (emails.length === 0) {
            noEmailsDiv.classList.remove('hidden');
            return;
        }

        // Render emails
        emails.forEach(email => {
            const emailEl = createEmailElement(email);
            emailsContainer.appendChild(emailEl);
        });

        // Update badge
        const unreadCount = emails.filter(e => e.status === '0').length;
        chrome.runtime.sendMessage({ action: 'updateBadge', count: unreadCount });

    } catch (error) {
        console.error('Error loading emails:', error);
        loadingDiv.classList.add('hidden');

        if (error.message.includes('expired') || error.message.includes('authenticated')) {
            showLoginScreen();
            showToast('Session expired. Please sign in again.', 'error');
        } else {
            showToast('Failed to load emails: ' + error.message, 'error');
        }
    }
}

// Load folders
async function loadFolders() {
    try {
        const folders = await getFolders(accountId);
        folderSelect.innerHTML = '';

        if (folders.length === 0) {
            folderSelect.innerHTML = '<option value="">No folders</option>';
            return;
        }

        // Sort folders: Inbox first, then system folders, then others
        const systemFolders = ['inbox', 'drafts', 'sent', 'spam', 'trash'];
        folders.sort((a, b) => {
            const indexA = systemFolders.indexOf(a.folderName.toLowerCase());
            const indexB = systemFolders.indexOf(b.folderName.toLowerCase());

            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;

            return a.folderName.localeCompare(b.folderName);
        });

        folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.folderId;
            option.textContent = folder.folderName;
            folderSelect.appendChild(option);
        });

        // Select current folder (default to Inbox)
        if (currentFolderId) {
            folderSelect.value = currentFolderId;
        } else if (inboxFolderId) {
            folderSelect.value = inboxFolderId;
            currentFolderId = inboxFolderId;
        }

    } catch (error) {
        console.error('Error loading folders:', error);
        folderSelect.innerHTML = '<option value="">Error loading folders</option>';
    }
}

// Create email element
function createEmailElement(email) {
    const div = document.createElement('div');
    div.className = `email-item${email.status === '0' ? ' unread' : ''}`;
    div.dataset.messageId = email.messageId;
    div.dataset.folderId = email.folderId;

    // Get sender initial
    const senderName = email.fromAddress || email.sender || 'Unknown';
    const initial = senderName.charAt(0).toUpperCase();

    // Format date
    const date = formatDate(email.receivedTime);

    // Snippet
    const snippet = email.summary || email.snippet || '';

    div.innerHTML = `
    <div class="email-avatar" style="background: ${getAvatarColor(senderName)}">${initial}</div>
    <div class="email-content">
      <div class="email-header">
        <span class="email-sender">${escapeHtml(senderName)}</span>
        <span class="email-date">${date}</span>
        <div class="email-actions">
          <button class="email-action-btn archive" title="Archive" data-action="archive">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5z"/>
            </svg>
          </button>
            <button class="email-action-btn delete" title="Delete" data-action="delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
          <button class="email-action-btn spam" title="Mark as Spam" data-action="markAsSpam">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.05 3H7.95L3 7.95v8.1L7.95 21h8.1L21 16.05V7.95L16.05 3zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm1.6-6h-3.2l.6-6h2l.6 6z"/>
            </svg>
          </button>
          <button class="email-action-btn mark-read" title="${email.status === '0' ? 'Mark as Read' : 'Mark as Unread'}" data-action="${email.status === '0' ? 'markAsRead' : 'markAsUnread'}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="${email.status === '0'
            ? 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z'
            : 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z'}"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="email-subject">${escapeHtml(email.subject || '(No Subject)')}</div>
      <div class="email-snippet">${escapeHtml(snippet)}</div>
    </div>
  `;

    // Click to preview
    div.addEventListener('click', (e) => {
        if (e.target.closest('.email-action-btn')) return;
        openEmailPreview(email);
    });

    // Action buttons
    div.querySelectorAll('.email-action-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            await handleEmailAction(action, email.messageId, email.folderId);
            await loadEmails();
        });
    });

    return div;
}

// Open email preview
async function openEmailPreview(email) {
    currentEmail = email;
    showPreviewScreen();

    previewSubject.textContent = email.subject || '(No Subject)';
    previewSender.textContent = email.fromAddress || email.sender || 'Unknown';
    previewDate.textContent = formatDate(email.receivedTime, true);
    previewTo.textContent = email.toAddress || '';
    previewBody.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        // Mark as read
        if (email.status === '0') {
            await handleEmailAction('markAsRead', email.messageId, email.folderId);
        }

        // Get full email content
        const content = await getEmailContent(accountId, email.folderId, email.messageId);
        previewBody.innerHTML = content.content || content.htmlContent || content.textContent || '<p>No content</p>';

    } catch (error) {
        console.error('Error loading email content:', error);
        previewBody.innerHTML = `<p style="color: var(--danger-color)">Failed to load email content: ${escapeHtml(error.message)}</p>`;
    }
}

// Handle email action
async function handleEmailAction(action, messageId, folderId) {
    try {
        const response = await chrome.runtime.sendMessage({
            action: action === 'delete' ? 'deleteEmails' :
                action === 'archive' ? 'archiveEmails' :
                    action === 'markAsSpam' ? 'markAsSpam' :
                        action === 'markAsRead' ? 'markAsRead' : 'markAsUnread',
            messageIds: [messageId],
            folderId
        });

        if (response && response.error) {
            throw new Error(response.error);
        }

        const actionLabels = {
            delete: 'Deleted',
            archive: 'Archived',
            markAsSpam: 'Marked as Spam',
            markAsRead: 'Marked as read',
            markAsUnread: 'Marked as unread'
        };

        showToast(actionLabels[action] || 'Done', 'success');

    } catch (error) {
        console.error('Error performing action:', error);
        showToast('Action failed: ' + error.message, 'error');
    }
}

// Format date
function formatDate(timestamp, full = false) {
    if (!timestamp) return '';

    const date = new Date(parseInt(timestamp));
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (full) {
        return date.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    if (isToday) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }

    if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Get avatar color based on name
function getAvatarColor(name) {
    const colors = [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
        'linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)',
        'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

const openAppBtn = document.getElementById('openAppBtn');
const composeBtn = document.getElementById('composeBtn');

// Event listeners
composeBtn.addEventListener('click', async () => {
    const { region } = await chrome.storage.local.get('region');
    let url = 'https://mail.zoho.com/zm/#compose';

    if (region === 'in') url = 'https://mail.zoho.in/zm/#compose';
    else if (region === 'eu') url = 'https://mail.zoho.eu/zm/#compose';
    else if (region === 'au') url = 'https://mail.zoho.com.au/zm/#compose';

    chrome.tabs.create({ url });
});

openAppBtn.addEventListener('click', async () => {
    const { region } = await chrome.storage.local.get('region');
    let url = 'https://mail.zoho.com/zm/';

    if (region === 'in') url = 'https://mail.zoho.in/zm/';
    else if (region === 'eu') url = 'https://mail.zoho.eu/zm/';
    else if (region === 'au') url = 'https://mail.zoho.com.au/zm/';

    chrome.tabs.create({ url });
});

folderSelect.addEventListener('change', async () => {
    currentFolderId = folderSelect.value;
    // Clear search when changing folders
    currentSearchTerm = '';
    searchInput.value = '';
    await loadEmails();
});

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const handleSearch = debounce(async (e) => {
    currentSearchTerm = e.target.value.trim();
    await loadEmails();
}, 500);

searchInput.addEventListener('input', handleSearch);

// Search button (immediate search)
searchBtn.addEventListener('click', async () => {
    currentSearchTerm = searchInput.value.trim();
    await loadEmails();
});

loginBtn.addEventListener('click', async () => {
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div> Signing in...';

    try {
        const region = regionSelect.value;
        await login(region);
        showMainScreen();
        await loadEmails();
        showToast('Signed in successfully!', 'success');
    } catch (error) {
        console.error('Login failed:', error);

        // Check if credentials are not configured
        if (error.message.includes('Credentials not configured')) {
            showToast('Please configure your Zoho credentials in Settings first!', 'error');
            // Give time for toast to show, then open settings
            setTimeout(() => {
                chrome.runtime.openOptionsPage();
            }, 1500);
        } else if (error.message.includes('Proxy server not running')) {
            showToast('Proxy server not running. Start it with: node server\\proxy.js', 'error');
        } else {
            showToast('Sign in failed: ' + error.message, 'error');
        }
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
      Sign in with Zoho
    `;
    }
});

logoutBtn.addEventListener('click', async () => {
    await logout();
    showLoginScreen();
    showToast('Signed out');
});

refreshBtn.addEventListener('click', async () => {
    refreshBtn.style.transform = 'rotate(360deg)';
    refreshBtn.style.transition = 'transform 0.5s';
    await loadEmails();
    setTimeout(() => {
        refreshBtn.style.transform = '';
    }, 500);
});

settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

backBtn.addEventListener('click', () => {
    showMainScreen();
    loadEmails();
});

// Preview action buttons
previewArchiveBtn.addEventListener('click', async () => {
    if (currentEmail) {
        await handleEmailAction('archive', currentEmail.messageId, currentEmail.folderId);
        showMainScreen();
        await loadEmails();
    }
});

previewDeleteBtn.addEventListener('click', async () => {
    if (currentEmail) {
        await handleEmailAction('delete', currentEmail.messageId, currentEmail.folderId);
        showMainScreen();
        await loadEmails();
    }
});

previewSpamBtn.addEventListener('click', async () => {
    if (currentEmail) {
        await handleEmailAction('markAsSpam', currentEmail.messageId, currentEmail.folderId);
        showMainScreen();
        await loadEmails();
    }
});

previewReplyBtn.addEventListener('click', async () => {
    if (currentEmail) {
        const { region } = await chrome.storage.local.get('region');
        let domain = 'zoho.com';
        if (region === 'in') domain = 'zoho.in';
        else if (region === 'eu') domain = 'zoho.eu';
        else if (region === 'au') domain = 'zoho.com.au';

        // Deep link format: https://mail.zoho.com/zm/#mail/folder/<folderId>/p/<messageId>
        const url = `https://mail.${domain}/zm/#mail/folder/${currentEmail.folderId}/p/${currentEmail.messageId}`;
        chrome.tabs.create({ url });
    }
});

previewMarkUnreadBtn.addEventListener('click', async () => {
    if (currentEmail) {
        await handleEmailAction('markAsUnread', currentEmail.messageId, currentEmail.folderId);
        showMainScreen();
        await loadEmails();
    }
});

// Initialize
init();
