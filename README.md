# FocusLock

A self-contained prototype of a focus/app-blocking manager. Open `index.html`
in a browser to run it — no build step or server required.

## File structure (separation of concerns)

The app is split into the three standard front-end layers so each kind of change
has one obvious place to make it:

| File         | Responsibility            | Edit this when you want to…                     |
|--------------|---------------------------|-------------------------------------------------|
| `index.html` | Structure (markup)        | Add/move a panel, button, modal, or text label  |
| `styles.css` | Presentation (styling)    | Change colors, spacing, fonts, layout           |
| `app.js`     | Behavior (logic)          | Change what happens on click, data, calculations|

## Common edits

- **Add a blockable app** → add an entry to the `APPS` array in `app.js`, then add a
  matching `<div id="gac-yourid"></div>` row in the Apps panel of `index.html`.
- **Change the default focus schedules** → edit `focusSchedules` in `app.js`.
- **Change the number of monthly breaks** → edit `bypassTokens` in `app.js`.
- **Re-tune the whole color theme** → edit the palette variables in `:root` at the top of `styles.css` (e.g. `--clay`, `--sage`, `--amber`, `--paper`).

## Note on the JavaScript

`app.js` is a plain (non-module) script and its functions are global on purpose —
the HTML wires up interactions with inline `onclick="..."` handlers that call those
functions by name. Keep new event-handler functions at the top level for the same
reason, or switch the markup to `addEventListener` if you prefer modules later.
