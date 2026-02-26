import { Bot, InlineKeyboard, Context } from "grammy";
import axios from "axios";

const API_BASE_URL = process.env.REPLIT_DOMAINS
  ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
  : `http://localhost:${process.env.PORT || 5000}`;

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/seller`,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
  validateStatus: () => true,
});

async function sellerRequest(params: Record<string, any>): Promise<any> {
  const response = await api.post("", params);
  return response.data;
}

type ResponseHandler = (ctx: Context, bot: Bot, db: BotDB) => Promise<void>;

interface ConversationState {
  handler: ResponseHandler;
  data: Record<string, any>;
  timeout: NodeJS.Timeout;
}

class BotDB {
  private store = new Map<string, any>();

  get(key: string): any {
    return this.store.get(key) ?? null;
  }

  set(key: string, value: any): void {
    this.store.set(key, value);
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}

const states = new Map<number, ConversationState>();
const STATE_TIMEOUT = 5 * 60 * 1000;

function setState(userId: number, handler: ResponseHandler, data: Record<string, any> = {}) {
  clearState(userId);
  states.set(userId, {
    handler,
    data,
    timeout: setTimeout(() => states.delete(userId), STATE_TIMEOUT),
  });
}

function clearState(userId: number) {
  const state = states.get(userId);
  if (state) clearTimeout(state.timeout);
  states.delete(userId);
}

function getSellerKey(db: BotDB, userId: number): string | null {
  return db.get(`selectedapp.${userId}`);
}

function esc(text: any): string {
  if (!text) return "";
  return text.toString().replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

export function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("[telegram-bot] TELEGRAM_BOT_TOKEN not set, skipping bot startup");
    return;
  }

  const bot = new Bot(token);
  const db = new BotDB();

  bot.command("start", async (ctx) => {
    const keyboard = new InlineKeyboard()
      .text("➕ Add Application", "add_app")
      .row()
      .text("📋 My Applications", "list_apps")
      .row()
      .text("ℹ️ Help", "help_info");

    await ctx.reply(
      "🔐 *KeyAuth Manager Bot*\n\n" +
      "Manage your applications, licenses, and users directly from Telegram\\.\n\n" +
      "To get started, add an application with your seller key\\.",
      { parse_mode: "MarkdownV2", reply_markup: keyboard }
    );
  });

  const helpText =
    "📖 *Available Commands*\n\n" +
    "*Application*\n" +
    "/setseller \\- Select or add application\n" +
    "/addapp \\- Add a new application\n" +
    "/myapps \\- List your applications\n" +
    "/selectapp \\- Select active application\n" +
    "/removeapp \\- Remove an application\n" +
    "/appdetails \\- View app details\n" +
    "/stats \\- View app statistics\n\n" +
    "*Licenses*\n" +
    "/create \\- Create license key\\(s\\)\n" +
    "/delkey \\- Delete a license key\n" +
    "/getkeys \\- Export all license keys\n" +
    "/keyinfo \\- Get license key info\n" +
    "/verify \\- Verify a license exists\n\n" +
    "*Users*\n" +
    "/adduser \\- Create a user\n" +
    "/deluser \\- Delete a user\n" +
    "/resethwid \\- Reset user HWID\n" +
    "/ban \\- Ban a user\n" +
    "/unban \\- Unban a user\n" +
    "/getusers \\- Export all users\n" +
    "/userdata \\- Get user details\n\n" +
    "*Info*\n" +
    "/status \\- Show current app selection\n" +
    "/help \\- Show this message";

  bot.command("help", async (ctx) => {
    await ctx.reply(
      helpText,
      { parse_mode: "MarkdownV2" }
    );
  });

  bot.callbackQuery("help_info", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      helpText,
      { parse_mode: "MarkdownV2" }
    );
  });

  bot.command("setseller", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const apps: Array<{ name: string; sellerkey: string }> = db.get(`applications.${userId}`) || [];
    const selectedKey = getSellerKey(db, userId);
    const keyboard = new InlineKeyboard();

    if (apps.length > 0) {
      apps.forEach((app, i) => {
        const marker = app.sellerkey === selectedKey ? " (Selected)" : "";
        keyboard.text(`${app.name}${marker}`, `select_app_${i}`).row();
      });
    }
    keyboard.text("Create new application", "add_app");

    await ctx.reply("Please click on one of your applications to select it.", { reply_markup: keyboard });
  });

  bot.command("addapp", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    await ctx.reply("Please send me the seller key for your application:");
    setState(userId, handleAddAppKey, {});
  });

  bot.callbackQuery("add_app", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from?.id;
    if (!userId) return;
    await ctx.reply("Please send me the seller key for your application:");
    setState(userId, handleAddAppKey, {});
  });

  async function handleAddAppKey(ctx: Context, _bot: Bot, db: BotDB) {
    const userId = ctx.from?.id;
    const sellerKey = ctx.message?.text?.trim();
    if (!userId || !sellerKey) return;

    const apps: Array<{ name: string; sellerkey: string }> = db.get(`applications.${userId}`) || [];
    if (apps.find(a => a.sellerkey === sellerKey)) {
      await ctx.reply("⚠️ You already have an application with this seller key.");
      return;
    }

    const loading = await ctx.reply("⏳ Validating seller key...");

    const response = await sellerRequest({ sellerkey: sellerKey, type: "validate" });

    if (!response.success) {
      await ctx.api.editMessageText(loading.chat.id, loading.message_id, `❌ ${response.message || "Invalid or disabled seller key."}`);
      return;
    }

    const suggestedName = response.appName || "";
    await ctx.api.editMessageText(
      loading.chat.id,
      loading.message_id,
      `✅ Seller key validated!${suggestedName ? ` (App: ${suggestedName})` : ""}\n\nWhat would you like to name this application?`
    );
    setState(userId, handleAddAppName, { sellerKey });
  }

  async function handleAddAppName(ctx: Context, _bot: Bot, db: BotDB) {
    const userId = ctx.from?.id;
    const appName = ctx.message?.text?.trim();
    if (!userId || !appName) return;

    const state = states.get(userId);
    const sellerKey = state?.data.sellerKey;
    if (!sellerKey) {
      await ctx.reply("❌ Session expired. Please try /addapp again.");
      return;
    }

    const apps: Array<{ name: string; sellerkey: string }> = db.get(`applications.${userId}`) || [];
    apps.push({ name: appName, sellerkey: sellerKey });
    db.set(`applications.${userId}`, apps);
    db.set(`selectedapp.${userId}`, sellerKey);
    db.delete(`temp_sellerkey.${userId}`);

    await ctx.reply(`✅ Application "${appName}" saved and set as your active application!\n\nYou can now use commands like /create, /adduser, etc.`);
    clearState(userId);
  }

  bot.command("myapps", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const apps: Array<{ name: string; sellerkey: string }> = db.get(`applications.${userId}`) || [];
    if (apps.length === 0) {
      await ctx.reply("You don't have any applications yet. Use /addapp to add one.");
      return;
    }

    const selectedKey = getSellerKey(db, userId);
    const keyboard = new InlineKeyboard();
    apps.forEach((app, i) => {
      const marker = app.sellerkey === selectedKey ? "✅ " : "";
      keyboard.text(`${marker}${app.name}`, `select_app_${i}`).row();
    });

    await ctx.reply("📋 *Your Applications*\n\nTap to select an application:", {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  });

  bot.callbackQuery("list_apps", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    const apps: Array<{ name: string; sellerkey: string }> = db.get(`applications.${userId}`) || [];
    if (apps.length === 0) {
      await ctx.reply("You don't have any applications yet. Use /addapp to add one.");
      return;
    }

    const selectedKey = getSellerKey(db, userId);
    const keyboard = new InlineKeyboard();
    apps.forEach((app, i) => {
      const marker = app.sellerkey === selectedKey ? "✅ " : "";
      keyboard.text(`${marker}${app.name}`, `select_app_${i}`).row();
    });

    await ctx.reply("📋 *Your Applications*\n\nTap to select an application:", {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  });

  bot.callbackQuery(/^select_app_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    const index = parseInt(ctx.match[1]);
    const apps: Array<{ name: string; sellerkey: string }> = db.get(`applications.${userId}`) || [];
    if (index < 0 || index >= apps.length) {
      await ctx.reply("❌ Invalid selection.");
      return;
    }

    db.set(`selectedapp.${userId}`, apps[index].sellerkey);
    await ctx.reply(`✅ Switched to application: ${apps[index].name}`);
  });

  bot.command("selectapp", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const apps: Array<{ name: string; sellerkey: string }> = db.get(`applications.${userId}`) || [];
    if (apps.length === 0) {
      await ctx.reply("You don't have any applications yet. Use /addapp to add one.");
      return;
    }

    const selectedKey = getSellerKey(db, userId);
    const keyboard = new InlineKeyboard();
    apps.forEach((app, i) => {
      const marker = app.sellerkey === selectedKey ? "✅ " : "";
      keyboard.text(`${marker}${app.name}`, `select_app_${i}`).row();
    });

    await ctx.reply("Select an application:", { reply_markup: keyboard });
  });

  bot.command("removeapp", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const apps: Array<{ name: string; sellerkey: string }> = db.get(`applications.${userId}`) || [];
    if (apps.length === 0) {
      await ctx.reply("You don't have any applications. Use /addapp to add one.");
      return;
    }

    const keyboard = new InlineKeyboard();
    apps.forEach((app, i) => {
      keyboard.text(`🗑 ${app.name}`, `remove_app_${i}`).row();
    });

    await ctx.reply("Select an application to remove:", { reply_markup: keyboard });
  });

  bot.callbackQuery(/^remove_app_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    const index = parseInt(ctx.match[1]);
    const apps: Array<{ name: string; sellerkey: string }> = db.get(`applications.${userId}`) || [];
    if (index < 0 || index >= apps.length) {
      await ctx.reply("❌ Invalid selection.");
      return;
    }

    const removedName = apps[index].name;
    const removedKey = apps[index].sellerkey;
    apps.splice(index, 1);
    db.set(`applications.${userId}`, apps);

    const selectedKey = getSellerKey(db, userId);
    if (selectedKey === removedKey) {
      if (apps.length > 0) {
        db.set(`selectedapp.${userId}`, apps[0].sellerkey);
      } else {
        db.delete(`selectedapp.${userId}`);
      }
    }

    await ctx.reply(`✅ Application "${removedName}" removed.`);
  });

  bot.command("status", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const sellerKey = getSellerKey(db, userId);
    if (!sellerKey) {
      await ctx.reply("⚠️ No application selected. Use /addapp or /selectapp.");
      return;
    }

    const apps: Array<{ name: string; sellerkey: string }> = db.get(`applications.${userId}`) || [];
    const app = apps.find(a => a.sellerkey === sellerKey);
    const masked = sellerKey.substring(0, 12) + "..." + sellerKey.substring(sellerKey.length - 4);

    await ctx.reply(
      `📊 Current Status\n\n` +
      `Application: ${app?.name || "Unknown"}\n` +
      `Seller Key: ${masked}\n` +
      `Total Apps: ${apps.length}`
    );
  });

  bot.command("create", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const sellerKey = getSellerKey(db, userId);
    if (!sellerKey) {
      await ctx.reply("⚠️ No application selected. Use /addapp or /selectapp first.");
      return;
    }

    await ctx.reply("How many days should the license last? (Enter number of days)");
    setState(userId, handleCreateExpiry, { sellerKey });
  });

  async function handleCreateExpiry(ctx: Context, _bot: Bot, _db: BotDB) {
    const userId = ctx.from?.id;
    const text = ctx.message?.text?.trim();
    if (!userId || !text) return;

    const state = states.get(userId);
    if (!state) return;

    const expiry = parseInt(text);
    if (isNaN(expiry) || expiry <= 0) {
      await ctx.reply("Please enter a valid number of days.");
      return;
    }

    state.data.expiry = expiry;
    await ctx.reply("How many licenses do you want to create? (1-100)");
    setState(userId, handleCreateAmount, state.data);
  }

  async function handleCreateAmount(ctx: Context, _bot: Bot, _db: BotDB) {
    const userId = ctx.from?.id;
    const text = ctx.message?.text?.trim();
    if (!userId || !text) return;

    const state = states.get(userId);
    if (!state) return;

    const amount = parseInt(text);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      await ctx.reply("Please enter a number between 1 and 100.");
      return;
    }

    state.data.amount = amount;

    const keyboard = new InlineKeyboard()
      .text("1", "level_1").text("2", "level_2").text("3", "level_3")
      .row()
      .text("4", "level_4").text("5", "level_5").text("Custom", "level_custom");

    await ctx.reply("Select the subscription level:", { reply_markup: keyboard });
    setState(userId, handleCreateLevelText, state.data);
  }

  for (let i = 1; i <= 5; i++) {
    bot.callbackQuery(`level_${i}`, async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from?.id;
      if (!userId) return;

      const state = states.get(userId);
      if (!state) {
        await ctx.reply("❌ Session expired. Please try /create again.");
        return;
      }

      state.data.level = i;
      await finishCreateLicense(ctx, state.data);
      clearState(userId);
    });
  }

  bot.callbackQuery("level_custom", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    const state = states.get(userId);
    if (!state) {
      await ctx.reply("❌ Session expired. Please try /create again.");
      return;
    }

    await ctx.reply("Enter the custom level number:");
    setState(userId, handleCreateLevelText, state.data);
  });

  async function handleCreateLevelText(ctx: Context, _bot: Bot, _db: BotDB) {
    const userId = ctx.from?.id;
    const text = ctx.message?.text?.trim();
    if (!userId || !text) return;

    const state = states.get(userId);
    if (!state) return;

    const level = parseInt(text);
    if (isNaN(level) || level < 1) {
      await ctx.reply("Please enter a valid level number.");
      return;
    }

    state.data.level = level;
    await finishCreateLicense(ctx, state.data);
    clearState(userId);
  }

  async function finishCreateLicense(ctx: Context, data: Record<string, any>) {
    const loading = await ctx.reply("⏳ Creating license(s)...");

    const response = await sellerRequest({
      sellerkey: data.sellerKey,
      type: "add",
      expiry: String(data.expiry),
      amount: String(data.amount),
      level: String(data.level || 1),
    });

    if (!response.success) {
      await ctx.api.editMessageText(loading.chat.id, loading.message_id, `❌ Error: ${response.message}`);
      return;
    }

    const keys = response.keys || [];
    if (keys.length === 0) {
      await ctx.api.editMessageText(loading.chat.id, loading.message_id, "❌ No licenses were created.");
      return;
    }

    if (keys.length <= 10) {
      const keyList = keys.map((k: string) => `\`${esc(k)}\``).join("\n");
      await ctx.api.editMessageText(
        loading.chat.id,
        loading.message_id,
        `✅ Created ${keys.length} license\\(s\\)\\!\n\n${keyList}`,
        { parse_mode: "MarkdownV2" }
      );
    } else {
      const keyText = keys.join("\n");
      const buffer = Buffer.from(keyText, "utf-8");
      await ctx.api.editMessageText(loading.chat.id, loading.message_id, `✅ Created ${keys.length} licenses. Sending as file...`);
      await ctx.replyWithDocument(new (await import("grammy")).InputFile(buffer, "licenses.txt"));
    }
  }

  bot.command("delkey", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const sellerKey = getSellerKey(db, userId);
    if (!sellerKey) {
      await ctx.reply("⚠️ No application selected. Use /addapp or /selectapp first.");
      return;
    }

    await ctx.reply("Enter the license key to delete:");
    setState(userId, handleDelKey, { sellerKey });
  });

  async function handleDelKey(ctx: Context, _bot: Bot, _db: BotDB) {
    const userId = ctx.from?.id;
    const key = ctx.message?.text?.trim();
    if (!userId || !key) return;

    const state = states.get(userId);
    if (!state) return;

    const response = await sellerRequest({
      sellerkey: state.data.sellerKey,
      type: "del",
      key,
    });

    if (!response.success) {
      await ctx.reply(`❌ Error: ${response.message}`);
    } else {
      await ctx.reply("✅ License deleted successfully.");
    }
    clearState(userId);
  }

  bot.command("adduser", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const sellerKey = getSellerKey(db, userId);
    if (!sellerKey) {
      await ctx.reply("⚠️ No application selected. Use /addapp or /selectapp first.");
      return;
    }

    await ctx.reply("Enter the username for the new user:");
    setState(userId, handleAddUserName, { sellerKey });
  });

  async function handleAddUserName(ctx: Context, _bot: Bot, _db: BotDB) {
    const userId = ctx.from?.id;
    const username = ctx.message?.text?.trim();
    if (!userId || !username) return;

    const state = states.get(userId);
    if (!state) return;

    state.data.username = username;
    await ctx.reply("Enter the password for this user:");
    setState(userId, handleAddUserPass, state.data);
  }

  async function handleAddUserPass(ctx: Context, _bot: Bot, _db: BotDB) {
    const userId = ctx.from?.id;
    const pass = ctx.message?.text?.trim();
    if (!userId || !pass) return;

    const state = states.get(userId);
    if (!state) return;

    state.data.pass = pass;
    await ctx.reply("Enter expiry in days (or 0 for no expiry):");
    setState(userId, handleAddUserExpiry, state.data);
  }

  async function handleAddUserExpiry(ctx: Context, _bot: Bot, _db: BotDB) {
    const userId = ctx.from?.id;
    const text = ctx.message?.text?.trim();
    if (!userId || !text) return;

    const state = states.get(userId);
    if (!state) return;

    const expiry = parseInt(text);
    if (isNaN(expiry) || expiry < 0) {
      await ctx.reply("Please enter a valid number of days.");
      return;
    }

    const response = await sellerRequest({
      sellerkey: state.data.sellerKey,
      type: "adduser",
      user: state.data.username,
      pass: state.data.pass,
      expiry: expiry > 0 ? String(expiry) : undefined,
    });

    if (!response.success) {
      await ctx.reply(`❌ Error: ${response.message}`);
    } else {
      await ctx.reply(
        `✅ User created successfully!\n\n` +
        `Username: ${state.data.username}\n` +
        `Password: ${state.data.pass}\n` +
        `Expiry: ${expiry > 0 ? expiry + " days" : "Never"}`
      );
    }
    clearState(userId);
  }

  bot.command("deluser", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const sellerKey = getSellerKey(db, userId);
    if (!sellerKey) {
      await ctx.reply("⚠️ No application selected. Use /addapp or /selectapp first.");
      return;
    }

    await ctx.reply("Enter the username to delete:");
    setState(userId, handleDelUser, { sellerKey });
  });

  async function handleDelUser(ctx: Context, _bot: Bot, _db: BotDB) {
    const userId = ctx.from?.id;
    const username = ctx.message?.text?.trim();
    if (!userId || !username) return;

    const state = states.get(userId);
    if (!state) return;

    const response = await sellerRequest({
      sellerkey: state.data.sellerKey,
      type: "deluser",
      user: username,
    });

    if (!response.success) {
      await ctx.reply(`❌ Error: ${response.message}`);
    } else {
      await ctx.reply(`✅ User "${username}" deleted successfully.`);
    }
    clearState(userId);
  }

  bot.command("resethwid", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const sellerKey = getSellerKey(db, userId);
    if (!sellerKey) {
      await ctx.reply("⚠️ No application selected. Use /addapp or /selectapp first.");
      return;
    }

    await ctx.reply("Enter the username to reset HWID for:");
    setState(userId, handleResetHwid, { sellerKey });
  });

  async function handleResetHwid(ctx: Context, _bot: Bot, _db: BotDB) {
    const userId = ctx.from?.id;
    const username = ctx.message?.text?.trim();
    if (!userId || !username) return;

    const state = states.get(userId);
    if (!state) return;

    const response = await sellerRequest({
      sellerkey: state.data.sellerKey,
      type: "resetuser",
      user: username,
    });

    if (!response.success) {
      await ctx.reply(`❌ Error: ${response.message}`);
    } else {
      await ctx.reply(`✅ HWID reset for user "${username}".`);
    }
    clearState(userId);
  }

  bot.command("ban", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const sellerKey = getSellerKey(db, userId);
    if (!sellerKey) {
      await ctx.reply("⚠️ No application selected. Use /addapp or /selectapp first.");
      return;
    }

    await ctx.reply("Enter the username to ban:");
    setState(userId, handleBan, { sellerKey });
  });

  async function handleBan(ctx: Context, _bot: Bot, _db: BotDB) {
    const userId = ctx.from?.id;
    const username = ctx.message?.text?.trim();
    if (!userId || !username) return;

    const state = states.get(userId);
    if (!state) return;

    const response = await sellerRequest({
      sellerkey: state.data.sellerKey,
      type: "banuser",
      user: username,
    });

    if (!response.success) {
      await ctx.reply(`❌ Error: ${response.message}`);
    } else {
      await ctx.reply(`✅ User "${username}" has been banned.`);
    }
    clearState(userId);
  }

  bot.command("unban", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const sellerKey = getSellerKey(db, userId);
    if (!sellerKey) {
      await ctx.reply("⚠️ No application selected. Use /addapp or /selectapp first.");
      return;
    }

    await ctx.reply("Enter the username to unban:");
    setState(userId, handleUnban, { sellerKey });
  });

  async function handleUnban(ctx: Context, _bot: Bot, _db: BotDB) {
    const userId = ctx.from?.id;
    const username = ctx.message?.text?.trim();
    if (!userId || !username) return;

    const state = states.get(userId);
    if (!state) return;

    const response = await sellerRequest({
      sellerkey: state.data.sellerKey,
      type: "unbanuser",
      user: username,
    });

    if (!response.success) {
      await ctx.reply(`❌ Error: ${response.message}`);
    } else {
      await ctx.reply(`✅ User "${username}" has been unbanned.`);
    }
    clearState(userId);
  }

  bot.command("stats", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const sellerKey = getSellerKey(db, userId);
    if (!sellerKey) {
      await ctx.reply("⚠️ No application selected. Use /addapp or /selectapp first.");
      return;
    }

    const loading = await ctx.reply("⏳ Fetching statistics...");
    const response = await sellerRequest({ sellerkey: sellerKey, type: "stats" });

    if (!response.success) {
      await ctx.api.editMessageText(loading.chat.id, loading.message_id, `❌ Error: ${response.message}`);
      return;
    }

    await ctx.api.editMessageText(
      loading.chat.id,
      loading.message_id,
      `📊 *Application Statistics*\n\n` +
      `*🔑 License Keys:*\n` +
      `Unused Keys: ${esc(response.unused || 0)}\n` +
      `Used Keys: ${esc(response.used || 0)}\n` +
      `Total Keys: ${esc(response.totalkeys || 0)}\n\n` +
      `*👥 Users:*\n` +
      `Total Users: ${esc(response.totalusers || 0)}\n` +
      `Banned Users: ${esc(response.bannedusers || 0)}\n\n` +
      `*🎟️ Tokens:*\n` +
      `Total Tokens: ${esc(response.totaltokens || 0)}`,
      { parse_mode: "MarkdownV2" }
    );
  });

  bot.command("appdetails", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const sellerKey = getSellerKey(db, userId);
    if (!sellerKey) {
      await ctx.reply("⚠️ No application selected. Use /addapp or /selectapp first.");
      return;
    }

    const loading = await ctx.reply("⏳ Fetching app details...");
    const response = await sellerRequest({ sellerkey: sellerKey, type: "appdetails" });

    if (!response.success) {
      await ctx.api.editMessageText(loading.chat.id, loading.message_id, `❌ Error: ${response.message}`);
      return;
    }

    const d = response.appdetails || {};
    await ctx.api.editMessageText(
      loading.chat.id,
      loading.message_id,
      `📱 *Application Details*\n\n` +
      `*Name:* ${esc(d.name)}\n` +
      `*Version:* ${esc(d.version)}\n` +
      `*Enabled:* ${d.enabled ? "Yes" : "No"}`,
      { parse_mode: "MarkdownV2" }
    );
  });

  bot.command("getkeys", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const sellerKey = getSellerKey(db, userId);
    if (!sellerKey) {
      await ctx.reply("⚠️ No application selected. Use /addapp or /selectapp first.");
      return;
    }

    const loading = await ctx.reply("⏳ Getting license keys...");
    const response = await sellerRequest({ sellerkey: sellerKey, type: "fetchallkeys" });

    if (!response.success) {
      await ctx.api.editMessageText(loading.chat.id, loading.message_id, `❌ Error: ${response.message}`);
      return;
    }

    const keys = response.keys || [];
    if (keys.length === 0) {
      await ctx.api.editMessageText(loading.chat.id, loading.message_id, "❌ No license keys found.");
      return;
    }

    await ctx.api.editMessageText(loading.chat.id, loading.message_id, `✅ Found ${keys.length} license keys. Sending as file...`);
    const { InputFile } = await import("grammy");
    const jsonData = JSON.stringify(keys, null, 2);
    await ctx.replyWithDocument(
      new InputFile(Buffer.from(jsonData, "utf-8"), `license_keys_${Date.now()}.json`),
      { caption: `📄 License Keys - ${keys.length} total` }
    );
  });

  bot.command("getusers", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const sellerKey = getSellerKey(db, userId);
    if (!sellerKey) {
      await ctx.reply("⚠️ No application selected. Use /addapp or /selectapp first.");
      return;
    }

    const loading = await ctx.reply("⏳ Getting users...");
    const response = await sellerRequest({ sellerkey: sellerKey, type: "fetchallusers" });

    if (!response.success) {
      await ctx.api.editMessageText(loading.chat.id, loading.message_id, `❌ Error: ${response.message}`);
      return;
    }

    const users = response.users || [];
    if (users.length === 0) {
      await ctx.api.editMessageText(loading.chat.id, loading.message_id, "❌ No users found.");
      return;
    }

    await ctx.api.editMessageText(loading.chat.id, loading.message_id, `✅ Found ${users.length} users. Sending as file...`);
    const { InputFile } = await import("grammy");
    const jsonData = JSON.stringify(users, null, 2);
    await ctx.replyWithDocument(
      new InputFile(Buffer.from(jsonData, "utf-8"), `users_${Date.now()}.json`),
      { caption: `📄 Users - ${users.length} total` }
    );
  });

  bot.command("keyinfo", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const sellerKey = getSellerKey(db, userId);
    if (!sellerKey) {
      await ctx.reply("⚠️ No application selected. Use /addapp or /selectapp first.");
      return;
    }

    await ctx.reply("Enter the license key to get info about:");
    setState(userId, handleKeyInfo, { sellerKey });
  });

  async function handleKeyInfo(ctx: Context, _bot: Bot, _db: BotDB) {
    const userId = ctx.from?.id;
    const key = ctx.message?.text?.trim();
    if (!userId || !key) return;

    const state = states.get(userId);
    if (!state) return;

    const response = await sellerRequest({ sellerkey: state.data.sellerKey, type: "info", key });

    if (!response.success) {
      await ctx.reply(`❌ Error: ${response.message}`);
    } else {
      await ctx.reply(
        `✅ License Info:\n\n` +
        `Key: ${response.key}\n` +
        `Level: ${response.level}\n` +
        `Duration: ${response.duration} ${response.durationUnit || "days"}\n` +
        `Enabled: ${response.enabled ? "Yes" : "No"}\n` +
        `Used: ${response.usedCount || 0}/${response.maxUses || 1}\n` +
        `Note: ${response.note || "None"}\n` +
        `Created: ${response.createdAt ? new Date(response.createdAt).toLocaleDateString() : "N/A"}\n` +
        `Expires: ${response.expiresAt ? new Date(response.expiresAt).toLocaleDateString() : "Never"}`
      );
    }
    clearState(userId);
  }

  bot.command("verify", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const sellerKey = getSellerKey(db, userId);
    if (!sellerKey) {
      await ctx.reply("⚠️ No application selected. Use /addapp or /selectapp first.");
      return;
    }

    await ctx.reply("Enter the license key to verify:");
    setState(userId, handleVerify, { sellerKey });
  });

  async function handleVerify(ctx: Context, _bot: Bot, _db: BotDB) {
    const userId = ctx.from?.id;
    const key = ctx.message?.text?.trim();
    if (!userId || !key) return;

    const state = states.get(userId);
    if (!state) return;

    const response = await sellerRequest({ sellerkey: state.data.sellerKey, type: "verify", key });

    if (!response.success) {
      await ctx.reply(`❌ License not found: ${key}`);
    } else {
      await ctx.reply(`✅ License exists: ${key}`);
    }
    clearState(userId);
  }

  bot.command("userdata", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const sellerKey = getSellerKey(db, userId);
    if (!sellerKey) {
      await ctx.reply("⚠️ No application selected. Use /addapp or /selectapp first.");
      return;
    }

    await ctx.reply("Enter the username to look up:");
    setState(userId, handleUserData, { sellerKey });
  });

  async function handleUserData(ctx: Context, _bot: Bot, _db: BotDB) {
    const userId = ctx.from?.id;
    const username = ctx.message?.text?.trim();
    if (!userId || !username) return;

    const state = states.get(userId);
    if (!state) return;

    const response = await sellerRequest({ sellerkey: state.data.sellerKey, type: "getuserdata", user: username });

    if (!response.success) {
      await ctx.reply(`❌ Error: ${response.message}`);
    } else {
      await ctx.reply(
        `✅ User Data for ${response.username}:\n\n` +
        `Username: ${response.username}\n` +
        `Email: ${response.email || "None"}\n` +
        `IP: ${response.ip || "None"}\n` +
        `HWID: ${response.hwid || "None"}\n` +
        `Banned: ${response.banned ? "Yes" : "No"}\n` +
        `Level: ${response.level || "N/A"}\n` +
        `Last Login: ${response.lastLogin ? new Date(response.lastLogin).toLocaleString() : "Never"}\n` +
        `Created: ${response.createdAt ? new Date(response.createdAt).toLocaleDateString() : "N/A"}\n` +
        `Expires: ${response.expiresAt ? new Date(response.expiresAt).toLocaleDateString() : "Never"}`
      );
    }
    clearState(userId);
  }

  bot.on("message:text", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const state = states.get(userId);
    if (state && state.handler) {
      try {
        await state.handler(ctx, bot, db);
      } catch (error: any) {
        console.error("[telegram-bot] Handler error:", error);
        await ctx.reply(`❌ An error occurred: ${error.message || "Unknown error"}`);
        clearState(userId);
      }
      return;
    }
  });

  bot.catch((err) => {
    console.error("[telegram-bot] Error:", err.message);
  });

  bot.start({
    onStart: (info) => {
      console.log(`[telegram-bot] Bot started: @${info.username}`);
    },
  });

  console.log("[telegram-bot] Starting bot...");
  return bot;
}
