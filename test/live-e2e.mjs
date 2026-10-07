// Live E2E against a real Obsidian instance launched with:
//   --user-data-dir=<repo>/.dev/profile --remote-debugging-port=9333
// Drives the actual plugin UI over CDP (Runtime.evaluate).
// Run: node test/live-e2e.mjs

const PORT = 9333;
let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? (pass++, console.log('ok: ' + msg)) : (fail++, console.error('FAIL: ' + msg)); };

// 1x1 red PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function main() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('no CDP page target');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown')
      errors.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300));
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) =>
    new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const js = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails)
      throw new Error((r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).slice(0, 400));
    return r.result.result.value;
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // React controlled inputs trap value assignment: setting el.value goes
  // through React's value tracker, so a following input event looks "unchanged"
  // and onChange never fires. Use the native prototype setter (bypasses the
  // tracker) + a bubbling input event so it reaches React's root listener.
  const SET_VALUE = `(el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }`;

  // Single-select dropdown: same value-tracker bypass as SET_VALUE, then a
  // bubbling change event so React's onChange fires.
  const SET_SELECT = `(el, v) => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }`;

  await send('Runtime.enable');

  // --- reset to a fresh install (suite assumes empty store) ---
  await js(`(async () => { try { await app.plugins.disablePlugin('movie-data'); } catch (e) {} })()`);
  await wait(400);
  await js(`require('fs').rmSync(app.vault.adapter.basePath + '/.movie-data', { recursive: true, force: true })`);
  await js(`(async () => { try { await app.plugins.enablePlugin('movie-data'); } catch (e) {} })()`);
  await wait(1200);

  // --- open view (assume already open; ensure exactly one) ---
  await js(`app.commands.executeCommandById('movie-data:open-movie-data')`);
  await wait(600);

  const pngB64 = PNG.toString('base64');

  // --- add actor via real UI ---
  await js(`[...document.querySelectorAll('.movie-data-toolbar button')].find(b=>b.textContent==='Actors').click()`);
  await wait(200);
  await js(`[...document.querySelectorAll('.movie-data-toolbar button')].find(b=>b.textContent==='+ Add actor').click()`);
  await wait(200);
  await js(`(() => {
    const form = document.querySelector('.movie-data-form');
    const inputs = [...form.querySelectorAll('input[type=text]')];
    const set = ${SET_VALUE};
    set(inputs[0], 'Ana de Armas');
    set(inputs[1], 'https://example.com/ana');
    set(form.querySelector('textarea'), 'Cuban actress');
  })()`);
  // actor cover through real file input
  await js(`(async () => {
    const form = document.querySelector('.movie-data-form');
    const fi = form.querySelector('input[type=file]');
    const bytes = Uint8Array.from(atob('${pngB64}'), c => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'ana.png', { type: 'image/png' }));
    fi.files = dt.files;
    fi.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
  })()`);
  await js(`[...document.querySelectorAll('.movie-data-form-buttons button')].find(b=>b.textContent==='Save').click()`);
  await wait(600);
  let st = await js(`JSON.stringify((() => {
    const fs = require('fs');
    const d = JSON.parse(fs.readFileSync(app.vault.adapter.basePath + '/.movie-data/movies.json', 'utf8'));
    return {actors: d.actors.length, name: d.actors[0]?.name};
  })())`);
  let s = JSON.parse(st);
  ok(s.actors === 1 && s.name === 'Ana de Armas', 'live: actor saved via real form');

  // --- add movie referencing the actor, with cover + tags + info ---
  await js(`[...document.querySelectorAll('.movie-data-toolbar button')].find(b=>b.textContent==='Movies').click()`);
  await wait(200);
  await js(`[...document.querySelectorAll('.movie-data-toolbar button')].find(b=>b.textContent==='+ Add movie').click()`);
  await wait(200);
  await js(`(() => {
    const form = document.querySelector('.movie-data-form');
    const inputs = [...form.querySelectorAll('input[type=text]')];
    const set = ${SET_VALUE};
    set(inputs[0], 'Blade Runner 2049');
    // chips: type + Enter per tag (comma-separated typing is gone)
    set(inputs[1], 'sci-fi');
    inputs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    set(inputs[1], 'noir');
    inputs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    set(inputs[2], 'https://example.com/br2049');
    set(form.querySelector('textarea'), 'K look\\nsecond line');
    const sel = form.querySelector('select[multiple]');
    [...sel.options].find(o => o.textContent === 'Ana de Armas').selected = true;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await js(`(async () => {
    const form = document.querySelector('.movie-data-form');
    const fi = form.querySelector('input[type=file]');
    const bytes = Uint8Array.from(atob('${pngB64}'), c => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'poster.png', { type: 'image/png' }));
    fi.files = dt.files;
    fi.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
  })()`);
  await js(`[...document.querySelectorAll('.movie-data-form-buttons button')].find(b=>b.textContent==='Save').click()`);
  await wait(800);

  st = await js(`JSON.stringify((() => {
    const fs = require('fs');
    const d = JSON.parse(fs.readFileSync(app.vault.adapter.basePath + '/.movie-data/movies.json', 'utf8'));
    return d.movies[0] || null;
  })())`);
  const mv = JSON.parse(st);
  ok(!!mv && mv.title === 'Blade Runner 2049', 'live: movie saved via real form');
  ok(JSON.stringify(mv?.tags) === JSON.stringify(['sci-fi', 'noir']), 'live: tags parsed');
  ok(mv?.info === 'K look\nsecond line', 'live: info verbatim');
  ok(mv?.actorIds?.length === 1, 'live: actor id reference');

  // --- disk: .mcov deformed, json written ---
  const disk = await js(`JSON.stringify((() => {
    const fs = require('fs');
    const base = app.vault.adapter.basePath + '/.movie-data';
    const covers = fs.readdirSync(base + '/covers');
    const raw = covers.length ? fs.readFileSync(base + '/covers/' + covers[0]) : null;
    return {
      covers,
      json: JSON.parse(fs.readFileSync(base + '/movies.json', 'utf8')).movies.length,
      firstBytes: raw ? [...raw.subarray(0, 4)] : null,
      hasPrefix: raw ? raw.subarray(0, 16).toString('latin1') === 'MOVIEMOVIECOVER!' : false,
      decodedIsPng: raw ? raw.subarray(20, 24).toString('latin1') === '\\u0089PNG' || raw[16] === 0x89 : false,
    };
  })())`);
  const dk = JSON.parse(disk);
  ok(dk.covers.every((c) => c.endsWith('.mcov')), 'live: cover ext is .mcov on real disk');
  ok(dk.hasPrefix, 'live: fixed prefix at offset 0 on real disk');
  ok(dk.firstBytes[0] === 0x4d, 'live: offset-0 byte is not an image signature');
  ok(dk.decodedIsPng, 'live: bytes after prefix are the original PNG');
  ok(dk.json === 1, 'live: movies.json on real disk has the movie');

  // --- grid shows cell with thumbnail ---
  const grid = await js(`JSON.stringify((() => {
    const cells = [...document.querySelectorAll('.movie-data-cell')];
    return { n: cells.length, title: cells[0]?.querySelector('.movie-data-cell-title')?.textContent,
             hasImg: !!cells[0]?.querySelector('.movie-data-cover img') };
  })())`);
  const g = JSON.parse(grid);
  ok(g.n === 1 && g.title === 'Blade Runner 2049', 'live: grid cell rendered');
  await wait(500);
  const hasImg = JSON.parse(await js(`JSON.stringify({img: !!document.querySelector('.movie-data-cell .movie-data-cover img')})`));
  ok(hasImg.img, 'live: thumbnail <img> decoded and rendered');

  // --- add a second actor with no movies (negative paths for filter + jump) ---
  await js(`[...document.querySelectorAll('.movie-data-toolbar button')].find(b=>b.textContent==='Actors').click()`);
  await wait(200);
  await js(`[...document.querySelectorAll('.movie-data-toolbar button')].find(b=>b.textContent==='+ Add actor').click()`);
  await wait(200);
  await js(`(() => { const f = document.querySelector('.movie-data-form'); (${SET_VALUE})(f.querySelectorAll('input[type=text]')[0], 'Zoe Missing'); })()`);
  await js(`[...document.querySelectorAll('.movie-data-form-buttons button')].find(b=>b.textContent==='Save').click()`);
  await wait(500);
  await js(`[...document.querySelectorAll('.movie-data-toolbar button')].find(b=>b.textContent==='Movies').click()`);
  await wait(200);
  const aid = JSON.parse(await js(`JSON.stringify((() => {
    const d = JSON.parse(require('fs').readFileSync(app.vault.adapter.basePath + '/.movie-data/movies.json', 'utf8'));
    return d.actors.find(a => a.name === 'Ana de Armas').id;
  })())`));

  // --- actor dropdown filter: non-matching actor -> empty state (was: search 'keanu') ---
  await js(`(() => { const s = document.querySelector('.movie-data-actor-select'); const zoe = [...s.options].find(o => o.textContent === 'Zoe Missing'); (${SET_SELECT})(s, zoe.value); })()`);
  await wait(200);
  let empty = JSON.parse(await js(`JSON.stringify({t: document.querySelector('.movie-data-empty')?.textContent, cells: document.querySelectorAll('.movie-data-cell').length})`));
  ok(empty.cells === 0 && empty.t === 'No results', 'live: non-matching actor filter -> empty state');

  // --- matching actor -> referencing movie (was: search 'ana') ---
  await js(`(() => { const s = document.querySelector('.movie-data-actor-select'); (${SET_SELECT})(s, '${aid}'); })()`);
  await wait(200);
  empty = JSON.parse(await js(`JSON.stringify({cells: document.querySelectorAll('.movie-data-cell').length, title: document.querySelector('.movie-data-cell-title')?.textContent})`));
  ok(empty.cells === 1 && empty.title === 'Blade Runner 2049', 'live: actor dropdown finds movie');

  // --- All actors resets the filter (was: clearing the search box) ---
  await js(`(() => { const s = document.querySelector('.movie-data-actor-select'); (${SET_SELECT})(s, ''); })()`);
  await wait(200);
  ok(JSON.parse(await js(`document.querySelectorAll('.movie-data-cell').length`)) === 1, 'live: All actors resets actor filter');

  // --- tag filter ---
  await js(`[...document.querySelectorAll('.movie-data-tag')].find(b=>b.textContent==='noir').click()`);
  await wait(200);
  ok(JSON.parse(await js(`document.querySelectorAll('.movie-data-cell').length`)) === 1, 'live: tag filter keeps tagged movie');
  await js(`[...document.querySelectorAll('.movie-data-tag')].find(b=>b.textContent==='noir').click()`);
  await wait(200);

  // --- actor jump: actors view -> that actor's filtered movies (one round trip) ---
  await js(`[...document.querySelectorAll('.movie-data-toolbar button')].find(b=>b.textContent==='Actors').click()`);
  await wait(200);
  await js(`(() => { const cell = [...document.querySelectorAll('.movie-data-cell')].find(c => c.textContent.includes('Ana de Armas')); cell.querySelector('.movie-data-jump').click(); })()`);
  await wait(300);
  const jumped = JSON.parse(await js(`JSON.stringify({
    sel: document.querySelector('.movie-data-actor-select')?.value,
    cells: document.querySelectorAll('.movie-data-cell').length,
    title: document.querySelector('.movie-data-cell-title')?.textContent,
    form: !!document.querySelector('.movie-data-form'),
  })`));
  ok(!jumped.form && jumped.cells === 1 && jumped.title === 'Blade Runner 2049' && jumped.sel === aid,
     'live: actor jump filters movies, selects actor, opens no form');

  // --- cancel writes nothing ---
  const before = await js(`require('fs').readFileSync(app.vault.adapter.basePath + '/.movie-data/movies.json', 'utf8')`);
  await js(`document.querySelector('.movie-data-cell').click()`);
  await wait(300);
  await js(`[...document.querySelectorAll('.movie-data-form-buttons button')].find(b=>b.textContent==='Cancel').click()`);
  await wait(300);
  const after = await js(`require('fs').readFileSync(app.vault.adapter.basePath + '/.movie-data/movies.json', 'utf8')`);
  ok(before === after, 'live: cancel leaves movies.json untouched');

  // --- edit actor, single source ---
  await js(`[...document.querySelectorAll('.movie-data-toolbar button')].find(b=>b.textContent==='Actors').click()`);
  await wait(200);
  await js(`document.querySelector('.movie-data-cell').click()`);
  await wait(300);
  await js(`(() => { const f = document.querySelector('.movie-data-form'); (${SET_VALUE})(f.querySelectorAll('input[type=text]')[0], 'Ana de Armas Prime'); })()`);
  await js(`[...document.querySelectorAll('.movie-data-form-buttons button')].find(b=>b.textContent==='Save').click()`);
  await wait(500);
  await js(`[...document.querySelectorAll('.movie-data-toolbar button')].find(b=>b.textContent==='Movies').click()`);
  await wait(200);
  const renamed = JSON.parse(await js(`JSON.stringify({
    opt: [...document.querySelectorAll('.movie-data-actor-select option')].map(o => o.textContent),
    cells: document.querySelectorAll('.movie-data-cell').length,
  })`));
  ok(renamed.opt.includes('Ana de Armas Prime') && renamed.cells === 1,
     'live: movie found via renamed actor (id reference intact)');

  // --- plugin reload persistence ---
  await js(`app.plugins.disablePlugin('movie-data')`);
  await wait(500);
  await js(`app.plugins.enablePlugin('movie-data')`);
  await wait(1500);
  const reloaded = await js(`JSON.stringify((() => {
    const p = app.plugins.plugins['movie-data'];
    const fs = require('fs');
    const d = JSON.parse(fs.readFileSync(app.vault.adapter.basePath + '/.movie-data/movies.json', 'utf8'));
    return { loaded: !!p, movies: d.movies.length, actors: d.actors.length };
  })())`);
  const rl = JSON.parse(reloaded);
  ok(rl.loaded && rl.movies === 1 && rl.actors === 2, 'live: plugin reload keeps data');

  // reopen the view: App loads from disk, no load-error screen
  await js(`app.commands.executeCommandById('movie-data:open-movie-data')`);
  await wait(800);
  const postReload = await js(`JSON.stringify({
    err: !!document.querySelector('.movie-data-load-error'),
    cells: document.querySelectorAll('.movie-data-cell').length,
  })`);
  const pr = JSON.parse(postReload);
  ok(!pr.err && pr.cells === 1, 'live: view reopens after reload without load-error');

  ok(errors.length === 0, 'live: no runtime exceptions' + (errors.length ? ' -> ' + JSON.stringify(errors) : ''));

  console.log(`\nLIVE E2E: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('FAIL:', e); process.exit(1); });
