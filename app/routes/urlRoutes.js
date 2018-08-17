// In Express, routes are wrapped in a function, which takes the Express
// instance and a database as arguments

module.exports = function(app, db) {
  // var ObjectID = require('mongodb').ObjectID
  const bodyParser = require('body-parser');
  const jsonParser = bodyParser.json();
  const inspector = require('schema-inspector');
  const fetch = require('node-fetch');
  const mydb = require('../../config/db');
  const key = mydb.key;
  const crypto = require('crypto');

  // Sanitization Schema
  const userSelectionSanitization = {
    type: 'object',
    properties: {
      userId: {type: 'string', rules: ['trim']},
      addrURL: {type: 'string'},
      title: {type: 'string'},
      highlight: {type: 'string'},
      label: {
        type: 'string', rules: ['trim', 'lower'],
        optional: 'true', def: 'general'
      }
    }
  };

  // Validation schema
  const userSelectionValidation = {
    type: 'object',
    properties: {
      userId: {type: 'string', minLength: 1},
      addrURL: {type: 'string', minLength: 1, pattern: 'url'},
      title: {type: 'string', minLength: 1},
      highlight: {type: 'string', minLength: 1},
      label: {type: 'string', minLength: 1}
    }
  };

  const searchSanitization = {
    type: 'object',
    properties: {
      search: {type: 'string', rules: ['trim']}
    }
  };

  const searchValidation = {
    type: 'object',
    properties: {
      search: {type: 'string', minLength: 1}
    }
  };

  // adds an entry to the database
  app.post('/urls', jsonParser, (req, res) => {
    // const url = {url: req.body.url};
    if (req.body) {
      inspector.sanitize(userSelectionSanitization, req.body);
      const result = inspector.validate(userSelectionValidation, req.body);
      if (result.valid) {
        db.collection('url').insert(req.body, (err, result) => {
          if (err) {
            res.statusCode = 500;
            res.send({'error': 'An error has occurred'});
          } else {
            // res.statusCode = 600;
            // res.setHeader('Content-Type', 'application/json');
            // res.setHeader('x-VarunHeader', 'silly');
            res.send(result.ops[0]);
          }
        });
      } else {
        res.statusCode = 400;
        res.send(result.error[0]);
      }
    } else {
      res.statusCode = 400;
      res.send({'error': 'Payload empty'});
    }
  });

  // Searches database for a search request
  app.get('/urls', (req, res) => {
    inspector.sanitize(searchSanitization, req.query);
    const result = inspector.validate(searchValidation, req.query);
    if (result.valid) {
      const query = req.query.search;

      let token = req.headers.authorization;
      console.log(token);
      token = token.split(' ')[1];
      token = parseInt(token);
      const id = req.headers['x-id'];
      console.log(id);

      const col = db.collection('users');
      const mongoQuery = {
        'user': {$eq: id}
      };

      col.findOne(mongoQuery).then((result) => {
        console.log(result);
        if (result === null || result.token !== token) {
          res.statusCode = 401;
          res.send({'error': 'Unauthorized access to server'});
        } else {
          const col = db.collection('url');
          const mongoQuery = {
            $and: [
              {
                $text: {
                  $search: query
                }
              },
              {
                "userId": id
              }
            ]
          };

          const exclude = {
            _id: 0
          };

          col.find(mongoQuery, exclude).toArray((err, docs) => {
            if (err) {
              res.statusCode = 500;
              res.send();
            } else {
              console.log(docs);
              res.send(docs);
            }
          });
        }
      });
    } else {
      res.statusCode = 400;
      res.send(result.error[0]);
    }
  });

  // creates and returns a token to validate requests to server
  app.get('/create-token', (req, res) => {
    const oauthToken = req.query.oauthToken;

    let init = {
      method: 'GET',
      async: true,
      headers: {
        'Authorization': 'Bearer ' + oauthToken,
        'Content-Type': 'application/json'
      }
      /* ,
      'contentType': 'json'
      */
    };

    fetch(
      'https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,photos&key=' + key,
      init)
      .then((response) => response.json())
      .then(function(data) {
        console.log(data);
        if (data.error) {
          throw new Error('Oauth token is not valid');
        }

        // const userID = 'google:' + data.names[0].metadata.source.id;
        const givenName = data.names[0].givenName;
        const userID = 'google:' + data.names[0].metadata.source.id;
        const imgSrc = data.photos[0].url;

        const col = db.collection('users');

        const mongoQuery = {
          'user': {$eq: userID}
        };

        const sort = [
          ['_id', 'asc']
        ];

        const update = {
          $set: {'token': Date.now()}
          // $set: {'token': crypto.randomBytes(48).toString('hex')}
        };

        const options = {
          new: true,
          upsert: true
        };

        col.findAndModify(mongoQuery, sort, update, options, (err, result) => {
          console.log(result);
          if (err) {
            res.statusCode = 500;
            res.send({'error': err});
          } else {
            console.log(result.value);
            res.send({
              userInfo: {
                'givenName': givenName,
                'userID': userID, 
                'imgSRC': imgSrc
              },
              token: result.value.token
            });
          }
        });
      }).catch((err) => {
        console.log(err);
        res.statusCode = 401;
        res.send({'Error': err.message});
      });
  });

  // remove a token from the server when the user logs out
  app.delete('/delete-token', (req, res) => {
    const token = req.headers.authorization;
    console.log(token);
    token = token.split(' ')[1];
    token = parseInt(token);

    const col = db.collection('users');
    const mongoQuery = {
      'token': {$eq: token},
    };

    col.findOneAndDelete(mongoQuery).then((result) => {
      if (result.value != null) {
        res.send(result);
      } else {
        // token doesn't exist
        res.statusCode = 400;
        res.send(result);
      }
    });
  });

  app.get('/health', (req, res) => {
    res.statusCode = 200;
    res.send('OK');
  });

  //app.use(express.static(__dirname + "/public/"));

  // custom 404 response
  app.use(function (req, res) {
    res.type('text/plain');
    res.status(404);
    res.clearCookie('userkey');
    res.send('404 - Not Found');
  });
  // custom 500 response
  app.use(function (err, req, res, next) {
    res.type('text/plain');
    res.status(500);
    res.send('500 - Server Error');
  });
};
