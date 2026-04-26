import { useState, useEffect, useCallback, useRef } from "react";

const MAX_UPLOAD_MB = 5;
const MAX_DIMENSION = 4000;

function resizeFile(file: File): Promise<File> {
  return new Promise((resolve) => {
    if (file.size <= MAX_UPLOAD_MB * 1024 * 1024) {
      resolve(file);
      return;
    }
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION && file.size <= MAX_UPLOAD_MB * 1024 * 1024) {
        resolve(file);
        return;
      }
      const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height, 1);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const resized = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          resolve(resized);
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return <div className={`toast ${type}`}>{message}</div>;
}

interface PhotoStat {
  key: string;
  filename: string;
  thumbUrl: string;
  views: number;
  totalDuration: number;
  avgDuration: number;
  stars: number;
  score: number;
}

type SortField = "score" | "views" | "duration" | "stars" | "name";
type SortDir = "asc" | "desc";

export default function AdminApp() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [stats, setStats] = useState<PhotoStat[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [totalStars, setTotalStars] = useState(0);
  const [avgViews, setAvgViews] = useState(0);
  const [sort, setSort] = useState<SortField>("score");
  const [dir, setDir] = useState<SortDir>("desc");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchStats = useCallback(async (p: number, s: SortField, d: SortDir) => {
    try {
      const res = await fetch(`/api/metrics?page=${p}&limit=50&sort=${s}&dir=${d}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.photos || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
        setTotalViews(data.totalViews || 0);
        setTotalStars(data.totalStars || 0);
        setAvgViews(data.avgViews || 0);
      } else if (res.status === 401) {
        setLoggedIn(false);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats(page, sort, dir);
  }, [page, sort, dir, fetchStats]);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/metrics?page=1&limit=1&sort=score&dir=desc");
        if (res.status === 401) {
          setLoggedIn(false);
          setLoading(false);
        } else if (res.ok) {
          setLoggedIn(true);
        }
      } catch {
        setLoading(false);
      }
    };
    check();
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setLoggedIn(true);
      setPassword("");
      setLoading(true);
      fetchStats(1, sort, dir);
    } else {
      showToast("Invalid password", "error");
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    for (const file of files) {
      const processed = await resizeFile(file);
      formData.append("files", processed);
    }
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        const msgs = [];
        if (data.uploaded?.length) msgs.push(`Uploaded ${data.uploaded.length} photo(s)`);
        if (data.errors?.length) msgs.push(`${data.errors.length} failed`);
        if (msgs.length === 0) msgs.push("No files were uploaded");
        showToast(msgs.join(" | "), data.uploaded?.length ? "success" : "error");
        fetchStats(page, sort, dir);
      } else {
        if (res.status === 401) setLoggedIn(false);
        else showToast("Upload failed", "error");
      }
    } catch {
      showToast("Upload failed", "error");
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  const deletePhoto = async (key: string) => {
    if (!confirm("Delete this photo?")) return;
    const res = await fetch(`/api/delete/${encodeURIComponent(key)}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Photo deleted", "success");
      fetchStats(page, sort, dir);
    } else {
      showToast("Delete failed", "error");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    upload(e.dataTransfer.files);
  };

  const toggleSort = (field: SortField) => {
    if (sort === field) {
      setDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setDir("desc");
    }
    setPage(1);
  };

  const sortIndicator = (field: SortField) => {
    if (sort !== field) return " \u2195";
    return dir === "asc" ? " \u25B2" : " \u25BC";
  };

  const fmtDuration = (sec: number) => {
    if (sec < 60) return `${sec.toFixed(1)}s`;
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}m ${s}s`;
  };

  if (!loggedIn) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1>Admin Login</h1>
          <p>Enter the admin password to manage your gallery.</p>
          <form onSubmit={login}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-primary" style={{ marginTop: 12, width: "100%" }}>
              Sign In
            </button>
          </form>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} />}
      </div>
    );
  }

  return (
    <div>
      <div className="admin-header">
        <h1>Photo Admin</h1>
        <button className="btn-ghost" onClick={() => setLoggedIn(false)}>
          Sign Out
        </button>
      </div>

      <div
        className={`upload-zone ${dragOver ? "drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInput.current?.click()}
      >
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => upload(e.target.files)}
          style={{ display: "none" }}
        />
        <div className="upload-zone-content">
          {uploading ? (
            <p>Uploading...</p>
          ) : (
            <>
              <p className="upload-icon">+</p>
              <p>Drop photos here or click to browse</p>
              <p className="upload-hint">Supports JPG, PNG, GIF, WebP</p>
            </>
          )}
        </div>
      </div>

      <div className="stats-summary">
        <div className="stat-card">
          <span className="stat-value">{total.toLocaleString()}</span>
          <span className="stat-label">Photos</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalViews.toLocaleString()}</span>
          <span className="stat-label">Total Views</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{avgViews}</span>
          <span className="stat-label">Avg Views</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalStars.toLocaleString()}</span>
          <span className="stat-label">Total Stars</span>
        </div>
      </div>

      <div className="photo-grid-header">
        <h2>Photo Metrics</h2>
        {total > 0 && (
          <button className="btn-danger" onClick={async () => {
            if (!confirm(`Delete ALL ${total} photos? This cannot be undone.`)) return;
            const res = await fetch("/api/delete/__all__", { method: "DELETE" });
            if (res.ok) {
              const data = await res.json();
              showToast(`Deleted ${data.deleted} photo(s)`, "success");
              fetchStats(1, sort, dir);
            } else {
              showToast("Delete all failed", "error");
            }
          }}>Delete All</button>
        )}
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading metrics...</p></div>
      ) : stats.length === 0 ? (
        <div className="empty-state"><p>No photos yet. Upload some to get started!</p></div>
      ) : (
        <>
          <div className="metrics-table-wrap">
            <table className="metrics-table">
              <thead>
                <tr>
                  <th className="col-rank">#</th>
                  <th className="col-thumb">Photo</th>
                  <th className="sortable" onClick={() => toggleSort("name")}>Filename{sortIndicator("name")}</th>
                  <th className="sortable" onClick={() => toggleSort("views")}>Views{sortIndicator("views")}</th>
                  <th className="sortable" onClick={() => toggleSort("duration")}>Avg Time{sortIndicator("duration")}</th>
                  <th className="sortable" onClick={() => toggleSort("stars")}>Stars{sortIndicator("stars")}</th>
                  <th className="sortable" onClick={() => toggleSort("score")}>Score{sortIndicator("score")}</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((photo, i) => (
                  <tr key={photo.key}>
                    <td className="col-rank">{(page - 1) * 50 + i + 1}</td>
                    <td className="col-thumb">
                      <img src={photo.thumbUrl} alt={photo.filename} loading="lazy" />
                    </td>
                    <td className="col-name" title={photo.filename}>{photo.filename}</td>
                    <td>{photo.views.toLocaleString()}</td>
                    <td>{fmtDuration(photo.avgDuration)}</td>
                    <td>{photo.stars > 0 ? photo.stars : "\u2014"}</td>
                    <td>{photo.score}</td>
                    <td className="col-actions">
                      <button className="btn-danger btn-sm" onClick={() => deletePhoto(photo.key)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn-ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="page-info">
                Page {page} of {totalPages}
              </span>
              <button
                className="btn-ghost"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
