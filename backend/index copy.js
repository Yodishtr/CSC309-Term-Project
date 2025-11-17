#!/usr/bin/env node
'use strict';

const port = (() => {
    const args = process.argv;

    if (args.length !== 3) {
        console.error("usage: node index.js port");
        process.exit(1);
    }

    const num = parseInt(args[2], 10);
    if (isNaN(num)) {
        console.error("error: argument must be an integer.");
        process.exit(1);
    }

    return num;
})();

const express = require("express");
const app = express();

app.use(express.json());

// ADD YOUR WORK HERE
const { expressjwt: jwt } = require('express-jwt');
require('dotenv').config()

// JWT middleware
app.use(jwt({
    secret: process.env.JWT_SECRET,
    algorithms: ['HS256']}).unless({
        path: [/^\/auth\/.*/]
    })
)
// checks if JWT token was valid, and returns an error if not
app.use((err, req, res, next) => {
  if (err.name === "UnauthorizedError") {
    return res.status(401).json({'error': "Unauthorized"});
  }
  next(err);
});


// Importing routes
const authRoutes = require('./routes/auth')
app.use('/auth', authRoutes)

const userRoutes = require('./routes/users')
app.use('/users', userRoutes)

const transactionRoutes = require('./routes/transactions')
app.use('/transactions', transactionRoutes)

const eventRoutes = require('./routes/events')
app.use('/events', eventRoutes)

const promotionRoutes = require('./routes/promotions')
app.use('/promotions', promotionRoutes)

app.use((req, res) => {
  return res.status(405).json({ error: "Method Not Allowed" });
});

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

server.on('error', (err) => {
    console.error(`cannot start server: ${err.message}`);
    process.exit(1);
});
