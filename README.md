# Zoho Mail Checker

A Chrome extension to check your Zoho Mail inbox with desktop notifications, search, and direct email management. Similar to Checker Plus for Gmail, but for Zoho Mail.

<img width="524" height="631" alt="image" src="https://github.com/user-attachments/assets/d9ed4640-6871-4823-9989-ced01b3c79f8" />


## Features

- 📬 **Check Inbox**: View unread emails directly from the browser toolbar.
- 🔍 **Search**: Real-time search to find specific emails instantly.
- 📁 **Folder Support**: Switch between Inbox, Sent, Drafts, Spam, and custom folders.
- ✏️ **Compose**: One-click access to open the Zoho Mail compose window in a new tab.
- 🔔 **Notifications**: Desktop notifications and spoken audio alerts ("New email received").
- 📱 **Quick Actions**:
    - **Mark as Read/Unread**
    - **Delete** (Move to Trash)
    - **Archive**
    - **Mark as Spam**
    - **Reply** (Opens Zoho Mail reply context)
- 🌍 **Global Support**: Supports all Zoho regions (India, US, EU, Australia).
- 🌙 **Dark Mode**: Sleek dark interface.
- 🔒 **Secure**: Direct communication with Zoho APIs (No intermediate proxy server needed).

## Prerequisites

- A Zoho Mail account
- Chrome browser

## Installation

### 1. Download the Extension

```bash
git clone https://github.com/13pathak/zoho-mail-checker.git
cd zoho-mail-checker
```

### 2. Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `zoho-mail-checker` folder

### 3. Configure Zoho API Credentials

The extension requires API credentials from Zoho to securely access your mail.

#### Step 1: Create a Self Client

1. Go to the Zoho API Console for your region:
   - 🇮🇳 India: https://api-console.zoho.in/
   - 🇺🇸 US: https://api-console.zoho.com/
   - 🇪🇺 EU: https://api-console.zoho.eu/
   - 🇦🇺 Australia: https://api-console.zoho.com.au/

2. Click **"ADD CLIENT"**
3. Select **"Self Client"**
4. Click **Create**

#### Step 2: Get Client ID and Secret

Go to the **"Client Secret"** tab and copy:
- **Client ID**
- **Client Secret**

#### Step 3: Generate Refresh Token

1. Go to the **"Generate Code"** tab in the API Console.
2. Enter these scopes:
   ```
   ZohoMail.messages.ALL,ZohoMail.folders.ALL,ZohoMail.accounts.ALL
   ```
3. Set duration to **10 minutes** and click **Create**.
4. Copy the generated **Code**.
5. Open a terminal in the extension folder and run this helper script:
   ```bash
   node get_tokens.js
   ```
6. Follow the prompts to generate your **Refresh Token**.

#### Step 4: Enter Credentials in Extension

1. Click the extension icon → **Settings** (⚙️)
2. Go to the **Setup** tab
3. Enter your Client ID, Client Secret, and Refresh Token.
4. Select your **Region**.
5. Click **Save Credentials**.

## Usage

1. **Sign In**: Click the extension icon and click **Sign in with Zoho**.
2. **View Emails**: Your inbox will load automatically.
3. **Switch Folders**: Use the dropdown at the top to view Sent, Spam, etc.
4. **Search**: Type in the search bar to filter emails.
5. **Actions**: Hover over an email to see action buttons (Archive, Delete, Spam, Mark Read).

## File Structure

```
zoho-mail-checker/
├── manifest.json          # Extension configuration (Manifest V3)
├── popup.html             # Main extension UI
├── options.html           # Settings page
├── get_tokens.js          # Helper script for initial OAuth setup
├── css/
│   └── popup.css          # Styles
├── js/
│   ├── auth.js            # Direct OAuth authentication
│   ├── api.js             # Direct Zoho Mail API wrapper
│   ├── popup.js           # UI logic
│   └── background.js      # Background worker (alarms, visual updates)
└── icons/                 # Extension icons
```

## Troubleshooting

### "Credentials not configured"
Go to Settings → Setup tab and enter your Zoho API credentials.

### "invalid_client"
Your refresh token may be invalid or from the wrong region. Ensure the Console region matches your selection.

### No emails showing
Check your internet connection and ensure the correct region is selected in Settings.

## Privacy

- **Local Storage**: All credentials and tokens are stored securely in Chrome's local storage.
- **Direct Connect**: The extension communicates directly with Zoho APIs. No data is sent to any third-party servers.

## License

MIT License - feel free to modify and distribute.

## Contributing

Pull requests are welcome!
