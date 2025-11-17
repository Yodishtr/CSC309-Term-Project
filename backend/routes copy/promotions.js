'use strict';

const express = require('express');
const { requireRole } = require('../middleware/roles');
const { Prisma } = require('@prisma/client');
const { PrismaClient } = require('@prisma/client');
const { datetimeRegex } = require('zod');
const prisma = new PrismaClient();
const router = express.Router();

const ISORegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+\-]\d{2}:\d{2})$/;
const typeRegex = /^(automatic|one-time)$/



router.post('/', requireRole(['manager', 'superuser']), async (req, res) => {
    try {
        const {name, description, type, startTime, endTime, minSpending, rate, points} = req.body
        if (!name || !description || !type || !startTime || !endTime) { return res.status(400).json({error: "Bad Request 1"})}

        // data validation
        if (!typeRegex.test(type) || !ISORegex.test(startTime) || !ISORegex.test(endTime)) { return res.status(400).json({error: "Bad Request 2"}) }
        if (minSpending && minSpending < 0) { return res.status(400).json({ error: "Bad Request 3" })}
        if (rate && rate < 0) {return res.status(400).json({error: "Bad Request 4"})}
        if (points && ( points < 0 || (!Number.isInteger(points)) ) ) { return res.status(400).json({error: "Bad Request 5"}) }
        if (endTime <= startTime || new Date(startTime) < new Date()) { return res.status(400).json({error: "Bad Request 6"}) }
        let useType = type
        if (type === 'one-time') {
            useType = 'onetime'
        }
        let newRate = undefined
        if (rate !== null) {
            newRate = rate
        }

        let newMin = undefined
        if (minSpending !== null) {
            newMin = minSpending
        }

        const newPromo = await prisma.promotion.create({
            data: {name, description, type: useType, startTime, endTime, minSpending: newMin, rate: newRate, points},
            select: {
                id: true,
                name: true,
                description: true,
                type: true,
                startTime: true,
                endTime: true,
                minSpending: true,
                rate: true,
                points: true
            }
        })
        return res.status(201).json(newPromo)
    } catch (err) { 
        return res.status(500).json({'error': err.message})
    }
})

router.get('/', requireRole(['regular', 'cashier', 'manager', 'superuser']), async (req, res) => {
    try {
        const {name, type, page, limit, started, ended} = req.query
        const now = new Date()
        let pageNum = page ?? 1;
        let pageLimit = limit ?? 10;

        pageNum = Number(pageNum);
        pageLimit = Number(pageLimit);
        if (!Number.isInteger(pageNum) || pageNum <= 0 || !Number.isInteger(pageLimit) || pageLimit <= 0) {return res.status(400).json({ error: "Bad Request" });}
        const skip = (pageNum - 1) * pageLimit

        if (name && typeof name !== 'string') { return res.status(400).json({error: "Bad Request"}) }
        if (type && !['one-time', 'automatic'].includes(type)) { return res.status(400).json({error: "Bad Request"}) }

        
        const where = {name}
        let newType = undefined
        if (type !== null) {
            newType = type
        }

        if (newType === 'one-time') {
            newType = 'onetime'
        }

        const select = {
            id: true,
            name: true,
            type: true,
            endTime: true,
            minSpending: true,
            rate: true,
            points: true
        }

        const getRole = await prisma.user.findUnique({
            where: { id: req.auth.id },
            select: { role: true }
        });
        const requesterRole = getRole.role  

        if (requesterRole === 'regular') {
            where.startTime = { lte: now };
            where.endTime = { gt: now }
            where.usedBy = {
                none: { utorid: req.auth.utorid }
            };
            newType = 'onetime'
            if (started || ended) { return res.status(400).json({error: "Bad Request"}) }
        } else if (['manager', 'superuser'].includes(requesterRole)) {
            if (started && ended) { return res.status(400).json({error: "Bad Request"}) }
            if (started) {
                if (started === 'true') { where.startTime = { lte: now }}
                else if (started === 'false') {where.startTime = { gte: now }}
                else { return res.status(400).json({error: "Bad Request"}) }
            }
            else if (ended) {
                if (ended === 'true') {where.endTime = { lte: now }}
                else if (ended === 'false') {where.endTime = { gte: now }}
                else { return res.status(400).json({error: "Bad Request"}) }
            }
            select.startTime = true
        }
        where.type = newType
        const [count, results] = await prisma.$transaction([
            prisma.promotion.count({
                where
            }),
            prisma.promotion.findMany({
                where,
                skip,
                take: pageLimit,
                select
            })
        ])
        console.log("count:", count)
        console.log("results: ", results)
        return res.status(200).json({count, results})
    } catch (err) {return res.status(500).json({'error': err.message})}
})

router.get('/:promotionId', requireRole(['regular', 'cashier', 'manager', 'superuser']), async (req, res) => {
    try {
        const id = parseInt(req.params.promotionId, 10);
        const now = new Date()
        const promo = await prisma.promotion.findFirst({
            where: {
                id,
                endTime: { gte: now },
                startTime: { lte: now }
            },
            select: {
                id: true,
                name: true,
                description: true,
                type: true,
                endTime: true,
                minSpending: true,
                rate: true,
                points: true
            }
        })
        if (!promo) { return res.status(404).json({error: "Not Found"})}
        return res.status(200).json(promo)
    } catch (err) {
        console.log("get promotion by id error", err.message)
        return res.status(500).json({'error': err.message})}
})

router.patch('/:promotionId', requireRole(['manager', 'superuser']), async (req, res) => {
    try {
        const id = parseInt(req.params.promotionId, 10);
        const now = new Date()
        const {name, description, type, startTime, endTime, minSpending, rate, points} = req.body

        const prevTime = await prisma.promotion.findUnique({
            where: {id},
            select: {
                startTime: true,
                endTime: true
            }
        })

        if (!prevTime) { return res.status(404).json({error: "Not Found"})}

        // check if end time has passed, then dont update anything
        if (prevTime.endTime < now) { return res.status(400).json({error: "Bad Request 1"}) }

        // check if start time has passed, cant update anything but endtime then
        if (prevTime.startTime < now) {
            if (name !== undefined || description !== undefined || type !== undefined || startTime !== undefined || minSpending !== undefined || rate !== undefined || points!== undefined ) { return res.status(400).json({error: "Bad Request 2"}) }
        }

        const data = {}
        const select = {
            id: true,
            name: true,
            type: true
        }

        if (startTime !== undefined && endTime === undefined) {
            if (!ISORegex.test(startTime) || new Date(startTime) <= new Date() || new Date(startTime) >= prevTime.endTime ) { return res.status(400).json({error: "Bad Request 3"})}
            data.startTime = startTime
            select.startTime = true
        }
        if (endTime !== undefined){
            if (!ISORegex.test(endTime) || new Date(endTime) <= new Date() || new Date(endTime) <= prevTime.startTime) {return res.status(400).json({error: "Bad Request 4"})}
            data.endTime = endTime
            select.endTime = true
        }         

        // check if start is before end 
        if (startTime !== undefined && endTime !== undefined && (new Date(startTime) >= new Date(endTime))) { return res.status(400).json({ error: "Bad Request 5" })}

        // number validation
        if (minSpending !== undefined && minSpending !== null) {
            if (!Number.isFinite(minSpending) || minSpending < 0) { return res.status(400).json({ error: "Bad Request 6" })}
            data.minSpending = minSpending
            select.minSpending = true
        }
        if (rate !== undefined && rate !== null) {
            if (!Number.isFinite(rate) || rate < 0) {return res.status(400).json({error: "Bad Request 7"})}
            data.rate = rate
            select.rate = true
        }
        if (points !== undefined && points !== null) {
            if ((!Number.isInteger(points)) || points < 0) { return res.status(400).json({error: "Bad Request 8"}) }
            data.points = points
            select.points = true
        } 
        if (type !== undefined && type !== null) {
            if (!typeRegex.test(type)) { return res.status(400).json({error: "Bad Request 9"}) }
            data.type = type
        }
        if (name !== undefined && typeof name == 'string') {
            data.name = name
            select.name = true
        }
        if (description !== undefined && typeof description == 'string') {
            data.description = description
            select.description = true
        }

        const updated = await prisma.promotion.update({
            where: {id},
            data,
            select
        })

        return res.status(200).json(updated)
    } catch (err) {
        console.log("patch promotion id error", err.message)
        return res.status(500).json({'error': err.message})}
})

router.delete('/:promotionId', requireRole(['manager', 'superuser']), async (req, res) => {
    try {
        const id = parseInt(req.params.promotionId, 10);

        // exists?
        const exists = await prisma.promotion.findUnique({
            where: {id},
            select: {id: true, startTime: true}
        })
        if (!exists) { return res.status(404).json({error: "Not Found"})}

        if (exists.startTime <= new Date()) { return res.status(403).json({error: "Forbidden"})}

        await prisma.promotion.delete({where: {id}})
        return res.status(204).send()

    } catch (err) {return res.status(500).json({'error': err.message})}
})


module.exports = router
