export interface EnvVar {
	key: string;
	value: string;
}

export interface ShellProfile {
	id: string;
	name: string;
	command: string;
	args: string[];
	cwd?: string;
	group?: string;
	icon?: string;
	color?: string;
	env?: EnvVar[];
	close_on_exit?: boolean;
}

export interface SshProfile {
	id: string;
	name: string;
	group?: string;
	host: string;
	port?: number;
	user?: string;
	identity_file?: string;
	agent_forwarding: boolean;
	icon?: string;
	color?: string;
	close_on_exit?: boolean;
}

export interface DetectedShell {
	name: string;
	command: string;
	args: string[];
}

export interface SshHostEntry {
	alias: string;
	hostname?: string;
	user?: string;
	port?: number;
	identity_file?: string;
}

export interface Keybindings {
	new_tab: string;
	close_pane: string;
	split_right: string;
	split_down: string;
	quick_connect: string;
	open_settings: string;
}

export interface Settings {
	theme: string;
	font_family: string;
	font_size: number;
	line_height: number;
	cursor_style: 'block' | 'underline' | 'bar';
	cursor_blink: boolean;
	background_opacity: number;
	scrollback: number;
	copy_on_select: boolean;
	right_click_paste: boolean;
	bell_style: 'none' | 'visual' | 'sound';
	confirm_close: boolean;
	profiles: ShellProfile[];
	ssh_profiles: SshProfile[];
	default_profile_id: string;
	keybindings: Keybindings;
}

/** A fully-resolved command to run in a PTY — what a tab/pane actually spawns. */
export interface SpawnSpec {
	command: string;
	args: string[];
	cwd?: string;
	env?: Record<string, string>;
	closeOnExit?: boolean;
	icon?: string;
	color?: string;
}

export type SplitDirection = 'row' | 'column';

export interface LeafPane {
	kind: 'leaf';
	id: string;
	sessionId: string;
	title: string;
	spawn: SpawnSpec;
}

export interface SplitPane {
	kind: 'split';
	id: string;
	direction: SplitDirection;
	children: PaneNode[];
	sizes: number[];
}

export type PaneNode = LeafPane | SplitPane;

export interface TerminalTab {
	id: string;
	title: string;
	root: PaneNode;
	activePaneId: string;
}
