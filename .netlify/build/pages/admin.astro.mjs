import { c as createComponent, i as renderComponent, r as renderTemplate } from '../chunks/astro/server_DtASbT4X.mjs';
import 'piccolore';
import { $ as $$BaseLayout } from '../chunks/BaseLayout_BKQeLCa5.mjs';
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import { useState, useRef, useCallback, useEffect } from 'react';
/* empty css                                 */
export { renderers } from '../renderers.mjs';

function Toast({ message, type }) {
  return /* @__PURE__ */ jsx("div", { className: `toast ${type}`, children: message });
}
function AdminApp() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef(null);
  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3e3);
  };
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/photos");
      if (res.ok) {
        const data = await res.json();
        setPhotos(data);
      }
    } catch {
    }
  }, []);
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
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
      checkAuth();
    } else {
      showToast("Invalid password", "error");
    }
  };
  const upload = async (files) => {
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
        showToast("Upload failed - are you logged in?", "error");
        setLoggedIn(false);
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
      checkAuth();
    } else {
      showToast("Delete failed", "error");
    }
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    upload(e.dataTransfer.files);
  };
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
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
    /* @__PURE__ */ jsx("div", { className: "photo-grid-header", children: /* @__PURE__ */ jsxs("h2", { children: [
      photos.length,
      " photo",
      photos.length !== 1 ? "s" : ""
    ] }) }),
    photos.length === 0 ? /* @__PURE__ */ jsx("div", { className: "empty-state", children: /* @__PURE__ */ jsx("p", { children: "No photos yet. Upload some to get started!" }) }) : /* @__PURE__ */ jsx("div", { className: "admin-grid", children: photos.map((photo) => /* @__PURE__ */ jsxs("div", { className: "admin-photo-card", children: [
      /* @__PURE__ */ jsx("div", { className: "admin-photo-thumb", children: /* @__PURE__ */ jsx("img", { src: `/api/photo/${encodeURIComponent(photo.key)}`, alt: photo.filename, loading: "lazy" }) }),
      /* @__PURE__ */ jsxs("div", { className: "admin-photo-info", children: [
        /* @__PURE__ */ jsx("span", { className: "photo-name", title: photo.filename, children: photo.filename }),
        /* @__PURE__ */ jsx("span", { className: "photo-meta", children: formatSize(photo.size) })
      ] }),
      /* @__PURE__ */ jsx("button", { className: "btn-danger btn-sm", onClick: () => deletePhoto(photo.key), children: "Delete" })
    ] }, photo.key)) }),
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
