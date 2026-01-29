import { Vector3, BufferGeometry, BufferAttribute } from 'three';
// @ts-ignore
import earcut from 'earcut';
import { ensureOutwardNormalWithVolume } from './GeometryUtils';

interface Point { x: number; y: number; z: number }

const vKey = (v: Point) => `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;

function getNormal(vertices: Point[]): Vector3 {
  if (vertices.length < 3) return new Vector3(0, 1, 0);
  
  // Use first three non-colinear points
  const p0 = new Vector3(vertices[0].x, vertices[0].y, vertices[0].z);
  const p1 = new Vector3(vertices[1].x, vertices[1].y, vertices[1].z);
  const p2 = new Vector3(vertices[2].x, vertices[2].y, vertices[2].z);
  
  const v1 = new Vector3().subVectors(p1, p0);
  const v2 = new Vector3().subVectors(p2, p0);
  
  return new Vector3().crossVectors(v2, v1).normalize();
}

function getWallCenter(vertices: Point[]): Vector3 {
  const sum = new Vector3(0, 0, 0);
  vertices.forEach(v => sum.add(new Vector3(v.x, v.y, v.z)));
  return sum.divideScalar(vertices.length);
}

function areNormalsCoplanar(n1: Vector3, n2: Vector3, thresholdDegrees: number = 3): boolean {
  const thresholdRadians = (thresholdDegrees * Math.PI) / 180;
  const dotProduct = Math.abs(n1.dot(n2));
  const angleRadians = Math.acos(Math.min(1, Math.max(-1, dotProduct)));
  return angleRadians < thresholdRadians;
}

export function computeExtrudedGeometries(
  walls: { vertices: Point[] }[],
  roofs: { vertices: Point[] }[],
  ground: { vertices: Point[] }[],
  selectedIndices: number[],
  width: number,
  offset: Vector3,
  eaveHeightDifference: number
): { geometry: BufferGeometry, area: number, height: number, wallIndex: number }[] {
  if (selectedIndices.length === 0) return [];

  // Filter out invalid indices (defensive check for state synchronization issues)
  const validIndices = selectedIndices.filter(idx => idx >= 0 && idx < walls.length && walls[idx]);
  if (validIndices.length === 0) return [];

  // 1. Calculate normals and ensure they point outward using volume-based detection
  const wallNormals = new Map<number, Vector3>();
  validIndices.forEach(idx => {
    const wall = walls[idx];
    const normal = getNormal(wall.vertices);
    const center = getWallCenter(wall.vertices);
    const correctedNormal = ensureOutwardNormalWithVolume(normal, center, walls, roofs, ground);
    wallNormals.set(idx, correctedNormal);
  });

  // 2. Identify shared vertices
  const vertexMap = new Map<string, number[]>();
  validIndices.forEach(idx => {
    walls[idx].vertices.forEach(v => {
      const key = vKey(v);
      if (!vertexMap.has(key)) {
        vertexMap.set(key, []);
      }
      vertexMap.get(key)?.push(idx);
    });
  });

  // 3. Compute extrusion vectors for each vertex
  const extrusionVectors = new Map<string, Vector3>();

  vertexMap.forEach((wallIndices, key) => {
    if (wallIndices.length === 1) {
      // Simple case: vertex belongs to only one wall
      const idx = wallIndices[0];
      const normal = wallNormals.get(idx)!;
      extrusionVectors.set(key, normal.clone().multiplyScalar(width));
    } else {
      // Multiple walls share this vertex - check if they're coplanar
      const normals = wallIndices.map(idx => wallNormals.get(idx)!);
      const allCoplanar = normals.every(n => areNormalsCoplanar(n, normals[0]));

      if (allCoplanar) {
        // All walls are coplanar - use average of normals
        const avgNormal = new Vector3(0, 0, 0);
        normals.forEach(n => avgNormal.add(n));
        avgNormal.normalize();
        extrusionVectors.set(key, avgNormal.multiplyScalar(width));
      } else {
        // Walls meet at an angle - use miter join
        const avgNormal = new Vector3(0, 0, 0);
        normals.forEach(n => avgNormal.add(n));
        avgNormal.normalize();

        // Calculate miter scale to maintain perpendicular distance
        const firstNormal = normals[0];
        const dotProduct = avgNormal.dot(firstNormal);
        const scale = Math.abs(dotProduct) > 0.1 ? width / dotProduct : width;

        extrusionVectors.set(key, avgNormal.multiplyScalar(scale));
      }
    }
  });

  // 4. Calculate extruded vertices for all walls first
  const extrudedWallVertices = validIndices.map(idx => {
    const wall = walls[idx];
    return wall.vertices.map(v => {
      const key = vKey(v);
      const extrusion = extrusionVectors.get(key) || new Vector3(0, 0, 0);
      return {
        x: v.x + extrusion.x,
        y: v.y + extrusion.y,
        z: v.z + extrusion.z
      };
    });
  });

  // 5. Create geometries with adjusted heights per wall
  
  // Calculate global min Z for normalization across all valid walls
  let globalMinZ = Infinity;
  validIndices.forEach(idx => {
    walls[idx].vertices.forEach(v => {
      if (v.z < globalMinZ) globalMinZ = v.z;
    });
  });
  // Also check extruded vertices
  extrudedWallVertices.forEach(wallVerts => {
    wallVerts.forEach(v => {
      if (v.z < globalMinZ) globalMinZ = v.z;
    });
  });
  
  if (globalMinZ === Infinity) globalMinZ = 0;
  console.log("globalMinZ", globalMinZ);

  // --- PASS 1: Identify all potential top-edge levels ---
  // We calculate the rounded target Z for every wall to see what levels exist.
  const potentialLevels = new Set<number>();
  const wallTargetZMap = new Map<number, number>(); // wall index -> raw target Z

  validIndices.forEach((idx, i) => {
    const rawVertices = extrudedWallVertices[i];
    const normalizedVertices = rawVertices.map(v => ({ ...v, z: v.z - globalMinZ }));
    
    let wallMaxZ = -Infinity;
    for (const v of normalizedVertices) {
      if (v.z > wallMaxZ) wallMaxZ = v.z;
    }
    const targetZ = wallMaxZ - (eaveHeightDifference / 100) + 2.0;
    wallTargetZMap.set(idx, targetZ);
    potentialLevels.add(Math.round(targetZ));
  });

  // --- PASS 2: Determine "Master Levels" (snap to higher) ---
  // Sort levels descending. A level absorbs any lower level within margin (1.0).
  const sortedPotential = Array.from(potentialLevels).sort((a, b) => b - a);
  const activeLevels: number[] = [];
  const levelMapping = new Map<number, number>(); // old level -> master level

  for (const level of sortedPotential) {
    // Check if this level can be snapped to an already established higher master level
    const master = activeLevels.find(m => (m - level) <= 1.2 && (m - level) >= 0);
    
    if (master !== undefined) {
      levelMapping.set(level, master);
    } else {
      // New master level
      activeLevels.push(level);
      levelMapping.set(level, level);
    }
  }

  // --- PASS 3: Generate Geometry ---
  return validIndices.map((idx, i) => {
    const rawVertices = extrudedWallVertices[i];
    const normalizedVertices = rawVertices.map(v => ({ ...v, z: v.z - globalMinZ }));
    
    let wallMaxZ = -Infinity;
    for (const v of normalizedVertices) {
      if (v.z > wallMaxZ) wallMaxZ = v.z;
    }

    // Get the wall's raw target
    const rawTarget = wallTargetZMap.get(idx)!;
    // Find its master level
    const rounded = Math.round(rawTarget);
    const finalTargetZ = levelMapping.get(rounded) ?? rounded; // Fallback to self if weirdness happens
    
    // Adjust vertices
    const adjustedVertices = normalizedVertices.map(v => {
      let finalZ = v.z;

      // 1. Top edge adjustment logic (intra-wall) -> snap to the Wall's Final Target
      // "Level out roof edge within margin"
      if (Math.abs(v.z - wallMaxZ) <= 2.3) {
        finalZ = finalTargetZ;
      }
      // 2. Global snapping logic for other high vertices
      else if (finalZ >= 1.0) {
        // Try to snap to an active master level
        let bestSnap = finalZ;
        let minDiff = Infinity;
        let foundSnap = false;

        // Prefer snapping to a higher master level if within margin
        for (const master of activeLevels) {
            const diff = master - finalZ;
            // For arbitrary vertices, we just want the closest master level.
            if (Math.abs(diff) <= 1.5 && Math.abs(diff) < minDiff) {
                minDiff = Math.abs(diff);
                bestSnap = master;
                foundSnap = true;
            }
        }

        if (foundSnap) {
            finalZ = bestSnap;
        } else {
            finalZ = Math.round(finalZ);
        }
      }

      return { ...v, z: finalZ };
    });

    const adjustedOffset = offset.clone();
    adjustedOffset.z -= globalMinZ;

    const geometry = createGeometryFromVertices(adjustedVertices, adjustedOffset);
    
    // re-calculate area...
    let area = 0;
    if (adjustedVertices.length >= 3) {
        const totalCross = new Vector3(0,0,0);
        const p0 = new Vector3(adjustedVertices[0].x, adjustedVertices[0].y, adjustedVertices[0].z);
        for(let i=1; i<adjustedVertices.length-1; i++) {
            const p1 = new Vector3(adjustedVertices[i].x, adjustedVertices[i].y, adjustedVertices[i].z);
            const p2 = new Vector3(adjustedVertices[i+1].x, adjustedVertices[i+1].y, adjustedVertices[i+1].z);
            const v1 = new Vector3().subVectors(p1, p0);
            const v2 = new Vector3().subVectors(p2, p0);
            totalCross.add(new Vector3().crossVectors(v1, v2));
        }
        area = 0.5 * totalCross.length();
    }

    let minZ_final = Infinity;
    let maxZ_final = -Infinity;
    for (const v of adjustedVertices) {
        if (v.z < minZ_final) minZ_final = v.z;
        if (v.z > maxZ_final) maxZ_final = v.z;
    }
    const height = maxZ_final - minZ_final;

    return { geometry, area, height, wallIndex: idx };
  });
}

// Duplicated from Building.tsx to avoid circular imports or messy exports
// Ideally should be shared
function createGeometryFromVertices(
  vertices: Point[],
  offset: Vector3
) {
  const geometry = new BufferGeometry();

  if (!vertices || vertices.length < 3) return geometry;

  // Deduplicate last vertex if repeated
  const eps = 1e-9;
  const verts =
    vertices.length > 3 &&
    Math.abs(vertices[0].x - vertices[vertices.length - 1].x) < eps &&
    Math.abs(vertices[0].y - vertices[vertices.length - 1].y) < eps &&
    Math.abs(vertices[0].z - vertices[vertices.length - 1].z) < eps
      ? vertices.slice(0, -1)
      : vertices;
  
  const pts3D = verts.map(
    (v) => new Vector3(v.x - offset.x, v.z - offset.z, v.y - offset.y)
  );

  if (pts3D.length < 3) return geometry;

  // Build local 2D basis
  const p0 = pts3D[0].clone();
  let i1 = 1;
  while (i1 < pts3D.length && pts3D[i1].distanceTo(p0) < 1e-7) i1++;
  if (i1 >= pts3D.length) return geometry;

  let i2 = i1 + 1;
  let n: Vector3 | null = null;
  while (i2 < pts3D.length) {
    const e1 = pts3D[i1].clone().sub(p0);
    const e2 = pts3D[i2].clone().sub(p0);
    const cross = e1.clone().cross(e2);
    if (cross.lengthSq() > 1e-12) {
      n = cross.normalize();
      break;
    }
    i2++;
  }
  if (!n) return geometry;

  const u = pts3D[i1].clone().sub(p0).normalize();
  const v = n.clone().cross(u).normalize();

  const flat2D: number[] = [];
  for (const p of pts3D) {
    const d = p.clone().sub(p0);
    flat2D.push(d.dot(u), d.dot(v));
  }

  const indices = earcut(flat2D, null, 2);

  if (!indices || indices.length < 3) {
    const fallback: number[] = [];
    for (let i = 1; i < pts3D.length - 1; i++) fallback.push(0, i, i + 1);
    geometry.setIndex(fallback);
  } else {
    geometry.setIndex(indices);
  }

  const positionArray = new Float32Array(pts3D.length * 3);
  for (let i = 0; i < pts3D.length; i++) {
    positionArray[i * 3 + 0] = pts3D[i].x;
    positionArray[i * 3 + 1] = pts3D[i].y;
    positionArray[i * 3 + 2] = pts3D[i].z;
  }
  geometry.setAttribute('position', new BufferAttribute(positionArray, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

