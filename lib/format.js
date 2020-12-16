function getExt (prefix, suffix = '.js') {
  return function ext (minify) {
    return `${prefix}${minify ? '.min' : ''}${suffix}`
  }
}

const formats = Object.create(null)

exports.formats = formats
exports.defineFormat = defineFormat

function defineFormat (name, f) {
  formats[name] = f(getExt)
}

defineFormat('umd', (getExt) => {
  return (minify) => ({
    rollupFormat: 'umd',
    webpackLibraryTarget: 'umd',
    ext: getExt('')(minify),
    define: {
      __TSGO_FORMAT__: JSON.stringify('umd'),
      'process.env.NODE_ENV': minify ? JSON.stringify('production') : JSON.stringify('development'),
      __TSGO_DEV__: !minify,
      __TSGO_GLOBAL__: true
    }
  })
})
defineFormat('cjs', (getExt) => {
  return (minify) => ({
    rollupFormat: 'cjs',
    webpackLibraryTarget: 'commonjs2',
    ext: getExt('.cjs')(minify),
    define: {
      __TSGO_FORMAT__: JSON.stringify('cjs'),
      'process.env.NODE_ENV': minify ? JSON.stringify('production') : JSON.stringify('development'),
      __TSGO_DEV__: !minify,
      __TSGO_GLOBAL__: false
    }
  })
})
defineFormat('esm-bundler', (getExt) => {
  return (minify) => ({
    rollupFormat: 'esm',
    webpackLibraryTarget: 'module',
    ext: getExt('.esm-bundler')(minify),
    define: {
      __TSGO_FORMAT__: JSON.stringify('esm-bundler'),
      'process.env.NODE_ENV': '(process.env.NODE_ENV)',
      __TSGO_DEV__: '(process.env.NODE_ENV !== "production")',
      __TSGO_GLOBAL__: false
    }
  })
})
defineFormat('esm-browser', (getExt) => {
  return (minify) => ({
    rollupFormat: 'esm',
    webpackLibraryTarget: 'module',
    ext: getExt('.esm-browser')(minify),
    define: {
      __TSGO_FORMAT__: JSON.stringify('esm-browser'),
      'process.env.NODE_ENV': minify ? JSON.stringify('production') : JSON.stringify('development'),
      __TSGO_DEV__: !minify,
      __TSGO_GLOBAL__: false
    }
  })
})
defineFormat('esm-node', (minify) => {
  return (minify) => ({
    rollupFormat: 'esm',
    webpackLibraryTarget: 'module',
    ext: getExt('', '.mjs')(minify),
    define: {
      __TSGO_FORMAT__: JSON.stringify('esm-node'),
      'process.env.NODE_ENV': '(process.env.NODE_ENV)',
      __TSGO_DEV__: '(process.env.NODE_ENV !== "production")',
      __TSGO_GLOBAL__: false
    }
  })
})
defineFormat('iife', (getExt) => {
  return (minify) => ({
    rollupFormat: 'iife',
    webpackLibraryTarget: 'var',
    ext: getExt('.global')(minify),
    define: {
      __TSGO_FORMAT__: JSON.stringify('iife'),
      'process.env.NODE_ENV': minify ? JSON.stringify('production') : JSON.stringify('development'),
      __TSGO_DEV__: !minify,
      __TSGO_GLOBAL__: true
    }
  })
})
