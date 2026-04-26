import { useState, useEffect, useCallback, useRef } from "react";

interface Photo {
  key: string;
  filename: string;
  contentType: string;
  size: number;
  uploadDate: string;
}

function getPageSize() {
  if (typeof window === "undefined") return 20;
  return window.innerWidth <= 640 ? 5 : 20;
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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const autoPlayRef = useRef<ReturnType<typeof setTimeout>>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const loadPage = useCallback(async (pageNum: number) => {
    setLoading(true);
    const limit = getPageSize();
    try {
      const [photoRes, starRes] = await Promise.all([
        fetch(`/api/photos?page=${pageNum}&limit=${limit}`),
        fetch("/api/stars"),
      ]);
      const photoData = await photoRes.json();
      const starData = await starRes.json();
      setPhotos(photoData?.photos || []);
      setTotalPages(photoData?.totalPages || 1);
      setTotal(photoData?.total || 0);
      setPage(photoData?.page || 1);
      setStars(starData);
      setCurrent(0);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("myStars");
    if (stored) {
      try { setMyStars(new Set(JSON.parse(stored))); } catch {}
    }
    loadPage(1);
  }, [loadPage]);

  const goNext = useCallback(() => {
    setCurrent((i) => (i + 1) % photos.length);
  }, [photos.length]);

  const goPrev = useCallback(() => {
    setCurrent((i) => (i - 1 + photos.length) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    if (autoPlay && photos.length > 1) {
      autoPlayRef.current = setTimeout(goNext, 5000);
    }
    return () => {
      if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    };
  }, [autoPlay, current, photos.length, goNext]);

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
      if (dx < 0) {
        if (current === photos.length - 1 && page < totalPages) {
          loadPage(page + 1);
        } else {
          goNext();
        }
      } else {
        if (current === 0 && page > 1) {
          loadPage(page - 1);
        } else {
          goPrev();
        }
      }
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
  const preload = new Set([
    current,
    (current + 1) % photos.length,
    (current - 1 + photos.length) % photos.length,
  ]);
  const globalIndex = (page - 1) * photos.length + current + 1;

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

        <button className="slide-nav slide-prev" onClick={current === 0 && page > 1 ? () => loadPage(page - 1) : goPrev} aria-label="Previous">
          &#8249;
        </button>
        <button className="slide-nav slide-next" onClick={current === photos.length - 1 && page < totalPages ? () => loadPage(page + 1) : goNext} aria-label="Next">
          &#8250;
        </button>

        {swipeHint && photos.length > 1 && (
          <div className="swipe-hint" onClick={() => setSwipeHint(false)}>
            Swipe or use arrows to navigate
          </div>
        )}

        <div className="slide-controls">
          <span className="slide-counter">{globalIndex} / {total}</span>
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

      <div className="pagination">
        <button
          className="btn-ghost"
          disabled={page <= 1}
          onClick={() => loadPage(page - 1)}
        >
          &#8249; Prev
        </button>
        <span className="page-info">
          Page {page} of {totalPages}
        </span>
        <button
          className="btn-ghost"
          disabled={page >= totalPages}
          onClick={() => loadPage(page + 1)}
        >
          Next &#8250;
        </button>
      </div>

      {showThumbs && photos.length > 1 && (
        <div className="thumb-strip">
          {photos.map((p, i) => (
            <button
              key={p.key}
              className={`thumb ${i === current ? "active" : ""}`}
              onClick={() => setCurrent(i)}
            >
              {preload.has(i) ? (
                <img src={`/api/photo/${encodeURIComponent(p.key)}`} alt={p.filename} loading="lazy" />
              ) : (
                <img data-src={`/api/photo/${encodeURIComponent(p.key)}`} alt={p.filename} loading="lazy" />
              )}
              {stars[p.key] ? <span className="thumb-star">{stars[p.key]}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
