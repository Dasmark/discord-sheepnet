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

module.exports = function() {
  this.chrono = chrono;
  this.dailies = require("./dailies.json");

  this.config = {
    "token":    process.env.DISCORD_TOKEN,
    "prefix":   process.env.DISCORD_PREFIX || '',
  };

  this.reminders = [
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
      "unit":    "hour",
      "amount":  1,
      "message": function(event) {
        return util.format("In 1 hour it's time for **%s**. Do not forget!",
                           event.summary);
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
  this.SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
  this.TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
       process.env.USERPROFILE) + '/.credentials/';
  this.TOKEN_PATH = this.TOKEN_DIR + 'calendar-nodejs-quickstart.json';


  this.authTokens = Buffer.from('eyJpbnN0YWxsZWQiOnsiY2xpZW50X2lkIjoiNDQwMTUwMDMyNTQ0LXVkaG84MHMyczZrNzlqbG4ybzVpbGJ1czRrb2JycjdvLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwicHJvamVjdF9pZCI6ImxlYXJuZWQtYWdlLTE5ODExOSIsImF1dGhfdXJpIjoiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tL28vb2F1dGgyL2F1dGgiLCJ0b2tlbl91cmkiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvdG9rZW4iLCJhdXRoX3Byb3ZpZGVyX3g1MDlfY2VydF91cmwiOiJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9vYXV0aDIvdjEvY2VydHMiLCJjbGllbnRfc2VjcmV0IjoiUG5WN2s0eVZxVkJaWHJraTdMcnNTYURMIiwicmVkaXJlY3RfdXJpcyI6WyJ1cm46aWV0Zjp3ZzpvYXV0aDoyLjA6b29iIiwiaHR0cDovL2xvY2FsaG9zdCJdfX0=', 'base64').toString('ascii'),

  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   *
   * @param {Object} credentials The authorization client credentials.
   * @param {function} callback The callback to call with the authorized client.
   */
  this.authorize = function(credentials, callback) {
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
  },

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   *
   * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
   * @param {getEventsCallback} callback The callback to call with the authorized
   *     client.
   */
  this.getNewToken = function(oauth2Client, callback) {
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
  },

  /**
   * Store token to disk be used in later program executions.
   *
   * @param {Object} token The token to store to disk.
   */
  this.storeToken = function(token) {
    try {
      fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
      if (err.code != 'EEXIST') {
        throw err;
      }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
  },

  this.parseEvents = function(handler) {
    return function(err, response) {
      if (err) {
        console.log('The API returned an error: ' + err);
        return;
      }
      var events = filterOutEventsFromThePast(response.items);
      events = addRecurringInformationToDeviatingEvents(events);
      events = getOnlyTheNextEvents(events);
      events = events.map(simplifyEvent);
      events = onlyGetEventsForInterval(events, moment.duration(1, 'week'));
      return handler(events);
    }
  },

  /**
   * Lists the next 10 events on the user's primary calendar.
   *
   * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
   */
  this.handleEvents = function(handler) {
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
  },

  this.filterOutEventsFromThePast = function(events) {
    return events.filter(function(event) {
      if ( 'recurrence' in event ) {
        return true;
      }
      return moment(event.start.dateTime || event.start.date) >= moment();
    });
  },

  this.onlyGetEventsForInterval = function(events, interval) {
    return events.filter(function(event) {
      return event.start <= moment().add(interval);
    });
  },

  this.getNextOccurrenceForReccuringEvent = function(event) {
    var nextOccurrence = moment.tz(event.start.dateTime || event.start.date, event.start.timeZone);
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
  },

  this.getOnlyTheNextEvents = function(events) {
    var nextEvents = [];
    var eventLookup = {};
    var recEventThings = [];
    events.forEach(function(event) {
      // var nextOccurrence = moment.utc(event.start.dateTime || event.start.date);
      var nextOccurrence = moment.tz(event.start.dateTime || event.start.date, event.start.timeZone);
      if ( 'recurrence' in event ) {
        nextOccurrence = getNextOccurrenceForReccuringEvent(event);
      }
      mainID = event.recurringEventId || event.id;
      mainID = mainID.replace(/_.*/, '');
      if ( !(mainID in eventLookup) ) {
        eventLookup[mainID] = {};
      }
      if ( !(nextOccurrence in eventLookup[mainID]) || !('recurrence' in event) ) {
        event.start = nextOccurrence;
        eventLookup[mainID][nextOccurrence] = event;
      }
    });
    for (var mainID in eventLookup) {
      recEventThings = [];
      for (nextOccurrence in eventLookup[mainID]) {
        recEventThings.push(eventLookup[mainID][nextOccurrence]);
      }
      recEventThings.sort(function(event1, event2) {
        return event1.start - event2.start;
      });
      nextEvents.push(recEventThings[0]);
    }
    nextEvents.sort(function(event1, event2) {
      return event1.start - event2.start;
    });
    return nextEvents;
  },

  this.getNiceRecurrence = function(recurrence) {
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
    var matchingElements = recurrence[0].match(/RRULE:FREQ=([A-Z]*);.*?BYDAY=([A-Z]*)/);
    if ( matchingElements == null || matchingElements.length == 0 ) {
      return null;
    }
    return matchingElements[1].toLocaleLowerCase() + ', every ' + shortWeekdaysToLong[matchingElements[2]];
  },

  this.simplifyEvent = function(event) {
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
  },

  this.addRecurringInformationToDeviatingEvents = function(events) {
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
  },

  this.printEventsToChannel = function(channel) {
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
      messages.forEach((message, index) => { channel.send(message) });
    };
  },

  this.announceEventRemindersToChannel = function(channel) {
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
  },


  this.tickHandler = function() {
    authorize(JSON.parse(authTokens), handleEvents(announceEventRemindersToChannel(generalChat)));
  },

  this.installTickHandler = function() {
    var nextTick = momentRound().ceil(5, 'minute');
    var msToTick = nextTick.diff(moment());
    setTimeout(function() {
      installTickHandler();
      tickHandler();
    }, msToTick);
  },

  this.getCurrentDaily = function(daily, when) {
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
  },

  this.getItemsForInterval = function(when, interval) {
    var currentIems = {};
    for (key in dailies) {
      if ( dailies[key].interval[1] == interval ) {
        currentIems[key] = getCurrentDaily(dailies[key], when);
      }
    }
    return currentIems;
  },

  this.getDailies = function(when) {
    return getItemsForInterval(when, "day");
  },

  this.getWeeklies = function(when) {
    return getItemsForInterval(when, "week");
  },

  this.displayCurrentCycle = function(items, title, message) {
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
};
