# Apex Designer — the desktop shell

Wraps the same bundle the browser runs. The engine is pure TypeScript with no UI
imports and the app has no backend, so **nothing about a takeoff changes because
it is running here** — this is a window, not a second implementation.

## Building it

Two prerequisites, neither installed on the machine this was scaffolded on:

1. **Rust** — <https://rustup.rs>
2. **MSVC C++ build tools** — the *Desktop development with C++* workload from
   the Visual Studio Build Tools installer. Several GB, and it wants a restart.

WebView2 is already present on Windows 10 and 11; Tauri uses it rather than
shipping a browser, which is why the installer is around 10 MB instead of 150.

```bash
npm run app:dev     # the app, with hot reload
npm run app:build   # a Windows installer under src-tauri/target/release/bundle
```

## It is not code-signed, deliberately

A certificate is $200–400 a year and Apex is not buying one. That is a decision,
not an oversight, and it has one consequence worth handling properly rather than
being surprised by.

**Windows SmartScreen warns on files that carry the Mark of the Web** — the flag
Windows attaches to anything arriving from a browser or an email client. The
warning reads *"Windows protected your PC"* and looks, to someone who did not
expect it, exactly like a virus alert. On an app whose whole point is that it
feels like Apex's own tool, that is the wrong first impression.

**So do not send it as a download.** Copy the installer to a USB stick or a
network share and hand it over that way. Files copied from removable media or a
local share are not marked, and SmartScreen stays quiet.

If it ever does arrive by download, the one-time fix is: right-click the
installer → **Properties** → tick **Unblock** → **OK**, then run it.

`installMode: currentUser` is set for the same reason — a per-user install needs
no administrator prompt, which is one less alarming dialog on first run.

## What is not done yet

- **The icons are upscaled from a 32 px favicon** and look it. `npx tauri icon
  <file>` regenerates the whole set from a square source; it wants 1024 x 1024.
  The brand assets in `public/brand` are a 32 px icon and a wide lockup, so
  neither is usable — this needs a real square source from the brand kit.
- **Saved designs still use `localStorage`**, exactly as in the browser. The
  obvious win from having a filesystem is designs as real `.json` files in a
  folder that can be backed up, which retires the limitation `SavedJobs.tsx`
  already apologises for. Not done here because it cannot be tested without the
  toolchain above.
- **The CSP in `tauri.conf.json` has never been exercised.** It matches the
  posture of the rest of the project, but a strict `script-src 'self'` against a
  Vite bundle is the kind of thing that either works immediately or breaks the
  whole window. Check it on the first build.
- **Updates.** Tauri's updater needs somewhere to serve releases from. Until
  that exists, a new version means handing over a new installer.
