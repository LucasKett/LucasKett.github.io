# China trip page source

`../index.html` is built from these files.

- `build/` holds the page in parts: `a_head.html` (styles), `b_body.html` (layout), `c_data*.js` (stops, legs, days, bookings, fees), `c_geo.js` and `c_roads*.js` (map shapes), `d_map.js` (map), `e_ui.js` (rendering).
- `tools/build.py` joins the parts, `tools/check.js` validates the data, `tools/prerender.js` renders the page to static HTML so it works without JavaScript, `tools/standalone.py` writes the final file, `tools/test5.js` checks for overflow at phone width.

Build order, from a folder that contains `build/` and `tools/`:

    python3 tools/build.py && node tools/check.js "$PWD" && node tools/prerender.js && python3 tools/standalone.py && node tools/test5.js

The page must render without JavaScript.
