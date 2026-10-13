# Frontend - LPG Leak Detection Dashboard

React app built with Vite.

## Requirements

- Node.js 22 or newer
- The Backend running on `http://localhost:3000` (see the root README)

## Run locally 

```bash
cd frontend
cp .env.example .env
npm install 
npm run dev 
```

Open http://localhost:5173. The page should show `Backend: ok` .

## Environment variabales

| Name | Description | Local value |
| --- | --- | --- |
| `VITE_API_URL` | Backend API base URL | `http://localhost:3000/api/v1` |

On Vercel, set `VITE_API_URL` to the Railway backend URL.