'use strict';
const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const bodyParser = require('body-parser');
const db = require('../config/db');
const fs = require('fs');
const https = require('https');
const app = express();

const port = db.port || 8443;

const options = {
  key: fs.readFileSync( '../certs/searchstash.key' ),
  cert: fs.readFileSync( '../certs/searchstash.crt' )
};

const httpsServer = https.createServer(options, app);

app.use(bodyParser.urlencoded({extended: false}));

// db.url = 'mongodb://localhost:27017' ;
const client = new MongoClient(db.url);
const dbName = 'highlighter'

async function main() {
  await client.connect();
  console.log('Connected successfully to server');
  const db = client.db(dbName);
  
  return db;
}

main()
  .then( ( database ) => {
    require('./app/routes')(app, database);

    httpsServer.listen( port );
  })
  .catch( err => console.log(err));

