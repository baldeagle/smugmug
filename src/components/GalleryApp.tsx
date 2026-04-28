import { useState, useEffect, useCallback, useRef } from "react";

interface Photo {
  key: string;
  filename: string;
}

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

function thumbUrl(filename: string): string {
  const dotIdx = filename.lastIndexOf(".");
  const base = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
  const ext = dotIdx > 0 ? filename.slice(dotIdx) : "";
  return `/api/thumb/${encodeURIComponent(base + "_thumb" + ext)}`;
}

function mobileUrl(key: string): string {
  return `/api/mobile/${encodeURIComponent(key)}`;
}

function slideUrl(key: string): string {
  if (isMobile()) return mobileUrl(key);
  return `/api/photo/${encodeURIComponent(key)}`;
}

interface Bookmark {
  id: string;
  name: string;
  key: string;
}

interface Props {
  initialPhotoKey?: string;
  mode?: "gallery" | "highlights" | "fighter";
  fighterId?: number;
}

export default function GalleryApp({ initialPhotoKey, mode = "gallery", fighterId }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [stars, setStars] = useState<Record<string, number>>({});
  const [myStars, setMyStars] = useState<Set<string>>(new Set());
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
  const [shareToast, setShareToast] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const nextPageRef = useRef(2);
  const autoPlayRef = useRef<ReturnType<typeof setTimeout>>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const photosRef = useRef<Photo[]>([]);
  const hasMoreRef = useRef(false);
  const fetchingMoreRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const viewStartRef = useRef(0);
  const prevKeyRef = useRef<string | null>(null);

  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
  useEffect(() => { fetchingMoreRef.current = fetchingMore; }, [fetchingMore]);

  function computeDuration(elapsedSec: number): number {
    if (elapsedSec <= 90) return elapsedSec;
    return 90 * Math.exp(-(elapsedSec - 90) / 30);
  }

  function submitView(key: string, start: number) {
    const elapsed = (Date.now() - start) / 1000;
    const duration = computeDuration(elapsed);
    if (duration < 2) return;
    try {
      fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, duration: Math.round(duration * 100) / 100 }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }

  const trimPhotos = useCallback((currentIdx: number) => {
    const max = getMaxPhotos();
    if (photosRef.current.length <= max) return;
    const keepFrom = Math.max(0, currentIdx - 10);
    if (keepFrom === 0) return;
    setGlobalOffset((prev) => prev + keepFrom);
    setPhotos(photosRef.current.slice(keepFrom));
    setCurrent(currentIdx - keepFrom);
  }, []);

  const jumpToPhoto = useCallback(async (key: string) => {
    const limit = getPageSize();
    try {
      const pageRes = await fetch(`/api/photo-page?key=${encodeURIComponent(key)}`);
      if (!pageRes.ok) return;
      const { index } = await pageRes.json();
      const targetPage = Math.floor(index / limit) + 1;
      const photoRes = await fetch(`/api/photos?page=${targetPage}&limit=${limit}`);
      const photoData = await photoRes.json();
      const pagePhotos: Photo[] = photoData?.photos || [];
      setTotal(photoData?.total || 0);
      setPhotos(pagePhotos);
      const idxInPage = index - (targetPage - 1) * limit;
      setCurrent(idxInPage);
      setGlobalOffset((targetPage - 1) * limit);
      nextPageRef.current = targetPage + 1;
      const totalPages = photoData?.totalPages || 1;
      setHasMore(targetPage < totalPages);
    } catch {}
  }, []);

  useEffect(() => {
    const photo = photos[current];
    if (!photo) return;

    if (prevKeyRef.current && viewStartRef.current > 0) {
      submitView(prevKeyRef.current, viewStartRef.current);
    }

    prevKeyRef.current = photo.key;
    viewStartRef.current = Date.now();
  }, [current, photos]);

  useEffect(() => {
    const onUnload = () => {
      if (prevKeyRef.current && viewStartRef.current > 0) {
        const elapsed = (Date.now() - viewStartRef.current) / 1000;
        const duration = computeDuration(elapsed);
        if (duration >= 2) {
          navigator.sendBeacon?.(
            "/api/metrics",
            new Blob([JSON.stringify({ key: prevKeyRef.current, duration: Math.round(duration * 100) / 100 })], { type: "application/json" })
          );
        }
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (prevKeyRef.current && viewStartRef.current > 0) {
          submitView(prevKeyRef.current, viewStartRef.current);
          viewStartRef.current = Date.now();
        }
      } else {
        viewStartRef.current = Date.now();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const fetchMore = useCallback(async () => {
    if (fetchingMoreRef.current || !hasMoreRef.current) return;
    setFetchingMore(true);
    const limit = getPageSize();
    const page = nextPageRef.current;
    const endpoint = mode === "highlights" ? "/api/highlights" : "/api/photos";
    try {
      const [photoRes, starRes] = await Promise.all([
        fetch(`${endpoint}?page=${page}&limit=${limit}`),
        fetch("/api/stars"),
      ]);
      const photoData = await photoRes.json();
      const starData = await starRes.json();
      const newPhotos = photoData?.photos || [];
      setTotal(photoData?.total || 0);
      setStars(starData);
      if (newPhotos.length > 0) {
        setPhotos((prev) => {
          const existing = new Set(prev.map((p) => p.key));
          const deduped = newPhotos.filter((p: Photo) => !existing.has(p.key));
          return [...prev, ...deduped];
        });
      }
      nextPageRef.current = page + 1;
      const totalPages = photoData?.totalPages || 1;
      setHasMore(page < totalPages);
    } catch {}
    setFetchingMore(false);
    if (mode !== "highlights") {
      trimPhotos(photosRef.current.length > 0 ? photosRef.current.length - 1 : 0);
    }
  }, [trimPhotos, mode]);

  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      const limit = getPageSize();

      const stored = localStorage.getItem("myStars");
      if (stored) {
        try { setMyStars(new Set(JSON.parse(stored))); } catch {}
      }

      const starRes = await fetch("/api/stars");
      const starData = await starRes.json();
      setStars(starData);

      if (mode === "gallery") {
        try {
          const bmRes = await fetch("/api/bookmarks");
          if (bmRes.ok) {
            const bmData = await bmRes.json();
            setBookmarks(bmData.bookmarks || []);
          }
        } catch {}
      }

      if (mode === "fighter" && fighterId != null) {
        try {
          const fighterRes = await fetch(`/api/fighters?id=${fighterId}&sort=action`);
          if (fighterRes.ok) {
            const fighterData = await fighterRes.json();
            setPhotos(fighterData.photos || []);
            setTotal(fighterData.photos?.length || 0);
            setCurrent(0);
            setHasMore(false);
          }
        } catch {}
        setLoading(false);
        return;
      }

      const endpoint = mode === "highlights" ? "/api/highlights" : "/api/photos";

      const photoKey = initialPhotoKey || new URLSearchParams(window.location.search).get("photo");
      if (photoKey && mode !== "highlights") {
        try {
          const pageRes = await fetch(`/api/photo-page?key=${encodeURIComponent(initialPhotoKey)}`);
          if (pageRes.ok) {
            const { index } = await pageRes.json();
            const targetPage = Math.floor(index / limit) + 1;
            const photoRes = await fetch(`/api/photos?page=${targetPage}&limit=${limit}`);
            const photoData = await photoRes.json();
            const pagePhotos: Photo[] = photoData?.photos || [];
            setTotal(photoData?.total || 0);
            setPhotos(pagePhotos);
            const idxInPage = index - (targetPage - 1) * limit;
            setCurrent(idxInPage);
            setGlobalOffset((targetPage - 1) * limit);
            nextPageRef.current = targetPage + 1;
            const totalPages = photoData?.totalPages || 1;
            setHasMore(targetPage < totalPages);
            setLoading(false);
            return;
          }
        } catch {}
      }

      try {
        const photoRes = await fetch(`${endpoint}?page=1&limit=${limit}`);
        const photoData = await photoRes.json();
        setPhotos(photoData?.photos || []);
        setTotal(photoData?.total || 0);
        setCurrent(0);
        nextPageRef.current = 2;
        const totalPages = photoData?.totalPages || 1;
        setHasMore(1 < totalPages);
      } catch {}
      setLoading(false);
    };

    loadInitial();
  }, [initialPhotoKey, mode, fighterId]);

  useEffect(() => {
    if (hasMore && !fetchingMore && photos.length > 0 && current >= photos.length - 3) {
      fetchMore();
    }
  }, [current, photos.length, hasMore, fetchingMore, fetchMore]);

  useEffect(() => {
    if (photos.length === 0 || current >= photos.length) return;
    const photo = photos[current];
    if (!photo) return;
    const shareUrl = `${window.location.origin}/photo/${encodeURIComponent(photo.key)}`;
    if (window.location.pathname.startsWith("/photo/")) {
      window.history.replaceState(null, "", `/photo/${encodeURIComponent(photo.key)}`);
    } else {
      window.history.replaceState(null, "", shareUrl);
    }
  }, [current, photos]);

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
      }, 5000);
    }
    return () => {
      if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    };
  }, [autoPlay, current, photos.length, hasMore, fetchMore]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") setFullscreen(false);
      else if (e.key === "f") setFullscreen((f) => !f);
      else if (e.key === "t") setShowThumbs((t) => !t);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (swipeHint) setSwipeHint(false);
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  const toggleStar = async (key: string) => {
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
    } catch {}
  };

  const downloadCurrent = () => {
    if (photos.length === 0) return;
    const photo = photos[current];
    const link = document.createElement("a");
    link.href = `/api/photo/${encodeURIComponent(photo.key)}?download=1`;
    link.download = photo.filename;
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

  const sharePhoto = async () => {
    if (photos.length === 0) return;
    const photo = photos[current];

    if (!myStars.has(photo.key)) {
      try {
        const res = await fetch(`/api/star/${encodeURIComponent(photo.key)}`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setStars((prev) => ({ ...prev, [photo.key]: data.stars }));
          const next = new Set(myStars);
          next.add(photo.key);
          setMyStars(next);
          localStorage.setItem("myStars", JSON.stringify([...next]));
        }
      } catch {}
    }

    const url = `${window.location.origin}/photo/${encodeURIComponent(photo.key)}`;
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
    setShareToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShareToast(false), 2000);
  };

  if (loading) {
    return <div className="gallery-loading">{mode === "highlights" ? "Loading highlights..." : "Loading gallery..."}</div>;
  }

  if (photos.length === 0) {
    return (
      <div className="gallery-empty">
        <h2>{mode === "highlights" ? "No highlights yet" : "No photos yet"}</h2>
        <p>{mode === "highlights" ? "Star some photos to see them here!" : "Visit the"} {mode !== "highlights" && <a href="/admin">admin page</a>} {mode !== "highlights" && "to upload photos."}</p>
        {mode === "highlights" && <p><a href="/">Browse the full gallery</a> to star your favorites.</p>}
      </div>
    );
  }

  const photo = photos[current];
  if (!photo) return null;

  const preloadAhead = isMobile() ? 2 : 4;
  const preloadIndices: number[] = [];
  for (let d = -1; d <= preloadAhead; d++) {
    const idx = current + d;
    if (idx >= 0 && idx < photos.length && idx !== current) {
      preloadIndices.push(idx);
    }
  }

  return (
    <div className={`gallery ${fullscreen ? "fullscreen" : ""}`} ref={slideRef}>
      <div className="gallery-banner">
        {mode === "highlights"
          ? "Highlights \u2014 the most starred and shared photos!"
          : "Star your favorites or share a photo to boost it into the Highlights reel!"}
      </div>

      {mode === "gallery" && bookmarks.length > 0 && (
        <div className="bookmark-bar">
          {bookmarks.map((bm) => (
            <button
              key={bm.id}
              className={`bookmark-chip ${photo.key === bm.key ? "active" : ""}`}
              onClick={() => jumpToPhoto(bm.key)}
            >
              {bm.name}
            </button>
          ))}
        </div>
      )}

      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={slideUrl(photo.key)}
          alt={photo.filename}
          className="slide-image"
          key={photo.key}
        />

        <button className="slide-nav slide-prev" onClick={goPrev} aria-label="Previous" style={current === 0 ? { opacity: 0.3 } : undefined}>
          &#8249;
        </button>
        <button className="slide-nav slide-next" onClick={goNext} aria-label="Next" style={current >= photos.length - 1 && !hasMore ? { opacity: 0.3 } : undefined}>
          &#8250;
        </button>

        {photos.length > 1 && (
          <div style={{ display: "none" }}>
            {preloadIndices.map((idx) => (
              <img key={photos[idx].key} src={slideUrl(photos[idx].key)} alt="" />
            ))}
          </div>
        )}

        {swipeHint && photos.length > 1 && (
          <div className="swipe-hint" onClick={() => setSwipeHint(false)}>
            Swipe or use arrows to navigate
          </div>
        )}

        <div className="slide-controls">
          <span className="slide-counter">{globalOffset + current + 1} / {total}</span>
          <span className="slide-filename">{photo.filename}</span>
          <div className="slide-actions">
            <button
              className={`btn-icon btn-star ${myStars.has(photo.key) ? "starred" : ""}`}
              onClick={() => toggleStar(photo.key)}
              title="Star this photo"
            >
              {myStars.has(photo.key) ? "\u2605" : "\u2606"}
              {stars[photo.key] ? <span className="star-count">{stars[photo.key]}</span> : null}
            </button>
            <button className="btn-ghost btn-icon" onClick={sharePhoto} title="Share">
              {"\u{1F517}"}
            </button>
            <button className="btn-ghost btn-icon" onClick={() => setAutoPlay(!autoPlay)} title={autoPlay ? "Pause" : "Auto-play"}>
              {autoPlay ? "\u23F8" : "\u25B6"}
            </button>
            <button className="btn-ghost btn-icon" onClick={toggleFullscreen} title="Fullscreen (F)">
              {"\u26F6"}
            </button>
            <button className="btn-ghost btn-icon" onClick={downloadCurrent} title="Download">
              {"\u2B07"}
            </button>
          </div>
        </div>
      </div>

      {showThumbs && photos.length > 1 && (
        <div className="thumb-strip">
          {photos.map((p, i) => (
            <button
              key={p.key}
              className={`thumb ${i === current ? "active" : ""}`}
              onClick={() => setCurrent(i)}
            >
              <img src={thumbUrl(p.filename)} alt={p.filename} loading={Math.abs(i - current) <= 8 ? "eager" : "lazy"} />
              {stars[p.key] ? <span className="thumb-star">{stars[p.key]}</span> : null}
            </button>
          ))}
          {fetchingMore && (
            <div className="thumb-loading">...</div>
          )}
        </div>
      )}

      {shareToast && <div className="share-toast">Link copied!</div>}
    </div>
  );
}
