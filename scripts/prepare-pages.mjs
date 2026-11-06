#!/usr/bin/env node
/**
 * Publish the generated Jemawe site below a GitHub Pages project prefix.
 *
 * This runs ONLY on the Pages artifact after the normal local build.
 * Source templates and locally hosted root-relative routes stay unchanged.
 */
import fs from 'node:fs'
import path from 'node:path'

const dist = path.resolve('dist')
const prefix = '/jemawe'
if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('Run npm run build before preparing Pages')

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(file) : [file]
  })
}

let changed = 0
for (const file of walk(dist)) {
  const ext = path.extname(file)
  if (!['.html', '.css'].includes(ext)) continue
  const before = fs.readFileSync(file, 'utf8')
  let after = before
  if (ext === '.html') {
    // Rewrite internal links and assets, without touching external // URLs.
    after = after.replace(/(\b(?:href|src|action|poster)=["'])(\/(?!\/))/gi, (_, attr, slash) => attr + prefix + slash)
    after = after.replace(/(\bsrcset=["'])([^"']+)(["'])/gi, (_, start, value, end) =>
      start + value.replace(/(^|,\s*)\/(?!\/)/g, '$1' + prefix + '/') + end)
  }
  if (ext === '.css') {
    after = after.replace(/url\(\s*(["']?)\/(?!\/)/g, (_, quote) => 'url(' + quote + prefix + '/')
  }
  if (after !== before) {
    fs.writeFileSync(file, after)
    changed++
  }
}

// Two runtime navigation paths are produced by TypeScript, not HTML templates.
// Keep the production artifact under the same Pages prefix.
for (const [file, replacements] of [
  ['js/eco-loader.js', [['"/js/hero3d.js"', '"/jemawe/js/hero3d.js"']]],
  ['js/forms.js', [['`/thank-you/?form=${', '`/jemawe/thank-you/?form=${']]],
]) {
  const target = path.join(dist, file)
  if (!fs.existsSync(target)) throw new Error('Missing compiled JavaScript: ' + file)
  const before = fs.readFileSync(target, 'utf8')
  let after = before
  for (const [oldValue, newValue] of replacements) {
    if (!after.includes(oldValue)) throw new Error('Missing expected navigation literal in ' + file + ': ' + oldValue)
    after = after.replaceAll(oldValue, newValue)
  }
  fs.writeFileSync(target, after)
  changed++
}

// A project Pages URL lives under /jemawe/ but the dist artifact root stays /.
for (const route of ['index.html', 'services/index.html', 'css/main.css', 'js/main.js', 'assets/logos/favicon.svg']) {
  if (!fs.existsSync(path.join(dist, route))) throw new Error('Missing Pages asset: ' + route)
}
const home = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
if (!home.includes('href="/jemawe/css/main.css"') || !home.includes('src="/jemawe/js/main.js"')) {
  throw new Error('The public homepage is missing its prefixed assets')
}
for (const file of walk(dist).filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(file, 'utf8')
  if (/(?:href|src|action|poster)=["']\/(?!\/|jemawe\/)/i.test(html)) {
    throw new Error('An unprefixed internal link remains in ' + path.relative(dist, file))
  }
}
fs.writeFileSync(path.join(dist, '.nojekyll'), '')
console.log('GitHub Pages artifact prepared; updated ' + changed + ' files, path prefix ' + prefix)
