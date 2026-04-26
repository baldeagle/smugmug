import { c as createComponent, i as renderComponent, r as renderTemplate } from '../chunks/astro/server_DtASbT4X.mjs';
import 'piccolore';
import { $ as $$BaseLayout } from '../chunks/BaseLayout_BKQeLCa5.mjs';
import { jsx, jsxs } from 'react/jsx-runtime';
import { useState, useRef, useEffect, useCallback } from 'react';
/* empty css                                 */
export { renderers } from '../renderers.mjs';

function isMobile() {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= 640;
}
function getPageSize() {
  return isMobile() ? 5 : 20;
}
function getMaxPhotos() {
  return isMobile() ? 50 : 150;
}
function thumbUrl(filename) {
  const thumbName = filename.replace("_sized", "_thumb");
  return `/api/thumb/${encodeURIComponent(thumbName)}`;
}
function GalleryApp() {
  const [photos, setPhotos] = useState([]);
  const [stars, setStars] = useState({});
  const [myStars, setMyStars] = useState(/* @__PURE__ */ new Set());
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [showThumbs, setShowThumbs] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [swipeHint, setSwipeHint] = useState(true);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [globalOffset, setGlobalOffset] = useState(0);
  const nextPageRef = useRef(2);
  const autoPlayRef = useRef(null);
  const slideRef = useRef(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const photosRef = useRef([]);
  const hasMoreRef = useRef(false);
  const fetchingMoreRef = useRef(false);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);
  useEffect(() => {
    fetchingMoreRef.current = fetchingMore;
  }, [fetchingMore]);
  const trimPhotos = useCallback((currentIdx) => {
    const max = getMaxPhotos();
    if (photosRef.current.length <= max) return;
    const keepFrom = Math.max(0, currentIdx - 10);
    if (keepFrom === 0) return;
    setGlobalOffset((prev) => prev + keepFrom);
    setPhotos(photosRef.current.slice(keepFrom));
    setCurrent(currentIdx - keepFrom);
  }, []);
  const fetchMore = useCallback(async () => {
    if (fetchingMoreRef.current || !hasMoreRef.current) return;
    setFetchingMore(true);
    const limit = getPageSize();
    const page = nextPageRef.current;
    try {
      const [photoRes, starRes] = await Promise.all([
        fetch(`/api/photos?page=${page}&limit=${limit}`),
        fetch("/api/stars")
      ]);
      const photoData = await photoRes.json();
      const starData = await starRes.json();
      const newPhotos = photoData?.photos || [];
      setTotal(photoData?.total || 0);
      setStars(starData);
      if (newPhotos.length > 0) {
        setPhotos((prev) => {
          const existing = new Set(prev.map((p) => p.key));
          const deduped = newPhotos.filter((p) => !existing.has(p.key));
          const merged = [...prev, ...deduped];
          return merged;
        });
      }
      nextPageRef.current = page + 1;
      const totalPages = photoData?.totalPages || 1;
      setHasMore(page < totalPages);
    } catch {
    }
    setFetchingMore(false);
    trimPhotos(photosRef.current.length > 0 ? photosRef.current.length - 1 : 0);
  }, []);
  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      const limit = getPageSize();
      try {
        const [photoRes, starRes] = await Promise.all([
          fetch(`/api/photos?page=1&limit=${limit}`),
          fetch("/api/stars")
        ]);
        const photoData = await photoRes.json();
        const starData = await starRes.json();
        setPhotos(photoData?.photos || []);
        setTotal(photoData?.total || 0);
        setStars(starData);
        setCurrent(0);
        nextPageRef.current = 2;
        const totalPages = photoData?.totalPages || 1;
        setHasMore(1 < totalPages);
      } catch {
      }
      setLoading(false);
    };
    const stored = localStorage.getItem("myStars");
    if (stored) {
      try {
        setMyStars(new Set(JSON.parse(stored)));
      } catch {
      }
    }
    loadInitial();
  }, []);
  useEffect(() => {
    if (hasMore && !fetchingMore && photos.length > 0 && current >= photos.length - 3) {
      fetchMore();
    }
  }, [current, photos.length, hasMore, fetchingMore, fetchMore]);
  const goNext = useCallback(() => {
    const p = photosRef.current;
    if (p.length === 0) return;
    if (current < p.length - 1) {
      setCurrent(current + 1);
    }
  }, [current]);
  const goPrev = useCallback(() => {
    if (current > 0) {
      setCurrent(current - 1);
    }
  }, [current]);
  useEffect(() => {
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    if (autoPlay && photos.length > 1) {
      autoPlayRef.current = setTimeout(() => {
        if (current < photos.length - 1) {
          setCurrent((c) => c + 1);
        } else if (hasMore) {
          fetchMore();
        } else {
          setAutoPlay(false);
        }
      }, 5e3);
    }
    return () => {
      if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    };
  }, [autoPlay, current, photos.length, hasMore, fetchMore]);
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
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (swipeHint) setSwipeHint(false);
      if (dx < 0) goNext();
      else goPrev();
    }
  };
  const toggleStar = async (key) => {
    const isStarred = myStars.has(key);
    const method = isStarred ? "DELETE" : "POST";
    try {
      const res = await fetch(`/api/star/${encodeURIComponent(key)}`, { method });
      if (res.ok) {
        const data = await res.json();
        setStars((prev) => ({ ...prev, [key]: data.stars }));
        const next = new Set(myStars);
        if (isStarred) next.delete(key);
        else next.add(key);
        setMyStars(next);
        localStorage.setItem("myStars", JSON.stringify([...next]));
      }
    } catch {
    }
  };
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
  const nextIdx = current + 1;
  const prevIdx = current - 1;
  return /* @__PURE__ */ jsxs("div", { className: `gallery ${fullscreen ? "fullscreen" : ""}`, ref: slideRef, children: [
    /* @__PURE__ */ jsx("div", { className: "gallery-banner", children: "Star your favorite photos and the most popular ones will be uploaded in full resolution!" }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: "slide-container",
        onTouchStart: handleTouchStart,
        onTouchEnd: handleTouchEnd,
        children: [
          /* @__PURE__ */ jsx(
            "img",
            {
              src: `/api/photo/${encodeURIComponent(photo.key)}`,
              alt: photo.filename,
              className: "slide-image"
            },
            photo.key
          ),
          /* @__PURE__ */ jsx("button", { className: "slide-nav slide-prev", onClick: goPrev, "aria-label": "Previous", style: current === 0 ? { opacity: 0.3 } : void 0, children: "‹" }),
          /* @__PURE__ */ jsx("button", { className: "slide-nav slide-next", onClick: goNext, "aria-label": "Next", style: current >= photos.length - 1 && !hasMore ? { opacity: 0.3 } : void 0, children: "›" }),
          photos.length > 1 && /* @__PURE__ */ jsxs("div", { style: { display: "none" }, children: [
            nextIdx < photos.length && /* @__PURE__ */ jsx("img", { src: `/api/photo/${encodeURIComponent(photos[nextIdx].key)}`, alt: "" }),
            prevIdx >= 0 && /* @__PURE__ */ jsx("img", { src: `/api/photo/${encodeURIComponent(photos[prevIdx].key)}`, alt: "" })
          ] }),
          swipeHint && photos.length > 1 && /* @__PURE__ */ jsx("div", { className: "swipe-hint", onClick: () => setSwipeHint(false), children: "Swipe or use arrows to navigate" }),
          /* @__PURE__ */ jsxs("div", { className: "slide-controls", children: [
            /* @__PURE__ */ jsxs("span", { className: "slide-counter", children: [
              globalOffset + current + 1,
              " / ",
              total
            ] }),
            /* @__PURE__ */ jsx("span", { className: "slide-filename", children: photo.filename }),
            /* @__PURE__ */ jsxs("div", { className: "slide-actions", children: [
              /* @__PURE__ */ jsxs(
                "button",
                {
                  className: `btn-icon btn-star ${myStars.has(photo.key) ? "starred" : ""}`,
                  onClick: () => toggleStar(photo.key),
                  title: "Star this photo",
                  children: [
                    myStars.has(photo.key) ? "★" : "☆",
                    stars[photo.key] ? /* @__PURE__ */ jsx("span", { className: "star-count", children: stars[photo.key] }) : null
                  ]
                }
              ),
              /* @__PURE__ */ jsx("button", { className: "btn-ghost btn-icon", onClick: () => setAutoPlay(!autoPlay), title: autoPlay ? "Pause" : "Auto-play", children: autoPlay ? "⏸" : "▶" }),
              /* @__PURE__ */ jsx("button", { className: "btn-ghost btn-icon", onClick: toggleFullscreen, title: "Fullscreen (F)", children: "⛶" }),
              /* @__PURE__ */ jsx("button", { className: "btn-ghost btn-icon", onClick: downloadCurrent, title: "Download", children: "⬇" })
            ] })
          ] })
        ]
      }
    ),
    showThumbs && photos.length > 1 && /* @__PURE__ */ jsxs("div", { className: "thumb-strip", children: [
      photos.map((p, i) => /* @__PURE__ */ jsxs(
        "button",
        {
          className: `thumb ${i === current ? "active" : ""}`,
          onClick: () => setCurrent(i),
          children: [
            /* @__PURE__ */ jsx("img", { src: thumbUrl(p.filename), alt: p.filename, loading: "lazy" }),
            stars[p.key] ? /* @__PURE__ */ jsx("span", { className: "thumb-star", children: stars[p.key] }) : null
          ]
        },
        p.key
      )),
      fetchingMore && /* @__PURE__ */ jsx("div", { className: "thumb-loading", children: "..." })
    ] })
  ] });
}

const $$Index = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Gallery", "description": "Photo gallery" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "GalleryApp", GalleryApp, { "client:load": true, "client:component-hydration": "load", "client:component-path": "C:/Users/andyb/Documents/GitHub/smugmug2/src/components/GalleryApp", "client:component-export": "default" })} ` })} `;
}, "C:/Users/andyb/Documents/GitHub/smugmug2/src/pages/index.astro", void 0);

const $$file = "C:/Users/andyb/Documents/GitHub/smugmug2/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
