# BMC Project Task Dashboard

A responsive React 18 + TypeScript single-page dashboard for Bombay Mercantile Co-operative Bank, powered by NyneOS.

## Run

- npm install
- npm run dev
- npm run build
- npm run test

## Architecture

Zustand is the persisted source of truth (bmb_dashboard_v1). Widgets, board, timeline, and calendars derive from the same filtered task set. React Hook Form and Zod validate task creation, dnd-kit provides mouse/touch/keyboard board movement, and hand-written SVG renders theme-aware charts. Theme and mode are independent and persisted in bmb_theme_v1.
