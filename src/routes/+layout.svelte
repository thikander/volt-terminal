<script lang="ts">
	let { children } = $props();
</script>

{@render children()}

<style>
	:global(:root) {
		--bg: #0b0d11;
		--surface: #14161c;
		--border: #262a33;
		--text: #d6dae3;
		--text-dim: #8890a0;
		--accent: #4da6ff;
	}

	:global(html, body) {
		margin: 0;
		height: 100%;
		background: var(--bg);
		color: var(--text);
		font-family:
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
		overflow: hidden;
	}

	:global(*) {
		box-sizing: border-box;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}

	:global(*::-webkit-scrollbar) {
		width: 8px;
		height: 8px;
	}

	:global(*::-webkit-scrollbar-track) {
		background: transparent;
	}

	:global(*::-webkit-scrollbar-thumb) {
		background: var(--border);
		border-radius: 4px;
	}

	:global(*::-webkit-scrollbar-thumb:hover) {
		background: var(--text-dim);
	}

	:global(button) {
		font-family: inherit;
	}
</style>
