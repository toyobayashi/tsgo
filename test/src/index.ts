/**
 * Example library
 *
 * @packageDocumentation
 */

import { add } from './add.ts'
import * as mytslib from 'tslib'
console.log(mytslib)

declare const __VERSION__: string
// const __VERSION__ = '2'
const a: string = __VERSION__

function b () {
  const __VERSION__ = 1
  console.log(__VERSION__)
}
console.log(a)

import('./add.ts').then(mod => {
  console.log(mod.add(3, 4))
}).catch(err => {
  console.log(err)
})

export { add }
