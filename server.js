'use strict'
const express = require('express')
const Slapp = require('slapp')
const ConvoStore = require('slapp-convo-beepboop')
const Context = require('slapp-context-beepboop')
var util   = require('util');
var spawn = require('child_process').spawn;
var dns = require('dns');

var ping = function(host, cb){

  if(!host || typeof host !== 'string'){
    cb(new Error('No host'));
    return;
  }

  var data = {};
  var stdout = '';
  var stderr = '';
  var error;

  var cp = spawn('ping', ['-n', '-W 2000', '-c 1', host]);

  cp.stdout.on('data', function (data) {
    stdout += data;
  });

  cp.stderr.on('data', function (data) {
    stderr += data;
  });

  cp.on('exit',function(code){
    data.code = code;


    if(code > 0 && code !== 2) {
      error = new Error(stderr);
      data.stdout = stdout;
      data.stderr = stderr;
      return cb(error,data);
    }

    var stdoutLines = stdout.split("\n");
    var ipRe = /\(([\d\.]+)\)/;
    var matches;

    if((matches = stdoutLines[0].match(ipRe)) && (data.ip = matches[1]) && !data.ip){
      error = new Error("ping had malformed stdout: " + stdout);
      return cb(error,data);
    }

    if(code === 2){
      error = new Error('Request timeout');
      return cb(error,data);
    }

    data.msg = stdoutLines[1];
    if(!data.msg){
      error = new Error("ping had malformed stdout: " + stdout);
      return cb(error,data);
    }

    var re = /(\d+) bytes from (.+): icmp_(?:r|s)eq=(\d+) ttl=(\d+) time=([\d.]+) ms/;
    var parts = data.msg.match(re);

    if(!parts.length){
      error = new Error("ping had malformed stdout: " + stdout);
      return cb(error,data);
    }

    data.bytes = Number(parts[1]);
    data.ttl = Number(parts[4]);
    data.time = Number(parts[5]);

    cb(error, data);

  });
};

var pingWithLookup = function(host,cb){

  if(!cb){
    cb = function(){};
  }

  dns.lookup(host,4,function(err, address){
    if(err){
      return cb(err, address);
    }
    ping(address, cb);
  });
};

module.exports = exports = pingWithLookup;


// Beep Boop
var port = process.env.PORT || 3000

var slapp = Slapp({
  // Beep Boop sets the SLACK_VERIFY_TOKEN env var
  verify_token: process.env.SLACK_VERIFY_TOKEN,
  convo_store: ConvoStore(),
  context: Context()
})


var HELP_TEXT = `
Я буду отвечать на следующие сообщения:
\`help\` - помощь
\`check\` - проверить все сайты
`

//*********************************************
// Setup different handlers for messages
//*********************************************

// response to the user typing "help"
slapp.message('help', ['mention', 'direct_message'], (msg) => {
  msg.say(HELP_TEXT)
})


// Can use a regex as well
slapp.message(/^(thanks|thank you)/i, ['mention', 'direct_message'], (msg) => {
  // You can provide a list of responses, and a random one will be chosen
  // You can also include slack emoji in your responses
  msg.say([
    "You're welcome :smile:",
    'You bet',
    ':+1: Of course',
    'Anytime :sun_with_face: :full_moon_with_face:'
  ])
})

// demonstrate returning an attachment...
slapp.message('attachment', ['mention', 'direct_message'], (msg) => {
  msg.say({
    text: 'Check out this amazing attachment! :confetti_ball: ',
    attachments: [{
      text: 'Slapp is a robust open source library that sits on top of the Slack APIs',
      title: 'Slapp Library - Open Source',
      image_url: 'https://storage.googleapis.com/beepboophq/_assets/bot-1.22f6fb.png',
      title_link: 'https://beepboophq.com/',
      color: '#7CD197'
    }]
  })
})

// Catch-all for any other responses not handled above
slapp.message('.*', ['direct_mention', 'direct_message'], (msg) => {
  // respond only 40% of the time
  if (Math.random() < 0.4) {
    msg.say([':wave:', ':pray:', ':raised_hands:'])
  }
})

// attach Slapp to express server
var server = slapp.attachToExpress(express())

// start http server
server.listen(port, (err) => {
  if (err) {
    return console.error(err)
  }

  console.log(`Listening on port ${port}`)
})
