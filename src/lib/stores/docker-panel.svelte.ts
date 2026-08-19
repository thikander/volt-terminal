import { detectComposeFile, detectDialect, runDockerCommand, writeComposeFile } from '../docker';
import { newService, parseCompose, serializeCompose, type ComposeModel } from '../compose-model';
import type { ShellDialect } from '../docker';

type Status = 'idle' | 'scanning' | 'available' | 'none' | 'unsupported' | 'error' | 'saving';

interface PaneDockerState {
	sessionId: string;
	status: Status;
	dialect: ShellDialect;
	filename: string;
	model: ComposeModel | null;
	error: string;
}

const EMPTY: PaneDockerState = {
	sessionId: '',
	status: 'idle',
	dialect: 'unsupported',
	filename: '',
	model: null,
	error: ''
};

class DockerPanelStore {
	perPane = $state<Record<string, PaneDockerState>>({});
	openPaneId = $state<string | null>(null);

	stateFor(paneId: string): PaneDockerState {
		return this.perPane[paneId] ?? EMPTY;
	}

	get openState(): PaneDockerState | null {
		return this.openPaneId ? this.stateFor(this.openPaneId) : null;
	}

	async scan(paneId: string, sessionId: string, spawnCommand: string) {
		const dialect = detectDialect(spawnCommand);
		if (dialect === 'unsupported') {
			this.perPane[paneId] = { ...EMPTY, sessionId, dialect, status: 'unsupported' };
			return;
		}
		await this.scanWithDialect(paneId, sessionId, dialect);
	}

	/** Re-runs detection for a pane already known (dialect + session already
	 * established), e.g. after the user `cd`s into a different project. */
	async rescan(paneId: string) {
		const existing = this.perPane[paneId];
		if (!existing?.sessionId || existing.dialect === 'unsupported') return;
		await this.scanWithDialect(paneId, existing.sessionId, existing.dialect);
	}

	private async scanWithDialect(paneId: string, sessionId: string, dialect: ShellDialect) {
		this.perPane[paneId] = { ...EMPTY, sessionId, dialect, status: 'scanning' };
		try {
			const file = await detectComposeFile(sessionId, dialect);
			if (!file) {
				this.perPane[paneId] = { ...this.perPane[paneId], status: 'none' };
				return;
			}
			this.perPane[paneId] = {
				sessionId,
				dialect,
				status: 'available',
				filename: file.filename,
				model: parseCompose(file.content),
				error: ''
			};
		} catch (err) {
			this.perPane[paneId] = {
				...this.perPane[paneId],
				status: 'error',
				error: err instanceof Error ? err.message : String(err)
			};
		}
	}

	open(paneId: string) {
		this.openPaneId = paneId;
	}

	close() {
		this.openPaneId = null;
	}

	addService() {
		const state = this.openState;
		if (!state?.model) return;
		let name = 'service';
		let i = 1;
		const existing = new Set(state.model.services.map((s) => s.name));
		while (existing.has(name)) name = `service${i++}`;
		state.model.services.push(newService(name));
	}

	removeService(name: string) {
		const state = this.openState;
		if (!state?.model) return;
		state.model.services = state.model.services.filter((s) => s.name !== name);
	}

	async save() {
		const paneId = this.openPaneId;
		const state = paneId ? this.perPane[paneId] : null;
		if (!paneId || !state?.model) return;

		this.perPane[paneId] = { ...state, status: 'saving' };
		try {
			await writeComposeFile(
				state.sessionId,
				state.dialect,
				state.filename,
				serializeCompose(state.model)
			);
			this.perPane[paneId] = { ...state, status: 'available' };
		} catch (err) {
			this.perPane[paneId] = {
				...state,
				status: 'error',
				error: err instanceof Error ? err.message : String(err)
			};
		}
	}

	runCommand(args: string) {
		const state = this.openState;
		if (state?.sessionId) runDockerCommand(state.sessionId, args);
	}
}

export const dockerPanel = new DockerPanelStore();
