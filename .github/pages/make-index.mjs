// Renders the built workbench.html into the static GitHub Pages site.
// Usage: node make-index.mjs <vscode-web dir> <base path, e.g. /vscode or empty> <commit> <owner/repo>
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [dir, base = '', commit = '', repo = ''] = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url));
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

// Reads the remote target at runtime so no host or secret is ever baked into the public page.
// The token arrives in the URL fragment (never sent to a server), is kept for the tab session, and is removed from the address bar.
const runtimeRemote = `<script>
(function () {
	var el = document.getElementById('vscode-workbench-web-configuration');
	var cfg = JSON.parse(el.getAttribute('data-settings'));
	var remote, tkn;
	try {
		var p = new URLSearchParams(location.hash.slice(1));
		if (p.get('remote')) {
			localStorage.setItem('vsw.remote', p.get('remote'));
			if (p.get('tkn')) { sessionStorage.setItem('vsw.tkn', p.get('tkn')); }
			history.replaceState(null, '', location.pathname + location.search);
		}
		remote = localStorage.getItem('vsw.remote');
		tkn = sessionStorage.getItem('vsw.tkn');
	} catch (e) { }
	if (new URLSearchParams(location.search).has('local')) { remote = undefined; }
	if (!remote || !tkn) {
		if (!new URLSearchParams(location.search).has('local')) { location.replace('${base}/connect.html'); }
		return;
	}
	cfg.remoteAuthority = remote;
	cfg.connectionToken = tkn;
	el.setAttribute('data-settings', JSON.stringify(cfg));
})();
</script>`;

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
html = html.replace('<!-- Workbench Auth Session -->', runtimeRemote + '\n\t\t<!-- Workbench Auth Session -->');
writeFileSync(join(dir, 'index.html'), html);
writeFileSync(join(dir, '.nojekyll'), '');

const fill = s => s.replaceAll('@OWNER@', repo.split('/')[0].toLowerCase()).replaceAll('@COMMIT@', commit).replaceAll('@REPO@', repo).replaceAll('@BASE@', base);
writeFileSync(join(dir, 'connect.html'), fill(readFileSync(join(here, 'connect.html'), 'utf8')));
writeFileSync(join(dir, 'install-server.sh'), fill(readFileSync(join(here, 'install-server.sh'), 'utf8')));
chmodSync(join(dir, 'install-server.sh'), 0o755);
