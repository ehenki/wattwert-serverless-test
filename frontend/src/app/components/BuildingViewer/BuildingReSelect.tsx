import React, { useMemo } from 'react';
import { BufferGeometry, Vector3, BufferAttribute } from 'three';
// @ts-ignore - earcut types not available
import earcut from 'earcut';
import { Surface } from './types';

// Helper to create geometry (copied from Building.tsx to keep this file self-contained)
function createGeometryFromVertices(
  vertices: { x: number; y: number; z: number }[],
  offset: Vector3
) {
  const geometry = new BufferGeometry();

  // Need at least a triangle
  if (!vertices || vertices.length < 3) return geometry;

  // Some sources repeat the first vertex at the end – drop it if so
  const eps = 1e-9;
  const verts =
    vertices.length > 3 &&
    Math.abs(vertices[0].x - vertices[vertices.length - 1].x) < eps &&
    Math.abs(vertices[0].y - vertices[vertices.length - 1].y) < eps &&
    Math.abs(vertices[0].z - vertices[vertices.length - 1].z) < eps
      ? vertices.slice(0, -1)
      : vertices;

  // Convert to local 3D (note the Y/Z swap matching Building.tsx logic)
  const pts3D = verts.map(
    (v) => new Vector3(v.x - offset.x, v.z - offset.z, v.y - offset.y)
  );

  // Guard: degenerate polygon
  if (pts3D.length < 3) return geometry;

  // --- Build a local 2D basis on the polygon’s plane ---
  // Find two non-colinear edges for the plane
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
  if (!n) return geometry; // all colinear

  const u = pts3D[i1].clone().sub(p0).normalize(); // axis in-plane
  const v = n.clone().cross(u).normalize();         // second axis in-plane

  // --- Project to 2D for triangulation ---
  // earcut expects a flat [x0, y0, x1, y1, ...] array
  const flat2D: number[] = [];
  for (const p of pts3D) {
    const d = p.clone().sub(p0);
    flat2D.push(d.dot(u), d.dot(v));
  }

  // Triangulate (no holes). Works for concave polygons, any winding.
  const indices = earcut(flat2D, null, 2);

  // If earcut fails (rare), fall back to triangle fan to avoid crashing
  if (!indices || indices.length < 3) {
    const fallback: number[] = [];
    for (let i = 1; i < pts3D.length - 1; i++) fallback.push(0, i, i + 1);
    geometry.setIndex(fallback);
  } else {
    geometry.setIndex(indices);
  }

  // Set positions from original 3D points
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

// Group surfaces into connected components (buildings)
function groupSurfaces(surfaces: Surface[]): number[][] {
    const epsilon = 0.01; // Tolerance for vertex matching
    const vertexMap = new Map<string, number[]>(); // "x,y,z" -> [surfaceIndex, ...]
    
    // 1. Build map of vertices to surfaces
    surfaces.forEach((surface, idx) => {
        surface.vertices.forEach(v => {
            // Round to avoid float precision issues
            const key = `${Math.round(v.x / epsilon)},${Math.round(v.y / epsilon)},${Math.round(v.z / epsilon)}`;
            if (!vertexMap.has(key)) {
                vertexMap.set(key, []);
            }
            vertexMap.get(key)!.push(idx);
        });
    });

    // 2. Build adjacency graph (surface index -> Set of adjacent surface indices)
    const adjacency = new Array<Set<number>>(surfaces.length).fill(null as any).map(() => new Set<number>());
    
    vertexMap.forEach((indices) => {
        for (let i = 0; i < indices.length; i++) {
            for (let j = i + 1; j < indices.length; j++) {
                const u = indices[i];
                const v = indices[j];
                adjacency[u].add(v);
                adjacency[v].add(u);
            }
        }
    });

    // 3. Find connected components
    const visited = new Set<number>();
    const groups: number[][] = [];

    for (let i = 0; i < surfaces.length; i++) {
        if (!visited.has(i)) {
            const group: number[] = [];
            const stack = [i];
            visited.add(i);

            while (stack.length > 0) {
                const current = stack.pop()!;
                group.push(current);

                adjacency[current].forEach((neighbor) => {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        stack.push(neighbor);
                    }
                });
            }
            groups.push(group);
        }
    }

    return groups;
}


interface GroupedBuildingsRendererProps {
  surfaces: Surface[] | undefined;
  selectedGroupIndices: number[];
  onGroupClick: ((index: number) => void) | undefined;
  offset: Vector3;
  colorSelected: string;
  colorDefault: string;
  opacitySelected: number;
  opacityDefault: number;
  active: boolean; // Is interaction enabled (slide 1)
  hoverColor?: string;
  renderOrder?: number;
}

export function GroupedBuildingsRenderer({
  surfaces = [],
  selectedGroupIndices,
  onGroupClick,
  offset,
  colorSelected,
  colorDefault,
  opacitySelected,
  opacityDefault,
  active,
  hoverColor = '#ff9900', // Default highlight color
  renderOrder = 1
}: GroupedBuildingsRendererProps) {
  
  // 1. Calculate groups (memoized)
  const groups = useMemo(() => groupSurfaces(surfaces), [surfaces]);

  // 2. Calculate geometries for all surfaces (memoized)
  const geometries = useMemo(() => {
    return surfaces.map(s => createGeometryFromVertices(s.vertices, offset));
  }, [surfaces, offset]);

  return (
    <group>
      {groups.map((groupIndices, groupIdx) => {
        const isSelected = selectedGroupIndices.includes(groupIdx);
        
        // Determine color and opacity for the whole group
        const color = isSelected ? colorSelected : colorDefault;
        const opacity = isSelected ? opacitySelected : opacityDefault;

        return (
          <group key={`building-group-${groupIdx}`}>
            {groupIndices.map(surfaceIndex => (
              <mesh
                key={`surface-${surfaceIndex}`}
                geometry={geometries[surfaceIndex]}
                renderOrder={renderOrder}
                onClick={(e) => {
                    if (active && onGroupClick) {
                        e.stopPropagation();
                        onGroupClick(groupIdx);
                    }
                }}
                onPointerOver={(e) => {
                    if (active) {
                        e.stopPropagation();
                        document.body.style.cursor = 'pointer';
                        
                        // Optional: Highlight effect on hover (could be done via state, but direct manipulation is faster)
                        // This might affect all meshes in the group if we structure it right, 
                        // currently it just highlights the hovered surface unless we manage state.
                        // For now, let's stick to simple cursor change as user requested "selection" logic primarily.
                        // To highlight the *whole* building on hover would require local state.
                    }
                }}
                onPointerOut={(e) => {
                    if (active) {
                        e.stopPropagation();
                        document.body.style.cursor = 'grab';
                    }
                }}
              >
                 <meshPhongMaterial 
                    color={color} 
                    opacity={opacity} 
                    transparent 
                    side={2} 
                    depthWrite={false} 
                 />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}
