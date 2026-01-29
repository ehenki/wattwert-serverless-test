import { Vector3 } from 'three';

interface Point { x: number; y: number; z: number }

/**
 * Check if a point is inside a closed mesh using ray casting.
 * Casts a ray from the point and counts intersections with mesh faces.
 * Odd number of intersections = inside, even = outside.
 */
export function isPointInsideMesh(
  point: Vector3,
  walls: { vertices: Point[] }[],
  roofs: { vertices: Point[] }[],
  ground: { vertices: Point[] }[]
): boolean {
  // Cast ray in positive X direction from the test point
  const rayOrigin = point.clone();
  const rayDir = new Vector3(1, 0, 0);
  
  let intersectionCount = 0;
  const allSurfaces = [...walls, ...roofs, ...ground];

  // Check intersections with all triangulated faces
  for (const surface of allSurfaces) {
    if (surface.vertices.length < 3) continue;
    
    // Triangulate polygon (simple fan triangulation from first vertex)
    for (let i = 1; i < surface.vertices.length - 1; i++) {
      const v0 = new Vector3(surface.vertices[0].x, surface.vertices[0].y, surface.vertices[0].z);
      const v1 = new Vector3(surface.vertices[i].x, surface.vertices[i].y, surface.vertices[i].z);
      const v2 = new Vector3(surface.vertices[i + 1].x, surface.vertices[i + 1].y, surface.vertices[i + 1].z);
      
      if (rayIntersectsTriangle(rayOrigin, rayDir, v0, v1, v2)) {
        intersectionCount++;
      }
    }
  }

  // Odd number of intersections means point is inside
  return intersectionCount % 2 === 1;
}

/**
 * Möller–Trumbore ray-triangle intersection algorithm
 * Returns true if ray intersects the triangle
 */
function rayIntersectsTriangle(
  rayOrigin: Vector3,
  rayDir: Vector3,
  v0: Vector3,
  v1: Vector3,
  v2: Vector3
): boolean {
  const EPSILON = 0.0000001;
  
  const edge1 = new Vector3().subVectors(v1, v0);
  const edge2 = new Vector3().subVectors(v2, v0);
  const h = new Vector3().crossVectors(rayDir, edge2);
  const a = edge1.dot(h);
  
  if (a > -EPSILON && a < EPSILON) {
    return false; // Ray is parallel to triangle
  }
  
  const f = 1.0 / a;
  const s = new Vector3().subVectors(rayOrigin, v0);
  const u = f * s.dot(h);
  
  if (u < 0.0 || u > 1.0) {
    return false;
  }
  
  const q = new Vector3().crossVectors(s, edge1);
  const v = f * rayDir.dot(q);
  
  if (v < 0.0 || u + v > 1.0) {
    return false;
  }
  
  // At this stage we can compute t to find out where the intersection point is on the line
  const t = f * edge2.dot(q);
  
  if (t > EPSILON) {
    return true; // Ray intersects triangle
  }
  
  return false;
}

/**
 * Ensure wall normal points outward from the building volume
 */
export function ensureOutwardNormalWithVolume(
  normal: Vector3,
  wallCenter: Vector3,
  walls: { vertices: Point[] }[],
  roofs: { vertices: Point[] }[],
  ground: { vertices: Point[] }[]
): Vector3 {
  // Test point slightly offset from wall center in normal direction
  const testPoint = wallCenter.clone().add(normal.clone().multiplyScalar(0.1));
  
  // If test point is inside the building, normal points inward - flip it
  const isInside = isPointInsideMesh(testPoint, walls, roofs, ground);
  
  if (isInside) {
    return normal.clone().negate();
  }
  
  return normal;
}

