/* =====================================================================
   FiveM Command Builder Pro — generators.js
   Pure Lua code generators for Native / QBCore / ESX frameworks.
   No DOM access here — these take a plain `config` object and return a
   Lua source string. Also exposes a tiny Lua syntax highlighter.
   Classic script: attaches window.FCB.generators + window.FCB.highlight.
   ===================================================================== */
(function () {
  'use strict';

  window.FCB = window.FCB || {};

  /* -------------------------- small helpers -------------------------- */

  // Escape a JS string so it is a valid Lua double-quoted string literal.
  function luaStr(s) {
    return '"' + String(s == null ? '' : s)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/\r/g, '') + '"';
  }

  // Sanitize the visible command name for use inside Lua identifiers/comments.
  function safeName(name) { return (name || 'command').trim() || 'command'; }

  // Wrap a long description into a block of `-- ` comment lines.
  function commentHeader(cfg) {
    var lines = [];
    lines.push('-- /' + safeName(cfg.name));
    if (cfg.description) lines.push('-- ' + cfg.description);
    var meta = [];
    if (cfg.permission) meta.push('permission: ' + cfg.permission);
    meta.push(cfg.restricted ? 'restricted' : 'open');
    if (cfg.args && cfg.args.length) {
      meta.push(cfg.args.length + ' arg' + (cfg.args.length === 1 ? '' : 's'));
    }
    if (cfg.aliases && cfg.aliases.length) {
      meta.push('aliases: ' + cfg.aliases.map(function (a) { return '/' + a; }).join(', '));
    }
    lines.push('-- (' + meta.join(' · ') + ')');
    return lines.join('\n');
  }

  // Build the `{ {name=, help=} ... }` suggestion/arguments table body.
  // `withType` includes a type= field (used by ESX). Returns indented lines.
  function argTable(args, indent, withType) {
    if (!args || !args.length) return '';
    var pad = indent;
    var inner = pad + '  ';
    var rows = args.map(function (a) {
      var parts = ['name = ' + luaStr(a.name)];
      parts.push('help = ' + luaStr(a.help || ''));
      if (withType) parts.push('type = ' + luaStr(a.type || 'string'));
      return inner + '{ ' + parts.join(', ') + ' }';
    });
    return rows.join(',\n');
  }

  // Argument-access stubs for inside the handler body.
  function argStubs(args, pad, accessor) {
    if (!args || !args.length) {
      return pad + '-- no arguments expected';
    }
    return args.map(function (a, i) {
      var idx = i + 1;
      var name = a.name || ('arg' + idx);
      var line = pad + 'local ' + name + ' = ' + accessor(idx);
      var note = [];
      note.push(a.type || 'string');
      if (a.required) note.push('required');
      if (a.help) note.push(a.help);
      return line + ' -- ' + note.join(' · ');
    }).join('\n');
  }

  /* ============================ NATIVE ============================== */
  function genNative(cfg) {
    var name = safeName(cfg.name);
    var out = [];
    out.push(commentHeader(cfg));
    out.push('');

    // ACE setup comment when a permission is present.
    if (cfg.permission) {
      out.push('-- ACE setup (add to server.cfg):');
      out.push('--   add_ace ' + (cfg.permission.indexOf('.') > -1 ? cfg.permission.split('.')[0] + ' ' + cfg.permission : cfg.permission) + ' command.' + name + ' allow');
      out.push('--   add_principal identifier.fivem:0000000 ' + cfg.permission + ' # grant a player');
      out.push('');
    }

    out.push('RegisterCommand(' + luaStr(name) + ', function(source, args, rawCommand)');

    // Permission gate.
    if (cfg.permission) {
      out.push('    -- permission check');
      out.push('    if source > 0 and not IsPlayerAceAllowed(source, ' + luaStr(cfg.permission) + ') then');
      out.push('        TriggerClientEvent("chat:addMessage", source, {');
      out.push('            args = { "^1SYSTEM", "You do not have permission to use /' + name + '." }');
      out.push('        })');
      out.push('        return');
      out.push('    end');
      out.push('');
    }

    out.push(argStubs(cfg.args, '    ', function (i) { return 'args[' + i + ']'; }));
    out.push('');
    out.push('    -- TODO: implement /' + name + ' logic here');
    out.push('end, ' + (cfg.restricted ? 'true' : 'false') + ')');

    // Aliases re-register the same handler by delegating via ExecuteCommand.
    if (cfg.aliases && cfg.aliases.length) {
      out.push('');
      out.push('-- aliases');
      cfg.aliases.forEach(function (al) {
        out.push('RegisterCommand(' + luaStr(al) + ', function(source, args, rawCommand)');
        out.push('    ExecuteCommand((source > 0 and ("onesync ") or "") .. ' + luaStr(name) + ' .. " " .. table.concat(args, " "))');
        out.push('    -- or call a shared handler function directly');
        out.push('end, ' + (cfg.restricted ? 'true' : 'false') + ')');
      });
    }

    // Chat suggestion(s).
    if (cfg.suggestion) {
      out.push('');
      out.push('-- chat suggestions');
      var sugArgs = argTable(cfg.args, '    ', false);
      var allNames = [name].concat(cfg.aliases || []);
      allNames.forEach(function (n) {
        if (sugArgs) {
          out.push('TriggerClientEvent("chat:addSuggestion", -1, "/' + n + '", ' + luaStr(cfg.description || '') + ', {');
          out.push(sugArgs);
          out.push('})');
        } else {
          out.push('TriggerClientEvent("chat:addSuggestion", -1, "/' + n + '", ' + luaStr(cfg.description || '') + ')');
        }
      });
    }

    return out.join('\n') + '\n';
  }

  /* ============================ QBCORE ============================== */
  function genQB(cfg) {
    var name = safeName(cfg.name);
    var out = [];
    out.push(commentHeader(cfg));
    out.push('');
    out.push('local QBCore = exports["qb-core"]:GetCoreObject()');
    out.push('');
    out.push('QBCore.Commands.Add(' + luaStr(name) + ', ' + luaStr(cfg.description || name) + ', {');

    var args = argTable(cfg.args, '    ', false);
    if (args) out.push(args);

    // restricted flag (3rd-arg style differs: arguments table, then argsRequired bool)
    var argsRequired = !!(cfg.args && cfg.args.some(function (a) { return a.required; }));
    out.push('}, ' + (argsRequired ? 'true' : 'false') + ', function(source, args)');
    out.push(argStubs(cfg.args, '    ', function (i) { return 'args[' + i + ']'; }));
    out.push('');
    out.push('    -- TODO: implement /' + name + ' logic here');
    out.push('end' + (cfg.permission ? ', ' + luaStr(cfg.permission) : '') + ')');

    if (cfg.aliases && cfg.aliases.length) {
      out.push('');
      out.push('-- aliases (register each with the same definition)');
      cfg.aliases.forEach(function (al) {
        out.push('QBCore.Commands.Add(' + luaStr(al) + ', ' + luaStr((cfg.description || name) + ' (alias of /' + name + ')') + ', {');
        if (args) out.push(args);
        out.push('}, ' + (argsRequired ? 'true' : 'false') + ', function(source, args)');
        out.push('    ExecuteCommand(("' + name + ' ") .. table.concat(args, " "))');
        out.push('end' + (cfg.permission ? ', ' + luaStr(cfg.permission) : '') + ')');
      });
    }

    return out.join('\n') + '\n';
  }

  /* ============================== ESX =============================== */
  function genESX(cfg) {
    var name = safeName(cfg.name);
    var out = [];
    out.push(commentHeader(cfg));
    out.push('');
    out.push('ESX = exports["es_extended"]:getSharedObject()');
    out.push('');
    out.push('ESX.RegisterCommand(' + luaStr(name) + ', ' + luaStr(cfg.permission || 'user') + ', function(xPlayer, args, showError)');
    out.push(argStubs(cfg.args, '    ', function (i) {
      return 'args.' + (cfg.args[i - 1] && cfg.args[i - 1].name ? cfg.args[i - 1].name : 'arg' + i);
    }));
    out.push('');
    out.push('    -- TODO: implement /' + name + ' logic here');
    out.push('    -- showError("Something went wrong") -- to report an error to the player');
    out.push('end, ' + (cfg.restricted ? 'true' : 'false') + ', {');
    out.push('    help = ' + luaStr(cfg.description || '') + ',');
    out.push('    validate = ' + (cfg.args && cfg.args.length ? 'true' : 'false') + ',');

    var esxArgs = argTable(cfg.args, '    ', true);
    if (esxArgs) {
      out.push('    arguments = {');
      out.push(esxArgs.replace(/^/gm, '    '));
      out.push('    }');
    } else {
      out.push('    arguments = {}');
    }
    out.push('})');

    if (cfg.aliases && cfg.aliases.length) {
      out.push('');
      out.push('-- aliases');
      cfg.aliases.forEach(function (al) {
        out.push('ESX.RegisterCommand(' + luaStr(al) + ', ' + luaStr(cfg.permission || 'user') + ', function(xPlayer, args, showError)');
        out.push('    ExecuteCommand(("' + name + ' ") .. (args.__raw or ""))');
        out.push('    -- ESX aliases: forward to /' + name + ' or call a shared function');
        out.push('end, ' + (cfg.restricted ? 'true' : 'false') + ', { help = ' + luaStr('Alias of /' + name) + ' })');
      });
    }

    return out.join('\n') + '\n';
  }

  /* ========================= Lua highlighter ======================== */
  // Lightweight tokenizer-style highlighter. Input is RAW Lua; we escape
  // HTML first inside this function, so callers pass plain text.
  var LUA_KEYWORDS = /\b(and|break|do|else|elseif|end|false|for|function|goto|if|in|local|nil|not|or|repeat|return|then|true|until|while)\b/;
  var LUA_GLOBALS = /\b(RegisterCommand|TriggerClientEvent|TriggerServerEvent|IsPlayerAceAllowed|ExecuteCommand|GetPlayerName|exports|table|string|math|pairs|ipairs|tostring|tonumber|print|source|QBCore|ESX|xPlayer|showError)\b/;

  function escapeHtml(s) {
    return s.replace(/[&<>]/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;';
    });
  }

  function highlight(code) {
    var lines = code.split('\n');
    return lines.map(function (line) {
      // Whole-line comment.
      var ci = line.indexOf('--');
      // Make sure the `--` isn't inside a string by scanning quotes first.
      var html = '';
      var i = 0;
      var n = line.length;
      while (i < n) {
        var ch = line[i];
        // String literal.
        if (ch === '"' || ch === "'") {
          var q = ch, j = i + 1, str = ch;
          while (j < n) {
            str += line[j];
            if (line[j] === '\\') { str += line[j + 1] || ''; j += 2; continue; }
            if (line[j] === q) { j++; break; }
            j++;
          }
          html += '<span class="tok-string">' + escapeHtml(str) + '</span>';
          i = j;
          continue;
        }
        // Comment to end of line.
        if (ch === '-' && line[i + 1] === '-') {
          html += '<span class="tok-comment">' + escapeHtml(line.slice(i)) + '</span>';
          i = n;
          continue;
        }
        // Word / number token.
        if (/[A-Za-z0-9_.]/.test(ch)) {
          var w = '';
          while (i < n && /[A-Za-z0-9_.]/.test(line[i])) { w += line[i]; i++; }
          if (/^[0-9]+\.?[0-9]*$/.test(w)) {
            html += '<span class="tok-number">' + escapeHtml(w) + '</span>';
          } else if (/^(true|false|nil)$/.test(w)) {
            html += '<span class="tok-bool">' + escapeHtml(w) + '</span>';
          } else if (LUA_KEYWORDS.test(w) && new RegExp('^(' + LUA_KEYWORDS.source.slice(2, -2) + ')$').test(w)) {
            html += '<span class="tok-keyword">' + escapeHtml(w) + '</span>';
          } else if (LUA_GLOBALS.test(w)) {
            html += '<span class="tok-global">' + escapeHtml(w) + '</span>';
          } else {
            html += escapeHtml(w);
          }
          continue;
        }
        // Anything else.
        html += escapeHtml(ch);
        i++;
      }
      void ci; // silence linters
      return html;
    }).join('\n');
  }

  /* ----------------------------- export ------------------------------ */
  window.FCB.generators = { native: genNative, qbcore: genQB, esx: genESX };
  window.FCB.highlight = highlight;
})();
