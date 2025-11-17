'use strict';

const express = require('express')
const router = express.Router();

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid');

require('dotenv').config()
const SECRET = process.env.JWT_SECRET
if (!SECRET) throw new Error("Missing JWT_SECRET in .env");


router.post('/tokens', async (req, res) => {
    try {
        const {utorid, password} = req.body || {}
        if (!utorid || !password) {
            return res.status(400).json({'error': 'Bad Request'})
        }
        
        // checks if the user exists and has a password
        const user = await prisma.user.findUnique({
            where: {utorid},
            select: { id: true, utorid: true, role: true, password: true }
        })
        if (!user || !user.password) {
            return res.status(401).json({'error': 'Unauthorized'})
        }

        // checks if the password is correct
        const correct_password = await bcrypt.compare(password, user.password)
        if (!correct_password) { return res.status(401).json({'error': 'Unauthorized'})}

        // create payload and get the JWT
        const payload = {
            id: user.id,
            utorid: user.utorid,
            role: user.role,
            // JWT PAYLOAD add as needed
        }
        const token = jwt.sign(payload, SECRET, {
            algorithm: 'HS256',
            expiresIn: '1d'
        })

        // change the lastLogin time and expiresAt time
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.user.update({
            where: {utorid: user.utorid},
            data: {lastLogin: new Date(), expiresAt}
        })
        return res.status(200).json({'token': token, 'expiresAt': expiresAt})

    } catch (err) {
        return res.status(500).json({'error': err.message})
    }
})

const WINDOW_MS = 60_000;
const lastByIp = new Map();

router.post('/resets', async (req, res) => {
    try {
        const { utorid } = req.body || {}
        if (!utorid) {
            return res.status(400).json({'error': 'Bad Request'})
        }
        
        // checks if the user exists
        const user = await prisma.user.findUnique({
            where: {utorid},
            select: { id: true, utorid: true}
        })
        if (!user) {
            return res.status(404).json({'error': 'Not Found'})
        }

        // rate limiter
        const key = req.ip
        const now = Date.now();
        const last = lastByIp.get(key) || 0;   // if the IP hasnt tried yet, use 0
        if (now - last < WINDOW_MS) {
            return res.status(429).json({'error': 'Too Many Requests'})
        }
        lastByIp.set(key, now)

        // create a resetToken with uuid and the exipry time
        const resetToken = uuidv4()
        const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000)

        // update the user with the reset token
        await prisma.user.update({
            where: {utorid},
            data: { resetToken, resetExpiresAt}
        })

        return res.status(202).json({'expiresAt': resetExpiresAt, 'resetToken': resetToken})

    } catch (err) {
        return res.status(500).json({'error': err.message})
    }
})

router.post('/resets/:resetToken', async (req, res) => {
    try {
        const {utorid, password} = req.body || {}
        const {resetToken} = req.params

        // invalid body or reset token
        if (!utorid || !resetToken) { return res.status(400).json({'error': 'Bad Request'})}

        // user doesnt exist
        const user = await prisma.user.findUnique({ where: {utorid} })
        if (!user) { return res.status(404).json({'error': 'Not Found'}) }

        // reset token is wrong
        if (resetToken != user.resetToken) {
            const tokenExists = await prisma.user.findFirst({
                where: { resetToken }
            })
            if (!tokenExists) {return res.status(404).json({'error': 'Not Found'})}
            return res.status(401).json({'error': 'Unauthorized'})
        }

        // token is expired
        const expired = new Date() > new Date(user.resetExpiresAt)
        if (expired) { return res.status(410).json({'error': 'Gone'}) }

        // password validation
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,20}$/;
        if (!passwordRegex.test(password)) { return res.status(400).json({'error': 'Bad Request'})}

        // change the password
        const encrypted = await bcrypt.hash(password, 10)
        await prisma.user.update({
            where: { utorid },
            data: { 
                password: encrypted,
                resetExpiresAt: new Date(),
             }
        })
        return res.status(200).json({'message': 'OK'})

    } catch (err) {
        return res.status(500).json({'error': err.message})
    }
})


module.exports = router