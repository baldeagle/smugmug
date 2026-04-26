import { renderers } from './renderers.mjs';
import { s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_CvSoi7hX.mjs';
import { manifest } from './manifest_WbkZZWQY.mjs';
import { createExports } from '@astrojs/netlify/ssr-function.js';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/admin.astro.mjs');
const _page2 = () => import('./pages/api/delete/_key_.astro.mjs');
const _page3 = () => import('./pages/api/highlights.astro.mjs');
const _page4 = () => import('./pages/api/login.astro.mjs');
const _page5 = () => import('./pages/api/metrics.astro.mjs');
const _page6 = () => import('./pages/api/photo/_key_.astro.mjs');
const _page7 = () => import('./pages/api/photo-page.astro.mjs');
const _page8 = () => import('./pages/api/photos.astro.mjs');
const _page9 = () => import('./pages/api/star/_key_.astro.mjs');
const _page10 = () => import('./pages/api/stars.astro.mjs');
const _page11 = () => import('./pages/api/thumb/_key_.astro.mjs');
const _page12 = () => import('./pages/api/upload.astro.mjs');
const _page13 = () => import('./pages/highlights.astro.mjs');
const _page14 = () => import('./pages/photo/_key_.astro.mjs');
const _page15 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/admin.astro", _page1],
    ["src/pages/api/delete/[key].ts", _page2],
    ["src/pages/api/highlights.ts", _page3],
    ["src/pages/api/login.ts", _page4],
    ["src/pages/api/metrics.ts", _page5],
    ["src/pages/api/photo/[key].ts", _page6],
    ["src/pages/api/photo-page.ts", _page7],
    ["src/pages/api/photos.ts", _page8],
    ["src/pages/api/star/[key].ts", _page9],
    ["src/pages/api/stars.ts", _page10],
    ["src/pages/api/thumb/[key].ts", _page11],
    ["src/pages/api/upload.ts", _page12],
    ["src/pages/highlights.astro", _page13],
    ["src/pages/photo/[key].astro", _page14],
    ["src/pages/index.astro", _page15]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./noop-entrypoint.mjs'),
    middleware: () => import('./_noop-middleware.mjs')
});
const _args = {
    "middlewareSecret": "31acba76-44d0-48bf-ad41-8944eda5cec4"
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start)) {
	serverEntrypointModule[_start](_manifest, _args);
}

export { __astrojsSsrVirtualEntry as default, pageMap };
