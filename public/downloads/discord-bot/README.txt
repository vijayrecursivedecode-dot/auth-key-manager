KeyAuth Manager - Discord Bot
================================

This bot allows you to manage your KeyAuth Manager application 
directly from Discord using slash commands and your seller key.

SETUP
-----
1. Create a Discord bot at https://discord.com/developers/applications
   - Click "New Application" and name it
   - Go to "Bot" tab and click "Reset Token" to get your token
   - Enable "Message Content Intent" under Privileged Intents
   - Go to "OAuth2" > "URL Generator"
   - Select scopes: bot, applications.commands
   - Select permissions: Send Messages, Embed Links, Attach Files
   - Copy the invite URL and add the bot to your server

2. Copy .env.example to .env
   - Set TOKEN to your Discord bot token
   - Set API_URL to your KeyAuth Manager seller API URL
     (shown in App Settings > Seller tab)

3. Install dependencies:
   npm install

4. Start the bot:
   npm start

USAGE
-----
1. Invite the bot to your Discord server
2. Use /setseller to set your seller key (Admin only)
3. Use slash commands to manage licenses and users!

COMMANDS
--------
/setseller        - Set seller key for this server (Admin only)
/add-license      - Create license key(s) with expiry, amount, level
/delete-license   - Delete a license key
/verify-license   - Check if a license key exists
/license-info     - Get detailed license key info
/fetch-all-keys   - Export all license keys as file
/add-user         - Create a new user
/delete-user      - Delete a user
/verify-user      - Check if a user exists
/user-data        - Get detailed user info
/reset-user       - Reset user HWID
/ban-user         - Ban a user
/unban-user       - Unban a user
/fetch-all-users  - Export all users as file
/app-stats        - View application statistics
/app-details      - View application details

NOTES
-----
- The seller key is stored per-server using quick.db (SQLite)
- Only administrators can use /setseller
- All responses use Discord embeds with purple theme
- Large data exports are sent as file attachments
