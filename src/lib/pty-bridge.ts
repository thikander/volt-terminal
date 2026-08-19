import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { SpawnSpec } from './types';

interface PtyOutputEvent {
	id: string;
	data: string;
}

interface PtyExitEvent {
	id: string;
	code: number;
}

type OutputHandler = (data: string) => void;
type ExitHandler = (code: number) => void;

/**
 * Single global listener that fans events out to whichever pane owns a
 * given session id, so we never register one Tauri listener per terminal.
 */
class PtyBridge {
	private outputHandlers = new Map<string, OutputHandler>();
	private exitHandlers = new Map<string, ExitHandler>();
	private ready: Promise<void>;

	constructor() {
		this.ready = Promise.all([
			listen<PtyOutputEvent>('pty-output', (event) => {
				this.outputHandlers.get(event.payload.id)?.(event.payload.data);
			}),
			listen<PtyExitEvent>('pty-exit', (event) => {
				this.exitHandlers.get(event.payload.id)?.(event.payload.code);
				this.outputHandlers.delete(event.payload.id);
				this.exitHandlers.delete(event.payload.id);
			})
		]).then(() => undefined);
	}

	async spawn(spec: SpawnSpec, cols: number, rows: number): Promise<string> {
		await this.ready;
		return invoke<string>('spawn_session', {
			shell: spec.command,
			args: spec.args,
			cwd: spec.cwd ?? null,
			cols,
			rows,
			env: spec.env ?? null
		});
	}

	onOutput(sessionId: string, handler: OutputHandler) {
		this.outputHandlers.set(sessionId, handler);
	}

	onExit(sessionId: string, handler: ExitHandler) {
		this.exitHandlers.set(sessionId, handler);
	}

	write(sessionId: string, data: string) {
		void invoke('write_session', { id: sessionId, data });
	}

	resize(sessionId: string, cols: number, rows: number) {
		void invoke('resize_session', { id: sessionId, cols, rows });
	}

	close(sessionId: string) {
		this.outputHandlers.delete(sessionId);
		this.exitHandlers.delete(sessionId);
		void invoke('close_session', { id: sessionId });
	}
}

export const ptyBridge = new PtyBridge();
