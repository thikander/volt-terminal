import type { LeafPane, PaneNode, SplitDirection, SpawnSpec, TerminalTab } from '../types';
import { ptyBridge } from '../pty-bridge';

function uid(): string {
	return crypto.randomUUID();
}

function makeLeaf(spawn: SpawnSpec, title: string): LeafPane {
	return { kind: 'leaf', id: uid(), sessionId: '', spawn, title };
}

/** Finds a node and, if found, its parent split + index within that split. */
function locate(
	root: PaneNode,
	id: string,
	parent: PaneNode | null = null
): { node: PaneNode; parent: PaneNode | null; index: number } | null {
	if (root.id === id) return { node: root, parent, index: -1 };
	if (root.kind === 'split') {
		for (let i = 0; i < root.children.length; i++) {
			const found = locate(root.children[i], id, root);
			if (found) return found.parent === root ? { ...found, index: i } : found;
		}
	}
	return null;
}

function collectLeaves(node: PaneNode, out: LeafPane[] = []): LeafPane[] {
	if (node.kind === 'leaf') out.push(node);
	else for (const child of node.children) collectLeaves(child, out);
	return out;
}

class WorkspaceStore {
	tabs = $state<TerminalTab[]>([]);
	activeTabId = $state('');
	private bootstrapped = false;

	get activeTab(): TerminalTab | undefined {
		return this.tabs.find((t) => t.id === this.activeTabId);
	}

	/**
	 * Creates the initial tab exactly once. Guards against Tauri/WebView2
	 * occasionally firing the root component's onMount twice on startup —
	 * a plain `tabs.length === 0` check races across two concurrent async
	 * callers since neither has added a tab yet when the other checks.
	 * This flag flips synchronously with no `await` in between, so the two
	 * calls can't interleave.
	 */
	ensureInitialTab(spawn: SpawnSpec, title: string) {
		if (this.bootstrapped) return;
		this.bootstrapped = true;
		this.newTab(spawn, title);
	}

	newTab(spawn: SpawnSpec, title: string) {
		const leaf = makeLeaf(spawn, title);
		const tab: TerminalTab = { id: uid(), title, root: leaf, activePaneId: leaf.id };
		this.tabs.push(tab);
		this.activeTabId = tab.id;
		return tab;
	}

	closeTab(tabId: string) {
		const tab = this.tabs.find((t) => t.id === tabId);
		if (!tab) return;
		for (const leaf of collectLeaves(tab.root)) {
			if (leaf.sessionId) ptyBridge.close(leaf.sessionId);
		}
		const index = this.tabs.findIndex((t) => t.id === tabId);
		this.tabs.splice(index, 1);
		if (this.activeTabId === tabId) {
			const fallback = this.tabs[index] ?? this.tabs[index - 1];
			this.activeTabId = fallback?.id ?? '';
		}
	}

	setActiveTab(tabId: string) {
		this.activeTabId = tabId;
	}

	setActivePane(tabId: string, paneId: string) {
		const tab = this.tabs.find((t) => t.id === tabId);
		if (tab) tab.activePaneId = paneId;
	}

	setPaneSession(tabId: string, paneId: string, sessionId: string) {
		const tab = this.tabs.find((t) => t.id === tabId);
		if (!tab) return;
		const found = locate(tab.root, paneId);
		if (found && found.node.kind === 'leaf') found.node.sessionId = sessionId;
	}

	renameTab(tabId: string, title: string) {
		const tab = this.tabs.find((t) => t.id === tabId);
		if (tab) tab.title = title;
	}

	splitPane(tabId: string, paneId: string, direction: SplitDirection, spawn: SpawnSpec) {
		const tab = this.tabs.find((t) => t.id === tabId);
		if (!tab) return;

		const newLeaf = makeLeaf(spawn, 'Terminal');

		if (tab.root.id === paneId) {
			tab.root = {
				kind: 'split',
				id: uid(),
				direction,
				children: [tab.root, newLeaf],
				sizes: [50, 50]
			};
			tab.activePaneId = newLeaf.id;
			return;
		}

		const found = locate(tab.root, paneId);
		if (!found || !found.parent || found.parent.kind !== 'split') return;
		const parent = found.parent;

		if (parent.direction === direction) {
			parent.children.splice(found.index + 1, 0, newLeaf);
			parent.sizes = parent.children.map(() => 100 / parent.children.length);
		} else {
			const wrapped: PaneNode = {
				kind: 'split',
				id: uid(),
				direction,
				children: [found.node, newLeaf],
				sizes: [50, 50]
			};
			parent.children[found.index] = wrapped;
		}
		tab.activePaneId = newLeaf.id;
	}

	closePane(tabId: string, paneId: string) {
		const tab = this.tabs.find((t) => t.id === tabId);
		if (!tab) return;

		const leaf = locate(tab.root, paneId)?.node;
		if (leaf?.kind === 'leaf' && leaf.sessionId) ptyBridge.close(leaf.sessionId);

		if (tab.root.id === paneId) {
			this.closeTab(tabId);
			return;
		}

		const found = locate(tab.root, paneId);
		if (!found || !found.parent || found.parent.kind !== 'split') return;
		const parent = found.parent;
		parent.children.splice(found.index, 1);
		parent.sizes = parent.children.map(() => 100 / parent.children.length);

		// Collapse a split left with a single child back into that child.
		if (parent.children.length === 1) {
			const onlyChild = parent.children[0];
			const grandparent = locate(tab.root, parent.id)?.parent;
			if (!grandparent) {
				tab.root = onlyChild;
			} else if (grandparent.kind === 'split') {
				const idx = grandparent.children.findIndex((c) => c.id === parent.id);
				if (idx !== -1) grandparent.children[idx] = onlyChild;
			}
		}

		const leaves = collectLeaves(tab.root);
		if (!leaves.some((l) => l.id === tab.activePaneId)) {
			tab.activePaneId = leaves[0]?.id ?? '';
		}
	}
}

export const workspace = new WorkspaceStore();
