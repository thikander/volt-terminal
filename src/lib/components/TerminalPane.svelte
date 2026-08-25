<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
	import { Terminal } from '@xterm/xterm';
	import { FitAddon } from '@xterm/addon-fit';
	import { WebLinksAddon } from '@xterm/addon-web-links';
	import '@xterm/xterm/css/xterm.css';
	import { ptyBridge } from '../pty-bridge';
	import { settingsStore } from '../stores/settings.svelte';
	import { workspace } from '../stores/workspace.svelte';
	import { themeWithOpacity } from '../theme';
	import type { LeafPane } from '../types';

	let { tabId, pane, active }: { tabId: string; pane: LeafPane; active: boolean } = $props();

	let wrapper: HTMLDivElement;
	let container: HTMLDivElement;
	let term: Terminal;
	let fitAddon: FitAddon;
	let resizeObserver: ResizeObserver;

	onMount(async () => {
		const settings = settingsStore.current;
		term = new Terminal({
			fontFamily: settings.font_family,
			fontSize: settings.font_size,
			lineHeight: settings.line_height,
			cursorStyle: settings.cursor_style,
			cursorBlink: settings.cursor_blink,
			scrollback: settings.scrollback,
			rightClickSelectsWord: !settings.right_click_paste,
			theme: themeWithOpacity(settings.background_opacity),
			allowProposedApi: true
		});
		fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		term.loadAddon(new WebLinksAddon());
		term.open(container);
		fitAddon.fit();

		const sessionId = await ptyBridge.spawn(pane.spawn, term.cols, term.rows);
		workspace.setPaneSession(tabId, pane.id, sessionId);

		ptyBridge.onOutput(sessionId, (data) => term.write(data));
		ptyBridge.onExit(sessionId, () => {
			if (pane.spawn.closeOnExit) {
				workspace.closePane(tabId, pane.id);
			} else {
				term.write('\r\n\x1b[90m[process exited]\x1b[0m\r\n');
			}
		});

		term.onData((data) => ptyBridge.write(sessionId, data));
		term.onResize(({ cols, rows }) => ptyBridge.resize(sessionId, cols, rows));

		if (settings.copy_on_select) {
			term.onSelectionChange(() => {
				const selection = term.getSelection();
				if (selection) void writeText(selection);
			});
		}

		if (settings.right_click_paste) {
			wrapper.addEventListener('contextmenu', async (e) => {
				e.preventDefault();
				const text = await readText().catch(() => '');
				if (text) ptyBridge.write(sessionId, text);
			});
		}

		resizeObserver = new ResizeObserver(() => fitAddon.fit());
		resizeObserver.observe(wrapper);

		if (active) term.focus();
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		term?.dispose();
	});

	$effect(() => {
		if (active) term?.focus();
	});

	export function fit() {
		fitAddon?.fit();
	}
</script>

<div
	class="terminal-pane"
	class:active
	style:border-color={active ? (pane.spawn.color ?? 'var(--accent)') : undefined}
	bind:this={wrapper}
	onmousedown={() => workspace.setActivePane(tabId, pane.id)}
	role="presentation"
>
	<div class="terminal-inner" bind:this={container}></div>
</div>

<style>
	.terminal-pane {
		width: 100%;
		height: 100%;
		padding: 6px 0 0 8px;
		box-sizing: border-box;
		overflow: hidden;
		border: 1px solid transparent;
	}

	.terminal-pane.active {
		border-color: var(--accent);
	}

	/* xterm attaches here, not on .terminal-pane directly: FitAddon measures
	   this element's own clientWidth, so it must have no padding of its own
	   or it miscounts columns by the padding amount and the overflow gets
	   clipped at the edge. */
	.terminal-inner {
		width: 100%;
		height: 100%;
	}

	.terminal-inner :global(.xterm) {
		height: 100%;
	}
</style>
