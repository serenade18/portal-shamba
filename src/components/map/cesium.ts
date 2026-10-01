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
import { token } from "@/components/ui/charts";

/*
 * Shared Cesium setup for the portal's maps: a bare globe (no Cesium widgets)
 * over Esri satellite imagery with place names, so no Cesium ion account is
 * needed. Set VITE_CESIUM_ION_TOKEN to add Cesium World Terrain (3D hills).
 * Only imported from lazily loaded map screens; Cesium is large.
 */

// Copied there by vite-plugin-static-copy (vite.config.ts). Read lazily by Cesium, so setting it here is early enough.
(window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = `${import.meta.env.BASE_URL}cesium/`;

const ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;
if (ION_TOKEN) Ion.defaultAccessToken = ION_TOKEN;

const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

/** [[south, west], [north, east]], as the rest of the portal writes bounds. */
export type Bounds = [[number, number], [number, number]];

export interface MapHandle {
  viewer: Viewer;
  /** The satellite and label layers, to hide while a choropleth is showing. */
  imagery: ImageryLayer[];
}

export function createMap(el: HTMLElement, { tilt = true }: { tilt?: boolean } = {}): MapHandle {
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
  const imagery = [
    viewer.imageryLayers.addImageryProvider(new UrlTemplateImageryProvider({ url: SATELLITE, maximumLevel: 19, credit })),
    viewer.imageryLayers.addImageryProvider(new UrlTemplateImageryProvider({ url: LABELS, maximumLevel: 19 })),
  ];
  scene.globe.baseColor = color("var(--surface)");
  scene.backgroundColor = color("var(--surface)");
  if (scene.skyBox) scene.skyBox.show = false;
  if (scene.sun) scene.sun.show = false;
  if (scene.moon) scene.moon.show = false;
  if (scene.skyAtmosphere) scene.skyAtmosphere.show = false;
  scene.fog.enabled = false;
  scene.screenSpaceCameraController.minimumZoomDistance = 40;
  scene.screenSpaceCameraController.maximumZoomDistance = 25_000_000;
  scene.screenSpaceCameraController.enableTilt = tilt;
  // Double-click would otherwise "track" an entity and lock the camera to it.
  viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  if (ION_TOKEN) {
    createWorldTerrainAsync()
      .then((terrain) => {
        if (!viewer.isDestroyed()) viewer.terrainProvider = terrain;
      })
      .catch(() => {
        /* no terrain: the flat globe still works */
      });
  }
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
} as const;
