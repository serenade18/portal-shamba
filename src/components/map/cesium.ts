import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  Cartesian2,
  Cartographic,
  Color,
  createWorldTerrainAsync,
  Credit,
  ImageryLayer,
  Ion,
  Math as CesiumMath,
  Rectangle,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  Viewer,
} from "cesium";
import * as api from "@/api/endpoints";
import { token } from "@/components/ui/charts";

/*
 * Shared Cesium setup for the portal's maps: a bare globe (no Cesium widgets)
 * over Esri satellite imagery with place names, so no Cesium ion account is
 * needed. With a Cesium ion token (set by super admins at /admin/keys, served
 * by GET /config/public) the globe also gets Cesium World Terrain (3D hills).
 * Only imported from lazily loaded map screens; Cesium is large.
 */

// Copied there by vite-plugin-static-copy (vite.config.ts). Read lazily by Cesium, so setting it here is early enough.
(window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = `${import.meta.env.BASE_URL}cesium/`;

/** The Cesium ion token, asked for once per page load ("" when none is set). */
let ionToken: Promise<string> | null = null;
function loadIonToken(): Promise<string> {
  ionToken ??= api.config.public().then(
    (c) => c.cesium_ion_token,
    () => {
      ionToken = null; // try again next time a map opens
      return "";
    },
  );
  return ionToken;
}

const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

/** [[south, west], [north, east]], as the rest of the portal writes bounds. */
export type Bounds = [[number, number], [number, number]];

export interface MapHandle {
  viewer: Viewer;
  /** The satellite and label layers. */
  imagery: { satellite: ImageryLayer; labels: ImageryLayer };
}

export function createMap(el: HTMLElement, { tilt = true, space = false }: {
  tilt?: boolean;
  /** A globe in space (stars, atmosphere) for the zoomed-out staff map; otherwise a plain backdrop. */
  space?: boolean;
} = {}): MapHandle {
  const viewer = new Viewer(el, {
    baseLayer: false,
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    // Only draw when something changes: these maps sit on phones in the field.
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
  });
  const scene = viewer.scene;
  const credit = new Credit("Imagery © Esri, Maxar, Earthstar Geographics");
  const imagery = {
    satellite: viewer.imageryLayers.addImageryProvider(new UrlTemplateImageryProvider({ url: SATELLITE, maximumLevel: 19, credit })),
    labels: viewer.imageryLayers.addImageryProvider(new UrlTemplateImageryProvider({ url: LABELS, maximumLevel: 19 })),
  };
  if (space) {
    // Stars and a blue rim of atmosphere; no sun or moon, and no night side.
    scene.backgroundColor = Color.BLACK;
    scene.globe.baseColor = Color.fromCssColorString("#0b1d2a");
    scene.globe.showGroundAtmosphere = true;
    scene.globe.enableLighting = false;
  } else {
    scene.globe.baseColor = color("var(--surface)");
    scene.backgroundColor = color("var(--surface)");
    if (scene.skyBox) scene.skyBox.show = false;
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = false;
    scene.fog.enabled = false;
  }
  if (scene.sun) scene.sun.show = false;
  if (scene.moon) scene.moon.show = false;
  scene.screenSpaceCameraController.minimumZoomDistance = 40;
  scene.screenSpaceCameraController.maximumZoomDistance = 25_000_000;
  scene.screenSpaceCameraController.enableTilt = tilt;
  // Double-click would otherwise "track" an entity and lock the camera to it.
  viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  loadIonToken()
    .then(async (ion) => {
      if (!ion || viewer.isDestroyed()) return;
      Ion.defaultAccessToken = ion;
      const terrain = await createWorldTerrainAsync();
      if (!viewer.isDestroyed()) viewer.terrainProvider = terrain;
    })
    .catch(() => {
      /* no terrain: the flat globe still works */
    });
  return { viewer, imagery };
}

/** A design token (or any CSS colour) as a Cesium colour. */
export function color(value: string, alpha = 1): Color {
  return (Color.fromCssColorString(token(value)) ?? Color.GRAY).withAlpha(alpha);
}

/** The [lng, lat] on the ground under a point on the canvas, if it's on the globe. */
export function lngLatAt(viewer: Viewer, at: Cartesian2): [number, number] | null {
  const scene = viewer.scene;
  const ray = viewer.camera.getPickRay(at);
  const hit = (ray && scene.globe.pick(ray, scene)) ?? viewer.camera.pickEllipsoid(at, scene.globe.ellipsoid);
  if (!hit) return null;
  const c = Cartographic.fromCartesian(hit);
  return [CesiumMath.toDegrees(c.longitude), CesiumMath.toDegrees(c.latitude)];
}

/** The [lng, lat] under the middle of the map. */
export function centre(viewer: Viewer): [number, number] | null {
  const canvas = viewer.scene.canvas;
  return lngLatAt(viewer, new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2));
}

/** How high the camera is above the ground, in metres. */
export const altitude = (viewer: Viewer) => viewer.camera.positionCartographic.height;

/** Bounds grown by a share of their size on every side, so edges aren't flush with the map's. */
export function rectangle([[south, west], [north, east]]: Bounds, pad = 0.1, minSpan = 0): Rectangle {
  const padLng = Math.max((east - west) * pad, (minSpan - (east - west)) / 2, 0);
  const padLat = Math.max((north - south) * pad, (minSpan - (north - south)) / 2, 0);
  return Rectangle.fromDegrees(west - padLng, Math.max(-89, south - padLat), east + padLng, Math.min(89, north + padLat));
}

export function boundsOf(ring: [number, number][]): Bounds {
  let w = Infinity, e = -Infinity, s = Infinity, n = -Infinity;
  for (const [lng, lat] of ring) {
    w = Math.min(w, lng); e = Math.max(e, lng); s = Math.min(s, lat); n = Math.max(n, lat);
  }
  return [[s, w], [n, e]];
}

/** Camera heights standing in for Leaflet zoom levels. */
export const HEIGHT = {
  /** A farm fills the view (~ zoom 17). */
  farm: 700,
  /** A farm and its neighbours (~ zoom 16). */
  farmArea: 1_500,
  /** A country (~ zoom 6). */
  country: 1_800_000,
  /** The whole globe. */
  world: 20_000_000,
} as const;
