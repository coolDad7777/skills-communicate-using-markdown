# Stamp System

A small, local-first web app for creating reusable stamps and applying them to targets with notes, evidence links and tags. Data is stored in `localStorage`.

Run (ES modules need an HTTP server):

```sh
cd stamps && python3 -m http.server 8000   # open http://localhost:8000
```

Test the pure helpers (CRUD, filtering, export):

```sh
node --test stamps/
```
