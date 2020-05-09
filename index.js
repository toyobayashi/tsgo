exports.main = async function main (argc, argv) {
  const { readConfig } = require('./lib/config.js')
  const { join } = require('path')
  const { existsSync } = require('fs-extra')

  const args = argv.slice(2)
  const config = readConfig()

  if (argc > 2) {
    if (args[0] === '-v' || args[0] === '--version' || args[0] === '-V') {
      console.log(require('./package.json').version)
      return 0
    }
    if (args[0] === '-h' || args[0] === '--help' || args[0] === '-?') {
      printHelp()
      return 0
    }
    const js = join(__dirname, `./command/${args[0]}.js`)
    if (existsSync(js)) {
      return await require(js).run(config, args.slice(1))
    } else {
      console.error(`Command not found: ${args[0]}`)
      return 1
    }
  }

  printHelp()
  return 0
}

function printHelp () {
  const path = require('path')
  console.log('Usage: tsgo <command>')
  console.log('\nCommands:\n')
  require('fs').readdirSync(path.join(__dirname, 'command')).forEach(v => {
    console.log(`  ${path.parse(v).name}`)
  })
}
