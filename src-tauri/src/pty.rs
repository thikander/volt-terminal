use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;

use parking_lot::Mutex;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Clone, Serialize)]
pub struct PtyOutputEvent {
    pub id: String,
    pub data: String,
}

#[derive(Clone, Serialize)]
pub struct PtyExitEvent {
    pub id: String,
    pub code: i32,
}

struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

/// Owns every live PTY session. One writer thread reads each child's output
/// and forwards it to the frontend as an event, keyed by session id.
#[derive(Default, Clone)]
pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

impl PtyManager {
    pub fn spawn(
        &self,
        app: AppHandle,
        shell: String,
        args: Vec<String>,
        cwd: Option<String>,
        cols: u16,
        rows: u16,
        env: HashMap<String, String>,
    ) -> Result<String, String> {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;

        let mut cmd = CommandBuilder::new(&shell);
        cmd.args(&args);
        if let Some(dir) = cwd {
            cmd.cwd(dir);
        }
        for (k, v) in env {
            cmd.env(k, v);
        }

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| e.to_string())?;
        // The slave side must be dropped after spawning or the master's
        // reader never sees EOF once the child exits.
        drop(pair.slave);

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| e.to_string())?;
        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

        let id = Uuid::new_v4().to_string();

        self.sessions.lock().insert(
            id.clone(),
            PtySession {
                master: pair.master,
                writer,
                child,
            },
        );

        spawn_reader_thread(app, id.clone(), reader, self.sessions.clone());

        Ok(id)
    }

    pub fn write(&self, id: &str, data: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock();
        let session = sessions.get_mut(id).ok_or("session not found")?;
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())
    }

    pub fn resize(&self, id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.lock();
        let session = sessions.get(id).ok_or("session not found")?;
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())
    }

    pub fn kill(&self, id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock();
        if let Some(mut session) = sessions.remove(id) {
            let _ = session.child.kill();
        }
        Ok(())
    }
}

fn spawn_reader_thread(
    app: AppHandle,
    id: String,
    mut reader: Box<dyn Read + Send>,
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
) {
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app.emit(
                        "pty-output",
                        PtyOutputEvent {
                            id: id.clone(),
                            data,
                        },
                    );
                }
                Err(_) => break,
            }
        }

        let code = sessions
            .lock()
            .get_mut(&id)
            .and_then(|s| s.child.wait().ok())
            .map(|status| status.exit_code() as i32)
            .unwrap_or(0);
        sessions.lock().remove(&id);
        let _ = app.emit("pty-exit", PtyExitEvent { id, code });
    });
}
