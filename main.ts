import {App, debounce, Notice, Plugin, WorkspaceLeaf, WorkspaceMobileDrawer, WorkspaceSidedock} from 'obsidian'

const name = 'highlight-active-parent-folders'

const activeClass = 'is-active'
const collapsedClass = 'is-collapsed'

function bail(msg: string): never {
	new Notice(msg)
	throw new Error(msg)
}

export default class HighlightActiveParentFoldersPlugin extends Plugin {
	/**
	 * Used to keep focus when clicking to un-/fold directories in the explorer.
	 */
	blockCounter: number = 0

	/**
	 * Load the app. Called on startup or when enabling the plugin.
	 */
	async onload() {
		// we need to wait until the layout is ready to register our hook
		this.app.workspace.onLayoutReady(() => {
			// register our updater to run on every page change event
			this.registerEvent(
				this.app.workspace.on('active-leaf-change', (leaf) => {
					this.onActiveLeafChange(leaf)
				}),
			)
		})

		console.log(`${name}: plugin loaded`)
	}

	/**
	 * Unload the app. Called when disabling the plugin.
	 */
	onunload() {
		console.log(`${name}: plugin unloaded`)
	}

	onActiveLeafChange(leaf: WorkspaceLeaf | null) {
		console.debug(`${name}: active leaf changed`, leaf)
		// only do anything if we got a leaf and are not already processing one
		if (leaf !== null)
			this.manageSidebarCSS(leaf)
	}

	/**
	 * This sets CSS classes on the parent folders of the last active file and unsets them on the previously highlighted
	 * ones. This happens in two steps:
	 *
	 * 1. Reset all folders that are active, but not in the set of parent folders.
	 * 2. Set all parent folders of the current file.
	 *
	 * We set the following CSS classes:
	 *
	 * 1. "is-active" on the folder title if active.
	 * 2. "is-collapsed" on the folder container if inactive.
	 *
	 * @param {WorkspaceLeaf} leaf - The leaf that was changed to.
	 */
	manageSidebarCSS(leaf: WorkspaceLeaf) {
		// get the sidebar element, the explorer view, and the current file
		const sidebar = this.app.workspace.leftSplit
		const explorer = this.app.workspace.getLeavesOfType('file-explorer').first()
			?? bail('')
		const filePath = this.app.workspace.getActiveFile()?.path ?? ''


		// TODO: we should also bail if the explorer is not visible
		// this.app.workspace.revealLeaf(explorer)
		// this.app.workspace.setActiveLeaf(explorer, {focus: false})
		// console.log(explorer.view.getState())

		// if the sidebar is closed, there's nothing we have to do
		if (sidebar.collapsed)
			return

		// @ts-ignore
		const container: Element = sidebar.containerEl
			?? bail(`${name}: couldn't find the sidebar container`)
		console.debug('container', container)

		// const root = container.querySelector(`div.mod-root.${folderClass}`)
		// 	?? bail(`${name}: couldn't find the file explorer root`)
		// console.debug('root', root)

		// get all folder title elements that should be active
		// by successively narrowing them down (following the path)
		const parentDirTitles: Set<Element> = new Set()
		let searchSpace = container
		const parts = filePath.split('/')
		for (const part of parts) {
			// exact is to find the first folder, and the slashes afterwards avoid shared suffixes
			console.debug(part)
			let next = searchSpace.querySelector(`div[data-path="${part}"]`)  // we try matching exactly
				?? searchSpace.querySelector(`div[data-path$="/${part}"]`)  // or match the end with a preceding slash
				?? bail(`${name}: couldn't find open folder in the file explorer`)
			console.debug(next)

			// add the element, narrow down the selection, and move on
			parentDirTitles.add(next)
			searchSpace = next.parentElement ?? bail(`${name}: couldn't narrow down the search space in the explorer`)
		}

		// TODO: scroll into view and unfold
		// remember the folder with the deepest nesting, so we can scroll there later
		const deepestFolder = searchSpace

		// TODO: do this via previous files with this.app.workspace.getLastOpenFiles()
		// deactivate all active elements not in our set
		for (const activeTitle of container.querySelectorAll(`div.${activeClass}`)) {
			if (!parentDirTitles.has(activeTitle)) {
				activeTitle.removeClass(activeClass)
				activeTitle.parentElement?.addClass(collapsedClass)  // TODO: this should be controlled by a setting
			} else  // if it IS in our set but already active we can just drop it
				parentDirTitles.delete(activeTitle)
		}
	}
}
