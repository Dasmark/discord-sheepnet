const Discord = require("discord.js");
const chrono = require('chrono-node');
var moment = require('moment-timezone');
const momentRound = require('moment-round');
var TurndownService = require('turndown');
var turndownService = new TurndownService();
var pad = require('pad');
const util = require('util');
var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var generalChat;

/**
 * Fix chrono so when prodiving a weekday, it always returns a day in the future
 */
var preferDatesInTheFuture = new chrono.Refiner();
preferDatesInTheFuture.refine = function(text, results) {
  results.forEach(function(result) {
    if (result.start.isCertain('weekday') && !result.start.isCertain('day')) {
      var determinedDate = moment(result.start.impliedValues.year + '-' + pad(2, result.start.impliedValues.month, '0') + '-' + pad(2, result.start.impliedValues.day, '0'));
      var todayAtMidnight = moment(moment().format('YYYY-MM-DD'));
      if ( todayAtMidnight.isAfter(determinedDate) ) {
        result.start.imply('day', result.start.impliedValues.day + 7)
      }
    }
  });
  return results;
};
chrono.casual.refiners.push(preferDatesInTheFuture);

const dailies = require("./dailies.json");

const client = new Discord.Client();

const config = {
  "token":    process.env.DISCORD_TOKEN,
  "prefix":   process.env.DISCORD_PREFIX,
};

const reminders = [
  {
    "unit":    "minutes",
    "amount":  15,
    "message": function(event) {
      return util.format("Time for **%s in %d minutes**.%s",
                         event.summary, 15,
                         (event.location == '') ? '' : ' Location: **' + event.location + '**');
    },
  },
  {
    "unit":    "hours",
    "amount":  8,
    "message": function(event) {
      return util.format("Short reminder: **%s** coming up in 8h", event.summary);
    },
  }
];
// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/calendar-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'calendar-nodejs-quickstart.json';

var authTokens = Buffer.from('eyJpbnN0YWxsZWQiOnsiY2xpZW50X2lkIjoiNDQwMTUwMDMyNTQ0LXVkaG84MHMyczZrNzlqbG4ybzVpbGJ1czRrb2JycjdvLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwicHJvamVjdF9pZCI6ImxlYXJuZWQtYWdlLTE5ODExOSIsImF1dGhfdXJpIjoiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tL28vb2F1dGgyL2F1dGgiLCJ0b2tlbl91cmkiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvdG9rZW4iLCJhdXRoX3Byb3ZpZGVyX3g1MDlfY2VydF91cmwiOiJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9vYXV0aDIvdjEvY2VydHMiLCJjbGllbnRfc2VjcmV0IjoiUG5WN2s0eVZxVkJaWHJraTdMcnNTYURMIiwicmVkaXJlY3RfdXJpcyI6WyJ1cm46aWV0Zjp3ZzpvYXV0aDoyLjA6b29iIiwiaHR0cDovL2xvY2FsaG9zdCJdfX0=', 'base64').toString('ascii');

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the next 10 events on the user's primary calendar.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function handleEvents(handler) {
  return function(auth) {
    var calendar = google.calendar('v3');
    calendar.events.list({
      auth: auth,
      calendarId: 'primary',
      timeMin: (new Date()).toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime'
    }, parseEvents(handler));
  };
}

function filterOutEventsFromThePast(events) {
  return events.filter(function(event) {
    if ( 'recurrence' in event ) {
      return true;
    }
    return moment(event.start.dateTime || event.start.date) >= moment();
  });
}

function getNextOccurrenceForReccuringEvent(event) {
  nextOccurrence = moment.utc(event.start.dateTime || event.start.date);
  if ( event.recurrence.length != 1 ) {
    return nextOccurrence;
  }
  var repeatInterval;
  if ( event.recurrence[0].match(/FREQ=WEEKLY/) ) {
    repeatInterval = 'week';
  } else if ( event.recurrence[0].match(/FREQ=DAILY/) ) {
    repeatInterval = 'day';
  } else {
    return nextOccurrence;;
  }
  while (nextOccurrence.isBefore(moment())) {
    nextOccurrence.add(1, repeatInterval);
  }
  return nextOccurrence;
}

function getOnlyTheNextEvents(events) {
  var nextEvents = [];
  var eventLookup = {};
  events.forEach(function(event) {
    var nextOccurrence = moment.utc(event.start.dateTime || event.start.date);
    if ( 'recurrence' in event ) {
      nextOccurrence = getNextOccurrenceForReccuringEvent(event);
    }
    mainID = event.recurringEventId || event.id;
    if ( !(mainID in eventLookup) ) {
      eventLookup[mainID] = {};
    }
    if ( !(nextOccurrence in eventLookup[mainID]) || !('recurrence' in event) ) {
      event.start = nextOccurrence;
      eventLookup[mainID][nextOccurrence] = event;
    }
  });
  for (var mainID in eventLookup) {
    for (nextOccurrence in eventLookup[mainID]) {
      nextEvents.push(eventLookup[mainID][nextOccurrence]);
    }
  }
  return nextEvents;
}

function getNiceRecurrence(recurrence) {
  shortWeekdaysToLong = {
    'MO': 'Monday',
    'TU': 'Tuesday',
    'WE': 'Wednesday',
    'TH': 'Thursday',
    'FR': 'Friday',
    'SA': 'Saturday',
    'SU': 'Sunday',
  };
  if ( recurrence == null ) {
    return null;
  }
  if ( recurrence.length != 1 ) {
    return null;
  }
  var matchingElements = recurrence[0].match(/RRULE:FREQ=([A-Z]*);BYDAY=([A-Z]*)/);
  if ( matchingElements.length == 0 ) {
    return null;
  }
  return matchingElements[1].toLocaleLowerCase() + ', every ' + shortWeekdaysToLong[matchingElements[2]];
}

function simplifyEvent(event) {
  var startTime = moment(event.start);
  var location = event.location || '';
  var summary = event.summary || '';
  var description = (event.description || '').replace(/^[\s\n]*/, '');
  var isRecurring = ('recurringEventId' in event || 'recurrence' in event);
  var niceStartTime = moment.tz(startTime, 'Europe/Berlin').format('YYYY-MM-DD HH:mm:ss z')
                      + ' *(GMT'
                      + moment.tz(startTime, 'Europe/Berlin').format('Z')
                      + ')*';
  var recurrence = getNiceRecurrence(event.recurrence || event.parentRecurrence);
  var minutesToEvent = momentRound(event.start).round(5, 'minute').diff(momentRound().round(5, 'minute'), 'minutes');
  return {
    'start':       startTime,
    'location':    location,
    'summary':     summary,
    'description': description,
    'isRecurring': isRecurring,
    'recurrence':  recurrence,
    'niceStart':   niceStartTime,
    'timeToEvent': moment.duration(minutesToEvent, 'minutes')
  };
}

function addRecurringInformationToDeviatingEvents(events) {
  dataById = [];
  events.forEach(function(event) {
    dataById[event.id] = event;
  });
  events.forEach(function(event) {
    if ( 'recurringEventId' in event ) {
      event.parentRecurrence = dataById[event.recurringEventId].recurrence;
    }
  });
  return events;
}

function parseEvents(handler) {
  return function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    var events = filterOutEventsFromThePast(response.items);
    events = addRecurringInformationToDeviatingEvents(events);
    events = getOnlyTheNextEvents(events);
    events = events.map(simplifyEvent);
    return handler(events);
  }
}

function printEventsToChannel(channel) {
  return function(events) {
    var messages = events.map(function(event) {
      var messageFields = [
        {
          name: event.summary,
          value: (event.description === '') ? 'No description *yet*' : turndownService.turndown(event.description).replace(/^[\s\n]*/, '')
        },
        {
          name: event.isRecurring ? 'Next time:' : 'When?',
          value: event.niceStart
        },
        {
          name: 'Where?',
          value: (event.location === '') ? 'Not *yet* decided' : event.location
        },
      ];
      if ( event.isRecurring ) {
        messageFields.splice(1, 0, {
          name: 'Repetition',
          value: event.recurrence
        });
      }
      var niceMessage = {
        color: 3447003,
        fields: messageFields
      };
      return {embed: niceMessage};
    });
    messages.forEach((message, index) => { channel.send(message)});
  };
}

function announceEventRemindersToChannel(channel) {
  return function(events) {
    var messages = [].concat.apply([], events.map(function(event) {
      var matchingReminders = reminders.filter(function(reminder) {
        return reminder.amount == event.timeToEvent.as(reminder.unit);
      });
      var messages = matchingReminders.map(function(reminder) {
        return reminder.message(event);
      });
      return messages;
    }));
    messages.forEach((message, index) => { channel.send(message)});
  }
}


function tickHandler() {
  authorize(JSON.parse(authTokens), handleEvents(announceEventRemindersToChannel(generalChat)));
}

function installTickHandler() {
  var nextTick = momentRound().ceil(5, 'minute');
  var msToTick = nextTick.diff(moment());
  setTimeout(function() {
    installTickHandler();
    tickHandler();
  }, msToTick);
}

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
    sayMessage += "**`" + pad(key, 21, '.') + "`**: [" + item.name + "](" + item.url + ") *" + item.remaining + "*\n";
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
