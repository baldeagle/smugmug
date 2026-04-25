import { useState, useEffect, useCallback, useRef } from "react";

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return <div className={`toast ${type}`}>{message}</div>;
}

export default function AdminApp() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [photos, setPhotos] = useState<any[]>([]);
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
      const res = await fetch("/api/photos");
      if (res.ok) {
        const data = await res.json();
        setPhotos(data);
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
      formData.append("files", file);
    }
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        showToast(`Uploaded ${data.uploaded.length} photo(s)`, "success");
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
                <img src={`/api/photo/${encodeURIComponent(photo.key)}`} alt={photo.filename} loading="lazy" />
              </div>
              <div className="admin-photo-info">
                <span className="photo-name" title={photo.filename}>{photo.filename}</span>
                <span className="photo-meta">{formatSize(photo.size)}</span>
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
