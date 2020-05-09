#!/usr/bin/env node

require('../lib/module.js').addNodeModulesPath(require('../lib/util.js').getPath())
require('../index.js').main(process.argv.length, process.argv).then(r => {
  process.exit(r)
}).catch(err => {
  console.error(err)
  process.exit(1)
})
