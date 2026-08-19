use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::shell_detect;

#[derive(Clone, Serialize, Deserialize)]
pub struct EnvVar {
    pub key: String,
    pub value: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ShellProfile {
    pub id: String,
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub group: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub icon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub env: Option<Vec<EnvVar>>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub close_on_exit: Option<bool>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct SshProfile {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub group: Option<String>,
    pub host: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub port: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub user: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub identity_file: Option<String>,
    #[serde(default)]
    pub agent_forwarding: bool,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub icon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub close_on_exit: Option<bool>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Keybindings {
    pub new_tab: String,
    pub close_pane: String,
    pub split_right: String,
    pub split_down: String,
    pub quick_connect: String,
    pub open_settings: String,
}

impl Default for Keybindings {
    fn default() -> Self {
        Self {
            new_tab: "Ctrl+Shift+T".into(),
            close_pane: "Ctrl+Shift+W".into(),
            split_right: "Ctrl+Shift+E".into(),
            split_down: "Ctrl+Shift+D".into(),
            quick_connect: "Ctrl+Shift+K".into(),
            open_settings: "Ctrl+,".into(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Settings {
    pub theme: String,
    pub font_family: String,
    pub font_size: u16,
    pub line_height: f32,
    pub cursor_style: String,
    pub cursor_blink: bool,
    pub background_opacity: f32,
    pub scrollback: u32,
    pub copy_on_select: bool,
    pub right_click_paste: bool,
    pub bell_style: String,
    pub confirm_close: bool,
    pub profiles: Vec<ShellProfile>,
    #[serde(default)]
    pub ssh_profiles: Vec<SshProfile>,
    pub default_profile_id: String,
    #[serde(default)]
    pub keybindings: Keybindings,
}

impl Default for Settings {
    fn default() -> Self {
        let profiles = default_profiles();
        let default_profile_id = profiles.first().map(|p| p.id.clone()).unwrap_or_default();
        Self {
            theme: "volt-dark".into(),
            font_family: "Cascadia Code, Consolas, monospace".into(),
            font_size: 14,
            line_height: 1.15,
            cursor_style: "block".into(),
            cursor_blink: true,
            background_opacity: 1.0,
            scrollback: 5000,
            copy_on_select: false,
            right_click_paste: true,
            bell_style: "none".into(),
            confirm_close: true,
            profiles,
            ssh_profiles: Vec::new(),
            default_profile_id,
            keybindings: Keybindings::default(),
        }
    }
}

/// Every shell the system actually has installed (PowerShell/cmd on Windows,
/// plus Git Bash and any WSL distros if present; `/etc/shells` elsewhere),
/// so a first launch already lists what's actually usable instead of a
/// hardcoded guess.
fn default_profiles() -> Vec<ShellProfile> {
    let detected = shell_detect::detect();
    if detected.is_empty() {
        return vec![ShellProfile {
            id: "default".into(),
            name: "Shell".into(),
            command: fallback_shell(),
            args: vec![],
            cwd: None,
            group: None,
            icon: None,
            color: None,
            env: None,
            close_on_exit: None,
        }];
    }

    detected
        .into_iter()
        .enumerate()
        .map(|(i, shell)| ShellProfile {
            id: format!("detected-{i}"),
            name: shell.name,
            command: shell.command,
            args: shell.args,
            cwd: None,
            group: None,
            icon: None,
            color: None,
            env: None,
            close_on_exit: None,
        })
        .collect()
}

#[cfg(target_os = "windows")]
fn fallback_shell() -> String {
    "powershell.exe".into()
}

#[cfg(not(target_os = "windows"))]
fn fallback_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into())
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}

pub fn load(app: &AppHandle) -> Settings {
    config_path(app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

pub fn save(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let path = config_path(app)?;
    let raw = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}
