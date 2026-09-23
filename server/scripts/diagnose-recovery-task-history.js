#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { getMongooseClientOptions } = require('../config/database');

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;
  await mongoose.connect(uri, getMongooseClientOptions(uri, /localhost|127/.test(uri || '')));
  const db = mongoose.connection.db;

  const members = await db.collection('recoverymembers').aggregate([
    { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'emp' } },
    { $unwind: { path: '$emp', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        isActive: 1,
        name: {
          $trim: {
            input: {
              $concat: [
                { $ifNull: ['$emp.firstName', ''] },
                ' ',
                { $ifNull: ['$emp.lastName', ''] }
              ]
            }
          }
        },
        employeeId: '$emp.employeeId'
      }
    }
  ]).toArray();

  const tasks = await db.collection('recoverytasks').find({}).project({
    title: 1, startDate: 1, endDate: 1, status: 1, assignedTo: 1,
    sector: 1, scopeType: 1, completedCount: 1, createdAt: 1
  }).sort({ startDate: -1 }).toArray();

  const rules = await db.collection('recoverytaskassignmentrules').find({}).project({
    type: 1, sector: 1, assignedTo: 1, isActive: 1, status: 1,
    createdAt: 1, completedCount: 1, targetCount: 1, minAmount: 1, maxAmount: 1
  }).sort({ createdAt: -1 }).toArray();

  const nameByMember = Object.fromEntries(members.map((m) => [String(m._id), m.name || String(m._id)]));

  const tasksEnriched = tasks.map((t) => ({
    ...t,
    assigneeName: nameByMember[String(t.assignedTo)] || String(t.assignedTo)
  }));
  const rulesEnriched = rules.map((r) => ({
    ...r,
    assigneeName: nameByMember[String(r.assignedTo)] || String(r.assignedTo)
  }));

  const urwaMembers = members.filter((m) => /urwa/i.test(m.name || ''));
  const zahidUsers = await db.collection('users').find({
    $or: [
      { firstName: /zahid/i },
      { lastName: /akbar/i },
      { employeeId: /zahid/i }
    ]
  }).project({ firstName: 1, lastName: 1, employeeId: 1, role: 1 }).limit(10).toArray();

  const completedNow = await db.collection('recoveryassignments').countDocuments({ taskStatus: 'completed' });
  const withHistory = await db.collection('recoveryassignments').countDocuments({ 'completionHistory.0': { $exists: true } });
  const withFeedback = await db.collection('recoveryassignments').countDocuments({
    $or: [
      { whatsappFeedback: { $nin: [null, ''] } },
      { callFeedback: { $nin: [null, ''] } }
    ]
  });
  const outboundJulAug = await db.collection('whatsappoutgoingmessages').countDocuments({
    sentAt: { $gte: new Date('2026-07-01'), $lt: new Date('2026-09-01') }
  });
  const outboundBySender = await db.collection('whatsappoutgoingmessages').aggregate([
    { $match: { sentAt: { $gte: new Date('2026-07-01'), $lt: new Date('2026-09-01') } } },
    { $group: { _id: '$sentBy', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 }
  ]).toArray();

  const senderIds = outboundBySender.map((x) => x._id).filter(Boolean);
  const users = senderIds.length
    ? await db.collection('users').find({ _id: { $in: senderIds } }).project({ firstName: 1, lastName: 1, employeeId: 1 }).toArray()
    : [];
  const userName = Object.fromEntries(users.map((u) => [
    String(u._id),
    [u.firstName, u.lastName].filter(Boolean).join(' ') || u.employeeId
  ]));

  console.log(JSON.stringify({
    members,
    urwaMembers,
    zahidUsers,
    taskCount: tasks.length,
    tasks: tasksEnriched,
    ruleCount: rules.length,
    rules: rulesEnriched,
    completedNow,
    withHistory,
    withFeedback,
    outboundJulAug,
    outboundBySender: outboundBySender.map((x) => ({
      sentBy: x._id,
      name: userName[String(x._id)] || null,
      count: x.count
    }))
  }, null, 2));

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
