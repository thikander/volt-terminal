import { invoke } from '@tauri-apps/api/core';
import type { ShellProfile, Settings } from '../types';

const fallback: Settings = {
	theme: 'volt-dark',
	font_family: 'Cascadia Code, Consolas, monospace',
	font_size: 14,
	line_height: 1.15,
	cursor_style: 'block',
	cursor_blink: true,
	background_opacity: 1,
	scrollback: 5000,
	copy_on_select: false,
	right_click_paste: true,
	bell_style: 'none',
	confirm_close: true,
	profiles: [],
	ssh_profiles: [],
	default_profile_id: '',
	keybindings: {
		new_tab: 'Ctrl+Shift+T',
		close_pane: 'Ctrl+Shift+W',
		split_right: 'Ctrl+Shift+E',
		split_down: 'Ctrl+Shift+D',
		quick_connect: 'Ctrl+Shift+K',
		open_settings: 'Ctrl+,'
	}
};

class SettingsStore {
	current = $state<Settings>(fallback);
	loaded = $state(false);

	async load() {
		this.current = await invoke<Settings>('load_settings');
		this.loaded = true;
	}

	async save(next: Settings) {
		this.current = next;
		await invoke('save_settings', { settings: next });
	}

	get defaultProfile(): ShellProfile | undefined {
		return (
			this.current.profiles.find((p) => p.id === this.current.default_profile_id) ??
			this.current.profiles[0]
		);
	}
}

export const settingsStore = new SettingsStore();
