const client = require('../config/db');

module.exports = {
  user: client.user,
  service: client.service,
  projectOrder: client.projectOrder,
  projectTask: client.projectTask,
  honorarium: client.honorarium,
  teFaSetting: client.teFaSetting,
  $transaction: client.$transaction.bind(client)
};