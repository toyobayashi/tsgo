/**
 * Import webpack.
 * @param {any} config
 * @returns {import('webpack')}
 */
exports.requireWebpack = function requireWebpack (config) {
  if (typeof config.webpack === 'function') {
    return config.webpack
  }
  try {
    return require('webpack')
  } catch (_) {
    throw new Error('Can not find webpack.')
  }
}

exports.requireRollup = function requireRollup (config) {
  if (config.rollup && typeof config.rollup.rollup === 'function') {
    return config.rollup
  }
  try {
    return require('rollup')
  } catch (_) {
    throw new Error('Can not find rollup.')
  }
}
