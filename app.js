var sheepnet = require('./lib.js')();
const Discord = require("discord.js");

const client = new Discord.Client();

client.on("ready", () => {
  console.log(`Bot has started, with ${client.users.size} users, in ${client.channels.size} channels of ${client.guilds.size} guilds.`); 
  var sheepGuilds = client.guilds.filterArray(function(guild) {
    return guild.name === 'Black Sheep';
  });
  var generalChats = sheepGuilds[0].channels.filterArray(function(channel) {
    return channel.name === 'general';
  });
  generalChat = generalChats[0];
  installTickHandler();
  client.user.setActivity(`sheep`);
});

client.on("guildCreate", guild => {
  console.log(`New guild joined: ${guild.name} (id: ${guild.id}). This guild has ${guild.memberCount} members!`);
});

client.on("guildDelete", guild => {
  console.log(`I have been removed from: ${guild.name} (id: ${guild.id})`);
});


client.on("message", async message => {
  // It's good practice to ignore other bots. This also makes your bot ignore itself
  // and not get into a spam loop (we call that "botception").
  if (message.author.bot) {
    return;
  }

  // Also good practice to ignore any message that does not start with our prefix, 
  // which is set in the configuration file.
  if (message.content.indexOf(config.prefix) !== 0) {
    return;
  }

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

  if (command === "events") {
    authorize(JSON.parse(authTokens), handleEvents(printEventsToChannel(message.channel)));
  }

  if (command === "dailies" || command === "daily") {
    message.delete().catch(O_o=>{});
    if ( args.length == 0 ) {
      displayCurrentCycle(getDailies(moment()),  "Current dailies",  message);
    } else {
      var wantedDate = chrono.parseDate(args.join(' ') + ' at ' + moment().format('HH:mm:ss'));
      if ( moment.utc(wantedDate).isValid() ) {
        wantedDate = moment.utc(wantedDate);
        displayCurrentCycle(getDailies(wantedDate),  "Dailies for " + moment.tz(wantedDate, 'Europe/Berlin').format('dddd, MMMM D, YYYY @ HH:mm:ss z'),  message);
      }
    }
  }

  if (command === "weeklies" || command === "weekly" || command === "nick") {
    message.delete().catch(O_o=>{});
    if ( args.length == 0 ) {
      displayCurrentCycle(getWeeklies(moment()), "Current weeklies", message);
    } else {
      var wantedDate = chrono.parseDate(args.join(' ') + ' at ' + moment().format('HH:mm:ss'));
      if ( moment.utc(wantedDate).isValid() ) {
        wantedDate = moment.utc(wantedDate);
        displayCurrentCycle(getWeeklies(wantedDate),  "Weeklies for " + moment.tz(wantedDate, 'Europe/Berlin').format('dddd, MMMM D, YYYY @ HH:mm:ss z'),  message);
      }
    }
  }

});

client.login(config.token);
