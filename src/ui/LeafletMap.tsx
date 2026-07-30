import React, { useMemo } from 'react';
import { View, Text, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme, radius } from '@/theme/theme';
import type { AgentPin } from '@/data/api';

/**
 * OpenStreetMap + Leaflet inside a WebView — no API key, no native module,
 * works in Expo Go and the APK. Green pin = clocked in, grey = clocked out.
 */
export type TrackPathPoint = { lat: number; lng: number; at?: string | number };

export function LeafletMap({ pins, path, height = 320 }: { pins: AgentPin[]; path?: TrackPathPoint[]; height?: number }) {
  const c = useTheme();

  const html = useMemo(() => {
    const line = (path || []).filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number').map((p) => [p.lat, p.lng]);
    const markers = pins.flatMap((p) => {
      const out: any[] = [];
      if (p.inLat != null && p.inLng != null) {
        out.push({ lat: p.inLat, lng: p.inLng, kind: 'in', name: p.name, city: p.city || '', time: p.inTime ? new Date(p.inTime).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '', onDuty: p.onDuty });
      }
      if (p.outLat != null && p.outLng != null) {
        out.push({ lat: p.outLat, lng: p.outLng, kind: 'out', name: p.name, city: p.city || '', time: p.outTime ? new Date(p.outTime).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '', onDuty: false });
      }
      return out;
    });
    const data = JSON.stringify(markers);
    const lineData = JSON.stringify(line);
    const dark = c.scheme === 'dark';
    const tiles = dark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;background:${dark ? '#0a0b12' : '#eef1f8'}}
.pin{border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)}
.lbl{font:600 12px -apple-system,Segoe UI,Roboto,sans-serif}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var pts = ${data};
var route = ${lineData};
var map = L.map('map', { zoomControl: true, attributionControl: false });
L.tileLayer('${tiles}', { maxZoom: 19 }).addTo(map);
var group = [];
// Draw the movement path first (so pins sit on top).
if (route && route.length > 1) {
  var poly = L.polyline(route, { color: '#6b62f5', weight: 4, opacity: 0.9, lineJoin: 'round' }).addTo(map);
  route.forEach(function(pt){ group.push(pt); });
  var start = route[0], end = route[route.length-1];
  L.marker(start, { icon: L.divIcon({ className:'', html:'<div class="pin" style="width:16px;height:16px;background:#2ee6a6"></div>', iconSize:[16,16], iconAnchor:[8,8] }) }).addTo(map).bindPopup('<div class="lbl"><b>Start</b></div>');
  L.marker(end, { icon: L.divIcon({ className:'', html:'<div class="pin" style="width:16px;height:16px;background:#f2555a"></div>', iconSize:[16,16], iconAnchor:[8,8] }) }).addTo(map).bindPopup('<div class="lbl"><b>Latest</b></div>');
}
pts.forEach(function(p){
  var color = p.kind === 'in' ? (p.onDuty ? '#2ee6a6' : '#8b83ff') : '#94a3b8';
  var icon = L.divIcon({ className:'', html:'<div class="pin" style="width:16px;height:16px;background:'+color+'"></div>', iconSize:[16,16], iconAnchor:[8,8] });
  var m = L.marker([p.lat, p.lng], { icon: icon }).addTo(map);
  m.bindPopup('<div class="lbl"><b>'+p.name+'</b><br>'+(p.kind==='in'?'Clocked in':'Clocked out')+(p.time?' · '+p.time:'')+(p.city?'<br>'+p.city:'')+'</div>');
  group.push([p.lat, p.lng]);
});
if (group.length === 1) map.setView(group[0], 15);
else if (group.length > 1) map.fitBounds(group, { padding:[36,36], maxZoom: 16 });
else map.setView([21.2088, 72.8393], 12);
</script></body></html>`;
  }, [pins, path, c.scheme]);

  // react-native-web can't host a WebView (and raw DOM nodes break the RNW tree),
  // so the browser preview shows a summary card instead — the APK shows the map.
  if (Platform.OS === 'web') {
    const onDuty = pins.filter((p) => p.onDuty).length;
    return (
      <View style={{ height, borderRadius: radius.lg, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Text style={{ color: c.text, fontSize: 30, fontWeight: '900' }}>{pins.length}</Text>
        <Text style={{ color: c.muted, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
          agent pins ({onDuty} on duty)
        </Text>
        <Text style={{ color: c.faint, fontSize: 11.5, marginTop: 10, textAlign: 'center', lineHeight: 16 }}>
          The live map renders in the Android app.{'\n'}Pins are listed below.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ height, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.cardAlt }}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
      />
    </View>
  );
}
