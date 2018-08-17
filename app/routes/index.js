// this file is for if you have multiple groups of routes, for example
// routes for notes, and then routes for to do lists
//
// It is basically a director that tells which route file to go to

const urlRoutes = require('./urlRoutes');

module.exports = function(app, db) {
	urlRoutes(app, db);
	// Other route groups could go here, in the future
};
