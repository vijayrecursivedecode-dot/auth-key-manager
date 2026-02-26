require("dotenv").config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require("discord.js");
const { QuickDB } = require("quick.db");
const fetch = require("node-fetch");

const TOKEN = process.env.TOKEN;
const API_URL = process.env.API_URL;

if (!TOKEN) {
  console.error("ERROR: TOKEN is not set in .env file!");
  process.exit(1);
}
if (!API_URL) {
  console.error("ERROR: API_URL is not set in .env file!");
  process.exit(1);
}

const db = new QuickDB();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function sellerRequest(params) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return await response.json();
  } catch (error) {
    return { success: false, message: error.message || "Network error" };
  }
}

async function getSellerKey(guildId) {
  return await db.get(`sellerkey_${guildId}`);
}

const commands = [
  new SlashCommandBuilder()
    .setName("setseller")
    .setDescription("Set the seller key for this server")
    .addStringOption(opt => opt.setName("key").setDescription("Your seller key").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("add-license")
    .setDescription("Create license key(s)")
    .addIntegerOption(opt => opt.setName("expiry").setDescription("Duration in days").setRequired(true))
    .addIntegerOption(opt => opt.setName("amount").setDescription("Number of keys to create (1-100)").setRequired(false))
    .addIntegerOption(opt => opt.setName("level").setDescription("Subscription level").setRequired(false))
    .addStringOption(opt => opt.setName("note").setDescription("Note for the license").setRequired(false)),

  new SlashCommandBuilder()
    .setName("delete-license")
    .setDescription("Delete a license key")
    .addStringOption(opt => opt.setName("key").setDescription("License key to delete").setRequired(true)),

  new SlashCommandBuilder()
    .setName("verify-license")
    .setDescription("Check if a license key exists")
    .addStringOption(opt => opt.setName("key").setDescription("License key to verify").setRequired(true)),

  new SlashCommandBuilder()
    .setName("license-info")
    .setDescription("Get detailed info about a license key")
    .addStringOption(opt => opt.setName("key").setDescription("License key to look up").setRequired(true)),

  new SlashCommandBuilder()
    .setName("fetch-all-keys")
    .setDescription("Export all license keys as a file"),

  new SlashCommandBuilder()
    .setName("add-user")
    .setDescription("Create a new user")
    .addStringOption(opt => opt.setName("user").setDescription("Username").setRequired(true))
    .addStringOption(opt => opt.setName("pass").setDescription("Password").setRequired(true))
    .addIntegerOption(opt => opt.setName("expiry").setDescription("Expiry in days (0 = never)").setRequired(false)),

  new SlashCommandBuilder()
    .setName("delete-user")
    .setDescription("Delete a user")
    .addStringOption(opt => opt.setName("user").setDescription("Username to delete").setRequired(true)),

  new SlashCommandBuilder()
    .setName("verify-user")
    .setDescription("Check if a user exists")
    .addStringOption(opt => opt.setName("user").setDescription("Username to verify").setRequired(true)),

  new SlashCommandBuilder()
    .setName("user-data")
    .setDescription("Get detailed info about a user")
    .addStringOption(opt => opt.setName("user").setDescription("Username to look up").setRequired(true)),

  new SlashCommandBuilder()
    .setName("reset-user")
    .setDescription("Reset a user's HWID")
    .addStringOption(opt => opt.setName("user").setDescription("Username to reset").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban-user")
    .setDescription("Ban a user")
    .addStringOption(opt => opt.setName("user").setDescription("Username to ban").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for the ban").setRequired(false)),

  new SlashCommandBuilder()
    .setName("unban-user")
    .setDescription("Unban a user")
    .addStringOption(opt => opt.setName("user").setDescription("Username to unban").setRequired(true)),

  new SlashCommandBuilder()
    .setName("fetch-all-users")
    .setDescription("Export all users as a file"),

  new SlashCommandBuilder()
    .setName("app-stats")
    .setDescription("View application statistics"),

  new SlashCommandBuilder()
    .setName("app-details")
    .setDescription("View application details"),
];

client.once("ready", async () => {
  console.log(`Bot logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: commands.map(c => c.toJSON()),
    });
    console.log("Slash commands registered successfully!");
  } catch (error) {
    console.error("Error registering commands:", error);
  }

  client.user.setPresence({
    activities: [{ name: "KeyAuth Manager", type: 3 }],
    status: "online",
  });
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guildId } = interaction;

  if (commandName === "setseller") {
    const key = interaction.options.getString("key");
    await interaction.deferReply({ ephemeral: true });

    const result = await sellerRequest({ sellerkey: key, type: "validate" });
    if (!result.success) {
      return interaction.editReply({
        embeds: [errorEmbed("Invalid Seller Key", result.message || "The seller key is invalid or disabled.")],
      });
    }

    await db.set(`sellerkey_${guildId}`, key);
    return interaction.editReply({
      embeds: [successEmbed("Seller Key Set", `Seller key has been saved for this server.${result.appName ? `\nApplication: **${result.appName}**` : ""}`)],
    });
  }

  const sellerkey = await getSellerKey(guildId);
  if (!sellerkey) {
    return interaction.reply({
      embeds: [errorEmbed("No Seller Key", "No seller key set for this server. Use `/setseller` first.")],
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    switch (commandName) {
      case "add-license": {
        const expiry = interaction.options.getInteger("expiry");
        const amount = interaction.options.getInteger("amount") || 1;
        const level = interaction.options.getInteger("level") || 1;
        const note = interaction.options.getString("note") || "";

        const result = await sellerRequest({
          sellerkey, type: "add",
          expiry: String(expiry),
          amount: String(Math.min(amount, 100)),
          level: String(level),
          note,
        });

        if (!result.success) {
          return interaction.editReply({ embeds: [errorEmbed("License Creation Failed", result.message)] });
        }

        const keys = result.keys || [];
        if (keys.length === 0) {
          return interaction.editReply({ embeds: [errorEmbed("No Keys", "No licenses were created.")] });
        }

        if (keys.length <= 10) {
          const keyList = keys.map(k => `\`${k}\``).join("\n");
          return interaction.editReply({
            embeds: [successEmbed(`Created ${keys.length} License(s)`, `**Expiry:** ${expiry} days\n**Level:** ${level}\n\n${keyList}`)],
          });
        } else {
          const content = keys.join("\n");
          const attachment = new AttachmentBuilder(Buffer.from(content, "utf-8"), { name: "licenses.txt" });
          return interaction.editReply({
            embeds: [successEmbed(`Created ${keys.length} Licenses`, `**Expiry:** ${expiry} days | **Level:** ${level}\nKeys sent as file attachment.`)],
            files: [attachment],
          });
        }
      }

      case "delete-license": {
        const key = interaction.options.getString("key");
        const result = await sellerRequest({ sellerkey, type: "del", key });
        if (result.success) {
          return interaction.editReply({ embeds: [successEmbed("License Deleted", `License \`${key}\` has been deleted.`)] });
        }
        return interaction.editReply({ embeds: [errorEmbed("Delete Failed", result.message)] });
      }

      case "verify-license": {
        const key = interaction.options.getString("key");
        const result = await sellerRequest({ sellerkey, type: "verify", key });
        if (result.success) {
          return interaction.editReply({ embeds: [successEmbed("License Found", `License \`${key}\` exists.`)] });
        }
        return interaction.editReply({ embeds: [errorEmbed("Not Found", `License \`${key}\` does not exist.`)] });
      }

      case "license-info": {
        const key = interaction.options.getString("key");
        const result = await sellerRequest({ sellerkey, type: "info", key });
        if (!result.success) {
          return interaction.editReply({ embeds: [errorEmbed("Not Found", result.message)] });
        }
        const embed = new EmbedBuilder()
          .setTitle("License Information")
          .setColor(0x7C3AED)
          .addFields(
            { name: "Key", value: `\`${result.key || key}\``, inline: false },
            { name: "Level", value: String(result.level || "N/A"), inline: true },
            { name: "Duration", value: `${result.duration || "N/A"} ${result.durationUnit || "days"}`, inline: true },
            { name: "Enabled", value: result.enabled ? "Yes" : "No", inline: true },
            { name: "Used", value: `${result.usedCount || 0}/${result.maxUses || 1}`, inline: true },
            { name: "Note", value: result.note || "None", inline: true },
            { name: "Created", value: result.createdAt ? new Date(result.createdAt).toLocaleDateString() : "N/A", inline: true },
            { name: "Expires", value: result.expiresAt ? new Date(result.expiresAt).toLocaleDateString() : "Never", inline: true },
          )
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      }

      case "fetch-all-keys": {
        const result = await sellerRequest({ sellerkey, type: "fetchallkeys" });
        if (!result.success) {
          return interaction.editReply({ embeds: [errorEmbed("Error", result.message)] });
        }
        const keys = result.keys || [];
        if (keys.length === 0) {
          return interaction.editReply({ embeds: [errorEmbed("No Keys", "No license keys found.")] });
        }
        const content = JSON.stringify(keys, null, 2);
        const attachment = new AttachmentBuilder(Buffer.from(content, "utf-8"), { name: `license_keys_${Date.now()}.json` });
        return interaction.editReply({
          embeds: [successEmbed("License Keys Exported", `Found **${keys.length}** license keys.`)],
          files: [attachment],
        });
      }

      case "add-user": {
        const user = interaction.options.getString("user");
        const pass = interaction.options.getString("pass");
        const expiry = interaction.options.getInteger("expiry") || 0;

        const result = await sellerRequest({
          sellerkey, type: "adduser",
          user, pass,
          expiry: expiry > 0 ? String(expiry) : undefined,
        });

        if (result.success) {
          return interaction.editReply({
            embeds: [successEmbed("User Created", `**Username:** ${user}\n**Password:** ${pass}\n**Expiry:** ${expiry > 0 ? expiry + " days" : "Never"}`)],
          });
        }
        return interaction.editReply({ embeds: [errorEmbed("User Creation Failed", result.message)] });
      }

      case "delete-user": {
        const user = interaction.options.getString("user");
        const result = await sellerRequest({ sellerkey, type: "deluser", user });
        if (result.success) {
          return interaction.editReply({ embeds: [successEmbed("User Deleted", `User **${user}** has been deleted.`)] });
        }
        return interaction.editReply({ embeds: [errorEmbed("Delete Failed", result.message)] });
      }

      case "verify-user": {
        const user = interaction.options.getString("user");
        const result = await sellerRequest({ sellerkey, type: "verify", user });
        if (result.success) {
          return interaction.editReply({ embeds: [successEmbed("User Found", `User **${user}** exists.`)] });
        }
        return interaction.editReply({ embeds: [errorEmbed("Not Found", `User **${user}** does not exist.`)] });
      }

      case "user-data": {
        const user = interaction.options.getString("user");
        const result = await sellerRequest({ sellerkey, type: "getuserdata", user });
        if (!result.success) {
          return interaction.editReply({ embeds: [errorEmbed("Not Found", result.message)] });
        }
        const embed = new EmbedBuilder()
          .setTitle("User Information")
          .setColor(0x7C3AED)
          .addFields(
            { name: "Username", value: result.username || user, inline: true },
            { name: "Email", value: result.email || "None", inline: true },
            { name: "IP", value: result.ip || "None", inline: true },
            { name: "HWID", value: result.hwid || "None", inline: true },
            { name: "Banned", value: result.banned ? "Yes" : "No", inline: true },
            { name: "Level", value: String(result.level || "N/A"), inline: true },
            { name: "Last Login", value: result.lastLogin ? new Date(result.lastLogin).toLocaleString() : "Never", inline: true },
            { name: "Created", value: result.createdAt ? new Date(result.createdAt).toLocaleDateString() : "N/A", inline: true },
            { name: "Expires", value: result.expiresAt ? new Date(result.expiresAt).toLocaleDateString() : "Never", inline: true },
          )
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      }

      case "reset-user": {
        const user = interaction.options.getString("user");
        const result = await sellerRequest({ sellerkey, type: "resetuser", user });
        if (result.success) {
          return interaction.editReply({ embeds: [successEmbed("HWID Reset", `HWID has been reset for user **${user}**.`)] });
        }
        return interaction.editReply({ embeds: [errorEmbed("Reset Failed", result.message)] });
      }

      case "ban-user": {
        const user = interaction.options.getString("user");
        const reason = interaction.options.getString("reason") || "No reason provided";
        const result = await sellerRequest({ sellerkey, type: "banuser", user, reason });
        if (result.success) {
          return interaction.editReply({ embeds: [successEmbed("User Banned", `User **${user}** has been banned.\n**Reason:** ${reason}`)] });
        }
        return interaction.editReply({ embeds: [errorEmbed("Ban Failed", result.message)] });
      }

      case "unban-user": {
        const user = interaction.options.getString("user");
        const result = await sellerRequest({ sellerkey, type: "unbanuser", user });
        if (result.success) {
          return interaction.editReply({ embeds: [successEmbed("User Unbanned", `User **${user}** has been unbanned.`)] });
        }
        return interaction.editReply({ embeds: [errorEmbed("Unban Failed", result.message)] });
      }

      case "fetch-all-users": {
        const result = await sellerRequest({ sellerkey, type: "fetchallusers" });
        if (!result.success) {
          return interaction.editReply({ embeds: [errorEmbed("Error", result.message)] });
        }
        const users = result.users || [];
        if (users.length === 0) {
          return interaction.editReply({ embeds: [errorEmbed("No Users", "No users found.")] });
        }
        const content = JSON.stringify(users, null, 2);
        const attachment = new AttachmentBuilder(Buffer.from(content, "utf-8"), { name: `users_${Date.now()}.json` });
        return interaction.editReply({
          embeds: [successEmbed("Users Exported", `Found **${users.length}** users.`)],
          files: [attachment],
        });
      }

      case "app-stats": {
        const result = await sellerRequest({ sellerkey, type: "stats" });
        if (!result.success) {
          return interaction.editReply({ embeds: [errorEmbed("Error", result.message)] });
        }
        const embed = new EmbedBuilder()
          .setTitle("Application Statistics")
          .setColor(0x7C3AED)
          .addFields(
            { name: "🔑 Unused Keys", value: String(result.unused || 0), inline: true },
            { name: "🔑 Used Keys", value: String(result.used || 0), inline: true },
            { name: "🔑 Total Keys", value: String(result.totalkeys || 0), inline: true },
            { name: "👥 Total Users", value: String(result.totalusers || 0), inline: true },
            { name: "🚫 Banned Users", value: String(result.bannedusers || 0), inline: true },
            { name: "🎟️ Total Tokens", value: String(result.totaltokens || 0), inline: true },
          )
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      }

      case "app-details": {
        const result = await sellerRequest({ sellerkey, type: "appdetails" });
        if (!result.success) {
          return interaction.editReply({ embeds: [errorEmbed("Error", result.message)] });
        }
        const d = result.appdetails || {};
        const embed = new EmbedBuilder()
          .setTitle("Application Details")
          .setColor(0x7C3AED)
          .addFields(
            { name: "Name", value: d.name || "N/A", inline: true },
            { name: "Version", value: d.version || "N/A", inline: true },
            { name: "Enabled", value: d.enabled ? "Yes" : "No", inline: true },
          )
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      }

      default:
        return interaction.editReply({ embeds: [errorEmbed("Unknown Command", "This command is not recognized.")] });
    }
  } catch (error) {
    console.error(`Command error [${commandName}]:`, error);
    return interaction.editReply({
      embeds: [errorEmbed("Error", `An error occurred: ${error.message || "Unknown error"}`)],
    });
  }
});

function successEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setColor(0x7C3AED)
    .setTimestamp();
}

function errorEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(`❌ ${title}`)
    .setDescription(description || "An error occurred.")
    .setColor(0xEF4444)
    .setTimestamp();
}

client.login(TOKEN).catch((err) => {
  console.error("Failed to login:", err.message);
  process.exit(1);
});

console.log("Starting KeyAuth Manager Discord Bot...");
