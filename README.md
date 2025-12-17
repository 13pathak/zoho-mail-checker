# Zoho Mail Checker

A Chrome extension to check your Zoho Mail inbox with desktop notifications. Similar to Checker Plus for Gmail, but for Zoho Mail.

![Extension Screenshot](screenshots/extension.png)

## Features

- 📬 Check Zoho Mail inbox from browser toolbar
- 🔔 Desktop notifications for new emails
- 📱 Email preview without opening Zoho Mail website
- ✅ Mark emails as read/unread
- 🗑️ Delete emails
- 📁 Archive emails
- 🌍 Supports all Zoho regions (India, US, EU, Australia)
- 🌙 Dark mode support

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later) - Required for the proxy server
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
4. Select the extension folder

### 3. Configure Zoho API Credentials

The extension requires API credentials from Zoho. Here's how to set them up:

#### Step 1: Create a Self Client in Zoho API Console

1. Go to the Zoho API Console for your region:
   - 🇮🇳 India: https://api-console.zoho.in/
   - 🇺🇸 US: https://api-console.zoho.com/
   - 🇪🇺 EU: https://api-console.zoho.eu/
   - 🇦🇺 Australia: https://api-console.zoho.com.au/

2. Click **"ADD CLIENT"**
3. Select **"Self Client"**
4. Accept the terms and click **Create**

#### Step 2: Get Client ID and Secret

After creating the Self Client, go to the **"Client Secret"** tab and copy:
- **Client ID** (starts with 1000.)
- **Client Secret**

#### Step 3: Generate Authorization Code

1. Go to the **"Generate Code"** tab
2. Enter these scopes:
   ```
   ZohoMail.messages.ALL,ZohoMail.folders.ALL,ZohoMail.accounts.ALL
   ```
3. Set duration to maximum (10 minutes)
4. Click **Create** and copy the generated code

#### Step 4: Get Refresh Token

Open PowerShell/Terminal in the extension folder and run:

```bash
node get_tokens.js
```

Follow the prompts to enter your code, Client ID, and Client Secret. Copy the **Refresh Token** from the output.

#### Step 5: Enter Credentials in Extension

1. Click the extension icon → Settings (⚙️)
2. Go to the **Setup** tab
3. Enter your:
   - Client ID
   - Client Secret
   - Refresh Token
   - Select your region
4. Click **Save Credentials**

### 4. Start the Proxy Server

The extension requires a local proxy server to communicate with Zoho's API (Zoho blocks browser-originated API requests).

**Option A: Manual start** (in PowerShell/Terminal):
```bash
cd path/to/zoho-mail-checker
node server/proxy.js
```

**Option B: Double-click** `server/start-server.bat`

> ⚠️ **Important**: The proxy server must be running whenever you use the extension!

### 5. Sign In

1. Click the extension icon
2. Select your Zoho region
3. Click **Sign in with Zoho**
4. Your emails should now appear!

## Auto-Start Proxy Server (Optional)

### Option 1: To start the proxy server automatically when Windows starts:

1. Press `Win + R`, type `shell:startup`, press Enter
2. Right-click your 'start-server.bat file in the server folder and choose Create shortcut.
3. Drag that shortcut into the Startup folder you just opened. Now it will run automatically every time you log in.

### Option 2: Pin to Taskbar for One-Click Access:

1. Right-click start-server.bat → Send to → Desktop (create shortcut).
2. Right-click the new Desktop shortcut → Properties.
3. In the "Target" field, add cmd /c  to the very beginning. Example: cmd /c "C:\...\server\start-server.bat"
Click OK.
Drag this shortcut to your taskbar. Now you have a "button" on your taskbar to start it instantly.

## File Structure

```
zoho-mail-checker/
├── manifest.json          # Extension configuration
├── popup.html             # Popup UI
├── options.html           # Settings page with setup wizard
├── get_tokens.js          # Helper script to generate refresh token
├── css/
│   └── popup.css          # Popup styles
├── js/
│   ├── auth.js            # OAuth authentication
│   ├── api.js             # Zoho Mail API wrapper
│   ├── popup.js           # Popup logic
│   └── background.js      # Background service worker
├── icons/                 # Extension icons
└── server/
    ├── proxy.js           # Local proxy server
    └── start-server.bat   # One-click server starter
```

## Troubleshooting

### "Credentials not configured"
Go to Settings → Setup tab and enter your Zoho API credentials.

### "Proxy server not running"
Start the proxy server with `node server/proxy.js` or double-click `server/start-server.bat`.

### "invalid_client" error
Your refresh token may have expired. Generate a new one using `node get_tokens.js`.

### No emails showing
Make sure you're using the correct Zoho region (India, US, EU, etc.).

## Privacy

- All credentials are stored locally in Chrome's secure storage
- The proxy server runs only on localhost (127.0.0.1)
- No data is sent to any third-party servers
- Only communicates with official Zoho API endpoints

## License

MIT License - feel free to modify and distribute.

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.
