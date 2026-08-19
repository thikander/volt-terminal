import { getCurrentWindow } from '@tauri-apps/api/window';

/** Live focused/maximized state of the main window, for chrome that needs
 * to react to it (title bar dimming, matching the OS's rounded corners). */
class WindowStateStore {
	focused = $state(true);
	maximized = $state(false);
	private initialized = false;

	async init() {
		if (this.initialized) return;
		this.initialized = true;

		const win = getCurrentWindow();
		this.focused = await win.isFocused();
		this.maximized = await win.isMaximized();

		win.onFocusChanged(({ payload }) => (this.focused = payload));
		win.onResized(async () => {
			this.maximized = await win.isMaximized();
		});
	}
}

export const windowState = new WindowStateStore();
