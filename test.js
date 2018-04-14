var sheepnet = require('./lib.js')();
var readline = require('readline');
var moment = require('moment-timezone');

var consSend = function(message) {
  if ( "embed" in message ) {
    message.embed.fields.forEach(function(msg) {
      console.log("[34;1m" + msg.name + "[0m");
      console.log('  ' + msg.value.trim().split(/\n/).join("\n  "));
    });
    console.log();
  } else {
    console.log(message.trim());
    rl.prompt();
  }
};

var message = {
  sender: {
    send: consSend,
  },
  channel: {
    send: consSend,
  },
  delete: function() { return { catch: function() {} } }
};

var processLine = function(line) {
  message.content = line;

  if (message.content.indexOf(config.prefix) !== 0) {
    rl.prompt();
    return;
  }

  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  if (command === "events") {
    authorize(JSON.parse(authTokens), handleEvents(function(channel) { return function(events) { printEventsToChannel(channel)(events); rl.prompt(); }}(message.channel)));
  }

  else if (command === "dailies" || command === "daily") {
    message.delete().catch(O_o=>{});
    if ( args.length == 0 ) {
      displayCurrentCycle(getDailies(moment()),  "Current dailies",  message);
      rl.prompt();
    } else {
      var wantedDate = chrono.parseDate(args.join(' ') + ' at ' + moment().format('HH:mm:ss'));
      if ( moment.utc(wantedDate).isValid() ) {
        wantedDate = moment.utc(wantedDate);
        displayCurrentCycle(getDailies(wantedDate),  "Dailies for " + moment.tz(wantedDate, 'Europe/Berlin').format('dddd, MMMM D, YYYY @ HH:mm:ss z'),  message);
        rl.prompt();
      }
    }
  }

  else if (command === "weeklies" || command === "weekly" || command === "nick") {
    message.delete().catch(O_o=>{});
    if ( args.length == 0 ) {
      displayCurrentCycle(getWeeklies(moment()), "Current weeklies", message);
      rl.prompt();
    } else {
      var wantedDate = chrono.parseDate(args.join(' ') + ' at ' + moment().format('HH:mm:ss'));
      if ( moment.utc(wantedDate).isValid() ) {
        wantedDate = moment.utc(wantedDate);
        displayCurrentCycle(getWeeklies(wantedDate),  "Weeklies for " + moment.tz(wantedDate, 'Europe/Berlin').format('dddd, MMMM D, YYYY @ HH:mm:ss z'),  message);
        rl.prompt();
      }
    }
  }

  else if (command === "quit" || command === "q" ) {
    rl.close();
  }
  else {
    console.log('Command not recognized');
    rl.prompt();
  }
};

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> ',
});

console.log("Sheepnet initialized.\n");
rl.prompt();
rl.on('line', processLine);
rl.on('close', function() {
  console.log("Bye!");
  process.exit(0);
});
