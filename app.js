// Load up the discord.js library
const Discord = require("discord.js");
var moment = require('moment');
var pad = require('pad');
const urlPrefixes = {
  "Shining Blade": "Wanted: "
};
const urlSuffixes = {
  "Zaishen Mission":  " (Zaishen quest)",
  "Zaishen Bounty":   " (Zaishen quest)",
  "Zaishen Vanquish": " (Zaishen quest)",
  "Zaishen Combat":   " (Zaishen quest)"
};
const start = moment.utc('2018-03-05 16:00:00');

const dailies = require("./dailies.json");

// This is your client. Some people call it `bot`, some people call it `self`, 
// some might call it `cootchie`. Either way, when you see `client.something`, or `bot.something`,
// this is what we're refering to. Your client.
const client = new Discord.Client();

// Here we load the config.json file that contains our token and our prefix values. 
const config = {
  "token":  process.env.DISCORD_TOKEN,
  "prefix": process.env.DISCORD_PREFIX
};
// config.token contains the bot's token
// config.prefix contains the message prefix.

client.on("ready", () => {
  // This event will run if the bot starts, and logs in, successfully.
  console.log(`Bot has started, with ${client.users.size} users, in ${client.channels.size} channels of ${client.guilds.size} guilds.`); 
  // Example of changing the bot's playing game to something useful. `client.user` is what the
  // docs refer to as the "ClientUser".
  client.user.setActivity(`eating clovers`);
});

client.on("guildCreate", guild => {
  // This event triggers when the bot joins a guild.
  console.log(`New guild joined: ${guild.name} (id: ${guild.id}). This guild has ${guild.memberCount} members!`);
  // client.user.setActivity(`grazing on ${client.guilds.size} servers`);
});

client.on("guildDelete", guild => {
  // this event triggers when the bot is removed from a guild.
  console.log(`I have been removed from: ${guild.name} (id: ${guild.id})`);
  // client.user.setActivity(`grazing on ${client.guilds.size} servers`);
});


client.on("message", async message => {
  // This event will run on every single message received, from any channel or DM.

  // It's good practice to ignore other bots. This also makes your bot ignore itself
  // and not get into a spam loop (we call that "botception").
  if(message.author.bot) return;

  // Also good practice to ignore any message that does not start with our prefix, 
  // which is set in the configuration file.
  if(message.content.indexOf(config.prefix) !== 0) return;

  // Here we separate our "command" name, and our "arguments" for the command. 
  // e.g. if we have the message "+say Is this the real life?" , we'll get the following:
  // command = say
  // args = ["Is", "this", "the", "real", "life?"]
  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  // Let's go with a few common example commands! Feel free to delete or change those.

  if (command === "ping") {
    // Calculates ping between sending a message and editing it, giving a nice round-trip latency.
    // The second ping is an average latency between the bot and the websocket server (one-way, not round-trip)
    const m = await message.channel.send("Ping?");
    m.edit(`Pong! Latency is ${m.createdTimestamp - message.createdTimestamp}ms. API Latency is ${Math.round(client.ping)}ms`);
  }

  if (command === "dailies") {
    var turnusStart = moment.utc("16:00:00", "HH:mm:ss");
    if ( turnusStart.isAfter(moment()) ) { // In the future
      turnusStart.subtract(1, "day");
    }
    var turnusEnd = turnusStart.clone().add(1, "day");
    var sayMessage = "";
    const offsetDays = moment().diff(start, "days");
    diffDuration = moment.duration(turnusEnd.diff(moment()));

    for (key in dailies) {
      var fullName = dailies[key][offsetDays % dailies[key].length];
      var urlPrefix = urlPrefixes[key] ? urlPrefixes[key] : "";
      var urlSuffix = urlSuffixes[key] ? urlSuffixes[key] : "";
      sayMessage += "**`" + pad(key, 20, '.') + "`**: [" + fullName + "](https://wiki.guildwars.com/wiki/" + encodeURIComponent(urlPrefix+fullName+urlSuffix).replace(/\(/, "%28").replace(/\)/, "%29")  + ")\n";
    }
    var niceMessage = {
      color: 3447003,
      fields: [{
        name: "Today's dailies for the next " + pad(2, diffDuration.hours(), "0") + ":" + pad(2, diffDuration.minutes(), "0"),
        value: sayMessage
      }],
      timestamp: new Date(),
    };
    // Then we delete the command message (sneaky, right?). The catch just ignores the error with a cute smiley thing.
    message.delete().catch(O_o=>{}); 
    // And we get the bot to say the thing: 
    message.channel.send({embed: niceMessage});
  }

});

client.login(config.token);
