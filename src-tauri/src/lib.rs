mod commands;
mod config;
mod native_chrome;
mod pty;
mod shell_detect;
mod ssh_config;

use tauri::Manager;

use pty::PtyManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PtyManager::default())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                native_chrome::apply(&window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::spawn_session,
            commands::write_session,
            commands::resize_session,
            commands::close_session,
            commands::load_settings,
            commands::save_settings,
            commands::list_ssh_hosts,
            commands::detect_shells,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
