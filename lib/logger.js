const chalk = require('chalk')

class Logger {
  constructor (label) {
    this.label = label
    this.startTime = -1
  }

  start () {
    const t = new Date()
    this.log('Starting...')
    this.startTime = t.getTime()
  }

  log (...args) {
    const msg = require('util').format(...args)
    const label = this.label ? `(${this.label})` : ''
    const raw = `[${new Date().toLocaleTimeString()}] ${label} ${msg}`
    const message = `[${chalk.gray(new Date().toLocaleTimeString())}] ${chalk.cyan(label)} ${msg}`
    const top = ('-').repeat(raw.length)
    const bottom = top
    console.log(top)
    console.log(message)
    console.log(bottom)
  }

  error (err) {
    const label = this.label ? `(${this.label})` : ''
    const raw = `[${new Date().toLocaleTimeString()}] ${label} Error:`
    const message = `[${chalk.gray(new Date().toLocaleTimeString())}] ${chalk.cyan(label)} ${chalk.red('Error')}:`
    const top = ('-').repeat(raw.length + 10)
    const bottom = top
    console.error(top)
    console.error(message)
    console.error(err)
    console.log(bottom)
  }

  end () {
    if (this.startTime === -1) {
      throw new Error('Call start() first.')
    }

    const t = Date.now() - this.startTime
    this.startTime = -1
    this.log(`Finished after ${chalk.magenta(t)} ms`)
  }
}

exports.Logger = Logger
