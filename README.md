# FiveM Command Builder Pro
Generate FiveM server commands as native, QBCore and ESX Lua — instantly.

> A zero-dependency, offline-first builder that turns a simple form into clean, copy-pasteable Lua for three FiveM frameworks. Define a command once — name, description, arguments, ACE permissions, chat suggestions and aliases — and watch idiomatic code generate live as you type.

## Overview
FiveM Command Builder Pro is part of the **Web Utility Suite**. It eliminates the boilerplate of registering server commands by hand. Fill out a single definition and the app emits correct Lua for **Native `RegisterCommand`**, **QBCore (`QBCore.Commands.Add`)** and **ESX (`ESX.RegisterCommand`)** — including permission gates, argument-access stubs, `chat:addSuggestion` calls and alias registration. Everything runs locally in the browser from `file://` with no build step, no network calls and no frameworks.

## Features
- **Three frameworks, one definition** — switch between Native, QBCore and ESX via tabbed output; the code regenerates instantly.
- **Live preview** — a syntax-highlighted Lua panel updates on every keystroke.
- **Smart command-name validation** — enforces lowercase, no-spaces, identifier-safe names with an inline error.
- **Dynamic arguments** — add/remove rows with name, type (`string` / `number` / `player` / `boolean`), required toggle and help text; generates typed access stubs.
- **ACE permissions** — set an ACE string (e.g. `group.admin`) plus a `restricted` toggle; Native output adds `IsPlayerAceAllowed` checks and `add_ace` / `add_principal` setup comments.
- **Chat suggestions** — optional `TriggerClientEvent("chat:addSuggestion", ...)` emission with the per-argument help table.
- **Aliases** — dynamic alias list; each framework registers them idiomatically.
- **Copy & download** — copy the active framework's code or download a `.lua` file named after the command.
- **Persistent state** — your last configuration is saved to `localStorage` and restored on reload.
- **Load example** — one click fills a realistic `/heal` command to explore the output.
- **Polished UX** — premium glass UI, dark/light themes, full keyboard support and responsive layout down to 360px.

## Installation
No dependencies, no build step.

```bash
git clone https://github.com/your-org/web-utility-suite.git
cd web-utility-suite/fivem-command-builder
```

Then simply open `index.html` in any modern browser (double-click it, or drag it into a browser tab). It runs directly from disk via `file://`.

## Usage
1. Enter a **command name** (lowercase, no spaces — e.g. `heal`).
2. Add a **description**, an optional **ACE permission**, and toggle **Restricted** / **Chat suggestion** as needed.
3. Click **Add argument** to define each parameter (name, type, required, help).
4. Click **Add alias** for any alternative command names.
5. Pick a framework tab — **Native**, **QBCore** or **ESX** — and watch the Lua generate live.
6. **Copy** the code or **download** the `.lua` file and drop it into your resource's server script.

> The generated handler bodies include argument-access stubs and a clearly marked `-- TODO` where your logic goes.

## Keyboard Shortcuts
| Shortcut | Action |
| --- | --- |
| `Ctrl` / `⌘` + `C` | Copy the generated code |
| `Ctrl` / `⌘` + `S` | Download the `.lua` file |
| `Ctrl` / `⌘` + `1` | Switch to Native framework |
| `Ctrl` / `⌘` + `2` | Switch to QBCore framework |
| `Ctrl` / `⌘` + `3` | Switch to ESX framework |
| `?` | Open the keyboard shortcuts help |
| `Esc` | Close the dialog |

## Screenshots
> _Screenshots coming soon._

![screenshot](docs/screenshot-1.png)
![screenshot](docs/screenshot-2.png)

## Roadmap
- [ ] Import an existing `RegisterCommand` block and reverse-engineer the form
- [ ] Additional frameworks (vRP, ox_lib `lib.addCommand`)
- [ ] Multi-command projects with a single export bundle
- [ ] Optional client-side `RegisterKeyMapping` generation
- [ ] Shareable config links encoded in the URL

## License
MIT Licensed. Part of the [Web Utility Suite](../index.html).
