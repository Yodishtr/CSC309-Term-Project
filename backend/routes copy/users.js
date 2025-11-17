'use strict';

const express = require('express')
const router = express.Router();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const bcrypt = require('bcrypt');

const { requireRole } = require('../middleware/roles');
const { v4: uuidv4 } = require('uuid');

const utoridRegex = /^[a-z0-9]{7,8}$/;
const nameRegex = /^.{1,50}$/;
const emailRegex = /^[A-Za-z0-9._%+-]+@mail\.utoronto\.ca$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,20}$/

function isValidDateString(str) {
    // 2. verify actual calendar validity (e.g., rejects 2023-02-30)
    const [year, month, day] = str.split("-").map(Number);
    const date = new Date(str);

    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day - 1
    );
}

router.post('/', requireRole(['cashier', 'manager', 'superuser']), async (req, res) => {
    try {
        const { utorid, name, email } = req.body || {}

        // missing any field
        if (!utorid || !name || !email) { return res.status(400).json({'error': 'Bad Request'}) }

        // input validation
        if (!utoridRegex.test(utorid) || !nameRegex.test(name) || !emailRegex.test(email)) { return res.status(400).json({'error': 'Bad Request'})}

        // does the utorid or email already belong to anyone
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                { utorid: utorid },
                { email: email }
                ]
            }
        })
        if (user) { return res.status(409).json({'error': 'Conflict'})}

        // create a reset token and create the user
        const resetToken = uuidv4()
        const resetExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        const newUser = await prisma.user.create({
            data: {
                utorid: utorid,
                name: name,
                email: email,
                resetToken,
                resetExpiresAt
            }
        })

        return res.status(201).json({
            'id': newUser.id,
            'utorid': newUser.utorid,
            'name': newUser.name,
            'email': newUser.email,
            'verified': newUser.verified,
            'expiresAt': newUser.resetExpiresAt,
            'resetToken': newUser.resetToken
        })
    } catch (err) {return res.status(500).json({'error': err.message})}

})

router.get('/', requireRole(['manager', 'superuser']), async (req, res) => {
    try {
        const { name, role, verified, activated, page, limit } = req.query || {}

        // make the where object for prisma call
        const where = {}
        if (name) {
            if (!nameRegex.test(name)) { return res.status(400).json({error: 'Bad Request'}) }
            where.OR = [{utorid: name}, {name: name}]
        }
        if (role) {
            if (!['regular', 'cashier', 'manager', 'superuser'].includes(role)) { return res.status(400).json({error: 'Bad Request'})}
            where.role = role
        }
        if (typeof verified === 'string') {
            if (verified === 'true') { where.verified = true }
            else if (verified === 'false') { where.verified = false}
            else { return res.status(400).json({error: 'Bad Request'})}
        }
        if (typeof activated === 'string') {
            if (activated === 'true') { where.lastLogin = {not: null} }
            else if (activated === 'false') { where.lastLogin = null}
            else { return res.status(400).json({error: 'Bad Request'})}
        }

        // convert page and limit to numbers, or fill in minimum
        let pageNum = page ?? 1;
        let pageLimit = limit ?? 10;

        pageNum = Number(pageNum);
        pageLimit = Number(pageLimit);
        if (!Number.isInteger(pageNum) || pageNum <= 0 || !Number.isInteger(pageLimit) || pageLimit <= 0) {return res.status(400).json({ error: "Bad Request" });}
        const skip = (pageNum - 1) * pageLimit

        const [count, results] = await prisma.$transaction([
            prisma.user.count({where}),
            prisma.user.findMany({
                where,
                skip,
                take: pageLimit,
                select: {
                    id: true, 
                    utorid: true,
                    name: true, 
                    email: true, 
                    birthday: true, 
                    role: true, 
                    points: true, 
                    createdAt: true, 
                    lastLogin: true, 
                    verified: true, 
                    avatarUrl: true
                }
            })
        ])
        return res.status(200).json({count, results})
    } catch (err) {return res.status(500).json({'error': err.message})}
})

router.patch('/me', requireRole(['regular', 'cashier', 'manager', 'superuser']), async (req, res) => {
    try {
        const {name, email, birthday, avatar} = req.body
        const id = req.auth.id

        const data = {}
        
        if (name && nameRegex.test(name)) {
            data.name = name
        } else if (name) { return res.status(400).json({error: "Bad Request 1"})}
        if (email && emailRegex.test(email)) {
            data.email = email
        } else if (email) { return res.status(400).json({error: "Bad Request 2"})}

        if (birthday && isValidDateString(birthday)) {
            data.birthday = birthday
        } else if (birthday) { return res.status(400).json({error: "Bad Request 3"})}
        if (avatar) {
            data.avatarUrl = `/uploads/avatars/${utorid}.png`
        }

        if (!name && !email && !birthday && !avatar) {
            return res.status(400).json({ error: "Bad Request 4" });
        }

        const updated = await prisma.user.update({
            where: {id},
            data,
            select: {
                id: true,
                utorid: true,
                name: true,
                email: true,
                birthday: true,
                role: true,
                points: true,
                createdAt: true,
                lastLogin: true,
                verified: true,
                avatarUrl: true,
            }
        })

        return res.status(200).json(updated)
    } catch (err) {return res.status(500).json({'error': err.message})}
})

router.get('/me', requireRole(['regular', 'cashier', 'manager', 'superuser']), async (req, res) => {
    try {
        const id = req.auth.id;
        const user = await prisma.user.findUnique({
            where: {id},
            select: {
                id: true,
                utorid: true,
                name: true,
                email: true,
                birthday: true,
                role: true,
                points: true,
                createdAt: true,
                lastLogin: true,
                verified: true,
                avatarUrl: true,
                usedPromotions: true,
            }
        })
        const editedUser = {
            ...user,
            promotions: user.usedPromotions
        }
        delete editedUser.usedPromotions
        return res.status(200).json(editedUser)

    } catch (err) {return res.status(500).json({'error': err.message})}
})

router.patch('/me/password', requireRole(['regular', 'cashier', 'manager', 'superuser']), async (req, res) => {
    try {
        const id = req.auth.id;
        const {old, new: newPassword} = req.body

        if (!old || !newPassword) { return res.status(400).json({error: "Bad Request"})}

        if (!passwordRegex.test(newPassword)) { return res.status(400).json({error: "Bad Request"})}

        const encryptNew = await bcrypt.hash(newPassword, 10)

        const user = await prisma.user.findUnique({
            where: {id},
            select: {password: true}
        })

        if (await bcrypt.compare(old, user.password)) {
            await prisma.user.update({
                where: {id},
                data: {
                    password: encryptNew
                }
            })
            return res.status(200).json({message: "OK"})
        }
        else { return res.status(403).json({error: "Forbidden"}) }

    } catch (err) {
        return res.status(500).json({'error': err.message})}
})

router.post('/me/transactions', requireRole(['regular', 'cashier', 'manager', 'superuser']), async (req, res) => {
    try {
        const {type, amount, remark} = req.body
        if (type !== 'redemption') { return res.status(400).json({ error: 'Bad Request' }) }

        const user = await prisma.user.findUnique({
            where: {id: req.auth.id},
            select: {
                points: true,
                verified: true,
                utorid: true
            }
        })
        if (!user.verified) { return res.status(403).json({error: "Forbidden"})}
        if (!Number.isInteger(amount) || amount < 0 || amount > user.points) { return res.status(400).json({ error: 'Bad Request' }) }

        const newT = await prisma.transaction.create({
            data: {
                utorid: user.utorid,
                type,
                remark,
                points: 0 - amount,
                createdBy: user.utorid
            },
            select: {
                id: true,
                utorid: true,
                type: true,
                remark: true,
                createdBy: true
            }
        })

        newT.amount = amount
        newT.processedBy = null

        return res.status(201).json(newT)
    } catch (err) {return res.status(500).json({'error': err.message})}
})

router.get('/me/transactions', requireRole(['regular', 'cashier', 'manager', 'superuser']), async (req, res) => {
    try {
        const {type, relatedId, promotionId, amount, operator, page, limit} = req.query

        const where = {
            utorid: req.auth.utorid
        }

        let pageNum = page ?? 1;
        let pageLimit = limit ?? 10;

        pageNum = Number(pageNum);
        pageLimit = Number(pageLimit);
        if (!Number.isInteger(pageNum) || pageNum <= 0 || !Number.isInteger(pageLimit) || pageLimit <= 0) {return res.status(400).json({ error: "Bad Request" });}
        const skip = (pageNum - 1) * pageLimit

        if (type !== undefined) {
            if (!['purchase', 'transfer', 'adjustment', 'event', 'adjustment']) {return res.status(400).json({ error: "Bad Request" });}
            where.type = type
        }
        if (relatedId !== undefined) {
            if (!Number.isInteger(relatedId) || type === undefined || relatedId <= 0 || type === 'purchase') {return res.status(400).json({ error: "Bad Request" });}
            where.relatedId = relatedId
        }

        if (promotionId) {
            const promotionIdNum = Number(promotionId)
            if (!Number.isInteger(promotionIdNum) || promotionIdNum < 0) { return res.status(400).json({error: "Bad Request"}) }
            where.promotionId = { some: { id: promotionIdNum } }
        }

        if ((amount !== undefined) !== (operator !== undefined)) { return res.status(400).json({error: "Bad Request"}) }
        if (operator) {
            if (!['gte', 'lte'].includes(operator)) { return res.status(400).json({error: "Bad Request"}) }
            const amountNum = Number(amount)
            if (!Number.isFinite(amountNum)) { return res.status(400).json({error: "Bad Request"}) }
            where.points = {
                [operator]: amountNum
            };
        }

         const [count, results] = await prisma.$transaction([
            prisma.transaction.count({
                where
            }),
            prisma.transaction.findMany({
                where,
                select: {
                    id: true,
                    type: true,
                    relatedId: true,
                    promotionIds: {select: { id: true}},
                    remark: true,
                    createdBy: true,
                    spent: true,
                    points: true
                },
                skip,
                take: pageLimit
            })
        ])
        const fullReturn = []
        for (const t of results) {
            const promoIds = t.promotionIds.map(p => p.id);
            let toReturn = {}
            toReturn.id = t.id
            toReturn.amount = t.points
            toReturn.remark = t.remark
            toReturn.createdBy = t.createdBy
            toReturn.type = t.type

            if (t.type === 'purchase') {
                toReturn.spent = t.spent
                toReturn.promotionIds = promoIds
            } else if (t.type === 'adjustment') {
                toReturn.relatedId = t.relatedId
                toReturn.promotionIds = promoIds
            } else if (t.type === 'redemption') {
                toReturn.relatedId = t.relatedId
                toReturn.promotionIds = promoIds
            } else if (t.type === 'event') {
                toReturn.rewarded = t.points
                toReturn.relatedId = t.relatedId
            } else if (t.type === 'transfer') {
                toReturn.relatedId = t.relatedId
                toReturn.promotionIds = t.promotionIds
            }
            fullReturn.push(toReturn)
        }
        return res.status(200).json({count, results: fullReturn})

    } catch (err) {return res.status(500).json({'error': err.message})}
})

router.get('/:userId', requireRole(['cashier', 'manager', 'superuser']), async (req, res) => {
    try {
        const {userId} = req.params;
        const id = parseInt(userId, 10)
        if (!id || id < 0) { return res.status(400).json({error: 'Bad Request'})}

        const now = new Date()
        let user

        const getRole = await prisma.user.findUnique({
            where: { id: req.auth.id },
            select: { role: true }
        });
        const requesterRole = getRole.role  

        if (requesterRole === 'cashier') {
            user = await prisma.user.findFirst({
                where: {
                    id,
                },
                select: {
                    id: true, 
                    utorid: true,
                    name: true,
                    points: true,
                    verified: true,
                }
            })

            const promos = await prisma.promotion.findMany({
                where: {
                    type: 'onetime',
                    startTime: {lte: now},
                    endTime: {gt: now},
                    usedBy: { none: {id}}
                },
                select: {
                    id: true
                }
            })

            const promoIds = promos.map(p => p.id);
            user.promotions = promoIds

        } else {
            user = await prisma.user.findUnique({
                where: {id},
                select: {
                    id: true, 
                    utorid: true,
                    name: true,
                    email: true,
                    birthday: true,
                    role: true,
                    points: true,
                    createdAt: true,
                    lastLogin: true,
                    verified: true,
                    avatarUrl: true,
                    usedPromotions: { 
                        select: { id: true }
                    }
                }
            })
            user.promotions = user.usedPromotions.map(p => p.id);
            delete user.usedPromotions
        }

        if (!user) { return res.status(404).json({error: 'Not Found'})}

        return res.status(200).json(user)

    } catch (err) {return res.status(500).json({'error': err.message})}
})

router.patch('/:userId', requireRole(['manager', 'superuser']), async (req, res) => {
    try {
        const id = Number(req.params.userId);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Bad Request' });
        }

        const getRole = await prisma.user.findUnique({
            where: { id: req.auth.id },
            select: { role: true }
        });
        const userRole = getRole.role 

        const {email, verified, suspicious, role} = req.body
        if (email === undefined && verified === undefined && suspicious === undefined && role === undefined) {
            return res.status(400).json({error: 'Bad Request'})
        }
        const userToUpdate = await prisma.user.findUnique({
            where: {id},
            select: {
                role: true,
                suspicious: true
            }
        })
        if (!userToUpdate) { return res.status(404).json({error: "Not Found"})}

        const data = {}
        const select = {
            id: true,
            utorid: true,
            name: true
        }
        if (email) {
            if (!emailRegex.test(email)) { return res.status(400).json({error: 'Bad Request'})}
            const user = await prisma.user.findUnique({
                where: { email },
                select: { id: true }
            });
            if (user && user.id !== id) { return res.status(409).json({error: "Conflict"})}
            data.email = email
            select.email = true
        }
        if (verified) {
            data.verified = true 
            select.verified = true
        } else if (verified === false) { 
            return res.status(400).json({error: 'Bad Request'}) 
        }
        if (typeof suspicious === 'boolean') {
            data.suspicious = suspicious
            select.suspicious = true
        } else if (suspicious) {
            return res.status(400).json({error: 'Bad Request'})
        }
        if (role) {
            if (['regular', 'cashier'].includes(role) || (['manager', 'superuser'].includes(role) && userRole === 'superuser')) {
                if (userToUpdate.role === 'regular' && userToUpdate.suspicious && role === 'cashier') {
                    return res.status(400).json({error: "Bad Request"})
                }  
                data.role = role
                select.role = true
            } else if (!['regular', 'cashier', 'manager', 'superuser'].includes(role)) {
                return res.status(400).json({error: "Bad Request"})
            } else { return res.status(403).json({error: "Forbidden"})}
        }
        const updated = await prisma.user.update({
            where: {id},
            data,
            select
        })
        return res.status(200).json(updated)
    } catch (err) {return res.status(500).json({'error': err.message})}
})

router.post('/:userId/transactions', requireRole(['regular', 'cashier', 'manager', 'superuser']), async (req, res) => {
    try {
        const id = Number(req.params.userId);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Bad Request' });
        }

        const recipient = await prisma.user.findUnique({
            where: {id},
            select: {
                utorid: true,
                id: true
            }
        })
        if (!recipient) { return res.status(404).json({error: "Not Found"})}

        const sender = await prisma.user.findUnique({
            where: {utorid: req.auth.utorid},
            select: {
                verified: true,
                points: true,
                utorid: true
            }
        })
        if (!sender.verified) { return res.status(403).json({error: "Forbidden"}) }
        const {type, amount, remark} = req.body
        if (remark !== undefined && typeof remark !== 'string') { return res.status(400).json({error: "Bad Request"})}

        if (type !== 'transfer') { return res.status(400).json({error: "Bad Request"})}
        if (!Number.isInteger(amount) || amount <= 0 || amount > sender.points) { return res.status(400).json({error: "Bad Request"}) }
        if (sender.utorid === recipient.utorid) { return res.status(400).json({error: "Bad Request"})}

        const [transaction, update1, update2] = await prisma.$transaction([
            prisma.transaction.create({
                data: {
                    utorid: sender.utorid,
                    type: 'transfer',
                    points: 0 - amount,
                    remark,
                    relatedId: recipient.id,
                    createdBy: sender.utorid,
                },
                select: {
                    id: true,
                    utorid: true,
                    points: true,
                    remark: true,
                    createdBy: true,
                    type: true
                }
            }),
            prisma.user.update({
                where: {utorid: sender.utorid},
                data: {
                    points: {decrement: amount}
                }
            }),
            prisma.user.update({
                where: {utorid: recipient.utorid},
                data: {
                    points: {increment: amount}
                }
            })
        ])

        transaction.sender = transaction.utorid
        delete transaction.utorid
        transaction.recipient = recipient.utorid
        transaction.sent = 0 - transaction.points
        delete transaction.points

        return res.status(201).json(transaction)

    } catch (err) {return res.status(500).json({'error': err.message})}
})

module.exports = router