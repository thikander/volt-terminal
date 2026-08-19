use std::fs;
use std::path::PathBuf;

use serde::Serialize;

#[derive(Clone, Serialize, Default)]
pub struct SshHostEntry {
    pub alias: String,
    pub hostname: Option<String>,
    pub user: Option<String>,
    pub port: Option<u16>,
    pub identity_file: Option<String>,
}

fn config_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(home) = dirs::home_dir() {
        paths.push(home.join(".ssh").join("config"));
    }
    paths
}

/// Parses `~/.ssh/config` into one entry per concrete host alias.
/// Wildcard patterns (`*`, `?`) are skipped since they aren't a
/// connectable target, and `Include` directives aren't followed —
/// this covers the common single-file setup without pulling in a
/// full SSH-config-grammar dependency for an edge case.
pub fn parse_hosts() -> Vec<SshHostEntry> {
    let mut hosts = Vec::new();

    for path in config_paths() {
        let Ok(raw) = fs::read_to_string(&path) else {
            continue;
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
                    flush(&mut current, &mut hosts);
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
                _ => {}
            }
        }
        flush(&mut current, &mut hosts);
    }

    hosts
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
