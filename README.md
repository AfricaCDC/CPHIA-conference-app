# CPHIA Conference App (PWA)

Installable delegate / staff Progressive Web App for **CPHIA 2026**.

This repository is a **mirror of** [`cphia_pwa/`](https://github.com/africacdcdev/CPHIA/tree/master/cphia_pwa) inside the main [CPHIA](https://github.com/africacdcdev/CPHIA) monorepo. Production still builds and serves the app from that monorepo at `/app/` (e.g. https://admincphia.africacdc.org/app/).

## Stack

- React 18 + Vite 5 + Tailwind CSS 3 + Zustand
- Capacitor (Android / iOS shells)
- Laravel mobile API: `/api/mobile/v1`

## Develop

```bash
cp .env.example .env
npm install
npm run dev      # http://localhost:3000/app/
npm run build
npm run lint
```

Point `VITE_API_BASE_URL` at a running CPHIA API when developing outside the monorepo Docker stack.

## Sync from the monorepo

From the CPHIA checkout:

```bash
./scripts/sync-pwa-to-conference-app.sh
```

Do not edit this mirror as the long-term source of truth — change `cphia_pwa/` in africacdcdev/CPHIA, then re-run the sync.

## License

See `LICENSE.txt`.
