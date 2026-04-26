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

export default function GalleryApp() {
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
  const nextPageRef = useRef(2);
  const autoPlayRef = useRef<ReturnType<typeof setTimeout>>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const photosRef = useRef<Photo[]>([]);
  const hasMoreRef = useRef(false);
  const fetchingMoreRef = useRef(false);

  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
  useEffect(() => { fetchingMoreRef.current = fetchingMore; }, [fetchingMore]);

  const trimPhotos = useCallback((currentIdx: number) => {
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
          const merged = [...prev, ...deduped];
          return merged;
        });
      }
      nextPageRef.current = page + 1;
      const totalPages = photoData?.totalPages || 1;
      setHasMore(page < totalPages);
    } catch {}
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
          fetch("/api/stars"),
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
      } catch {}
      setLoading(false);
    };

    const stored = localStorage.getItem("myStars");
    if (stored) {
      try { setMyStars(new Set(JSON.parse(stored))); } catch {}
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

  if (loading) {
    return <div className="gallery-loading">Loading gallery...</div>;
  }

  if (photos.length === 0) {
    return (
      <div className="gallery-empty">
        <h2>No photos yet</h2>
        <p>Visit the <a href="/admin">admin page</a> to upload photos.</p>
      </div>
    );
  }

  const photo = photos[current];
  const nextIdx = current + 1;
  const prevIdx = current - 1;

  return (
    <div className={`gallery ${fullscreen ? "fullscreen" : ""}`} ref={slideRef}>
      <div className="gallery-banner">
        Star your favorite photos and the most popular ones will be uploaded in full resolution!
      </div>

      <div
        className="slide-container"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={`/api/photo/${encodeURIComponent(photo.key)}`}
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
            {nextIdx < photos.length && (
              <img src={`/api/photo/${encodeURIComponent(photos[nextIdx].key)}`} alt="" />
            )}
            {prevIdx >= 0 && (
              <img src={`/api/photo/${encodeURIComponent(photos[prevIdx].key)}`} alt="" />
            )}
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
              <img src={thumbUrl(p.filename)} alt={p.filename} loading="lazy" />
              {stars[p.key] ? <span className="thumb-star">{stars[p.key]}</span> : null}
            </button>
          ))}
          {fetchingMore && (
            <div className="thumb-loading">...</div>
          )}
        </div>
      )}
    </div>
  );
}
