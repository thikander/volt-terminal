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
 *
 * Output has multiple subscribers per session (the terminal's own display,
 * plus anything transiently "tapping" the stream — e.g. capturing the
 * output of one injected command) rather than one handler, so a feature
 * like that can listen in without stealing the terminal's own feed.
 */
class PtyBridge {
	private outputHandlers = new Map<string, Set<OutputHandler>>();
	private exitHandlers = new Map<string, Set<ExitHandler>>();
	private ready: Promise<void>;

	constructor() {
		this.ready = Promise.all([
			listen<PtyOutputEvent>('pty-output', (event) => {
				this.outputHandlers.get(event.payload.id)?.forEach((h) => h(event.payload.data));
			}),
			listen<PtyExitEvent>('pty-exit', (event) => {
				this.exitHandlers.get(event.payload.id)?.forEach((h) => h(event.payload.code));
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
			rows
		});
	}

	/** Subscribes to a session's output; returns a function to unsubscribe. */
	subscribeOutput(sessionId: string, handler: OutputHandler): () => void {
		let handlers = this.outputHandlers.get(sessionId);
		if (!handlers) {
			handlers = new Set();
			this.outputHandlers.set(sessionId, handlers);
		}
		handlers.add(handler);
		return () => handlers!.delete(handler);
	}

	onExit(sessionId: string, handler: ExitHandler) {
		let handlers = this.exitHandlers.get(sessionId);
		if (!handlers) {
			handlers = new Set();
			this.exitHandlers.set(sessionId, handlers);
		}
		handlers.add(handler);
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
