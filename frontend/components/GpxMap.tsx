'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface GpxMapProps {
  gpxUrl: string;
  className?: string;
}

function parseGpxToLatLngs(gpxText: string): [number, number][] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxText, 'application/xml');
  const points: [number, number][] = [];

  // Parse <trkpt> elements
  const trkpts = doc.querySelectorAll('trkpt');
  trkpts.forEach((pt) => {
    const lat = parseFloat(pt.getAttribute('lat') || '');
    const lon = parseFloat(pt.getAttribute('lon') || '');
    if (!isNaN(lat) && !isNaN(lon)) {
      points.push([lat, lon]);
    }
  });

  // Fallback: parse <rtept> elements
  if (points.length === 0) {
    const rtepts = doc.querySelectorAll('rtept');
    rtepts.forEach((pt) => {
      const lat = parseFloat(pt.getAttribute('lat') || '');
      const lon = parseFloat(pt.getAttribute('lon') || '');
      if (!isNaN(lat) && !isNaN(lon)) {
        points.push([lat, lon]);
      }
    });
  }

  return points;
}

export default function GpxMap({ gpxUrl, className = '' }: GpxMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Fetch and parse GPX
    fetch(gpxUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch GPX');
        return res.text();
      })
      .then((gpxText) => {
        const points = parseGpxToLatLngs(gpxText);
        if (points.length === 0) {
          setError(true);
          return;
        }

        const polyline = L.polyline(points, {
          color: '#2563eb',
          weight: 3,
          opacity: 0.8,
        }).addTo(map);

        // Start marker
        const startIcon = L.divIcon({
          html: '<div style="width:12px;height:12px;background:#16a34a;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>',
          iconSize: [12, 12],
          iconAnchor: [6, 6],
          className: '',
        });
        L.marker(points[0], { icon: startIcon }).addTo(map);

        // Finish marker
        const finishIcon = L.divIcon({
          html: '<div style="width:12px;height:12px;background:#dc2626;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>',
          iconSize: [12, 12],
          iconAnchor: [6, 6],
          className: '',
        });
        L.marker(points[points.length - 1], { icon: finishIcon }).addTo(map);

        map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
      })
      .catch(() => {
        setError(true);
      });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [gpxUrl]);

  if (error) return null;

  return <div ref={mapRef} className={`w-full ${className}`} />;
}
