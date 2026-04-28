import { useState, useEffect } from "react";
import GalleryApp from "./GalleryApp";

interface FighterThumb {
  id: number;
  totalPhotos: number;
  thumbUrl: string;
}

type SortMode = "action" | "chrono";

export default function FighterGrid() {
  const [fighters, setFighters] = useState<FighterThumb[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sort, setSort] = useState<SortMode>("action");
  const [sortKey, setSortKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/fighters");
        if (res.ok) {
          const data = await res.json();
          setFighters(data.fighters || []);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const handleSort = (newSort: SortMode) => {
    setSort(newSort);
    setSortKey((k) => k + 1);
  };

  if (loading) {
    return <div className="fighter-loading">Loading fighters...</div>;
  }

  if (selectedId !== null) {
    return (
      <div className="fighter-gallery">
        <div className="fighter-gallery-header">
          <button className="btn-ghost" onClick={() => setSelectedId(null)}>
            ← Back to all
          </button>
          <div className="fighter-sort">
            <button
              className={`btn-ghost ${sort === "action" ? "active" : ""}`}
              onClick={() => handleSort("action")}
            >
              Action
            </button>
            <button
              className={`btn-ghost ${sort === "chrono" ? "active" : ""}`}
              onClick={() => handleSort("chrono")}
            >
              Chronologic
            </button>
          </div>
        </div>
        <GalleryApp key={`${selectedId}-${sortKey}`} mode="fighter" fighterId={selectedId} />
      </div>
    );
  }

  return (
    <div className="fighter-wall">
      <div className="fighter-wall-header">
        <h2>Capoeiristas — click your face!</h2>
        <p className="fighter-count">{fighters.length} people found</p>
      </div>
      <div className="fighter-grid">
        {fighters.map((f) => (
          <button
            key={f.id}
            className="fighter-thumb"
            onClick={() => setSelectedId(f.id)}
          >
            <img src={f.thumbUrl} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
