use std::collections::HashMap;

use tauri::{AppHandle, State};

use crate::config::{self, Settings};
use crate::pty::PtyManager;
use crate::shell_detect::{self, DetectedShell};
use crate::ssh_config::{self, SshHostEntry};

#[tauri::command]
pub fn spawn_session(
    app: AppHandle,
    pty: State<PtyManager>,
    shell: String,
    args: Vec<String>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<String, String> {
    pty.spawn(app, shell, args, cwd, cols, rows, HashMap::new())
}

#[tauri::command]
pub fn write_session(pty: State<PtyManager>, id: String, data: String) -> Result<(), String> {
    pty.write(&id, &data)
}

#[tauri::command]
pub fn resize_session(
    pty: State<PtyManager>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    pty.resize(&id, cols, rows)
}

#[tauri::command]
pub fn close_session(pty: State<PtyManager>, id: String) -> Result<(), String> {
    pty.kill(&id)
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Settings {
    config::load(&app)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    config::save(&app, &settings)
}

#[tauri::command]
pub fn list_ssh_hosts() -> Vec<SshHostEntry> {
    ssh_config::parse_hosts()
}

#[tauri::command]
pub fn detect_shells() -> Vec<DetectedShell> {
    shell_detect::detect()
}
