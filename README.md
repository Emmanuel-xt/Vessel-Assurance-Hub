# Vessel Assurance Hub

LOD1 assurance app for offshore vessel operations. Version 1 is a clickable showcase prototype running entirely
on a mocked data layer: no database, no real authentication, no cloud storage. See `CLAUDE.md` for the full brief.

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
npm test           # Vitest
npm run lint
```

## Open it on a phone (same Wi-Fi)

1. Find the computer's Wi-Fi IPv4 address: run `ipconfig` and look for the Wi-Fi adapter's "IPv4 Address"
   (e.g. `192.168.1.23`).
2. Run `npm run dev`. The dev server listens on all network interfaces.
3. On the phone, open `http://<that-address>:3000`.
4. If Windows Firewall asks, allow Node.js on **Private networks**, and make sure the Wi-Fi is set to a
   Private network profile.
