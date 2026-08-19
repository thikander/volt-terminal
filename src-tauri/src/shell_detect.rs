use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct DetectedShell {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
}

fn find_in_path(exe: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    std::env::split_paths(&path_var)
        .map(|dir| dir.join(exe))
        .find(|candidate| candidate.is_file())
}

#[cfg(target_os = "windows")]
pub fn detect() -> Vec<DetectedShell> {
    let mut shells = vec![
        DetectedShell {
            name: "PowerShell".into(),
            command: "powershell.exe".into(),
            args: vec![],
        },
        DetectedShell {
            name: "Command Prompt".into(),
            command: "cmd.exe".into(),
            args: vec![],
        },
    ];

    if let Some(pwsh) = find_in_path("pwsh.exe") {
        shells.push(DetectedShell {
            name: "PowerShell 7".into(),
            command: pwsh.to_string_lossy().into_owned(),
            args: vec![],
        });
    }

    let program_files = [
        std::env::var("ProgramFiles").ok(),
        std::env::var("ProgramFiles(x86)").ok(),
    ];
    for base in program_files.into_iter().flatten() {
        for suffix in ["bin\\bash.exe", "usr\\bin\\bash.exe"] {
            let candidate = Path::new(&base).join("Git").join(suffix);
            if candidate.is_file() {
                shells.push(DetectedShell {
                    name: "Git Bash".into(),
                    command: candidate.to_string_lossy().into_owned(),
                    args: vec!["--login".into(), "-i".into()],
                });
                break;
            }
        }
    }

    if let Some(wsl) = find_in_path("wsl.exe") {
        for distro in list_wsl_distros(&wsl) {
            shells.push(DetectedShell {
                name: format!("WSL: {distro}"),
                command: wsl.to_string_lossy().into_owned(),
                args: vec!["-d".into(), distro],
            });
        }
    }

    shells
}

/// `wsl -l -q` prints UTF-16LE on Windows regardless of the console's
/// active code page, so a plain `from_utf8` mangles every distro name.
#[cfg(target_os = "windows")]
fn list_wsl_distros(wsl: &Path) -> Vec<String> {
    let Ok(output) = Command::new(wsl).args(["-l", "-q"]).output() else {
        return Vec::new();
    };
    if !output.status.success() {
        return Vec::new();
    }

    let raw = &output.stdout;
    let text = if raw.iter().take(64).filter(|&&b| b == 0).count() > 0 {
        let utf16: Vec<u16> = raw
            .chunks_exact(2)
            .map(|b| u16::from_le_bytes([b[0], b[1]]))
            .collect();
        String::from_utf16_lossy(&utf16)
    } else {
        String::from_utf8_lossy(raw).into_owned()
    };

    text.lines()
        .map(|l| l.trim().trim_end_matches(" (Default)").trim())
        .filter(|l| !l.is_empty())
        .map(str::to_string)
        .collect()
}

#[cfg(not(target_os = "windows"))]
pub fn detect() -> Vec<DetectedShell> {
    let mut candidates: Vec<String> = std::fs::read_to_string("/etc/shells")
        .map(|raw| {
            raw.lines()
                .map(str::trim)
                .filter(|l| !l.is_empty() && !l.starts_with('#'))
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();
    for common in ["/bin/bash", "/bin/zsh", "/bin/fish", "/bin/sh", "/usr/bin/fish"] {
        candidates.push(common.to_string());
    }

    let mut seen = std::collections::HashSet::new();
    let mut shells = Vec::new();

    for path in candidates {
        if !Path::new(&path).is_file() || !seen.insert(path.clone()) {
            continue;
        }
        let name = Path::new(&path)
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.clone());
        shells.push(DetectedShell {
            name: capitalize(&name),
            command: path,
            args: vec![],
        });
    }

    shells
}

#[cfg(not(target_os = "windows"))]
fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        Some(first) => first.to_uppercase().collect::<String>() + c.as_str(),
        None => String::new(),
    }
}
