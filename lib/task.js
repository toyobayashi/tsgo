const { Logger } = require('./logger.js')

class Task {
  constructor (name, callback) {
    this.name = name
    this.callback = callback
  }

  async run (config, args) {
    const logger = new Logger(this.name)
    logger.start()
    let r
    try {
      r = await this.callback(config, logger, args)
    } catch (err) {
      logger.error(err)
      return 1
    }
    logger.end()
    return r
  }
}

exports.Task = Task
