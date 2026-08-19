import { invoke } from '@tauri-apps/api/core';
import type { ShellProfile, SshHostEntry, SshProfile, SpawnSpec } from './types';

export interface ConnectionTarget {
	label: string;
	subtitle?: string;
	group: string;
	icon: 'terminal' | 'ssh';
	spawn: SpawnSpec;
}

export function fromShellProfile(profile: ShellProfile): ConnectionTarget {
	return {
		label: profile.name,
		subtitle: profile.command,
		group: profile.group ?? 'Local',
		icon: 'terminal',
		spawn: { command: profile.command, args: profile.args, cwd: profile.cwd }
	};
}

export function fromSshProfile(profile: SshProfile): ConnectionTarget {
	const address = profile.user ? `${profile.user}@${profile.host}` : profile.host;
	const args = ['-p', String(profile.port ?? 22), address];
	if (profile.identity_file) args.push('-i', profile.identity_file);
	if (profile.agent_forwarding) args.push('-A');
	return {
		label: profile.name,
		subtitle: address,
		group: profile.group ?? 'SSH',
		icon: 'ssh',
		spawn: { command: 'ssh', args }
	};
}

export function fromSshConfigHost(host: SshHostEntry): ConnectionTarget {
	return {
		label: host.alias,
		subtitle: [host.user, host.hostname].filter(Boolean).join('@') || undefined,
		group: 'SSH Config (~/.ssh/config)',
		// Let the system ssh client resolve the alias — it already reads
		// this file, including options we don't parse (ProxyJump, Include...).
		icon: 'ssh',
		spawn: { command: 'ssh', args: [host.alias] }
	};
}

export function fromAddress(address: string): ConnectionTarget {
	return {
		label: address,
		group: 'Quick Connect',
		icon: 'ssh',
		spawn: { command: 'ssh', args: [address] }
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
