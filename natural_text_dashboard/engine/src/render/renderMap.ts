import L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { MapProjectionResult } from "../types/result";
import type { MapStyle } from "../types/spec";
import { registerMap } from "./chartRegistry";
import { seriesColor } from "./theme";

const GSI_TILES: Record<MapStyle, { url: string; maxZoom: number; label: string }> = {
  pale: { url: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", maxZoom: 18, label: "淡色地図" },
  std: { url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png", maxZoom: 18, label: "標準地図" },
  blank: { url: "https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png", maxZoom: 18, label: "白地図" },
  seamlessphoto: {
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
    maxZoom: 18,
    label: "写真",
  },
};

const GSI_ATTRIBUTION_HTML =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>';

function divIcon(color: string): L.DivIcon {
  const svg = `<svg width="20" height="26" viewBox="0 0 20 26" xmlns="http://www.w3.org/2000/svg"><path d="M10 0C4.48 0 0 4.48 0 10c0 7.5 10 16 10 16s10-8.5 10-16C20 4.48 15.52 0 10 0z" fill="${color}" stroke="white" stroke-width="1.5"/><circle cx="10" cy="10" r="3.5" fill="white"/></svg>`;
  return L.divIcon({
    html: svg,
    className: "kdm-map-marker",
    iconSize: [20, 26],
    iconAnchor: [10, 26],
    popupAnchor: [0, -24],
  });
}

/**
 * §7.5/§8.2: 地図はレコード投影(PointResult)を Leaflet + markercluster で描画する。
 * bindPopup にはDOM要素だけを渡し、AI由来文字列がHTMLとして解釈されないようにする。
 */
export function renderMap(result: MapProjectionResult, mapStyle: MapStyle = "pale", colorLegend?: Map<string, string>): HTMLElement {
  const wrap = document.createElement("div");

  if (result.points.length === 0) {
    const empty = document.createElement("div");
    empty.className = "kdm-empty";
    empty.textContent = `表示できる座標がありません（除外 ${result.excludedCount}件）。`;
    wrap.appendChild(empty);
    return wrap;
  }

  const mapEl = document.createElement("div");
  mapEl.className = "kdm-map";
  wrap.appendChild(mapEl);

  const tile = GSI_TILES[mapStyle];
  const map = L.map(mapEl, { attributionControl: true });
  registerMap(mapEl, map);
  L.tileLayer(tile.url, { maxZoom: tile.maxZoom, attribution: GSI_ATTRIBUTION_HTML }).addTo(map);

  const cluster = L.markerClusterGroup();
  const colorKeys = [...new Set(result.points.map((p) => p.colorKey).filter((k): k is string => !!k))];
  const colorOf = (key: string | undefined) => {
    if (!key) return seriesColor(0);
    const idx = colorKeys.indexOf(key);
    return seriesColor(idx < 0 ? 0 : idx);
  };

  const markers = result.points.map((p) => {
    const marker = L.marker([p.lat, p.lng], { icon: divIcon(colorOf(p.colorKey)) });
    if (p.label || p.colorKey) {
      const popup = document.createElement("div");
      if (p.label) {
        const strong = document.createElement("strong");
        strong.textContent = p.label;
        popup.appendChild(strong);
      }
      if (p.colorKey) {
        const div = document.createElement("div");
        div.textContent = p.colorKey;
        popup.appendChild(div);
      }
      marker.bindPopup(popup);
    }
    return marker;
  });
  cluster.addLayers(markers);
  map.addLayer(cluster);
  // renderMap() はまだDOMに接続されていない要素を組み立てて返す（呼び出し側が後からgridに挿入する）。
  // L.map() 生成時点ではコンテナが未接続=サイズ0のため、fitBounds をそのまま呼ぶと不正なズームになる。
  // 呼び出し側の挿入が終わる次のフレームまで待ってから invalidateSize + fitBounds する。
  requestAnimationFrame(() => {
    map.invalidateSize();
    map.fitBounds(cluster.getBounds(), { padding: [20, 20] });
  });

  const notes: string[] = [];
  if (result.excludedCount > 0) notes.push(`※ 座標が不正なため ${result.excludedCount}件を除外しました。`);
  if (result.truncated) notes.push("※ マーカー数が上限を超えたため一部のみ表示しています。");
  if (notes.length > 0) {
    const note = document.createElement("div");
    note.className = "kdm-note";
    note.textContent = notes.join(" ");
    wrap.appendChild(note);
  }

  void colorLegend;
  return wrap;
}
