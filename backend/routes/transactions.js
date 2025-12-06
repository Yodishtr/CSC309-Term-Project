'use strict';

const express = require('express');
const { requireRole } = require('../middleware/roles');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

const now = new Date();
const utoridRegex = /^[a-z0-9]{7,8}$/;

router.post('/', requireRole(['cashier', 'manager', 'superuser']), async (req, res) => {
    try {
        const {utorid, type, spent, promotionIds, remark, amount, relatedId} = req.body

        // Purchase
        if (type === 'purchase') {
            if (!utorid || !type || !spent) { return res.status(400).json({error: "Bad Request 1"}) }
            if (typeof utorid !== 'string' || typeof spent !== 'number' || spent <= 0) {
                return res.status(400).json({error: "Bad Request 2"})
            }   
            if (remark && typeof remark !== 'string') { return res.status(400).json({error: "Bad Request 3"}) }

            const user = await prisma.user.findUnique({
                where: {utorid},
                select: {
                    id: true,
                    utorid: true,
                    points: true,
                    usedPromotions: {
                        select: { id: true }
                    }
                }
            })
            if (!user) { return res.status(404).json({error: "Not Found"})}

            let totalPoints = 0;
            totalPoints += Math.round((spent*100)/25)

            let oneTime = []
            if (promotionIds) {
                if (!Array.isArray(promotionIds)) { return res.status(400).json({error: "Bad Request 4"}) }
                oneTime = promotionIds
            }

            for (const promoId of oneTime) {
                // check if promo is valid
                if (typeof promoId !== 'number' || promoId < 0) { return res.status(400).json({error: "Bad Request 5"}) }
                // get promos that havent been used by this user and are one time
                const promo = await prisma.promotion.findFirst({
                    where: {
                        id: promoId,
                        type: 'onetime',
                        usedBy: { none: { utorid } },
                        startTime: { lte: now },
                        endTime: { gte: now },
                        minSpending: { lte: spent }
                    },
                    select: {
                        points: true,
                        rate: true,
                        minSpending: true,
                    }
                })
                if (!promo) { return res.status(400).json({error: "Bad Request 6"})}
                if (promo.points) { totalPoints += promo.points; }
                if (promo.rate) { totalPoints += Math.round((spent * promo.rate)/100); }
            }

            // also check the automatic promotions to see if any are valid
            const autoPromos = await prisma.promotion.findMany({
                where: {
                    type: 'automatic',
                    startTime: { lte: now },
                    endTime: { gte: now },
                    minSpending: { lte: spent }
                },
                select: {
                    id: true,
                    points: true,
                    rate: true
                }
            })

            for (const promo of autoPromos) {
                if (promo.points) { totalPoints += promo.points; }
                if (promo.rate) { totalPoints += Math.round((spent * promo.rate)/100); }
            }

            const cashier =  await prisma.user.findUnique({
                where: { id: req.auth.id },
                select: { 
                    suspicious: true
                }
            });

            let suspicious = false;
            if (cashier.suspicious) { suspicious = true} 

            const result = await prisma.$transaction( async (prisma) => {
                const purchase = await prisma.transaction.create({
                    data: {
                        type,
                        spent,
                        points: totalPoints,
                        ...(remark ? { remark } : {}),
                        promotionIds: {
                            connect: oneTime.map((id) => ({ id }))
                        },
                        suspicious,
                        user: {
                            connect: { utorid }, // matches fields: [utorid], references: [utorid]
                        },
                        created: {
                            connect: { utorid: req.auth.utorid },
                        },
                    },
                    select: {
                        id: true,
                        utorid: true,
                        type: true,
                        spent: true,
                        points: true,
                        remark: true,
                        createdBy: true
                    }
                })
                await prisma.user.update({
                    where: { utorid },
                    data: { 
                        usedPromotions: {
                            connect: oneTime.map((id) => ({ id }))
                        }
                    }
                })
                if (!suspicious) {
                        await prisma.user.update({
                            where: { utorid },
                            data: { 
                                points: { increment: totalPoints } 
                            }
                        })
                    }
                return { purchase };
            })
            const purchase = result.purchase;
            purchase.earned = suspicious ? 0 : purchase.points
            purchase.promotionIds = oneTime
            delete purchase.points;
            return res.status(201).json(purchase)
        } 
        
        // Adujstment
        else if (type === 'adjustment') {
            if (req.auth.role === 'cashier') {return res.status(403).json({error: "Unauthorized"})}
            if (!utorid || !amount || !relatedId) {return res.status(400).json({error: "Bad Request 7"})}
            if (typeof utorid !== 'string' || !Number.isInteger(amount) || typeof relatedId !== 'number' || relatedId < 0) { return res.status(400).json({error: "Bad Request 8"}) }
            const oneTime = Array.isArray(promotionIds) ? promotionIds : []
            if (remark && typeof remark !== 'string') { return res.status(400).json({error: "Bad Request 9"}) }

            // check that all of them exist and are one time, so we add them as used for the user
            for (const promoId of oneTime) {
                if (typeof promoId !== 'number' || promoId < 0) { return res.status(400).json({error: "Bad Request 10"}) }
                const promo = await prisma.promotion.findFirst({
                    where: {
                        id: promoId,
                        type: 'onetime',
                        startTime: { lte: now },
                        endTime: { gte: now },
                        usedBy: { none: { utorid: utorid } }
                    },
                    select: { id: true }
                })
                if (!promo) { return res.status(400).json({error: "Bad Request 11"}) }
            }

            // check that the related transaction exists
            const relatedTransaction = await prisma.transaction.findUnique({
                where: { 
                    id: relatedId
                },
                select: { id: true }
            })
            if (!relatedTransaction) { return res.status(404).json({error: "Not Found"}) }

            // check that the user exists
            const user = await prisma.user.findUnique({
                where: { utorid },
                select: { utorid: true }
            })
            if (!user) { return res.status(400).json({error: "Bad Request 12"})}

            const result = await prisma.$transaction( async (prisma) => {
                const adjustment = await prisma.transaction.create({
                    data: {
                        utorid,
                        points: amount,
                        type,
                        remark,
                        promotionIds: { connect: oneTime.map((id) => ({ id })) },
                        relatedId,
                        createdBy: req.auth.utorid,
                    },
                    select: {
                        id: true,
                        utorid: true,
                        type: true,
                        points: true,
                        remark: true,
                        relatedId: true,
                        createdBy: true
                    }
                })
                adjustment.promotionIds = oneTime
                adjustment.amount = adjustment.points
                delete adjustment.points;
                
                // add promotions as used by the user, add the points to their points
                const updateUser = await prisma.user.update({
                    where: { utorid },
                    data: {
                        points: { increment: amount },
                        usedPromotions: {
                            connect: oneTime.map((id) => ({ id }))
                        }
                    }
                })
                return {adjustment, updateUser}
            })
            
            return res.status(201).json(result.adjustment)
        }
        else { return res.status(400).json({error: "Bad Request 13"}) }
    } catch (err) {
        console.log("post transaction error", err.message)
        return res.status(500).json({'error': err.message})}
})

router.get('/', requireRole(['manager', 'superuser']), async (req, res) => {
    try {
        const {name, createdBy, suspicious, promotionId, type, relatedId, amount, operator, page, limit} = req.query;

        const where = {}

        if (name) {
            where.OR = [
                {
                utorid: {
                    contains: name,
                },
                },
                {
                user: {
                    name: {
                    contains: name,
                    },
                },
                },
            ];
        }
        if (createdBy) {
            if (!utoridRegex.test(createdBy)) { return res.status(400).json({error: "Bad Request"})}
              where.createdBy = {
                contains: createdBy,
            };
        }
        if (suspicious) {
            if (!['true', 'false'].includes(suspicious)) { return res.status(400).json({error: "Bad Request"}) }
            where.suspicious = suspicious === 'true' ? true : false
        }
        if (promotionId) {
            const promotionIdNum = Number(promotionId)
            if (!Number.isInteger(promotionIdNum) || promotionIdNum < 0) { return res.status(400).json({error: "Bad Request"}) }
            where.promotionId = { some: { id: promotionIdNum } }
        }
        if (type) {
            if (!['purchase', 'adjustment', 'event', 'redemption', 'transfer'].includes(type)) { return res.status(400).json({error: "Bad Request"}) }
            where.type = type
        }
        if (relatedId) {
            const relatedIdNum = Number(relatedId)
            if (!Number.isInteger(relatedIdNum) || relatedIdNum < 0) { return res.status(400).json({error: "Bad Request"}) }
            if (relatedId && !type || type === 'purchase') { return res.status(400).json({error: "Bad Request"}) }
            where.relatedId = relatedIdNum
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

        let pageNum = page ?? 1;
        let pageLimit = limit ?? 10;

        pageNum = Number(pageNum);
        pageLimit = Number(pageLimit);
        if (!Number.isInteger(pageNum) || pageNum <= 0 || !Number.isInteger(pageLimit) || pageLimit <= 0) {return res.status(400).json({ error: "Bad Request" });}

        // if any of the query params are not found, 404 and if any are incorrectly formatted, 400

        const skip = (pageNum - 1) * pageLimit

        const [count, result] = await prisma.$transaction([
            prisma.transaction.count({
                where
            }),
            prisma.transaction.findMany({
                where,
                select: {
                    id: true,
                    utorid: true,
                    type: true,
                    relatedId: true,
                    promotionIds: {select: { id: true}},
                    suspicious: true,
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
        for (const t of result) {
            const promoIds = t.promotionIds.map(p => p.id);
            let toReturn = {}
            toReturn.id = t.id
            toReturn.utorid = t.utorid
            toReturn.amount = t.points
            toReturn.remark = t.remark
            toReturn.createdBy = t.createdBy
            toReturn.type = t.type
            toReturn.suspicious = t.suspicious

            if (t.type === 'purchase') {
                toReturn.spent = t.spent
                toReturn.promotionIds = promoIds
            } else if (t.type === 'adjustment') {
                toReturn.relatedId = t.relatedId
                toReturn.promotionIds = promoIds
            } else if (t.type === 'redemption') {
                toReturn.relatedId = t.relatedId
                toReturn.redeemed = 0 - t.points
                toReturn.promotionIds = promoIds
            } else if (t.type === 'event') {
                delete toReturn.amount
                toReturn.rewarded = t.points
                toReturn.recipient = t.utorid
                toReturn.eventId = t.relatedId
            } else if (t.type === 'transfer') {
                if (t.points > 0) {
                    toReturn.recipient = t.utorid
                    delete toReturn.amount
                    toReturn.received = t.points
                    toReturn.sender = t.relatedId
                } else {
                    toReturn.sender = t.utorid
                    delete toReturn.amount
                    toReturn.sent = 0 - t.points
                    toReturn.recipient = t.relatedId
                }
            }
            fullReturn.push(toReturn)
        }
        return res.status(200).json({count, results: fullReturn})
    } catch (err) {return res.status(500).json({'error': err.message})}    
})

// TODO: for a transfer, make only one transaction of the senders

router.get('/:transactionId', requireRole(['manager', 'superuser']), async (req, res) => {
    try {
        const id = Number(req.params.transactionId);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: "Bad Request" });
        }

        const t = await prisma.transaction.findUnique({
            where: {id},
            select: {
                id: true,
                utorid: true,
                points: true,
                remark: true,
                createdBy: true,
                type: true,
                relatedId: true,
                suspicious: true,
                spent: true,
                promotionIds: {
                    select: { id: true}
                }

            }
        })
        if (!t) {return res.status(404).json({error: "Not Found"})}

        const toReturn = {}
        toReturn.id = t.id
        toReturn.utorid = t.utorid
        toReturn.amount = t.points
        toReturn.remark = t.remark
        toReturn.createdBy = t.createdBy
        toReturn.type = t.type

        if (t.type === 'purchase') {
            toReturn.spent = t.spent
            toReturn.promotionIds = t.promotionIds.map(p => p.id)
            toReturn.suspicious = t.suspicious
        } else if (t.type === 'adjustment') {
            toReturn.relatedId = t.relatedId
            toReturn.promotionIds = t.promotionIds.map(p => p.id)
            toReturn.suspicious = t.suspicious
        } else if (t.type === 'redemption') {
            toReturn.relatedId = t.relatedId
            toReturn.redeemed = 0 - t.points
            toReturn.promotionIds = t.promotionIds.map(p => p.id)
        } else if (t.type === 'event') {
            delete toReturn.amount
            toReturn.rewarded = t.points
            delete toReturn.utorid
            toReturn.recipient = t.utorid
            toReturn.eventId = t.relatedId
        } else if (t.type === 'transfer') {
            delete toReturn.utorid
            toReturn.sender = t.utorid
            delete toReturn.amount
            toReturn.sent = 0 - t.points
            toReturn.recipient = t.relatedId
        }
        console.log("to return", toReturn)
        return res.status(200).json(toReturn)

    } catch (err) {
        console.log("get transaction by id error", err.message)
        return res.status(500).json({'error': err.message})}    
})

router.patch(
  "/:transactionId/suspicious",
  requireRole(["manager", "superuser"]),
  async (req, res) => {
    try {
      const id = Number(req.params.transactionId);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Bad Request" });
      }

      const { suspicious } = req.body;
      if (typeof suspicious !== "boolean") {
        return res.status(400).json({ error: "Bad Request" });
      }

      const t = await prisma.transaction.findUnique({
        where: { id },
        select: {
          id: true,
          utorid: true,
          type: true,
          spent: true,
          points: true,
          suspicious: true,
          remark: true,
          createdBy: true,
          promotionIds: { select: { id: true } },
        },
      });

      if (!t) {
        return res.status(404).json({ error: "Not Found" });
      }

      // If nothing changes, just return the current transaction in the correct shape
      if (t.suspicious === suspicious) {
        const ids = t.promotionIds.map((p) => p.id);
        return res.status(200).json({
          id: t.id,
          utorid: t.utorid,
          type: t.type,
          spent: t.spent,
          amount: t.points,
          promotionIds: ids,
          suspicious: t.suspicious,
          remark: t.remark,
          createdBy: t.createdBy,
        });
      }

      // Compute delta for user points.
      // Only purchases, adjustments, and event transactions will reverse the balance; everything else just flips the flag.
      let pointsDelta = 0;
      if (t.type === "purchase" || t.type === "adjustment" || t.type === "event") {
        pointsDelta = suspicious ? -t.points : t.points;
      }

      const [updatedT] = await prisma.$transaction([
        prisma.transaction.update({
          where: { id },
          data: { suspicious },
          select: {
            id: true,
            utorid: true,
            type: true,
            spent: true,
            points: true,
            suspicious: true,
            remark: true,
            createdBy: true,
            promotionIds: { select: { id: true } },
          },
        }),
        ...(pointsDelta !== 0
          ? [
              prisma.user.update({
                where: { utorid: t.utorid },
                data: {
                  points: { increment: pointsDelta },
                },
              }),
            ]
          : []),
      ]);

      const ids = updatedT.promotionIds.map((p) => p.id);

      return res.status(200).json({
        id: updatedT.id,
        utorid: updatedT.utorid,
        type: updatedT.type,
        spent: updatedT.spent,
        amount: updatedT.points,
        promotionIds: ids,
        suspicious: updatedT.suspicious,
        remark: updatedT.remark,
        createdBy: updatedT.createdBy,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }
);


router.patch('/:transactionId/processed', requireRole(['cashier', 'manager', 'superuser']), async (req, res) => {
    try {
        const id = Number(req.params.transactionId);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: "Bad Request" });
        }
        const old = await prisma.transaction.findUnique({
            where: {id},
            select: {
                relatedId: true,
                type: true,
                utorid: true,
                remark: true,
                createdBy: true,
                points: true
            }
        })
        if (!old) { return res.status(404).json({ error: "Not Found" }) }
        if (old.type !== 'redemption' || old.relatedId) { return res.status(400).json({error: "Bad Request"}) }

        const user = await prisma.user.findUnique({
            where: {utorid: old.utorid},
            select: {points: true}
        })
        console.log(user.points)
        console.log(old.points)
        if (user.points < 0 - old.points) { return res.status(400).json({error: "Insufficient Points"})}

        const {processed} = req.body
        if (typeof processed !== 'boolean' || processed !== true) { return res.status(400).json({error: "Bad Request"}) }

        const updated = await prisma.transaction.update({
            where: {id},
            data: {
                relatedId: req.auth.id
            },
        })

        const updateUser = await prisma.user.update({
            where: {utorid: old.utorid},
            data: {
                points: {increment: old.points}
            }
        })
        return res.status(200).json({
            id,
            utorid: old.utorid,
            type: old.type,
            processedBy: req.auth.utorid,
            redeemed: 0 - old.points,
            remark: old.remark,
            createdBy: old.createdBy
        })

    } catch (err) {return res.status(500).json({'error': err.message})}    
})


module.exports = router