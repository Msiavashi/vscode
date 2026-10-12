// Renders the built workbench.html into a static index.html for GitHub Pages.
// Usage: node make-index.mjs <vscode-web dir> <base path, e.g. /vscode or empty>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, base = ''] = process.argv.slice(2);
const asAttr = obj => JSON.stringify(obj).replace(/"/g, '&quot;');

const config = {
	enableWorkspaceTrust: true,
	productConfiguration: {
		nameShort: 'VS Code Web',
		extensionsGallery: {
			serviceUrl: 'https://open-vsx.org/vscode/gallery',
			itemUrl: 'https://open-vsx.org/vscode/item',
			resourceUrlTemplate: 'https://open-vsx.org/vscode/unpkg/{publisher}/{name}/{version}/{path}',
			controlUrl: '',
			nlsBaseUrl: ''
		}
	},
	callbackRoute: `${base}/out/vs/code/browser/workbench/callback.html`
};

const values = {
	WORKBENCH_WEB_CONFIGURATION: asAttr(config),
	WORKBENCH_AUTH_SESSION: '',
	WORKBENCH_WEB_BASE_URL: base,
	WORKBENCH_NLS_FALLBACK_URL: `${base}/out/nls.messages.js`,
	WORKBENCH_SCRIPT_NONCE: ''
};

let html = readFileSync(join(dir, 'out/vs/code/browser/workbench/workbench.html'), 'utf8');
html = html.replace(/<script type="module" src="\{\{WORKBENCH_NLS_URL\}\}"><\/script>\s*/, '');
html = html.replace(/ nonce="\{\{WORKBENCH_SCRIPT_NONCE\}\}"/g, '');
html = html.replace(/\{\{(\w+)\}\}/g, (_, k) => {
	if (!(k in values)) { throw new Error(`Unhandled placeholder ${k}`); }
	return values[k];
});
writeFileSync(join(dir, 'index.html'), html);
writeFileSync(join(dir, '.nojekyll'), '');
