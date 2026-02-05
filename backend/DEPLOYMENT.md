# cPanel Deployment Guide – acc.iges.ug

Same structure as the cos project: frontend and backend deployed separately on the same domain.

---

## Step 1: Backend Setup

### 1.1 Create Node.js app in cPanel

1. Go to **cPanel → Setup Node.js App → Create Application**
2. Settings:
   - **Node.js version:** 20.x or higher
   - **Application mode:** Production
   - **Application root:** `/home/YOUR_USERNAME/acc.iges.ug` (or your domain folder)
   - **Application URL:** `https://acc.iges.ug/v1`
   - **Application startup file:** `app.js`

### 1.2 Upload backend files

Upload the **entire `backend` folder** to the application root:

- `server.js`, `app.js`, `admin.js`
- `package.json`, `package-lock.json`
- `create-admin.js`, `create-manager.js`, `check-users.js`

### 1.3 Create `.env` on the server

In the application root, create `.env`:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/bwws?appName=Cluster0
MONGODB_DB=invcaa
JWT_SECRET=your-secure-random-secret-key
NODE_ENV=production
ALLOWED_ORIGINS=https://acc.iges.ug,http://acc.iges.ug
```

### 1.4 Install and start

1. Click **Run NPM Install** in the Node.js app
2. Click **Restart**

### 1.5 Create admin user (first time only)

SSH or cPanel Terminal:

```bash
cd ~/acc.iges.ug
node create-admin.js admin yourpassword
```

---

## Step 2: Frontend Setup

### 2.1 Build

```bash
cd vue-project
npm install
npm run build
```

### 2.2 Upload dist folder

Upload **all contents** of `vue-project/dist/` to `public_html/` (or the folder for acc.iges.ug):

- `index.html`
- `assets/` folder
- `config.js`
- `favicon.ico`
- `.htaccess`

---

## Step 3: DNS and SSL

- Point `acc.iges.ug` to your server
- cPanel → **SSL/TLS Status** → enable AutoSSL for `acc.iges.ug`

---

## Result

- App: https://acc.iges.ug
- API: https://acc.iges.ug/v1/...

Frontend uses relative URLs (same origin). No extra config needed.

---

## Checklist

- [ ] Backend uploaded
- [ ] Node.js app created (URL: acc.iges.ug/v1)
- [ ] `.env` created (MONGODB_URI, JWT_SECRET, ALLOWED_ORIGINS, INITIAL_* passwords)
- [ ] npm install + Restart (admin/manager auto-created on first start)
- [ ] Frontend built and dist uploaded
- [ ] `.htaccess` in place
- [ ] DNS + SSL set up

---

## Troubleshooting

**502/503:** Node.js app not running → check logs, restart in cPanel

**CORS:** Ensure `ALLOWED_ORIGINS` includes `https://acc.iges.ug`

**API returns HTML:** Node app URL must be `acc.iges.ug/v1` so `/v1/*` hits the backend
