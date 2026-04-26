import { useState, useEffect, useCallback, useRef } from "react";

const MAX_UPLOAD_MB = 5;
const MAX_DIMENSION = 4000;

function thumbUrl(filename: string): string {
  const dotIdx = filename.lastIndexOf(".");
  const base = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
  const ext = dotIdx > 0 ? filename.slice(dotIdx) : "";
  return `/api/thumb/${encodeURIComponent(base + "_thumb" + ext)}`;
}

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

export default function AdminApp() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [photos, setPhotos] = useState<any[]>([]);
  const [starCounts, setStarCounts] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const checkAuth = useCallback(async () => {
    try {
      const [photoRes, starRes] = await Promise.all([
        fetch("/api/photos"),
        fetch("/api/stars"),
      ]);
      if (photoRes.ok) {
        const data = await photoRes.json();
        setPhotos(data);
      }
      if (starRes.ok) {
        setStarCounts(await starRes.json());
      }
    } catch {}
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
      checkAuth();
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
        if (data.errors?.length) msgs.push(`${data.errors.length} failed: ${data.errors.map((e: any) => e.error).join(", ")}`);
        if (msgs.length === 0) msgs.push("No files were uploaded");
        showToast(msgs.join(" | "), data.uploaded?.length ? "success" : "error");
        checkAuth();
      } else {
        const text = await res.text();
        showToast(`Upload failed (${res.status}): ${text}`, "error");
        if (res.status === 401) setLoggedIn(false);
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
      checkAuth();
    } else {
      showToast("Delete failed", "error");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    upload(e.dataTransfer.files);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
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

      <div className="photo-grid-header">
        <h2>{photos.length} photo{photos.length !== 1 ? "s" : ""}</h2>
        {photos.length > 0 && (
          <button className="btn-danger" onClick={async () => {
            if (!confirm(`Delete ALL ${photos.length} photos? This cannot be undone.`)) return;
            const res = await fetch("/api/delete/__all__", { method: "DELETE" });
            if (res.ok) {
              const data = await res.json();
              showToast(`Deleted ${data.deleted} photo(s)`, "success");
              checkAuth();
            } else {
              showToast("Delete all failed", "error");
            }
          }}>Delete All</button>
        )}
      </div>

      {photos.length === 0 ? (
        <div className="empty-state">
          <p>No photos yet. Upload some to get started!</p>
        </div>
      ) : (
        <div className="admin-grid">
          {photos.map((photo) => (
            <div key={photo.key} className="admin-photo-card">
              <div className="admin-photo-thumb">
                <img src={thumbUrl(photo.filename)} alt={photo.filename} loading="lazy" />
              </div>
              <div className="admin-photo-info">
                <span className="photo-name" title={photo.filename}>{photo.filename}</span>
                <span className="photo-meta">
                  {formatSize(photo.size)}
                  {starCounts[photo.key] ? ` · ${starCounts[photo.key]} stars` : ""}
                </span>
              </div>
              <button className="btn-danger btn-sm" onClick={() => deletePhoto(photo.key)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
