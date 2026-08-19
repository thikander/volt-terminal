import { invoke } from '@tauri-apps/api/core';
import type { EnvVar, ShellProfile, SshHostEntry, SshProfile, SpawnSpec } from './types';

export interface ConnectionTarget {
	label: string;
	subtitle?: string;
	group: string;
	icon: string;
	color?: string;
	spawn: SpawnSpec;
}

const DEFAULT_TERMINAL_ICON = '›_';
const DEFAULT_SSH_ICON = '⇄';

function envToRecord(env: EnvVar[] | undefined): Record<string, string> | undefined {
	if (!env?.length) return undefined;
	const entries = env.filter((e) => e.key).map((e): [string, string] => [e.key, e.value]);
	return entries.length ? Object.fromEntries(entries) : undefined;
}

export function fromShellProfile(profile: ShellProfile): ConnectionTarget {
	return {
		label: profile.name,
		subtitle: profile.command,
		group: profile.group ?? 'Local',
		icon: profile.icon || DEFAULT_TERMINAL_ICON,
		color: profile.color,
		spawn: {
			command: profile.command,
			args: profile.args,
			cwd: profile.cwd,
			env: envToRecord(profile.env),
			closeOnExit: profile.close_on_exit,
			icon: profile.icon || DEFAULT_TERMINAL_ICON,
			color: profile.color
		}
	};
}

export function fromSshProfile(profile: SshProfile): ConnectionTarget {
	const address = profile.user ? `${profile.user}@${profile.host}` : profile.host;
	const args = ['-p', String(profile.port ?? 22), address];
	if (profile.identity_file) args.push('-i', profile.identity_file);
	if (profile.agent_forwarding) args.push('-A');
	const icon = profile.icon || DEFAULT_SSH_ICON;
	return {
		label: profile.name,
		subtitle: address,
		group: profile.group ?? 'SSH',
		icon,
		color: profile.color,
		spawn: { command: 'ssh', args, closeOnExit: profile.close_on_exit, icon, color: profile.color }
	};
}

export function fromSshConfigHost(host: SshHostEntry): ConnectionTarget {
	return {
		label: host.alias,
		subtitle: [host.user, host.hostname].filter(Boolean).join('@') || undefined,
		group: 'SSH Config (~/.ssh/config)',
		// Let the system ssh client resolve the alias — it already reads
		// this file, including options we don't parse (ProxyJump, Include...).
		icon: DEFAULT_SSH_ICON,
		spawn: { command: 'ssh', args: [host.alias], icon: DEFAULT_SSH_ICON }
	};
}

export function fromAddress(address: string): ConnectionTarget {
	return {
		label: address,
		group: 'Quick Connect',
		icon: DEFAULT_SSH_ICON,
		spawn: { command: 'ssh', args: [address], icon: DEFAULT_SSH_ICON }
	};
}

const ADDRESS_PATTERN = /^[\w.-]+@?[\w.-]*(:\d+)?$/;

export function looksLikeAddress(input: string): boolean {
	return input.includes('@') || (ADDRESS_PATTERN.test(input) && input.includes('.'));
}

export async function listSshConfigHosts(): Promise<SshHostEntry[]> {
	return invoke<SshHostEntry[]>('list_ssh_hosts');
}

/**
 * Turns a `~/.ssh/config` entry into a real saved profile. A config entry
 * only exists on whichever machine has that file — importing it is what
 * makes a connection portable: a saved profile lives in the app's own
 * settings, so it's the thing worth syncing/sharing later (e.g. across a
 * team), not the local config file itself.
 */
export function sshHostToProfile(host: SshHostEntry): SshProfile {
	return {
		id: crypto.randomUUID(),
		name: host.alias,
		group: 'Imported',
		host: host.hostname ?? host.alias,
		port: host.port,
		user: host.user,
		identity_file: host.identity_file,
		agent_forwarding: false
	};
}

const RECENTS_KEY = 'volt-terminal:recent-connections';
const MAX_RECENTS = 8;

export function loadRecents(): ConnectionTarget[] {
	try {
		const raw = localStorage.getItem(RECENTS_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

export function pushRecent(target: ConnectionTarget) {
	const existing = loadRecents().filter((t) => t.label !== target.label);
	const next = [{ ...target, group: 'Recent' }, ...existing].slice(0, MAX_RECENTS);
	localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}
