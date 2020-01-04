'use strict';
const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const bodyParser = require('body-parser');
const db = require('./config/db');
const fs = require('fs');
const https = require('https');
const http = require('http');


const app = express();

const port = db.port || 3000;
/*
const privateKey = fs.readFileSync(process.argv[2], 'utf8');
const certificate = fs.readFileSync(process.argv[3], 'utf8');
const credentials = {key: privateKey, cert: certificate};
*/

// your express configuration here

var httpServer = http.createServer(app);

// const httpsServer = https.createServer(credentials, app);

app.use(bodyParser.urlencoded({extended: false}));

MongoClient.connect(db.url, (err, database) => {
  if (err) return console.log(err);

  require('./app/routes')(app, database);

  httpServer.listen(port, () => {
    console.log('We are live on ' + port);
  });
});
