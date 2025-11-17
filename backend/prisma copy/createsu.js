/*
 * Complete this script so that it is able to add a superuser to the database
 * Usage example: 
 *   node prisma/createsu.js clive123 clive.su@mail.utoronto.ca SuperUser123!
 */
'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
require('dotenv').config()

const SECRET = process.env.JWT_SECRET

async function main() {
    const args = process.argv.slice(2)
    if (args.length < 3) {
        console.error("utorid, email, and password required")
        process.exit(1)
    }
    const [utorid, email, password] = args;
    const hashed_password = await bcrypt.hash(password, 10);

    try {
        const user = await prisma.user.create({
            data: {
                utorid,
                email,
                password: hashed_password,
                role: 'superuser',
                verified: true
            }
        })
        console.log("Superuser Created")
    }
    catch (err) {
        console.log("error creating superuser")
    } finally {
        await prisma.$disconnect();
    }
}

main()