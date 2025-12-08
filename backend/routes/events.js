'use strict';

const express = require('express')
const router = express.Router();

const ISORegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+\-]\d{2}:\d{2})$/;
const { requireRole } = require('../middleware/roles');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.post('/', requireRole(['manager', 'superuser']), async (req, res) => {
    try {  
        const {name, description, location, startTime, endTime, capacity, points} = req.body

        const now = new Date()
        if  (!name || !description || !location || !startTime || !endTime || points === undefined) {
            return res.status(400).json({error: "Bad Request 1"})
        }
        if (!ISORegex.test(startTime) || !ISORegex.test(endTime)) { return res.status(400).json({error: "Bad Request 2"}) }
        if (capacity && capacity < 0) { return res.status(400).json({ error: "Bad Request 3" })}
        if (points < 0 || (!Number.isInteger(points)) ) { return res.status(400).json({error: "Bad Request 4"}) }
        if (endTime <= startTime || new Date(startTime) < now || new Date(endTime) < now) { return res.status(400).json({error: "Bad Request 5"}) }

        const newEvent = await prisma.event.create({
            data: {name, description, location, startTime, endTime, capacity, spaceRemain: capacity, pointsRemain: points, published: true},
            select: {
                id: true,
                name: true,
                description: true,
                location: true,
                startTime: true,
                endTime: true,
                capacity: true,
                pointsRemain: true,
                pointsAwarded: true,
                published: true,
                organizers: true,
                guests: true
            }
        })
        return res.status(201).json(newEvent)
    } catch (err) {
        return res.status(500).json({'error': err.message})
    }
})

router.get('/', requireRole(['regular', 'cashier', 'manager', 'superuser']), async (req, res) => {
    try {
        const {name, location, started, ended, showFull, page, limit, published} = req.query
        const now = new Date()

        let pageNum = page ?? 1;
        let pageLimit = limit ?? 10;

        pageNum = Number(pageNum);
        pageLimit = Number(pageLimit);
        if (!Number.isInteger(pageNum) || pageNum <= 0 || !Number.isInteger(pageLimit) || pageLimit <= 0) {return res.status(400).json({ error: "Bad Request" });}
        const skip = (pageNum - 1) * pageLimit
        const where = {}
        const select = {
            id: true,
            name: true,
            location: true,
            startTime: true,
            endTime: true,
            capacity: true,
            _count: {select: {guests: true}}
        }

        if (name) {
            if (typeof name !== 'string') { return res.status(400).json({error: "Bad Request"}) }
            where.name = name
        }
        if (location) {
            if (typeof location !== 'string') { return res.status(400).json({error: "Bad Request"}) }
            where.location = location
        }
        if (started) {
            if (ended) { return res.status(400).json({error: "Bad Request"}) }
            if (!['true', 'false'].includes(started)) { return res.status(400).json({error: "Bad Request"}) }
            where.startTime = started === 'true' ? { lte: now } : { gt: now }
        }
        if (ended) {
            if (!['true', 'false'].includes(ended)) { return res.status(400).json({error: "Bad Request"}) }
            where.endTime = ended === 'true' ? { lte: now } : { gt: now }
        }
        if (showFull) {
            if (!['true', 'false'].includes(showFull)) { return res.status(400).json({error: "Bad Request"}) }
        } 
        if (!showFull || showFull === 'false') {
            where.OR = [
                { capacity: null },
                { spaceRemain: { gt: 0 } }
            ];
        }
        const getRole = await prisma.user.findUnique({
            where: { id: req.auth.id },
            select: { role: true }
        });
        const requesterRole = getRole.role
        if (requesterRole === 'regular') {
            if (published) {return res.status(400).json({error: "Bad Request"}) }
            where.published = true
        }
        if (requesterRole === 'cashier') {
            if (published) {return res.status(400).json({error: "Bad Request"}) }
        } 
        if (requesterRole === 'manager' || requesterRole === 'superuser') {
            if (published) {
                if (!['true', 'false'].includes(published)) { return res.status(400).json({error: "Bad Request"}) }
                where.published = published === 'true' ? true : false
            }
            select.pointsRemain = true;
            select.pointsAwarded = true;
            select.published = true;
        }

        const [count, results] = await prisma.$transaction([
            prisma.event.count({ where }),
            prisma.event.findMany({
                where,
                skip,
                take: pageLimit,
                select
            })
        ])
        for (const r of results) {
            r.numGuests = r._count.guests
            delete r._count
        }
        return res.status(200).json({count, results})
    } catch (err) {return res.status(500).json({'error': err.message})}
})

router.get('/:eventId', requireRole(['regular', 'cashier', 'manager', 'superuser']), async (req, res) => {
    try {
        const id = parseInt(req.params.eventId, 10)
        if (!id || id < 0) { return res.status(400).json({error: "Bad Request"}) }

        const getRole = await prisma.user.findUnique({
            where: { id: req.auth.id },
            select: { 
                role: true,
                organizingEvents: {select: { id: true } },
             }
        });
        const requesterRole = getRole.role
        const isOrganizer = getRole.organizingEvents.map(e => e.id).includes(id)
        const isPriviliged = (requesterRole === 'manager' || requesterRole === 'superuser')

        const select = {
            id: true,
            name: true,
            description: true,
            location: true,
            startTime: true,
            endTime: true,
            capacity: true,
            organizers: {
                select: { id: true, utorid: true, name: true}
            },      
            _count: {select: {guests: true}},
            published: true,
            guests: {select: { id: true, utorid: true, name: true}},
            pointsRemain: true,
            pointsAwarded: true,
        }

        const event =  await prisma.event.findUnique({
            where: { id },
            select
        })

        if (!event) { return res.status(404).json( {error: "Not Found"}) }
        
        const result = {}

        if (!isPriviliged && !isOrganizer) {
            if (!event.published) { return res.status(404).json({error: "Not Found"}) }
            result.id = event.id
            result.name = event.name
            result.description = event.description
            result.location = event.location
            result.startTime = event.startTime
            result.endTime = event.endTime
            result.capacity = event.capacity
            result.organizers = event.organizers
            result.numGuests = event._count.guests
        } else {
            result.id = event.id
            result.name = event.name
            result.description = event.description
            result.location = event.location
            result.startTime = event.startTime
            result.endTime = event.endTime
            result.capacity = event.capacity
            result.pointsRemain = event.pointsRemain
            result.pointsAwarded = event.pointsAwarded
            result.published = event.published
            result.organizers = event.organizers
            result.guests = event.guests
        }

        return res.status(200).json(result)
    } catch (err) {return res.status(500).json({'error': err.message})}
})

router.patch('/:eventId', requireRole(['regular', 'cashier', 'manager', 'superuser']), async (req, res) => {
    try {
        const id = parseInt(req.params.eventId, 10)
        const now = new Date()
        if (!id || id < 0) { return res.status(400).json({error: "Bad Request"}) }

        const getRole = await prisma.user.findUnique({
            where: { id: req.auth.id },
            select: { 
                role: true,
                organizingEvents: {select: { id: true } },
             }
        });
        const requesterRole = getRole.role
        const isOrganizer = getRole.organizingEvents.map(e => e.id).includes(id)
        const isPriviliged = (requesterRole === 'manager' || requesterRole === 'superuser')
        if (!isPriviliged && !isOrganizer) { return res.status(403).json({error: "Forbidden"}) }

        Object.keys(req.body).forEach(key => {
            if (req.body[key] === null) {
                delete req.body[key];
            }
        });

        const {name, description, location, startTime, endTime, capacity, points, published} = req.body


        if (name !== undefined && typeof name !== 'string') { return res.status(400).json({error: "Bad Request"}) }
        if (description !== undefined && typeof description !== 'string') { return res.status(400).json({error: "Bad Request"}) }
        if (location !== undefined && typeof location !== 'string') { return res.status(400).json({error: "Bad Request"}) }
        if (startTime !== undefined && !ISORegex.test(startTime)) { return res.status(400).json({error: "Bad Request"}) }
        if (endTime !== undefined && !ISORegex.test(endTime)) { return res.status(400).json({error: "Bad Request"}) }
        if (startTime !== undefined && endTime !== undefined) {
            if (new Date(startTime) >= new Date(endTime)) { return res.status(400).json({ error: "Bad Request" }) }
        }
        if (capacity !== undefined && (capacity < 0 || !Number.isInteger(capacity))) { return res.status(400).json({ error: "Bad Request" }) }
        if (points !== undefined) {
            if (!isPriviliged) { return res.status(403).json({error: "Forbidden"}) }
            if (points <= 0 || !Number.isInteger(points)) { return res.status(400).json({error: "Bad Request"}) }
        }
        if (published !== undefined && published !== null) {
            if (!isPriviliged) { return res.status(403).json({error: "Forbidden"}) }
            if (published !== true) { return res.status(400).json({error: "Bad Request"}) }
        }
        
        const data = {}
        const select = {
            id: true,
            name: true,
            location: true,
        }

        const currentEvent = await prisma.event.findUnique({
            where: { id },
            select: {
                _count: {select: {guests: true}},
                capacity: true,
                pointsAwarded: true,
                startTime: true,
                endTime: true
            }
        })

        if (name !== undefined) { data.name = name }
        if (description !== undefined) { data.description = description; select.description = true }
        if (location !== undefined) { data.location = location }
        if (published === true) { data.published = true; select.published = true }

        if (startTime !== undefined) {
            if (new Date(startTime) < now) { return res.status(400).json({ error: "Bad Request" }) }

            data.startTime = new Date(startTime)
            select.startTime = true
        }
        if (endTime !== undefined) {
            if (new Date(endTime) < now) { return res.status(400).json({ error: "Bad Request" }) }
            if (startTime === undefined) {
                if (currentEvent.startTime >= new Date(endTime)) { return res.status(400).json({ error: "Bad Request" }) }
            }
            data.endTime = new Date(endTime)
            select.endTime = true
        }
        if (capacity !== undefined) {
            if (capacity < currentEvent._count.guests) { return res.status(400).json({ error: "Bad Request" }) }
            data.capacity = capacity
            data.spaceRemain = capacity - currentEvent._count.guests
            select.capacity = true
        }
        if (points !== undefined) {
            if (points < currentEvent.pointsAwarded) { return res.status(400).json({ error: "Bad Request" }) }
            data.pointsRemain = points - currentEvent.pointsAwarded
        }   
        select.pointsRemain = true
        select.pointsAwarded = true
        if (currentEvent.startTime < now) {
            if (name !== undefined || description !== undefined || location !== undefined || startTime !== undefined || capacity !== undefined) {
                return res.status(400).json({ error: "Bad Request" })
            }
        }
        if (currentEvent.endTime < now) {
            if (endTime !== undefined) {return res.status(400).json({ error: "Bad Request" })}
        }

        const updated = await prisma.event.update({
            where: {id},
            data,
            select
        })
        if (points !== undefined) {
            updated.points = updated.pointsRemain + updated.pointsAwarded
        }
        delete updated.pointsRemain
        delete updated.pointsAwarded
        return res.status(200).json(updated)
    } catch (err) {return res.status(500).json({'error': err.message})}
})

router.delete('/:eventId', requireRole(['manager', 'superuser']), async (req, res) => {
    try {
        const id = Number(req.params.eventId);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: "Bad Request" });
        }
        if (!id || id < 0) { return res.status(400).json({error: "Bad Request"}) }

        const toDelete = await prisma.event.findUnique({
            where: { id },
            select: { id: true }
        })
        
        if (!toDelete) { return res.status(404).json({error: "Not Found"}) }  

        await prisma.event.delete({ where: { id } })
        return res.status(204).send()
    } catch (err) {return res.status(500).json({'error': err.message})}
})

router.post('/:eventId/organizers', requireRole(['manager', 'superuser']), async (req, res) => {
    try {
        const id = Number(req.params.eventId);
        const now = new Date()
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: "Bad Request" });
        }
        const { utorid } = req.body;
        if (!utorid || typeof utorid !== 'string') {
            return res.status(400).json({ error: "Bad Request" });
        }
        const user = await prisma.user.findUnique({
            where: { utorid },
            select: { id: true }
        })
        if (!user) { return res.status(404).json({ error: "Not Found" }); }

        const event = await prisma.event.findUnique({
            where: { id },
            select: {
                guests: { select: { utorid: true } },
                endTime: true
            }
        })
        if (!event) { return res.status(404).json({ error: "Not Found" }); }
        
        if (event.guests.some(g => g.utorid === utorid)) {
            return res.status(400).json({ error: "Bad Request" });
        }
        if (event.endTime <= now) {
            return res.status(410).json({ error: "Gone" });
        }

        const updated = await prisma.event.update({
            where: { id },
            data: {
                organizers: {
                    connect: { utorid }
                }
            },
            select: {
                id: true,
                name: true,
                location: true,
                organizers: {
                    select: { id: true, utorid: true, name: true }
                }
            }
        })
        return res.status(201).json(updated);

    } catch (err) {return res.status(500).json({'error': err.message})}
})

router.delete('/:eventId/organizers/:userId', requireRole(['manager', 'superuser']), async (req, res) => {
    try {
        const id = Number(req.params.eventId);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: "Bad Request" });
        }
        const userId = Number(req.params.userId);
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({ error: "Bad Request" });
        }
        const event = await prisma.event.findUnique({
            where: { id },
            select: {
                organizers: { select: { id: true } },
                endTime: true
            }
        })
        if (!event) { return res.status(404).json({ error: "Not Found" }); }
        if (!event.organizers.some(o => o.id === userId)) {
            return res.status(404).json({ error: "Not Found" });
        }
        await prisma.event.update({
            where: { id },
            data: {
                organizers: {
                    disconnect: { id: userId }
                }
            }
        })

        return res.status(204).send()
    } catch (err) {return res.status(500).json({'error': err.message})}
})

router.post('/:eventId/guests', requireRole(['regular', 'cashier', 'manager', 'superuser']), async (req, res) => {
    try {
        const id = Number(req.params.eventId);
        const now = new Date()
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: "Bad Request" });
        }
        const { utorid } = req.body;
        if (!utorid || typeof utorid !== 'string') {
            return res.status(400).json({ error: "Bad Request" });
        }

        const guest = await prisma.user.findUnique({
            where: { utorid },
            select: { 
                id: true,
                utorid: true,
                name: true
             }
        })
        if (!guest) { return res.status(404).json({ error: "Not Found" }); }

        const getRole = await prisma.user.findUnique({
            where: { id: req.auth.id },
            select: { role: true }
        });
        const requesterRole = getRole.role

        const isPriviliged = (requesterRole === 'manager' || requesterRole === 'superuser') 

        const event = await prisma.event.findUnique({
            where: { id },
            select: {
                organizers: { select: { utorid: true } },
                guests: { select: { utorid: true } },
                spaceRemain: true,
                endTime: true,
                published: true,
                name: true,
                location: true
            }
        })
        if (!event) { return res.status(404).json({ error: "Not Found" }); }

        const isOrganizer = event.organizers.some(o => o.utorid === req.auth.utorid)
        if (!isPriviliged && !isOrganizer) { return res.status(403).json({ error: "Forbidden" }) }

        if (!event.published && !isPriviliged) {
            return res.status(404).json({ error: "Not Found" }); 
        }
        
        if (event.organizers.some(o => o.utorid === utorid)) {
            return res.status(400).json({ error: "Bad Request" });
        }
        if (event.guests.some(g => g.utorid === utorid)) {
            const toReturn = {}
            toReturn.id = event.id
            toReturn.name = event.name
            toReturn.location = event.location
            toReturn.numGuests = event.guests.length
            toReturn.guestAdded = guest
            return res.status(201).json(toReturn);
        }
        if (event.endTime <= now) {
            return res.status(410).json({ error: "Gone" });
        }
        if (event.spaceRemain !== null && event.spaceRemain <= 0) {
            return res.status(410).json({ error: "Gone" });
        }

        const updated = await prisma.event.update({
            where: { id },
            data: {
                guests: {
                    connect: { utorid }
                },
                spaceRemain: event.spaceRemain !== null ? event.spaceRemain - 1 : null,
            },
            select: {
                id: true,
                name: true,
                location: true,
                _count: {select: {guests: true}}
            }
        })
        updated.numGuests = updated._count.guests
        delete updated._count
        updated.guestAdded = guest

        return res.status(201).json(updated);

    } catch (err) {return res.status(500).json({'error': err.message})}
})

router.post('/:eventId/guests/me', requireRole(['regular']), async (req, res) => {
    try {
        const id = Number(req.params.eventId);
        const now = new Date()
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: "Bad Request" });
        }
        const utorid = req.auth.utorid;

        const user = await prisma.user.findUnique({
            where: { utorid },
            select: { id: true, utorid: true, name: true }
        })

        const event = await prisma.event.findUnique({
            where: { id },
            select: {
                organizers: { select: { utorid: true } },
                guests: { select: { utorid: true } },
                spaceRemain: true,
                endTime: true,
                published: true
            }
        })
        if (!event) { return res.status(404).json({ error: "Not Found" }); }
        if (!event.published) { return res.status(404).json({ error: "Not Found" }); }
        if (event.endTime <= now) {return res.status(410).json({ error: "Gone" });  }
        if (event.spaceRemain <= 0) {return res.status(410).json({ error: "Gone" });  }
        if (event.guests.some(g => g.utorid === utorid)) {
            return res.status(400).json({ error: "Bad Request" });
        }
        if (event.organizers.some(o => o.utorid === utorid)) {
            return res.status(400).json({ error: "Bad Request" });
        }

        const updated = await prisma.event.update({ 
            where: { id },
            data: {
                guests: {
                    connect: { utorid }
                },
                spaceRemain: event.spaceRemain !== null ? event.spaceRemain - 1 : null,
            },
            select: {
                id: true,
                name: true,
                location: true,
                _count: {select: {guests: true}}
            }
        })
        updated.numGuests = updated._count.guests
        delete updated._count
        updated.guestAdded = user
        
        return res.status(201).json(updated);

    } catch (err) {return res.status(500).json({'error': err.message})}
})

router.delete('/:eventId/guests/me', requireRole(['regular']), async (req, res) => {
    try {
        const id = Number(req.params.eventId);
        const now = new Date()
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: "Bad Request" });
        }
        const utorid = req.auth.utorid;
        
        const event = await prisma.event.findUnique({
            where: { id },
            select: {
                guests: { select: { utorid: true } },
                endTime: true,
                spaceRemain: true
            }
        })
        if (!event) { return res.status(404).json({ error: "Not Found" }); }
        if (!event.guests.some(g => g.utorid === utorid)) {
            return res.status(404).json({ error: "Not Found" });
        } 
        if (event.endTime <= now) {
            return res.status(410).json({ error: "Gone" });
        }
        await prisma.event.update({
            where: { id },
            data: {
                guests: {
                    disconnect: { utorid }
                },
                spaceRemain: event.spaceRemain !== null ? event.spaceRemain + 1 : null,
            }
        })
        return res.status(204).send()
    } catch (err) {return res.status(500).json({'error': err.message})}
})

router.delete('/:eventId/guests/:userId', requireRole(['manager', 'superuser']), async (req, res) => {
    try {
        const id = Number(req.params.eventId);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: "Bad Request" });
        }
        const userId = Number(req.params.userId);
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({ error: "Bad Request" });
        } 
        const event = await prisma.event.findUnique({
            where: { id },
            select: {
                guests: { select: { id: true } },
                endTime: true,
                spaceRemain: true
            }
        })
        if (!event) { return res.status(404).json({ error: "Not Found" }); }
        if (!event.guests.some(g => g.id === userId)) {
            return res.status(404).json({ error: "Not Found" });
        }
        await prisma.event.update({
            where: { id },
            data: {
                guests: {
                    disconnect: { id: userId }
                },
                spaceRemain: event.spaceRemain !== null ? event.spaceRemain + 1 : null,
            }
        })

        return res.status(204).send()
    } catch (err) {return res.status(500).json({'error': err.message})}
})

// TODO: Implement transaction endpoint
router.post('/:eventId/transactions', requireRole(['regular', 'cashier', 'manager', 'superuser']), async (req, res) => {
    try {
        const id = Number(req.params.eventId);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: "Bad Request 1" });
        }
        const getRole = await prisma.user.findUnique({
            where: { id: req.auth.id },
            select: { 
                role: true,
                organizingEvents: {select: { id: true } },
             }
        });
        const requesterRole = getRole.role
        const isOrganizer = getRole.organizingEvents.map(e => e.id).includes(id)
        const isPriviliged = (requesterRole === 'manager' || requesterRole === 'superuser') 

        if (!isOrganizer && !isPriviliged) { return res.status(403).json({error: "Forbidden"})}

        const {type, utorid, amount, remark} = req.body

        if (type !== 'event' || !amount || !Number.isInteger(amount) || amount <= 0) { return res.status(400).json({error: "Bad Request 2"})}
        if (remark && typeof remark !== 'string') {return res.status(400).json({error: "Bad Request 3"})}

        const event = await prisma.event.findUnique({
            where: {id},
            select: {
                pointsRemain: true,
                guests: {select: {id: true, utorid: true}}
            }
        })
        if (!event) { return res.status(404).json({error: "Not Found"}) }

        let awardTo = event.guests.map(e => e.utorid)

        if (utorid) {
            const user = await prisma.event.findFirst({
                where: {
                    id,
                    guests: { some: {utorid}}
                },
                select: {
                    id: true
                }
            })
            if (!user) { return res.status(400).json({error: "Bad Request 5"})}
            awardTo = [utorid]
        }

        if (awardTo.length === 0) {return res.status(400).json({error: "Bad Request 6"})}

        const totalUsed = amount * awardTo.length
        if (event.pointsRemain < totalUsed) { return res.status(400).json({error: "Bad Request 4"}) }


        let result = []
        for (const u of awardTo) {
            // create transaction
            let trans = await prisma.transaction.create({
                data: {
                    utorid: u,
                    type: 'event',
                    points: amount,
                    remark,
                    relatedId: id,
                    createdBy: req.auth.utorid
                },
                select: {
                    id: true,
                    utorid: true,
                    points: true,
                    type: true,
                    relatedId: true,
                    remark: true,
                    createdBy: true
                }
            })
            trans.recipient = trans.utorid
            delete trans.utorid
            trans.awarded = trans.points
            delete trans.points
            // update the users points
            let updated = await prisma.user.update({
                where: {utorid: u},
                data: {
                    points: {increment: amount}
                }
            })
            result.push(trans)
        }

        const updateEvent = await prisma.event.update({
            where: {id},
            data: {
                pointsRemain: {decrement: totalUsed},
                pointsAwarded: {increment: totalUsed}
            }
        })
        const single = result[0]
        if (utorid) { 
            return res.status(201).json(single)} else { return res.status(201).json(result)}

    } catch (err) {
        console.log(err.message)
        return res.status(500).json({'error': err.message})}
})




module.exports = router