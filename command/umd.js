const { bundler } = require('../lib/util.js')

const { Task } = require('../lib/task.js')

module.exports = new Task('umd', async function (config, logger) {
  const result = await Promise.all(config.bundler.map(b => {
    if (typeof bundler[b] === 'function') {
      return bundler[b](config)
    } else {
      return Promise.resolve()
    }
  }))
  if (result.length === 0) {
    logger.log('No bundler set.')
  }
  return 0
})
