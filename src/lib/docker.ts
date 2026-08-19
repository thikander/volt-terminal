import { ptyBridge } from './pty-bridge';

export type ShellDialect = 'posix' | 'powershell' | 'unsupported';

const COMPOSE_FILENAMES = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];

/**
 * Docker Compose files usually live on whatever machine the shell is
 * actually running on — often a remote server reached over SSH, not the
 * local filesystem. There's no separate file-transfer channel here, so
 * every read/write goes through the same PTY the user is already typing
 * into: we send a real shell command and scrape its output between two
 * unique markers. It's transparent by design — these commands are as
 * visible in the terminal as if the user typed them themselves.
 */
export function detectDialect(spawnCommand: string): ShellDialect {
	const cmd = spawnCommand.toLowerCase();
	if (cmd.includes('pwsh') || cmd.includes('powershell')) return 'powershell';
	if (cmd === 'ssh' || cmd.includes('bash') || cmd.includes('wsl') || cmd.endsWith('sh')) {
		return 'posix';
	}
	return 'unsupported';
}

function marker(tag: string): string {
	return `__VOLT_${tag}_${crypto.randomUUID().replace(/-/g, '')}__`;
}

const ESCAPE_SEQUENCE = /\x1b\[[0-9;]*[a-zA-Z]/g;

/**
 * The command we inject always contains our own marker strings *literally*
 * (they're baked into the command source, e.g. `echo "$endTag"`), and an
 * interactive shell echoes back the command it's running before executing
 * it. So every marker shows up twice in the stream: once as part of the
 * echoed input, once for real as the command's actual output. Naively
 * matching the first occurrence means matching the echo — which is why an
 * earlier version of this always "detected" nothing: the echoed source
 * contains both the found and not-found branches' text, and testing for the
 * not-found marker's mere presence always found the echoed copy of it.
 * The fix: a marker only "counts" once it's occurred twice.
 */
function secondOccurrenceIndex(text: string, marker: string): number {
	const first = text.indexOf(marker);
	if (first === -1) return -1;
	return text.indexOf(marker, first + marker.length);
}

/**
 * Writes `command` into the session as if typed, then collects output
 * until `endMarker` has genuinely completed (see above), stripping ANSI
 * escapes as it goes. Rejects after `timeoutMs` so a wrong shell/dialect
 * guess fails loudly instead of hanging forever.
 */
function runCaptured(
	sessionId: string,
	command: string,
	endMarker: string,
	timeoutMs = 6000
): Promise<string> {
	return new Promise((resolve, reject) => {
		let buffer = '';
		const timer = setTimeout(() => {
			unsubscribe();
			reject(new Error('Timed out waiting for shell output'));
		}, timeoutMs);

		const unsubscribe = ptyBridge.subscribeOutput(sessionId, (data) => {
			buffer += data;
			if (secondOccurrenceIndex(buffer, endMarker) !== -1) {
				clearTimeout(timer);
				unsubscribe();
				resolve(buffer.replace(ESCAPE_SEQUENCE, ''));
			}
		});

		ptyBridge.write(sessionId, command + '\r');
	});
}

export interface ComposeFile {
	filename: string;
	content: string;
}

export async function detectComposeFile(
	sessionId: string,
	dialect: ShellDialect
): Promise<ComposeFile | null> {
	if (dialect === 'unsupported') return null;

	const foundTag = marker('FOUND');
	const notFoundTag = marker('NOTFOUND');
	const endTag = marker('END');

	const command =
		dialect === 'posix'
			? `sh -c 'f=""; for c in ${COMPOSE_FILENAMES.join(' ')}; do [ -f "$c" ] && f="$c" && break; done; if [ -n "$f" ]; then echo "${foundTag}:$f"; cat "$f"; else echo "${notFoundTag}"; fi; echo "${endTag}"'`
			: `$f = @(${COMPOSE_FILENAMES.map((n) => `'${n}'`).join(',')}) | Where-Object { Test-Path $_ } | Select-Object -First 1; if ($f) { Write-Output "${foundTag}:$f"; Get-Content $f -Raw } else { Write-Output "${notFoundTag}" }; Write-Output "${endTag}"`;

	const raw = await runCaptured(sessionId, command, endTag);

	const foundAt = secondOccurrenceIndex(raw, foundTag);
	if (foundAt === -1) return null; // the not-found branch actually ran

	const afterFound = raw.slice(foundAt + foundTag.length + 1); // skip tag + the ':' before the filename
	const newlineIndex = afterFound.indexOf('\n');
	const filename = afterFound.slice(0, newlineIndex).trim();
	const endIndex = afterFound.indexOf(endTag); // only one real occurrence remains past this point
	const content = afterFound.slice(newlineIndex + 1, endIndex === -1 ? undefined : endIndex);

	return { filename, content: content.replace(/\r\n/g, '\n').trim() + '\n' };
}

export async function writeComposeFile(
	sessionId: string,
	dialect: ShellDialect,
	filename: string,
	content: string
): Promise<void> {
	if (dialect === 'unsupported') throw new Error('Unsupported shell');

	const endTag = marker('WRITTEN');
	const heredocTag = `VOLT_EOF_${crypto.randomUUID().replace(/-/g, '')}`;

	const command =
		dialect === 'posix'
			? `cat > '${filename}' << '${heredocTag}'\n${content}\n${heredocTag}\necho "${endTag}"`
			: `@'\n${content}\n'@ | Set-Content -Path '${filename}' -NoNewline; Write-Output "${endTag}"`;

	await runCaptured(sessionId, command, endTag);
}

export function runDockerCommand(sessionId: string, args: string): void {
	ptyBridge.write(sessionId, `docker compose ${args}\r`);
}

export const DOCKER_SHORTCUTS: { label: string; args: string }[] = [
	{ label: 'Up -d', args: 'up -d' },
	{ label: 'Down', args: 'down' },
	{ label: 'Restart', args: 'restart' },
	{ label: 'Build', args: 'build' },
	{ label: 'Pull', args: 'pull' },
	{ label: 'PS', args: 'ps' },
	{ label: 'Logs -f', args: 'logs -f' }
];
