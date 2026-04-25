import { useState, useEffect, useCallback, useRef } from "react";

interface Photo {
  key: string;
  filename: string;
  contentType: string;
  size: number;
  uploadDate: string;
}

export default function GalleryApp() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [showThumbs, setShowThumbs] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const autoPlayRef = useRef<ReturnType<typeof setTimeout>>(null);
  const slideRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/photos")
      .then((r) => r.json())
      .then((data) => {
        setPhotos(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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

  return (
    <div className={`gallery ${fullscreen ? "fullscreen" : ""}`} ref={slideRef}>
      <div className="slide-container">
        <img
          src={`/api/photo/${encodeURIComponent(photo.key)}`}
          alt={photo.filename}
          className="slide-image"
          key={photo.key}
        />

        <button className="slide-nav slide-prev" onClick={goPrev} aria-label="Previous">
          ‹
        </button>
        <button className="slide-nav slide-next" onClick={goNext} aria-label="Next">
          ›
        </button>

        <div className="slide-controls">
          <span className="slide-counter">{current + 1} / {photos.length}</span>
          <span className="slide-filename">{photo.filename}</span>
          <div className="slide-actions">
            <button className="btn-ghost btn-icon" onClick={() => setAutoPlay(!autoPlay)} title={autoPlay ? "Pause" : "Auto-play"}>
              {autoPlay ? "⏸" : "▶"}
            </button>
            <button className="btn-ghost btn-icon" onClick={toggleFullscreen} title="Fullscreen (F)">
              ⛶
            </button>
            <button className="btn-ghost btn-icon" onClick={downloadCurrent} title="Download">
              ⬇
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
              <img src={`/api/photo/${encodeURIComponent(p.key)}`} alt={p.filename} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
