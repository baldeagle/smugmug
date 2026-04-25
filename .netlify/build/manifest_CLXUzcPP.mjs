import '@astrojs/internal-helpers/path';
import '@astrojs/internal-helpers/remote';
import 'piccolore';
import { l as NOOP_MIDDLEWARE_HEADER, n as decodeKey } from './chunks/astro/server_DtASbT4X.mjs';
import 'clsx';
import 'es-module-lexer';
import 'html-escaper';

const NOOP_MIDDLEWARE_FN = async (_ctx, next) => {
  const response = await next();
  response.headers.set(NOOP_MIDDLEWARE_HEADER, "true");
  return response;
};

const codeToStatusMap = {
  // Implemented from IANA HTTP Status Code Registry
  // https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  PROXY_AUTHENTICATION_REQUIRED: 407,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  LENGTH_REQUIRED: 411,
  PRECONDITION_FAILED: 412,
  CONTENT_TOO_LARGE: 413,
  URI_TOO_LONG: 414,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RANGE_NOT_SATISFIABLE: 416,
  EXPECTATION_FAILED: 417,
  MISDIRECTED_REQUEST: 421,
  UNPROCESSABLE_CONTENT: 422,
  LOCKED: 423,
  FAILED_DEPENDENCY: 424,
  TOO_EARLY: 425,
  UPGRADE_REQUIRED: 426,
  PRECONDITION_REQUIRED: 428,
  TOO_MANY_REQUESTS: 429,
  REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
  UNAVAILABLE_FOR_LEGAL_REASONS: 451,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  HTTP_VERSION_NOT_SUPPORTED: 505,
  VARIANT_ALSO_NEGOTIATES: 506,
  INSUFFICIENT_STORAGE: 507,
  LOOP_DETECTED: 508,
  NETWORK_AUTHENTICATION_REQUIRED: 511
};
Object.entries(codeToStatusMap).reduce(
  // reverse the key-value pairs
  (acc, [key, value]) => ({ ...acc, [value]: key }),
  {}
);

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.normalize().replace(/#/g, "%23").replace(/\?/g, "%3F")];
      }
      return [key, value];
    })
  );
}
function getParameter(part, params) {
  if (part.spread) {
    return params[part.content.slice(3)] || "";
  }
  if (part.dynamic) {
    if (!params[part.content]) {
      throw new TypeError(`Missing parameter: ${part.content}`);
    }
    return params[part.content];
  }
  return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]");
}
function getSegment(segment, params) {
  const segmentPath = segment.map((part) => getParameter(part, params)).join("");
  return segmentPath ? "/" + segmentPath : "";
}
function getRouteGenerator(segments, addTrailingSlash) {
  return (params) => {
    const sanitizedParams = sanitizeParams(params);
    let trailing = "";
    if (addTrailingSlash === "always" && segments.length) {
      trailing = "/";
    }
    const path = segments.map((segment) => getSegment(segment, sanitizedParams)).join("") + trailing;
    return path || "/";
  };
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    }),
    isIndex: rawRouteData.isIndex,
    origin: rawRouteData.origin
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const inlinedScripts = new Map(serializedManifest.inlinedScripts);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  const serverIslandNameMap = new Map(serializedManifest.serverIslandNameMap);
  const key = decodeKey(serializedManifest.key);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware() {
      return { onRequest: NOOP_MIDDLEWARE_FN };
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes,
    serverIslandNameMap,
    key
  };
}

const manifest = deserializeManifest({"hrefRoot":"file:///C:/Users/andyb/Documents/GitHub/smugmug2/","cacheDir":"file:///C:/Users/andyb/Documents/GitHub/smugmug2/node_modules/.astro/","outDir":"file:///C:/Users/andyb/Documents/GitHub/smugmug2/dist/","srcDir":"file:///C:/Users/andyb/Documents/GitHub/smugmug2/src/","publicDir":"file:///C:/Users/andyb/Documents/GitHub/smugmug2/public/","buildClientDir":"file:///C:/Users/andyb/Documents/GitHub/smugmug2/dist/","buildServerDir":"file:///C:/Users/andyb/Documents/GitHub/smugmug2/.netlify/build/","adapterName":"@astrojs/netlify","routes":[{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"page","component":"_server-islands.astro","params":["name"],"segments":[[{"content":"_server-islands","dynamic":false,"spread":false}],[{"content":"name","dynamic":true,"spread":false}]],"pattern":"^\\/_server-islands\\/([^/]+?)\\/?$","prerender":false,"isIndex":false,"fallbackRoutes":[],"route":"/_server-islands/[name]","origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image\\/?$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro/dist/assets/endpoint/generic.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"inline","content":".nav[data-astro-cid-37fxchfa]{background:var(--bg-card);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100}.nav-inner[data-astro-cid-37fxchfa]{max-width:1400px;margin:0 auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;height:56px}.nav-brand[data-astro-cid-37fxchfa]{font-size:18px;font-weight:700;color:var(--text)}.nav-brand[data-astro-cid-37fxchfa]:hover{color:var(--accent)}.nav-links[data-astro-cid-37fxchfa]{display:flex;gap:20px}.nav-links[data-astro-cid-37fxchfa] a[data-astro-cid-37fxchfa]{font-size:14px;color:var(--text-muted);transition:color .15s}.nav-links[data-astro-cid-37fxchfa] a[data-astro-cid-37fxchfa]:hover{color:var(--text)}.main[data-astro-cid-37fxchfa]{max-width:1400px;margin:0 auto;padding:24px}\n.login-container{display:flex;align-items:center;justify-content:center;min-height:calc(100vh - 200px)}.login-card{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:32px;width:100%;max-width:380px}.login-card h1{font-size:22px;margin-bottom:8px}.login-card p{color:var(--text-muted);font-size:14px;margin-bottom:20px}.admin-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}.admin-header h1{font-size:22px}.upload-zone{border:2px dashed var(--border);border-radius:12px;padding:40px;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:24px}.upload-zone:hover,.upload-zone.drag-over{border-color:var(--accent);background:#3b82f60d}.upload-zone-content p{margin:4px 0}.upload-icon{font-size:36px;color:var(--accent);font-weight:300}.upload-hint{font-size:13px;color:var(--text-muted)}.photo-grid-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.photo-grid-header h2{font-size:16px}.empty-state{text-align:center;padding:40px;color:var(--text-muted)}.admin-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}.admin-photo-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column}.admin-photo-thumb{aspect-ratio:4/3;overflow:hidden;background:#111}.admin-photo-thumb img{width:100%;height:100%;object-fit:cover}.admin-photo-info{padding:8px 10px;display:flex;flex-direction:column;gap:2px;flex:1}.photo-name{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.photo-meta{font-size:11px;color:var(--text-muted)}.admin-photo-card .btn-sm{margin:0 8px 8px;padding:4px 10px;font-size:11px;align-self:flex-start}\n"}],"routeData":{"route":"/admin","isIndex":false,"type":"page","pattern":"^\\/admin\\/?$","segments":[[{"content":"admin","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/admin.astro","pathname":"/admin","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/delete/[key]","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/delete\\/([^/]+?)\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"delete","dynamic":false,"spread":false}],[{"content":"key","dynamic":true,"spread":false}]],"params":["key"],"component":"src/pages/api/delete/[key].ts","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/login","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/login\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"login","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/login.ts","pathname":"/api/login","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/photo/[key]","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/photo\\/([^/]+?)\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"photo","dynamic":false,"spread":false}],[{"content":"key","dynamic":true,"spread":false}]],"params":["key"],"component":"src/pages/api/photo/[key].ts","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/photos","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/photos\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"photos","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/photos.ts","pathname":"/api/photos","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/upload","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/upload\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"upload","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/upload.ts","pathname":"/api/upload","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"inline","content":".nav[data-astro-cid-37fxchfa]{background:var(--bg-card);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100}.nav-inner[data-astro-cid-37fxchfa]{max-width:1400px;margin:0 auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;height:56px}.nav-brand[data-astro-cid-37fxchfa]{font-size:18px;font-weight:700;color:var(--text)}.nav-brand[data-astro-cid-37fxchfa]:hover{color:var(--accent)}.nav-links[data-astro-cid-37fxchfa]{display:flex;gap:20px}.nav-links[data-astro-cid-37fxchfa] a[data-astro-cid-37fxchfa]{font-size:14px;color:var(--text-muted);transition:color .15s}.nav-links[data-astro-cid-37fxchfa] a[data-astro-cid-37fxchfa]:hover{color:var(--text)}.main[data-astro-cid-37fxchfa]{max-width:1400px;margin:0 auto;padding:24px}\n.gallery{display:flex;flex-direction:column;gap:12px;height:calc(100vh - 104px)}.gallery.fullscreen{position:fixed;inset:0;z-index:1000;background:#000;padding:0;margin:0;height:100vh}.gallery-loading,.gallery-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:calc(100vh - 200px);color:var(--text-muted);gap:8px}.slide-container{position:relative;flex:1;display:flex;align-items:center;justify-content:center;background:#000;border-radius:var(--radius);overflow:hidden;min-height:0}.slide-image{max-width:100%;max-height:100%;object-fit:contain;user-select:none}.slide-nav{position:absolute;top:50%;transform:translateY(-50%);background:#00000080;color:#fff;border:none;font-size:32px;width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;padding:0;line-height:1}.slide-nav:hover{background:#000c}.slide-prev{left:12px}.slide-next{right:12px}.slide-controls{position:absolute;bottom:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:linear-gradient(transparent,#000000b3);color:#fff;font-size:13px}.slide-counter{opacity:.8;min-width:60px}.slide-filename{opacity:.6;font-size:12px}.slide-actions{display:flex;gap:6px}.btn-icon{width:36px;height:36px;padding:0;display:flex;align-items:center;justify-content:center;font-size:16px;border-radius:50%;color:#fff;border-color:#ffffff4d}.thumb-strip{display:flex;gap:6px;overflow-x:auto;padding:4px 0;flex-shrink:0}.thumb{flex-shrink:0;width:64px;height:64px;border:2px solid transparent;border-radius:6px;overflow:hidden;cursor:pointer;padding:0;background:none;transition:border-color .15s}.thumb:hover{border-color:var(--text-muted)}.thumb.active{border-color:var(--accent)}.thumb img{width:100%;height:100%;object-fit:cover}@media(max-width:640px){.slide-controls{flex-wrap:wrap;gap:4px}.slide-filename{order:3;width:100%;text-align:center}.thumb{width:48px;height:48px}}\n"}],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}}],"base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["C:/Users/andyb/Documents/GitHub/smugmug2/src/pages/admin.astro",{"propagation":"none","containsHead":true}],["C:/Users/andyb/Documents/GitHub/smugmug2/src/pages/index.astro",{"propagation":"none","containsHead":true}]],"renderers":[],"clientDirectives":[["idle","(()=>{var l=(n,t)=>{let i=async()=>{await(await n())()},e=typeof t.value==\"object\"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};\"requestIdleCallback\"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var n=(a,t)=>{let i=async()=>{await(await a())()};if(t.value){let e=matchMedia(t.value);e.matches?i():e.addEventListener(\"change\",i,{once:!0})}};(self.Astro||(self.Astro={})).media=n;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var a=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let l of e)if(l.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=a;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000noop-middleware":"_noop-middleware.mjs","\u0000virtual:astro:actions/noop-entrypoint":"noop-entrypoint.mjs","\u0000@astro-page:node_modules/astro/dist/assets/endpoint/generic@_@js":"pages/_image.astro.mjs","\u0000@astro-page:src/pages/admin@_@astro":"pages/admin.astro.mjs","\u0000@astro-page:src/pages/api/delete/[key]@_@ts":"pages/api/delete/_key_.astro.mjs","\u0000@astro-page:src/pages/api/login@_@ts":"pages/api/login.astro.mjs","\u0000@astro-page:src/pages/api/photo/[key]@_@ts":"pages/api/photo/_key_.astro.mjs","\u0000@astro-page:src/pages/api/photos@_@ts":"pages/api/photos.astro.mjs","\u0000@astro-page:src/pages/api/upload@_@ts":"pages/api/upload.astro.mjs","\u0000@astro-page:src/pages/index@_@astro":"pages/index.astro.mjs","\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000@astrojs-ssr-adapter":"_@astrojs-ssr-adapter.mjs","\u0000@astrojs-manifest":"manifest_CLXUzcPP.mjs","C:/Users/andyb/Documents/GitHub/smugmug2/node_modules/unstorage/drivers/netlify-blobs.mjs":"chunks/netlify-blobs_DM36vZAS.mjs","C:/Users/andyb/Documents/GitHub/smugmug2/src/components/AdminApp":"_astro/AdminApp.BYrt6hf-.js","C:/Users/andyb/Documents/GitHub/smugmug2/src/components/GalleryApp":"_astro/GalleryApp.5tFxa7Tp.js","@astrojs/react/client.js":"_astro/client.DYKcjN1Z.js","astro:scripts/before-hydration.js":""},"inlinedScripts":[],"assets":["/favicon.svg","/global.css","/_astro/AdminApp.BYrt6hf-.js","/_astro/client.DYKcjN1Z.js","/_astro/GalleryApp.5tFxa7Tp.js","/_astro/index.CdJzaNS0.js","/_astro/jsx-runtime.D_zvdyIk.js"],"buildFormat":"directory","checkOrigin":true,"allowedDomains":[],"actionBodySizeLimit":1048576,"serverIslandNameMap":[],"key":"MAYkMTZ00Oi2SZpJ/4ik7/fFvGGVj7+cbSsIYxGxWkI=","sessionConfig":{"driver":"netlify-blobs","options":{"name":"astro-sessions","consistency":"strong"}}});
if (manifest.sessionConfig) manifest.sessionConfig.driverModule = () => import('./chunks/netlify-blobs_DM36vZAS.mjs');

export { manifest };
