import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

type Status = 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'error';

class UpdateStore {
	status = $state<Status>('idle');
	available = $state<Update | null>(null);
	progress = $state(0);
	errorMessage = $state('');

	async check(): Promise<void> {
		this.status = 'checking';
		this.errorMessage = '';
		try {
			const update = await check();
			if (update) {
				this.available = update;
				this.status = 'available';
			} else {
				this.status = 'up-to-date';
			}
		} catch (err) {
			this.status = 'error';
			this.errorMessage = err instanceof Error ? err.message : String(err);
		}
	}

	async installAndRestart(): Promise<void> {
		if (!this.available) return;
		this.status = 'downloading';
		let downloaded = 0;
		let total = 0;
		try {
			await this.available.downloadAndInstall((event) => {
				if (event.event === 'Started') {
					total = event.data.contentLength ?? 0;
				} else if (event.event === 'Progress') {
					downloaded += event.data.chunkLength;
					this.progress = total > 0 ? Math.min(1, downloaded / total) : 0;
				} else if (event.event === 'Finished') {
					this.progress = 1;
				}
			});
			this.status = 'ready';
			await relaunch();
		} catch (err) {
			this.status = 'error';
			this.errorMessage = err instanceof Error ? err.message : String(err);
		}
	}

	dismiss(): void {
		this.status = 'idle';
		this.available = null;
	}
}

export const updateStore = new UpdateStore();
