import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@maplibre/maplibre-gl-leaflet';

// Clean, muted base map in the style of delivery apps (Swiggy / Zomato):
// light gray land, white roads, soft blue water, gentle green parks and
// very few labels/icons, so the live markers are what stands out.
//
// Free and key-less: vector tiles from OpenFreeMap (openfreemap.org), drawn with
// MapLibre GL inside the existing react-leaflet map.

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

const C = {
  land: '#f3f4f6',
  residential: '#eef0f3',
  building: '#e5e7eb',
  park: '#dcf0d5',
  wood: '#e3f1dc',
  water: '#bfe0f5',
  waterLine: '#a9d4f0',
  roadMinor: '#ffffff',
  roadMajor: '#ffffff',
  roadMajorCasing: '#e1e4e8',
  motorway: '#fde9b4',
  motorwayCasing: '#f2d48a',
  rail: '#d6d9de',
  label: '#6b7280',
  labelStrong: '#374151',
  halo: '#ffffff',
};

let styleCache = null;

function setPaint(layer, prop, value) {
  layer.paint = { ...layer.paint, [prop]: value };
}

function buildStyle(base) {
  const style = JSON.parse(JSON.stringify(base));
  // Layers dropped to reduce clutter (shields, minor/path names, ice etc.)
  const hide = new Set([
    'landcover_ice_shelf', 'landcover_glacier', 'highway-name-path', 'highway-shield-non-us',
    'highway-shield-us-interstate', 'road_shield_us', 'label_other', 'boundary_3', 'aeroway-taxiway',
    'railway_transit_dashline', 'railway_service_dashline', 'railway_dashline', 'waterway_line_label',
  ]);
  style.layers = style.layers.filter((l) => !hide.has(l.id));

  style.layers.forEach((l) => {
    const id = l.id;
    if (id === 'background') setPaint(l, 'background-color', C.land);
    else if (id === 'park') { setPaint(l, 'fill-color', C.park); setPaint(l, 'fill-opacity', 1); }
    else if (id === 'landcover_wood') { setPaint(l, 'fill-color', C.wood); setPaint(l, 'fill-opacity', 0.9); }
    else if (id === 'water') setPaint(l, 'fill-color', C.water);
    else if (id === 'waterway') setPaint(l, 'line-color', C.waterLine);
    else if (id === 'landuse_residential') setPaint(l, 'fill-color', C.residential);
    else if (id === 'building') { setPaint(l, 'fill-color', C.building); setPaint(l, 'fill-outline-color', '#dcdfe4'); }
    else if (id === 'highway_minor' || id === 'highway_path' || id === 'road_pier') setPaint(l, 'line-color', C.roadMinor);
    else if (id === 'highway_major_casing') setPaint(l, 'line-color', C.roadMajorCasing);
    else if (id === 'highway_major_inner' || id === 'highway_major_subtle') setPaint(l, 'line-color', C.roadMajor);
    else if (id.startsWith('highway_motorway') || id.startsWith('tunnel_motorway')) {
      setPaint(l, 'line-color', id.includes('casing') ? C.motorwayCasing : C.motorway);
    } else if (id.startsWith('railway')) setPaint(l, 'line-color', C.rail);
    else if (l.type === 'symbol') {
      const strong = id.startsWith('label_city') || id === 'label_town';
      setPaint(l, 'text-color', strong ? C.labelStrong : C.label);
      setPaint(l, 'text-halo-color', C.halo);
      setPaint(l, 'text-halo-width', 1.4);
    }
  });
  return style;
}

async function loadStyle() {
  if (styleCache) return styleCache;
  const res = await fetch(STYLE_URL);
  if (!res.ok) throw new Error(`Map style ${res.status}`);
  styleCache = buildStyle(await res.json());
  return styleCache;
}

export const SMOOTH_MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OSM</a>';

export default function SmoothBaseMap({ onError }) {
  const map = useMap();

  useEffect(() => {
    let layer = null;
    let cancelled = false;
    loadStyle()
      .then((style) => {
        if (cancelled) return;
        layer = L.maplibreGL({ style, attribution: SMOOTH_MAP_ATTRIBUTION });
        layer.addTo(map);
      })
      .catch((err) => {
        console.warn('Smooth base map unavailable, using fallback tiles', err);
        if (!cancelled && onError) onError(err);
      });
    return () => {
      cancelled = true;
      if (layer) map.removeLayer(layer);
    };
  }, [map, onError]);

  return null;
}
