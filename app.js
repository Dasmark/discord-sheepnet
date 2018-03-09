const Discord = require("discord.js");
var moment = require('moment');
var pad = require('pad');

const dailies = require("./dailies.json");

const client = new Discord.Client();

const config = {
  "token":  process.env.DISCORD_TOKEN,
  "prefix": process.env.DISCORD_PREFIX
};

function getCurrentDaily(daily, when) {
  var dailyStarts = moment.utc(daily.start);
  var offset = when.diff(dailyStarts, daily.interval[1]);
  var cycleStarts = dailyStarts.clone().add(offset, daily.interval[1]);
  var cycleEnds   = cycleStarts.clone().add(1, daily.interval[1]);
  var timeRemaining = moment.duration(cycleEnds.diff(when));
  var timeRemainingString = pad(2, timeRemaining.hours(), "0") + ':' + pad(2, timeRemaining.minutes(), "0");
  if ( timeRemaining.days() > 0 ) {
    timeRemainingString = timeRemaining.days() + 'd ' + timeRemainingString;
  }

  return {
    name: daily.items[offset % daily.items.length],
    start: cycleStarts,
    end: cycleEnds,
    remaining: timeRemainingString,
    type: daily.interval[1],
    url: "https://wiki.guildwars.com/wiki/"+
         encodeURIComponent(
           (daily.urlPrefix ? daily.urlPrefix : '')+
           (daily.items[offset % daily.items.length]).replace(/^\d+\s+/, "")+
           (daily.urlSuffix ? daily.urlSuffix : '')
         ).replace(/\(/, "%28").replace(/\)/, "%29")
  };
}

function getItemsForInterval(when, interval) {
  var currentIems = {};
  for (key in dailies) {
    if ( dailies[key].interval[1] == interval ) {
      currentIems[key] = getCurrentDaily(dailies[key], when);
    }
  }
  return currentIems;
}

function getDailies(when) {
  return getItemsForInterval(when, "day");
}

function getWeeklies(when) {
  return getItemsForInterval(when, "week");
}

function displayCurrentCycle(items, title, message) {
  var sayMessage = "";

  for (key in items) {
    var item = items[key];
    sayMessage += "**`" + pad(key, 20, '.') + "`**: [" + item.name + "](" + item.url + ") *" + item.remaining + "*\n";
  }
  var niceMessage = {
    color: 3447003,
    fields: [{
      name: title,
      value: sayMessage
    }],
    timestamp: new Date(),
  };
  message.channel.send({embed: niceMessage});
}

client.on("ready", () => {
  console.log(`Bot has started, with ${client.users.size} users, in ${client.channels.size} channels of ${client.guilds.size} guilds.`); 
  client.user.setActivity(`eating clovers`);
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

  if (command === "dailies" || command === "daily") {
    message.delete().catch(O_o=>{});
    displayCurrentCycle(getDailies(moment()),  "Current dailies",  message);
  }

  if (command === "weeklies" || command === "weekly" || command === "nick") {
    message.delete().catch(O_o=>{});
    displayCurrentCycle(getWeeklies(moment()), "Current weeklies", message);
  }

});

client.login(config.token);
