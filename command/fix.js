const { lintFile } = require('../lib/util.js')

const { Task } = require('../lib/task.js')

module.exports = new Task('fix', async function (/* config, logger */) {
  return await lintFile(['src'], true)
})
