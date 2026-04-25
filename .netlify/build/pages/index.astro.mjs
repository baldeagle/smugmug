import { c as createComponent, i as renderComponent, r as renderTemplate } from '../chunks/astro/server_DtASbT4X.mjs';
import 'piccolore';
import { $ as $$BaseLayout } from '../chunks/BaseLayout_DTKES44d.mjs';
import { jsx, jsxs } from 'react/jsx-runtime';
import { useState, useRef, useEffect, useCallback } from 'react';
/* empty css                                 */
export { renderers } from '../renderers.mjs';

function GalleryApp() {
  const [photos, setPhotos] = useState([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [showThumbs, setShowThumbs] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const autoPlayRef = useRef(null);
  const slideRef = useRef(null);
  useEffect(() => {
    fetch("/api/photos").then((r) => r.json()).then((data) => {
      setPhotos(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  const goNext = useCallback(() => {
    setCurrent((i) => (i + 1) % photos.length);
  }, [photos.length]);
  const goPrev = useCallback(() => {
    setCurrent((i) => (i - 1 + photos.length) % photos.length);
  }, [photos.length]);
  useEffect(() => {
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    if (autoPlay && photos.length > 1) {
      autoPlayRef.current = setTimeout(goNext, 5e3);
    }
    return () => {
      if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    };
  }, [autoPlay, current, photos.length, goNext]);
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") setFullscreen(false);
      else if (e.key === "f") setFullscreen((f) => !f);
      else if (e.key === "t") setShowThumbs((t) => !t);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);
  const downloadCurrent = () => {
    if (photos.length === 0) return;
    const photo2 = photos[current];
    const link = document.createElement("a");
    link.href = `/api/photo/${encodeURIComponent(photo2.key)}?download=1`;
    link.download = photo2.filename;
    link.click();
  };
  const toggleFullscreen = () => {
    if (!fullscreen && slideRef.current) {
      slideRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setFullscreen(!fullscreen);
  };
  if (loading) {
    return /* @__PURE__ */ jsx("div", { className: "gallery-loading", children: "Loading gallery..." });
  }
  if (photos.length === 0) {
    return /* @__PURE__ */ jsxs("div", { className: "gallery-empty", children: [
      /* @__PURE__ */ jsx("h2", { children: "No photos yet" }),
      /* @__PURE__ */ jsxs("p", { children: [
        "Visit the ",
        /* @__PURE__ */ jsx("a", { href: "/admin", children: "admin page" }),
        " to upload photos."
      ] })
    ] });
  }
  const photo = photos[current];
  return /* @__PURE__ */ jsxs("div", { className: `gallery ${fullscreen ? "fullscreen" : ""}`, ref: slideRef, children: [
    /* @__PURE__ */ jsxs("div", { className: "slide-container", children: [
      /* @__PURE__ */ jsx(
        "img",
        {
          src: `/api/photo/${encodeURIComponent(photo.key)}`,
          alt: photo.filename,
          className: "slide-image"
        },
        photo.key
      ),
      /* @__PURE__ */ jsx("button", { className: "slide-nav slide-prev", onClick: goPrev, "aria-label": "Previous", children: "‹" }),
      /* @__PURE__ */ jsx("button", { className: "slide-nav slide-next", onClick: goNext, "aria-label": "Next", children: "›" }),
      /* @__PURE__ */ jsxs("div", { className: "slide-controls", children: [
        /* @__PURE__ */ jsxs("span", { className: "slide-counter", children: [
          current + 1,
          " / ",
          photos.length
        ] }),
        /* @__PURE__ */ jsx("span", { className: "slide-filename", children: photo.filename }),
        /* @__PURE__ */ jsxs("div", { className: "slide-actions", children: [
          /* @__PURE__ */ jsx("button", { className: "btn-ghost btn-icon", onClick: () => setAutoPlay(!autoPlay), title: autoPlay ? "Pause" : "Auto-play", children: autoPlay ? "⏸" : "▶" }),
          /* @__PURE__ */ jsx("button", { className: "btn-ghost btn-icon", onClick: toggleFullscreen, title: "Fullscreen (F)", children: "⛶" }),
          /* @__PURE__ */ jsx("button", { className: "btn-ghost btn-icon", onClick: downloadCurrent, title: "Download", children: "⬇" })
        ] })
      ] })
    ] }),
    showThumbs && photos.length > 1 && /* @__PURE__ */ jsx("div", { className: "thumb-strip", children: photos.map((p, i) => /* @__PURE__ */ jsx(
      "button",
      {
        className: `thumb ${i === current ? "active" : ""}`,
        onClick: () => setCurrent(i),
        children: /* @__PURE__ */ jsx("img", { src: `/api/photo/${encodeURIComponent(p.key)}`, alt: p.filename, loading: "lazy" })
      },
      p.key
    )) })
  ] });
}

const $$Index = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Gallery", "description": "Photo gallery" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "GalleryApp", GalleryApp, { "client:load": true, "client:component-hydration": "load", "client:component-path": "C:/Users/andyb/Documents/GitHub/smugmug/src/components/GalleryApp", "client:component-export": "default" })} ` })} `;
}, "C:/Users/andyb/Documents/GitHub/smugmug/src/pages/index.astro", void 0);

const $$file = "C:/Users/andyb/Documents/GitHub/smugmug/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
