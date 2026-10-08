# Environment Startup Instructions

## 1. Start the Backend API (Terminal 1)

To run the server, execute the following command in a separate terminal from the root directory:

```powershell
node server/src/index.js
```

* **URL:** `http://localhost:5000`
* **Database:** SQLite file located at `server/insuminder.db`

---

## 2. Start the Frontend Client (Terminal 2)

To run the client application, execute the following commands in another terminal:

```powershell
cd client
npm run dev
```

* **URL:** `http://localhost:5173`
* **Proxy:** Requests to `/api/*` are forwarded automatically to `http://localhost:5000`