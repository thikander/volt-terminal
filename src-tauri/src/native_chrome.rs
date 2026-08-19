//! Makes the undecorated main window look like a native Windows 11 app:
//! rounded corners and the default DWM drop shadow, neither of which the
//! system draws for a `decorations: false` window on its own.

#[cfg(target_os = "windows")]
pub fn apply(window: &tauri::WebviewWindow) {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::Graphics::Dwm::{
        DwmExtendFrameIntoClientArea, DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE,
        DWMWCP_ROUND,
    };
    use windows_sys::Win32::UI::Controls::MARGINS;

    let Ok(hwnd) = window.hwnd() else { return };
    let hwnd = hwnd.0 as HWND;

    unsafe {
        let preference = DWMWCP_ROUND;
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE as u32,
            &preference as *const _ as *const _,
            size_of::<i32>() as u32,
        );

        // Extending the frame by 1px triggers DWM's default window shadow
        // on an otherwise borderless window — a well-known trick since the
        // API has no direct "just give me the shadow" flag.
        let margins = MARGINS {
            cxLeftWidth: 0,
            cxRightWidth: 0,
            cyTopHeight: 0,
            cyBottomHeight: 1,
        };
        DwmExtendFrameIntoClientArea(hwnd, &margins);
    }
}

#[cfg(not(target_os = "windows"))]
pub fn apply(_window: &tauri::WebviewWindow) {}
