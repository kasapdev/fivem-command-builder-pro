/* =====================================================================
   FiveM Command Builder Pro — app.js
   Wires the form to the live Lua preview, handles dynamic arg/alias rows,
   framework tabs, copy/download, persistence and keyboard shortcuts.
   Classic script. Depends on window.WUS (core.js) and window.FCB
   (generators.js).
   ===================================================================== */
(function () {
  'use strict';

  var W = window.WUS;
  var GEN = window.FCB.generators;
  var HL = window.FCB.highlight;
  var STORE_KEY = 'fcb.config';

  /* ----------------------------- DOM refs ---------------------------- */
  var $ = function (id) { return document.getElementById(id); };
  var form = $('cmd-form');
  var nameEl = $('f-name');
  var nameErr = $('name-err');
  var nameField = nameEl.closest('.field');
  var permEl = $('f-perm');
  var descEl = $('f-desc');
  var restrictedEl = $('f-restricted');
  var suggestionEl = $('f-suggestion');
  var argsList = $('args-list');
  var argsEmpty = $('args-empty');
  var aliasList = $('alias-list');
  var aliasEmpty = $('alias-empty');
  var codeOut = $('code-out');
  var fwBadge = $('fw-badge');
  var fileNameEl = $('file-name');
  var lineCountEl = $('line-count');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.segmented [data-fw]'));

  var FW_LABEL = { native: 'RegisterCommand', qbcore: 'QBCore.Commands.Add', esx: 'ESX.RegisterCommand' };
  var activeFw = 'native';

  /* ----------------------- Validation: name ------------------------- */
  // FiveM command names: lowercase letters, digits, underscores; no spaces.
  function validateName() {
    var raw = nameEl.value;
    var v = raw.trim();
    var ok = true, msg = '';
    if (v === '') {
      ok = false; msg = ''; // empty is "incomplete" not an error shown loudly
    } else if (/\s/.test(v)) {
      ok = false; msg = 'No spaces allowed in a command name.';
    } else if (v !== v.toLowerCase()) {
      ok = false; msg = 'Use lowercase only.';
    } else if (!/^[a-z0-9_]+$/.test(v)) {
      ok = false; msg = 'Only lowercase letters, numbers and underscores.';
    }
    if (msg) {
      nameField.classList.add('is-invalid');
      nameErr.textContent = msg;
      nameErr.hidden = false;
    } else {
      nameField.classList.remove('is-invalid');
      nameErr.hidden = true;
    }
    return ok && v !== '';
  }

  /* ---------------------- Dynamic argument rows --------------------- */
  function makeArgRow(data) {
    data = data || {};
    var row = W.el('div', { class: 'arg-row' });

    var name = W.el('input', { type: 'text', placeholder: 'amount', 'aria-label': 'Argument name', spellcheck: 'false', value: data.name || '' });
    var type = W.el('select', { 'aria-label': 'Argument type' });
    ['string', 'number', 'player', 'boolean'].forEach(function (t) {
      var o = W.el('option', { value: t, text: t });
      if ((data.type || 'string') === t) o.setAttribute('selected', 'selected');
      type.appendChild(o);
    });
    var help = W.el('input', { class: 'arg-help', type: 'text', placeholder: 'help text', 'aria-label': 'Argument help', spellcheck: 'false', value: data.help || '' });

    var reqWrap = W.el('label', { class: 'arg-req', title: 'Required argument' }, [
      (function () {
        var sw = W.el('span', { class: 'switch' });
        var cb = W.el('input', { type: 'checkbox', 'aria-label': 'Required' });
        if (data.required) cb.checked = true;
        sw.appendChild(cb);
        sw.appendChild(W.el('span', { class: 'track' }));
        sw.appendChild(W.el('span', { class: 'thumb' }));
        return sw;
      })(),
      'req'
    ]);

    var rm = W.el('button', {
      type: 'button', class: 'btn btn--remove', 'aria-label': 'Remove argument',
      onclick: function () { row.remove(); syncEmptyStates(); update(); }
    }, [iconTrash()]);

    [name, type, help].forEach(function (inp) { inp.addEventListener('input', update); });
    reqWrap.querySelector('input').addEventListener('change', update);
    type.addEventListener('change', update);

    row.appendChild(name);
    row.appendChild(type);
    row.appendChild(help);
    row.appendChild(reqWrap);
    row.appendChild(rm);
    return row;
  }

  function addArg(data) {
    argsList.appendChild(makeArgRow(data));
    syncEmptyStates();
  }

  /* ----------------------- Dynamic alias rows ----------------------- */
  function makeAliasRow(value) {
    var row = W.el('div', { class: 'alias-row' });
    var wrap = W.el('div', { class: 'input-prefix' });
    wrap.appendChild(W.el('span', { class: 'prefix', text: '/' }));
    var inp = W.el('input', { type: 'text', placeholder: 'restorehp', 'aria-label': 'Alias name', spellcheck: 'false', value: value || '' });
    inp.addEventListener('input', function () {
      // keep aliases command-name-safe: lowercase, strip spaces/invalid
      var clean = inp.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (clean !== inp.value) inp.value = clean;
      update();
    });
    wrap.appendChild(inp);

    var rm = W.el('button', {
      type: 'button', class: 'btn btn--remove', 'aria-label': 'Remove alias',
      onclick: function () { row.remove(); syncEmptyStates(); update(); }
    }, [iconTrash()]);

    row.appendChild(wrap);
    row.appendChild(rm);
    return row;
  }

  function addAlias(value) {
    aliasList.appendChild(makeAliasRow(value));
    syncEmptyStates();
  }

  function syncEmptyStates() {
    argsEmpty.hidden = argsList.children.length > 0;
    aliasEmpty.hidden = aliasList.children.length > 0;
  }

  /* --------------------------- Icons -------------------------------- */
  function iconTrash() {
    var span = W.el('span');
    span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    return span.firstChild;
  }

  /* ----------------------- Collect config --------------------------- */
  function collect() {
    var args = Array.prototype.map.call(argsList.children, function (row) {
      var inputs = row.querySelectorAll('input, select');
      return {
        name: (inputs[0].value || '').trim(),
        type: row.querySelector('select').value,
        help: (row.querySelector('.arg-help').value || '').trim(),
        required: row.querySelector('.arg-req input').checked
      };
    }).filter(function (a) { return a.name !== ''; });

    var aliases = Array.prototype.map.call(aliasList.children, function (row) {
      return (row.querySelector('input').value || '').trim();
    }).filter(function (a) { return a !== ''; });

    return {
      name: nameEl.value.trim(),
      description: descEl.value.trim(),
      permission: permEl.value.trim(),
      restricted: restrictedEl.checked,
      suggestion: suggestionEl.checked,
      args: args,
      aliases: aliases
    };
  }

  /* --------------------------- Generate ----------------------------- */
  function currentCode() {
    var cfg = collect();
    if (!cfg.name) cfg.name = 'command';
    try {
      return GEN[activeFw](cfg);
    } catch (err) {
      console.error(err);
      W.toast('Could not generate code: ' + err.message, 'error');
      return '-- Generation error.\n';
    }
  }

  function update() {
    validateName();
    var cfg = collect();
    var displayName = cfg.name || 'command';
    var code;
    try {
      code = GEN[activeFw](Object.assign({}, cfg, { name: displayName }));
    } catch (err) {
      console.error(err);
      code = '-- Generation error: ' + err.message + '\n';
    }
    codeOut.innerHTML = HL(code);
    fwBadge.textContent = FW_LABEL[activeFw];
    fileNameEl.textContent = displayName + '.lua';
    var lines = code.replace(/\n$/, '').split('\n').length;
    lineCountEl.textContent = lines + ' line' + (lines === 1 ? '' : 's');
    persist(cfg);
  }

  var persist = W.debounce(function (cfg) {
    W.store.set(STORE_KEY, { fw: activeFw, cfg: cfg });
  }, 350);

  /* --------------------------- Tabs --------------------------------- */
  function setFramework(fw) {
    if (!GEN[fw]) return;
    activeFw = fw;
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-fw') === fw;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    update();
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { setFramework(t.getAttribute('data-fw')); });
  });

  /* --------------------- Copy / download ---------------------------- */
  function doCopy() {
    var code = currentCode();
    W.copy(code, 'Lua copied — paste into your resource').then(function (ok) {
      if (ok) {
        var panel = document.querySelector('.out-panel');
        if (panel) { panel.classList.add('flash'); setTimeout(function () { panel.classList.remove('flash'); }, 500); }
      }
    });
  }
  function doDownload() {
    var cfg = collect();
    var fname = (cfg.name || 'command') + '.lua';
    try {
      W.download(fname, currentCode(), 'text/x-lua;charset=utf-8');
      W.toast('Downloaded ' + fname);
    } catch (err) {
      W.toast('Download failed: ' + err.message, 'error');
    }
  }
  $('btn-copy').addEventListener('click', doCopy);
  $('btn-download').addEventListener('click', doDownload);

  /* ------------------------- Example / reset ------------------------ */
  function loadExample() {
    nameEl.value = 'heal';
    descEl.value = "Restore a player's health to full";
    permEl.value = 'group.admin';
    restrictedEl.checked = true;
    suggestionEl.checked = true;
    argsList.innerHTML = '';
    addArg({ name: 'target', type: 'player', help: 'Server ID of the player to heal (optional, defaults to self)', required: false });
    addArg({ name: 'amount', type: 'number', help: 'Health amount 0-200 (optional)', required: false });
    aliasList.innerHTML = '';
    addAlias('restorehp');
    addAlias('hp');
    syncEmptyStates();
    update();
    W.toast('Loaded example: /heal');
  }

  function resetAll() {
    form.reset();
    suggestionEl.checked = true;
    argsList.innerHTML = '';
    aliasList.innerHTML = '';
    nameField.classList.remove('is-invalid');
    nameErr.hidden = true;
    syncEmptyStates();
    update();
    W.toast('Cleared');
  }

  $('btn-example').addEventListener('click', loadExample);
  $('btn-reset').addEventListener('click', resetAll);
  $('add-arg').addEventListener('click', function () { addArg(); update(); });
  $('add-alias').addEventListener('click', function () { addAlias(); update(); });

  // Live updates on the core fields.
  [nameEl, descEl, permEl].forEach(function (inp) { inp.addEventListener('input', update); });
  [restrictedEl, suggestionEl].forEach(function (cb) { cb.addEventListener('change', update); });

  /* ----------------------- Restore / first load --------------------- */
  function restore() {
    var saved = W.store.get(STORE_KEY, null);
    if (saved && saved.cfg) {
      var c = saved.cfg;
      nameEl.value = c.name || '';
      descEl.value = c.description || '';
      permEl.value = c.permission || '';
      restrictedEl.checked = !!c.restricted;
      suggestionEl.checked = c.suggestion !== false;
      (c.args || []).forEach(function (a) { addArg(a); });
      (c.aliases || []).forEach(function (a) { addAlias(a); });
      if (saved.fw && GEN[saved.fw]) activeFw = saved.fw;
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-fw') === activeFw;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      syncEmptyStates();
      update();
      return true;
    }
    return false;
  }

  /* ----------------------------- Modal ------------------------------ */
  var modal = $('help-modal');
  var lastFocus = null;
  function openHelp() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    var closeBtn = $('help-close');
    if (closeBtn) closeBtn.focus();
  }
  function closeHelp() {
    modal.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $('btn-help').addEventListener('click', openHelp);
  $('help-close').addEventListener('click', closeHelp);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeHelp(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) { e.preventDefault(); closeHelp(); }
  });

  /* --------------------------- Shortcuts ---------------------------- */
  W.registerShortcut('mod+c', function () {
    // Only hijack copy when the user isn't selecting text manually.
    var sel = window.getSelection();
    if (sel && sel.toString().length > 0) return;
    doCopy();
  }, 'Copy generated code');
  W.registerShortcut('mod+s', function () { doDownload(); }, 'Download .lua file');
  W.registerShortcut('mod+1', function () { setFramework('native'); }, 'Native framework');
  W.registerShortcut('mod+2', function () { setFramework('qbcore'); }, 'QBCore framework');
  W.registerShortcut('mod+3', function () { setFramework('esx'); }, 'ESX framework');
  W.registerShortcut('?', function () { openHelp(); }, 'Open keyboard shortcuts');

  // Prevent the native form submission (Enter) from reloading.
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  /* ------------------------------ Boot ------------------------------ */
  if (!restore()) {
    syncEmptyStates();
    update();
  }
})();
