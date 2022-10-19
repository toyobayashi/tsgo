import * as path from 'path'
import * as fs from 'fs'

export function findPrefix (dir: string): string {
  dir = path.resolve(dir)

  // this is a weird special case where an infinite recurse of
  // node_modules folders resolves to the level that contains the
  // very first node_modules folder
  let walkedUp = false
  while (path.basename(dir) === 'node_modules') {
    dir = path.dirname(dir)
    walkedUp = true
  }
  if (walkedUp) {
    return dir
  }

  return findPrefix_(dir)
}

function findPrefix_ (dir: string, original = dir): string {
  const parent = path.dirname(dir)
  if (parent === dir) return original

  let files
  try {
    files = fs.readdirSync(dir)
  } catch (err: any) {
    if (dir === original && err.code !== 'ENOENT') {
      throw err
    } else {
      return original
    }
  }

  if (files.indexOf('node_modules') !== -1 || files.indexOf('package.json') !== -1) {
    return dir
  }

  return findPrefix_(parent, original)
}
