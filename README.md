# Volt Terminal

A fast, minimal terminal emulator — tabs, splits, SSH quick-connect, and
per-session shell profiles, built on a lighter stack for a snappier feel.
Frameless native-feeling window, dark theme, and a quick-connect palette
that reads your real `~/.ssh/config`.

**Stack:** Tauri 2 (Rust) + SvelteKit / Svelte 5 (runes) + xterm.js

## Architecture

```
src-tauri/src/
  lib.rs          Tauri app entry, registers commands + manages PtyManager state
  pty.rs          PTY lifecycle (spawn/write/resize/kill) via portable-pty,
                  one reader thread per session forwarding output as events
  config.rs       Settings, shell profiles, SSH profiles, keybindings —
                  persisted as JSON in the app config dir
  ssh_config.rs   Parses ~/.ssh/config into connectable host entries
  shell_detect.rs Finds installed shells (PowerShell/cmd/Git Bash/WSL distros,
                  or /etc/shells) to seed profiles on first run
  native_chrome.rs Rounded corners + native drop shadow for the undecorated
                  window on Windows 11 (DWM)
  commands.rs     #[tauri::command] surface consumed by the frontend

src/lib/
  types.ts                     Shared types: profiles, Settings, pane tree, SpawnSpec
  connections.ts                Resolves any profile / ~/.ssh/config host / typed
                                address into a SpawnSpec; recent-connections persistence
  pty-bridge.ts                 Single global event listener that fans pty-output/
                                pty-exit events out to the owning pane by session id
  keys.ts                       Matches a KeyboardEvent against a "Ctrl+Shift+T"-style combo
  theme.ts                      xterm.js color theme
  stores/settings.svelte.ts     Settings state (Svelte 5 class + runes)
  stores/workspace.svelte.ts    Tabs + recursive split-pane tree, all mutations
  stores/window-state.svelte.ts Live focused/maximized state, shared by the
                                 title bar (dimming) and window controls (icon)
  stores/update.svelte.ts       Wraps @tauri-apps/plugin-updater: check /
                                 download / install-and-relaunch state machine
  components/
    TitleBar.svelte             Frameless custom title bar (tabs + window controls)
    TabBar.svelte                Tab strip
    WindowControls.svelte        Minimize / maximize / close for the frameless window
    ResizeHandles.svelte          Invisible edge/corner regions so the undecorated
                                  window can still be resized by dragging
    QuickConnect.svelte          Connect palette: recents, local profiles, saved
                                  SSH profiles, and live ~/.ssh/config hosts
    SplitView.svelte             Recursive renderer for the split-pane tree,
                                  with draggable resize gutters
    TerminalPane.svelte          Owns one xterm.js instance + its PTY session
    SettingsModal.svelte         Multi-section settings (profiles, SSH, appearance,
                                  terminal, keybindings, about + update check)
    UpdateBanner.svelte           In-app banner when an update is available/downloading
```

### Why this shape

- **One PTY reader thread per session, one Tauri event channel.** The frontend
  never opens more than two `listen()` calls total; `pty-bridge.ts` is the only
  place that talks to Tauri's IPC, so every pane just registers a plain
  callback. This scales to many panes without event-listener sprawl.
- **The pane layout is a binary tree (`PaneNode`)**, matching how you'd
  represent nested horizontal/vertical splits. `workspace.svelte.ts` operates
  on the tree directly with Svelte 5's deep reactivity — no separate
  normalization/selector layer needed for an app this size.
- **A pane spawns a resolved `SpawnSpec` (`{command, args, cwd}`), not a
  profile reference.** `connections.ts` is the single place that turns a local
  profile, a saved SSH profile, a `~/.ssh/config` alias, or a typed
  `user@host` into that shape. This is what makes SSH quick-connect and local
  shells interchangeable everywhere else in the app.
- **SSH connects by shelling out to the system `ssh` binary**, not a bundled
  SSH client library. `ssh <alias>` lets the OpenSSH client itself resolve
  `~/.ssh/config` — including `Include`, `ProxyJump`, and agent setup we don't
  parse — instead of re-implementing SSH config semantics. `ssh_config.rs`
  only parses the file far enough to *list* hosts for the picker.
- **Settings and profiles live in Rust**, persisted to the OS app-config
  directory as JSON, and are the source of truth on load — the frontend only
  edits a draft and calls `save_settings`.

## Develop

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## Releasing (auto-updates)

The app checks `https://github.com/thikander/volt-terminal/releases/latest/download/latest.json`
on launch and from Settings → About → "Check for updates". To cut a release
that updater-enabled installs can actually see:

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat .tauri/volt-terminal.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
npm run tauri build
```

Bump `version` in `src-tauri/tauri.conf.json` first — the updater only offers
an update when the release's version is greater than the running app's. Then
create a GitHub release tagged `v<version>` and upload everything under
`src-tauri/target/release/bundle/{msi,nsis}/`, including the generated
`latest.json` — its exact filename matters, since that's what the `/latest/download/`
URL above resolves to.

The signing key lives at `.tauri/volt-terminal.key` and is gitignored — it's
what proves an update actually came from this project, so treat it like a
credential (back it up somewhere safe; losing it means old installs can never
verify a future update again, forcing everyone to reinstall manually).

## SSH

Open Quick Connect (`Ctrl+Shift+K` or the ▾ button next to a tab) and either:

- pick a host already defined in `~/.ssh/config` — shown automatically, no setup, or
- pick a saved SSH connection (Settings → SSH Connections), or
- type `user@host` (or just `host`) and press Enter to connect ad hoc.

Every successful connection is remembered under "Recent". Saved SSH
connections and `~/.ssh/config` hosts both ultimately run `ssh <target>` in a
real PTY, so host-key prompts, passwords, and 2FA all work exactly as they
would in a normal terminal.

Settings → SSH Connections keeps the two sources visibly separate: a
**From ~/.ssh/config** list (each with an Import button) above **Your saved
connections** (the editable, groupable profiles you create yourself or
import). Importing copies a config entry into a real saved profile — the
config file only exists on whatever machine has it, so a saved profile is
the thing that's actually portable, which matters if/when profiles become
shareable across a team.

## Keyboard shortcuts

All rebindable in Settings → Keybindings. Defaults use `Ctrl+Shift+<key>`
rather than bare `Ctrl+<key>` on purpose — `Ctrl+T`/`Ctrl+W`/`Ctrl+D` are live
readline bindings (transpose-char, delete-word, EOF) and would otherwise get
eaten by the app instead of reaching your shell.

| Shortcut       | Action                       |
| -------------- | ---------------------------- |
| `Ctrl+Shift+T` | New tab (default profile)    |
| `Ctrl+Shift+W` | Close active pane/tab        |
| `Ctrl+Shift+E` | Split right                  |
| `Ctrl+Shift+D` | Split down                   |
| `Ctrl+Shift+K` | Quick connect                |
| `Ctrl+,`       | Open settings                |
| `Ctrl+Tab`     | Next tab (fixed, not rebindable) |
| `Ctrl+Shift+Tab` | Previous tab (fixed, not rebindable) |

## Extending

- **New shell profile defaults:** edit `default_profiles()` in
  [`config.rs`](src-tauri/src/config.rs) — profiles are otherwise fully
  user-editable at runtime via Settings.
- **`~/.ssh/config` parsing gaps** (no `Include`, no wildcard hosts, single
  file only): extend `parse_hosts()` in
  [`ssh_config.rs`](src-tauri/src/ssh_config.rs). The picker only needs
  alias/hostname/user/port for display — the actual connection always goes
  through the system `ssh` binary, so parsing more directives only improves
  what's *shown*, not what connects.
- **Themes:** `theme.ts` exports one palette; swap it for a map keyed by
  `Settings.theme` when you add more than one.
