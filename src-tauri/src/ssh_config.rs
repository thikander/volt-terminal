use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

#[derive(Clone, Serialize, Default)]
pub struct SshHostEntry {
    pub alias: String,
    pub hostname: Option<String>,
    pub user: Option<String>,
    pub port: Option<u16>,
    pub identity_file: Option<String>,
}

fn ssh_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".ssh"))
}

/// Where OpenSSH itself looks: the user's own config first, then the
/// system-wide one — covers people who keep their config somewhere the
/// system config `Include`s from, or who only have the system-wide file.
fn base_config_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(dir) = ssh_dir() {
        paths.push(dir.join("config"));
    }
    if cfg!(target_os = "windows") {
        paths.push(PathBuf::from(r"C:\ProgramData\ssh\ssh_config"));
    } else {
        paths.push(PathBuf::from("/etc/ssh/ssh_config"));
    }
    paths
}

/// Resolves an `Include` directive's pattern the way OpenSSH does: absolute
/// and `~`-prefixed paths are used as-is, anything else is relative to
/// `~/.ssh/`. Supports glob wildcards so `Include config.d/*` works.
fn resolve_include(pattern: &str, ssh_dir: &Path) -> Vec<PathBuf> {
    let expanded = if let Some(rest) = pattern.strip_prefix("~/") {
        dirs::home_dir().map(|h| h.join(rest))
    } else if Path::new(pattern).is_absolute() {
        Some(PathBuf::from(pattern))
    } else {
        Some(ssh_dir.join(pattern))
    };

    let Some(expanded) = expanded else { return Vec::new() };
    let Some(pattern_str) = expanded.to_str() else {
        return vec![expanded];
    };

    match glob::glob(pattern_str) {
        Ok(paths) => paths.filter_map(Result::ok).collect(),
        Err(_) => vec![expanded],
    }
}

/// Parses every reachable SSH config file (including whatever `Include`
/// directives pull in) into one entry per concrete host alias. Wildcard
/// host patterns (`*`, `?`) are skipped since they aren't a connectable
/// target on their own.
pub fn parse_hosts() -> Vec<SshHostEntry> {
    let ssh_dir = ssh_dir().unwrap_or_else(|| PathBuf::from("."));
    let mut hosts = Vec::new();
    let mut visited = HashSet::new();

    for path in base_config_paths() {
        parse_file(&path, &ssh_dir, &mut hosts, &mut visited);
    }

    // OpenSSH uses the first value it finds for a given host; mirror that
    // by keeping only the first entry per alias across every file parsed.
    let mut seen = HashSet::new();
    hosts.retain(|h| seen.insert(h.alias.clone()));
    hosts
}

fn parse_file(
    path: &Path,
    ssh_dir: &Path,
    hosts: &mut Vec<SshHostEntry>,
    visited: &mut HashSet<PathBuf>,
) {
    let Ok(canonical) = fs::canonicalize(path) else {
        return;
    };
    if !visited.insert(canonical) {
        return; // already parsed this exact file — avoid Include cycles
    }

    let Ok(raw) = fs::read_to_string(path) else {
        return;
    };

    let mut current: Vec<SshHostEntry> = Vec::new();
    let flush = |current: &mut Vec<SshHostEntry>, hosts: &mut Vec<SshHostEntry>| {
        hosts.append(current);
    };

    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = split_directive(line) else {
            continue;
        };
        let key_lower = key.to_ascii_lowercase();

        match key_lower.as_str() {
            "host" => {
                flush(&mut current, hosts);
                current = value
                    .split_whitespace()
                    .filter(|alias| !alias.contains(['*', '?']))
                    .map(|alias| SshHostEntry {
                        alias: alias.to_string(),
                        ..Default::default()
                    })
                    .collect();
            }
            "hostname" => {
                for h in current.iter_mut() {
                    h.hostname = Some(value.to_string());
                }
            }
            "user" => {
                for h in current.iter_mut() {
                    h.user = Some(value.to_string());
                }
            }
            "port" => {
                let port = value.parse().ok();
                for h in current.iter_mut() {
                    h.port = port;
                }
            }
            "identityfile" => {
                for h in current.iter_mut() {
                    h.identity_file = Some(value.to_string());
                }
            }
            "include" => {
                flush(&mut current, hosts);
                for included in resolve_include(value, ssh_dir) {
                    parse_file(&included, ssh_dir, hosts, visited);
                }
            }
            _ => {}
        }
    }
    flush(&mut current, hosts);
}

fn split_directive(line: &str) -> Option<(&str, &str)> {
    let line = line.trim_start();
    let split_at = line.find(|c: char| c == ' ' || c == '\t' || c == '=')?;
    let key = &line[..split_at];
    let value = line[split_at..].trim_start_matches(['=', ' ', '\t']).trim();
    if value.is_empty() {
        None
    } else {
        Some((key, value))
    }
}
