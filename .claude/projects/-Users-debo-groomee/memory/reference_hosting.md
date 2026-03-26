---
name: Hosting on Render
description: Groomee is hosted on Render (not Vercel) — use render.yaml for infra config, Render Cron Jobs for scheduled tasks
type: reference
---

Groomee is deployed on Render, not Vercel.

**How to apply:** Use `render.yaml` for infrastructure-as-code. Cron jobs are Render Cron Job services that curl the API endpoints. Never create vercel.json.
