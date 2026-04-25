import { c as createComponent, e as addAttribute, j as renderHead, k as renderSlot, r as renderTemplate, f as createAstro } from './astro/server_DtASbT4X.mjs';
import 'piccolore';
import 'clsx';
/* empty css                         */

const $$Astro = createAstro();
const $$BaseLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$BaseLayout;
  const { title, description = "Photo gallery" } = Astro2.props;
  return renderTemplate`<html lang="en" data-astro-cid-37fxchfa> <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description"${addAttribute(description, "content")}><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="stylesheet" href="/global.css"><title>${title}</title>${renderHead()}</head> <body data-astro-cid-37fxchfa> <nav class="nav" data-astro-cid-37fxchfa> <div class="nav-inner" data-astro-cid-37fxchfa> <a href="/" class="nav-brand" data-astro-cid-37fxchfa>PhotoGallery</a> <div class="nav-links" data-astro-cid-37fxchfa> <a href="/" data-astro-cid-37fxchfa>Gallery</a> <a href="/admin" data-astro-cid-37fxchfa>Admin</a> </div> </div> </nav> <main class="main" data-astro-cid-37fxchfa> ${renderSlot($$result, $$slots["default"])} </main> </body></html>`;
}, "C:/Users/andyb/Documents/GitHub/smugmug/src/layouts/BaseLayout.astro", void 0);

export { $$BaseLayout as $ };
