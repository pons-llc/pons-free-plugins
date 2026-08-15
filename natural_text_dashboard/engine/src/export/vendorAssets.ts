// §9.3: CDNからは読み込まず、Chart.js / Leaflet をビルド時にソースごと文字列としてバンドルへ取り込む。
// 地図を含まないダッシュボードのエクスポートには Leaflet を含めない（§9.3の出し分け）。
// chart.js の package.json "exports" マップには dist/chart.umd.min.js が含まれないため、
// bareスペシファイアではなく相対パスで直接ファイルシステムから読み込む。
import chartJsSrc from "../../node_modules/chart.js/dist/chart.umd.min.js?raw";
import leafletCssSrc from "leaflet/dist/leaflet.css?raw";
import leafletJsSrc from "leaflet/dist/leaflet.js?raw";
import markerClusterCssSrc from "leaflet.markercluster/dist/MarkerCluster.css?raw";
import markerClusterDefaultCssSrc from "leaflet.markercluster/dist/MarkerCluster.Default.css?raw";
import markerClusterJsSrc from "leaflet.markercluster/dist/leaflet.markercluster.js?raw";

export { chartJsSrc, leafletCssSrc, leafletJsSrc, markerClusterCssSrc, markerClusterDefaultCssSrc, markerClusterJsSrc };
