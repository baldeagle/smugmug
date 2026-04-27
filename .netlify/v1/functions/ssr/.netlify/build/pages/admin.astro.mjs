import { c as createComponent, i as renderComponent, r as renderTemplate } from '../chunks/astro/server_DtASbT4X.mjs';
import 'piccolore';
import { $ as $$BaseLayout } from '../chunks/BaseLayout_BEWLDVHA.mjs';
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import { useState, useRef, useCallback, useEffect } from 'react';
/* empty css                                 */
export { renderers } from '../renderers.mjs';

const MAX_UPLOAD_MB = 5;
const MAX_DIMENSION = 4e3;
function resizeFile(file) {
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
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const resized = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
            type: "image/jpeg",
            lastModified: Date.now()
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
function Toast({ message, type }) {
  return /* @__PURE__ */ jsx("div", { className: `toast ${type}`, children: message });
}
function AdminApp() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [stats, setStats] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [totalStars, setTotalStars] = useState(0);
  const [avgViews, setAvgViews] = useState(0);
  const [sort, setSort] = useState("score");
  const [dir, setDir] = useState("desc");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef(null);
  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3e3);
  };
  const fetchStats = useCallback(async (p, s, d) => {
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
    } catch {
    }
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
        } else if (res.ok) {
          setLoggedIn(true);
        }
      } catch {
      }
      setLoading(false);
    };
    check();
  }, []);
  const login = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
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
  const upload = async (files) => {
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
  const deletePhoto = async (key) => {
    if (!confirm("Delete this photo?")) return;
    const res = await fetch(`/api/delete/${encodeURIComponent(key)}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Photo deleted", "success");
      fetchStats(page, sort, dir);
    } else {
      showToast("Delete failed", "error");
    }
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    upload(e.dataTransfer.files);
  };
  const toggleSort = (field) => {
    if (sort === field) {
      setDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setDir("desc");
    }
    setPage(1);
  };
  const sortIndicator = (field) => {
    if (sort !== field) return " ↕";
    return dir === "asc" ? " ▲" : " ▼";
  };
  const fmtDuration = (sec) => {
    if (sec < 60) return `${sec.toFixed(1)}s`;
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}m ${s}s`;
  };
  if (!loggedIn) {
    return /* @__PURE__ */ jsxs("div", { className: "login-container", children: [
      /* @__PURE__ */ jsxs("div", { className: "login-card", children: [
        /* @__PURE__ */ jsx("h1", { children: "Admin Login" }),
        /* @__PURE__ */ jsx("p", { children: "Enter the admin password to manage your gallery." }),
        /* @__PURE__ */ jsxs("form", { onSubmit: login, children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "password",
              placeholder: "Password",
              value: password,
              onChange: (e) => setPassword(e.target.value),
              autoFocus: true
            }
          ),
          /* @__PURE__ */ jsx("button", { type: "submit", className: "btn-primary", style: { marginTop: 12, width: "100%" }, children: "Sign In" })
        ] })
      ] }),
      toast && /* @__PURE__ */ jsx(Toast, { message: toast.message, type: toast.type })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs("div", { className: "admin-header", children: [
      /* @__PURE__ */ jsx("h1", { children: "Photo Admin" }),
      /* @__PURE__ */ jsx("button", { className: "btn-ghost", onClick: () => setLoggedIn(false), children: "Sign Out" })
    ] }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: `upload-zone ${dragOver ? "drag-over" : ""}`,
        onDragOver: (e) => {
          e.preventDefault();
          setDragOver(true);
        },
        onDragLeave: () => setDragOver(false),
        onDrop: handleDrop,
        onClick: () => fileInput.current?.click(),
        children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              ref: fileInput,
              type: "file",
              accept: "image/*",
              multiple: true,
              onChange: (e) => upload(e.target.files),
              style: { display: "none" }
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "upload-zone-content", children: uploading ? /* @__PURE__ */ jsx("p", { children: "Uploading..." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("p", { className: "upload-icon", children: "+" }),
            /* @__PURE__ */ jsx("p", { children: "Drop photos here or click to browse" }),
            /* @__PURE__ */ jsx("p", { className: "upload-hint", children: "Supports JPG, PNG, GIF, WebP" })
          ] }) })
        ]
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "stats-summary", children: [
      /* @__PURE__ */ jsxs("div", { className: "stat-card", children: [
        /* @__PURE__ */ jsx("span", { className: "stat-value", children: total.toLocaleString() }),
        /* @__PURE__ */ jsx("span", { className: "stat-label", children: "Photos" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "stat-card", children: [
        /* @__PURE__ */ jsx("span", { className: "stat-value", children: totalViews.toLocaleString() }),
        /* @__PURE__ */ jsx("span", { className: "stat-label", children: "Total Views" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "stat-card", children: [
        /* @__PURE__ */ jsx("span", { className: "stat-value", children: avgViews }),
        /* @__PURE__ */ jsx("span", { className: "stat-label", children: "Avg Views" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "stat-card", children: [
        /* @__PURE__ */ jsx("span", { className: "stat-value", children: totalStars.toLocaleString() }),
        /* @__PURE__ */ jsx("span", { className: "stat-label", children: "Total Stars" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "photo-grid-header", children: [
      /* @__PURE__ */ jsx("h2", { children: "Photo Metrics" }),
      total > 0 && /* @__PURE__ */ jsx("button", { className: "btn-danger", onClick: async () => {
        if (!confirm(`Delete ALL ${total} photos? This cannot be undone.`)) return;
        const res = await fetch("/api/delete/__all__", { method: "DELETE" });
        if (res.ok) {
          const data = await res.json();
          showToast(`Deleted ${data.deleted} photo(s)`, "success");
          fetchStats(1, sort, dir);
        } else {
          showToast("Delete all failed", "error");
        }
      }, children: "Delete All" })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "empty-state", children: /* @__PURE__ */ jsx("p", { children: "Loading metrics..." }) }) : stats.length === 0 ? /* @__PURE__ */ jsx("div", { className: "empty-state", children: /* @__PURE__ */ jsx("p", { children: "No photos yet. Upload some to get started!" }) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { className: "metrics-table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "metrics-table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { className: "col-rank", children: "#" }),
          /* @__PURE__ */ jsx("th", { className: "col-thumb", children: "Photo" }),
          /* @__PURE__ */ jsxs("th", { className: "sortable", onClick: () => toggleSort("name"), children: [
            "Filename",
            sortIndicator("name")
          ] }),
          /* @__PURE__ */ jsxs("th", { className: "sortable", onClick: () => toggleSort("views"), children: [
            "Views",
            sortIndicator("views")
          ] }),
          /* @__PURE__ */ jsxs("th", { className: "sortable", onClick: () => toggleSort("duration"), children: [
            "Avg Time",
            sortIndicator("duration")
          ] }),
          /* @__PURE__ */ jsxs("th", { className: "sortable", onClick: () => toggleSort("stars"), children: [
            "Stars",
            sortIndicator("stars")
          ] }),
          /* @__PURE__ */ jsxs("th", { className: "sortable", onClick: () => toggleSort("score"), children: [
            "Score",
            sortIndicator("score")
          ] }),
          /* @__PURE__ */ jsx("th", { className: "col-actions", children: "Actions" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: stats.map((photo, i) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { className: "col-rank", children: (page - 1) * 50 + i + 1 }),
          /* @__PURE__ */ jsx("td", { className: "col-thumb", children: /* @__PURE__ */ jsx("img", { src: photo.thumbUrl, alt: photo.filename, loading: "lazy" }) }),
          /* @__PURE__ */ jsx("td", { className: "col-name", title: photo.filename, children: photo.filename }),
          /* @__PURE__ */ jsx("td", { children: photo.views.toLocaleString() }),
          /* @__PURE__ */ jsx("td", { children: fmtDuration(photo.avgDuration) }),
          /* @__PURE__ */ jsx("td", { children: photo.stars > 0 ? photo.stars : "—" }),
          /* @__PURE__ */ jsx("td", { children: photo.score }),
          /* @__PURE__ */ jsx("td", { className: "col-actions", children: /* @__PURE__ */ jsx("button", { className: "btn-danger btn-sm", onClick: () => deletePhoto(photo.key), children: "Delete" }) })
        ] }, photo.key)) })
      ] }) }),
      totalPages > 1 && /* @__PURE__ */ jsxs("div", { className: "pagination", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "btn-ghost",
            disabled: page <= 1,
            onClick: () => setPage((p) => Math.max(1, p - 1)),
            children: "Previous"
          }
        ),
        /* @__PURE__ */ jsxs("span", { className: "page-info", children: [
          "Page ",
          page,
          " of ",
          totalPages
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "btn-ghost",
            disabled: page >= totalPages,
            onClick: () => setPage((p) => Math.min(totalPages, p + 1)),
            children: "Next"
          }
        )
      ] })
    ] }),
    toast && /* @__PURE__ */ jsx(Toast, { message: toast.message, type: toast.type })
  ] });
}

const $$Admin = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Admin", "description": "Photo gallery admin" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "AdminApp", AdminApp, { "client:load": true, "client:component-hydration": "load", "client:component-path": "C:/Users/andyb/Documents/GitHub/smugmug2/src/components/AdminApp", "client:component-export": "default" })} ` })} `;
}, "C:/Users/andyb/Documents/GitHub/smugmug2/src/pages/admin.astro", void 0);

const $$file = "C:/Users/andyb/Documents/GitHub/smugmug2/src/pages/admin.astro";
const $$url = "/admin";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Admin,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
