import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export interface ComposeService {
	name: string;
	image: string;
	build: string;
	containerName: string;
	command: string;
	restart: string;
	ports: string[];
	volumes: string[];
	environment: { key: string; value: string }[];
	dependsOn: string[];
}

export interface ComposeModel {
	version: string;
	services: ComposeService[];
}

function toStringArray(value: unknown): string[] {
	if (Array.isArray(value)) return value.map(String);
	if (value && typeof value === 'object') return Object.keys(value);
	return [];
}

function toEnvironment(value: unknown): { key: string; value: string }[] {
	if (Array.isArray(value)) {
		return value.map((entry) => {
			const [key, ...rest] = String(entry).split('=');
			return { key, value: rest.join('=') };
		});
	}
	if (value && typeof value === 'object') {
		return Object.entries(value as Record<string, unknown>).map(([key, v]) => ({
			key,
			value: v == null ? '' : String(v)
		}));
	}
	return [];
}

function toCommandString(value: unknown): string {
	if (Array.isArray(value)) return value.join(' ');
	return value ? String(value) : '';
}

function toBuildString(value: unknown): string {
	if (typeof value === 'string') return value;
	if (value && typeof value === 'object') {
		const b = value as Record<string, unknown>;
		return String(b.context ?? '');
	}
	return '';
}

/** Best-effort normalization — docker-compose allows several equivalent
 * shapes for most fields; editing always converges on one canonical shape
 * (e.g. environment as a list), which is a deliberate simplification, not
 * a full round-trip-preserving YAML editor. */
export function parseCompose(content: string): ComposeModel {
	const doc = (parseYaml(content) ?? {}) as Record<string, unknown>;
	const rawServices = (doc.services ?? {}) as Record<string, Record<string, unknown>>;

	const services: ComposeService[] = Object.entries(rawServices).map(([name, svc]) => ({
		name,
		image: String(svc.image ?? ''),
		build: toBuildString(svc.build),
		containerName: String(svc.container_name ?? ''),
		command: toCommandString(svc.command),
		restart: String(svc.restart ?? ''),
		ports: toStringArray(svc.ports),
		volumes: toStringArray(svc.volumes),
		environment: toEnvironment(svc.environment),
		dependsOn: toStringArray(svc.depends_on)
	}));

	return { version: doc.version ? String(doc.version) : '3.8', services };
}

export function serializeCompose(model: ComposeModel): string {
	const services: Record<string, Record<string, unknown>> = {};

	for (const svc of model.services) {
		const entry: Record<string, unknown> = {};
		if (svc.image) entry.image = svc.image;
		if (svc.build) entry.build = svc.build;
		if (svc.containerName) entry.container_name = svc.containerName;
		if (svc.command) entry.command = svc.command;
		if (svc.restart) entry.restart = svc.restart;
		if (svc.ports.length) entry.ports = svc.ports;
		if (svc.volumes.length) entry.volumes = svc.volumes;
		if (svc.environment.length) {
			entry.environment = svc.environment
				.filter((e) => e.key)
				.map((e) => `${e.key}=${e.value}`);
		}
		if (svc.dependsOn.length) entry.depends_on = svc.dependsOn;
		services[svc.name] = entry;
	}

	return stringifyYaml({ version: model.version, services });
}

export function newService(name: string): ComposeService {
	return {
		name,
		image: '',
		build: '',
		containerName: '',
		command: '',
		restart: 'unless-stopped',
		ports: [],
		volumes: [],
		environment: [],
		dependsOn: []
	};
}
