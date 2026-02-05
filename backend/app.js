// cPanel Node.js Application Entry Point
// This file is used by cPanel's Phusion Passenger to start the app

const server = require('./server.js');

// Export for Passenger
module.exports = server;
