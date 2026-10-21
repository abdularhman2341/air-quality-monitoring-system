// prisma.js
// One shared Prisma client for the whole backend.
// Import it wherever you need the database:
//   const prisma = require('./db/prisma');
// Creating a new PrismaClient in every file opens extra connections.

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
