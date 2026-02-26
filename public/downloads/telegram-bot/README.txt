KeyAuth Manager - Telegram Bot
================================

This bot allows you to manage your KeyAuth Manager application 
directly from Telegram using your seller key.

SETUP
-----
1. Create a Telegram bot via @BotFather on Telegram
   - Send /newbot to BotFather
   - Choose a name and username for your bot
   - Copy the bot token

2. Copy .env.example to .env
   - Set TELEGRAM_BOT_TOKEN to your bot token
   - Set API_URL to your KeyAuth Manager seller API URL
     (shown in App Settings > Seller tab)

3. Install dependencies:
   npm install

4. Start the bot:
   npm start

USAGE
-----
1. Open your bot on Telegram
2. Send /setseller
3. Click "Create new application"
4. Paste your seller key (from App Settings > Seller tab)
5. Name your application
6. Use commands to manage licenses and users!

COMMANDS
--------
/setseller   - Select or add application
/create      - Create license key(s)
/delkey      - Delete a license key
/getkeys     - Export all license keys
/keyinfo     - Get license key info
/verify      - Verify a license exists
/adduser     - Create a user
/deluser     - Delete a user
/getusers    - Export all users
/userdata    - Get user details
/resethwid   - Reset user HWID
/ban         - Ban a user
/unban       - Unban a user
/stats       - View app statistics
/appdetails  - View app details
/status      - Show current selection
/help        - Show all commands
