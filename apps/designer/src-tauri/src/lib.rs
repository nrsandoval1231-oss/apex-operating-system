//! The desktop shell.
//!
//! Deliberately empty of logic. The engine is pure TypeScript with no UI
//! imports, and the whole app is a static bundle with no backend — so the shell
//! opens a window onto exactly the same bundle the browser runs. Nothing about
//! a takeoff changes because it is running here.
//!
//! Anything that does belong in Rust — reading and writing design files from a
//! real folder rather than from localStorage — goes in as a command, not as a
//! second copy of a rule that already exists in the engine.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Apex Designer");
}
