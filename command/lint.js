const { lintFile } = require('../lib/util.js')

const { Task } = require('../lib/task.js')

module.exports = new Task('lint', async function (/* config, logger */) {
  return lintFile(['src'], false)
})
