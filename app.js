/* jslint node: true */
"use strict";

var _ = require('underscore');
var express = require('express');
var bodyParser = require('body-parser');
const winston = require('winston');
const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');
const { combine, timestamp, printf } = format;

var debug = require('debug')('express-antenna-cocoalumberjack');

var port = process.env.NODE_EXPRESS_ANTENNA_PORT || 3205;
var logPath = process.env.NODE_EXPRESS_ANTENNA_LOG_PATH || null;
var logUrl = process.env.NODE_EXPRESS_ANTENNA_LOG_URL || '/log';
var appName = process.env.NODE_EXPRESS_ANTENNA_APP_NAME || 'antenna-cocoalumberjack';

var fileName = null;

if(!_.isNull(logPath) && !_.isNull(appName)){
  logPath = logPath.replace(/\/$/, "");
  fileName = logPath + '/' + appName + '-%DATE%.log';
}

var transport = null;
var myFormat = null;
var logger = null;

if(!_.isNull(logPath)){
  
  transport = new (winston.transports.DailyRotateFile)({
    filename: fileName,
    datePattern: 'YYYY-MM-DD-HH', //rotate every hour?
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d'
  });
  
  transport.on('rotate', function(oldFilename, newFilename) {
    debug("rotating file");
  });

  myFormat = printf(({ level, message, timestamp }) => {
    return `[${timestamp}] ${level}: ${message}`;
  });
  
  logger = winston.createLogger({
    format: combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss ZZ'
      }),
      myFormat
      ),
      transports: [
        transport
      ]
    });
}

  var app = express();
  
  app.enable('trust proxy');
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({extended: true}));
  
  var router = express.Router();
  app.use('/', router);
  
  // run the app as DEBUG=* node app.js to see the debug messages
  router.use(function(req, res, next){
    debug(req.method + ' ' + req.url);
    next();
  });
  
  // This method allows you to verify that your service is reachable.
  // Open a browser and point to http[s]://yourhost[:port]/ping
  router.get('/ping', function(req, res){
    res.json({pong: new Date().toISOString()});
  });
  
  // Default endpoint is /log.
  // Use export NODE_EXPRESS_ANTENNA_LOG_URL='/api/logging/path' to change it.
  router.post(logUrl, function(req, res){
    var default_keys = ['locale', 'notification', 'uuid', 'json', 'message', 'timestamp', 'method', 'log-level', 'file'];
    var custom_keys = ['username', 'user-id', 'device-name', 'department-id', 'app-version'];
    var filter_keys = _.union(default_keys, custom_keys);
    var object = _.pick(req.body, filter_keys);
    var message = JSON.stringify(object);
    
    var ignored_keys = _.omit(req.body, filter_keys);
    if(_.size(ignored_keys) > 0){
      console.log('ignored keys', ignored_keys);
    }
    
    if(_.isNull(logger) || _.isUndefined(logger)){
      console.log(new Date().toISOString(), message);
    } else {
      logger.info(message);
    }
    
    res.status(200).end();
  });
  
  var server = app.listen(port, function() {
    console.log('Listening on port %d', server.address().port);
  });