// Background service worker for Zoho Mail Checker

import { isLoggedIn, getAccessToken, refreshToken } from './auth.js';
import { getAccounts, getInboxFolderId, getEmails, markAsRead, deleteEmails, archiveEmails, markAsSpam } from './api.js';

// Constants
const CHECK_INTERVAL_MINUTES = 5;
const ALARM_NAME = 'checkMail';

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Extension installed:', details.reason);

    // Set up alarm for periodic email checking
    await setupAlarm();

    // Initialize badge
    chrome.action.setBadgeBackgroundColor({ color: '#D93025' });
    chrome.action.setBadgeText({ text: '' });
});

// Set up periodic alarm
async function setupAlarm() {
    const { checkInterval } = await chrome.storage.sync.get('checkInterval');
    const interval = checkInterval || CHECK_INTERVAL_MINUTES;

    chrome.alarms.create(ALARM_NAME, {
        periodInMinutes: interval
    });
}

// Handle alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === ALARM_NAME) {
        await checkForNewEmails();
    }
});

// Check for new emails
async function checkForNewEmails() {
    try {
        const loggedIn = await isLoggedIn();
        if (!loggedIn) {
            chrome.action.setBadgeText({ text: '' });
            return;
        }

        // Get stored account info
        let { accountId, inboxFolderId } = await chrome.storage.local.get(['accountId', 'inboxFolderId']);

        // If no account info, fetch it
        if (!accountId) {
            const accounts = await getAccounts();
            if (accounts.length > 0) {
                accountId = accounts[0].accountId;
                await chrome.storage.local.set({
                    accountId,
                    userEmail: accounts[0].emailAddress
                });
            } else {
                return;
            }
        }

        // Get inbox folder ID if not stored
        if (!inboxFolderId) {
            inboxFolderId = await getInboxFolderId(accountId);
            if (inboxFolderId) {
                await chrome.storage.local.set({ inboxFolderId });
            }
        }

        // Fetch unread emails
        const emails = await getEmails(accountId, {
            folderId: inboxFolderId,
            status: 'unread',
            limit: 50
        });

        const unreadCount = emails.length;

        // Update badge
        updateBadge(unreadCount);

        // Check for new emails (compare with previous)
        const { lastEmailIds = [] } = await chrome.storage.local.get('lastEmailIds');
        const currentEmailIds = emails.map(e => e.messageId);
        const newEmailIds = currentEmailIds.filter(id => !lastEmailIds.includes(id));

        // Show notifications for new emails
        if (newEmailIds.length > 0) {
            const { notificationsEnabled = true } = await chrome.storage.sync.get('notificationsEnabled');

            if (notificationsEnabled) {
                // Play notification sound (TTS)
                chrome.tts.speak('New email received');

                const newEmails = emails.filter(e => newEmailIds.includes(e.messageId));
                for (const email of newEmails.slice(0, 3)) { // Max 3 notifications
                    showNotification(email);
                }
            }
        }

        // Store current email IDs
        await chrome.storage.local.set({ lastEmailIds: currentEmailIds });

    } catch (error) {
        console.error('Error checking emails:', error);
        if (error.message.includes('expired') || error.message.includes('authenticated')) {
            chrome.action.setBadgeText({ text: '!' });
        }
    }
}

// Update badge with unread count
function updateBadge(count) {
    if (count === 0) {
        chrome.action.setBadgeText({ text: '' });
    } else if (count > 99) {
        chrome.action.setBadgeText({ text: '99+' });
    } else {
        chrome.action.setBadgeText({ text: count.toString() });
    }
}

// Show notification for new email
function showNotification(email) {
    const notificationId = `email_${email.messageId}`;

    chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: email.fromAddress || email.sender || 'New Email',
        message: email.subject || '(No Subject)',
        contextMessage: 'Zoho Mail',
        priority: 2,
        buttons: [
            { title: 'Mark as Read' },
            { title: 'Delete' }
        ],
        requireInteraction: false
    });

    // Store notification data for handling clicks
    chrome.storage.local.get('notifications').then(({ notifications = {} }) => {
        notifications[notificationId] = {
            messageId: email.messageId,
            folderId: email.folderId
        };
        chrome.storage.local.set({ notifications });
    });
}

// Handle notification clicks
chrome.notifications.onClicked.addListener(async (notificationId) => {
    if (notificationId.startsWith('email_')) {
        // Open popup
        chrome.action.openPopup();
        chrome.notifications.clear(notificationId);
    }
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    if (!notificationId.startsWith('email_')) return;

    const { notifications = {}, accountId } = await chrome.storage.local.get(['notifications', 'accountId']);
    const notifData = notifications[notificationId];

    if (!notifData || !accountId) return;

    try {
        if (buttonIndex === 0) {
            // Mark as Read
            await markAsRead(accountId, [notifData.messageId]);
        } else if (buttonIndex === 1) {
            // Delete
            await deleteEmails(accountId, [notifData.messageId], notifData.folderId);
        }

        // Refresh email count
        await checkForNewEmails();
    } catch (error) {
        console.error('Error handling notification action:', error);
    }

    chrome.notifications.clear(notificationId);
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message).then(sendResponse).catch(error => {
        sendResponse({ error: error.message });
    });
    return true; // Keep channel open for async response
});

async function handleMessage(message) {
    switch (message.action) {
        case 'checkEmails':
            await checkForNewEmails();
            return { success: true };

        case 'getEmails':
            const { accountId, inboxFolderId } = await chrome.storage.local.get(['accountId', 'inboxFolderId']);
            if (!accountId) {
                const accounts = await getAccounts();
                if (accounts.length > 0) {
                    await chrome.storage.local.set({
                        accountId: accounts[0].accountId,
                        userEmail: accounts[0].emailAddress
                    });
                    const folderId = await getInboxFolderId(accounts[0].accountId);
                    await chrome.storage.local.set({ inboxFolderId: folderId });
                    return await getEmails(accounts[0].accountId, {
                        folderId,
                        limit: message.limit || 20
                    });
                }
            }
            return await getEmails(accountId, {
                folderId: inboxFolderId,
                limit: message.limit || 20,
                status: message.status || 'all'
            });

        case 'markAsRead':
            const account = await chrome.storage.local.get('accountId');
            await markAsRead(account.accountId, message.messageIds);
            await checkForNewEmails();
            return { success: true };

        case 'markAsUnread':
            const acc = await chrome.storage.local.get('accountId');
            const { markAsUnread: markUnread } = await import('./api.js');
            await markUnread(acc.accountId, message.messageIds);
            await checkForNewEmails();
            return { success: true };

        case 'deleteEmails':
            const accDel = await chrome.storage.local.get(['accountId', 'inboxFolderId']);
            await deleteEmails(accDel.accountId, message.messageIds, accDel.inboxFolderId);
            await checkForNewEmails();
            return { success: true };

        case 'archiveEmails':
            const accArch = await chrome.storage.local.get('accountId');
            await archiveEmails(accArch.accountId, message.messageIds);
            await checkForNewEmails();
            return { success: true };

        case 'markAsSpam':
            const accSpam = await chrome.storage.local.get('accountId');
            await markAsSpam(accSpam.accountId, message.messageIds);
            await checkForNewEmails();
            return { success: true };

        case 'updateBadge':
            updateBadge(message.count);
            return { success: true };

        default:
            throw new Error(`Unknown action: ${message.action}`);
    }
}

// Initial check when service worker starts
chrome.runtime.onStartup.addListener(async () => {
    await setupAlarm();
    await checkForNewEmails();
});

// Also check immediately on install
setTimeout(async () => {
    const loggedIn = await isLoggedIn();
    if (loggedIn) {
        await checkForNewEmails();
    }
}, 1000);

console.log('Zoho Mail Checker background service worker started');
