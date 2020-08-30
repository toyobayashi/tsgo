/**
 * Example library
 *
 * @packageDocumentation
 */

import { add } from './add'
import * as mytslib from 'tslib/aaa.ts'
console.log(mytslib)

import('./add.ts').then(mod => {
  console.log(mod.add(3, 4))
}).catch(err => {
  console.log(err)
})

export { add }
