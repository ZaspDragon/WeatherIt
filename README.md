# NWS Weather Trading Dashboard

A mobile-style static web app that:
- uses the National Weather Service API
- loads hourly forecasts from `/points -> forecastHourly`
- pulls the nearest observation station and compares latest observed temperature to forecast
- shows a simple "hot bias / cool bias / watch / neutral" signal
- supports browser geolocation and auto-refresh

## Files
- `index.html`
- `style.css`
- `script.js`

## Run locally
Because some browsers can be picky about local file requests and permissions, it's best to run this with a tiny local server:

### Python
```bash
python -m http.server 8000
```
Then open `http://localhost:8000`

## Deploy free
- GitHub Pages
- Netlify
- Vercel

## Notes
- Replace the demo `User-Agent` string in `script.js` with your own app/site/email.
- This dashboard is directional, not a guarantee. Observation feeds can lag.
