// frontend/src/components/BuildingViewer/types.ts

// Type declaration for global reset function
declare global {
  interface Window {
    resetCameraView?: () => void;
  }
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Surface {
  vertices: Vector3D[];
}

export interface BuildingData {
  walls: Surface[];
  facade_N?: Surface[];
  facade_NE?: Surface[];
  facade_E?: Surface[];
  facade_SE?: Surface[];
  facade_S?: Surface[];
  facade_SW?: Surface[];
  facade_W?: Surface[];
  facade_NW?: Surface[];
  roofs: Surface[];
  ground: Surface[];
  wallCenters?: Vector3D[];
  points: {
    single: Vector3D[];
    multi: Vector3D[];
    roofExtrusions: Vector3D[][];
  };
  extrusions: {
    tops: Surface[];
    walls: Surface[][];
  };
  coordinates?: [number, number]; // [longitude, latitude]
  neighbours?: Surface[];
  surroundingBuildings?: Surface[];
}
