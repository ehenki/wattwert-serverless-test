// frontend/src/components/BuildingViewer/Building.tsx
import { useMemo, useEffect, useState, useCallback } from 'react';
import { BufferGeometry, Vector3, BufferAttribute } from 'three';
import { BuildingData } from './types';
import { InstancedMesh, SphereGeometry, MeshStandardMaterial, Matrix4 } from 'three';
import { Billboard, Text, Circle, Image, RoundedBox } from '@react-three/drei';
// @ts-ignore - earcut types not available
import earcut from 'earcut';
import eventBus from '../helpers/eventBus';
import { EdgeDimensions } from './EdgeDimensions';
import { useWallMeasurements, calculate3DPolygonArea } from './MeasurementLogic';
import { getAllWalls } from '../helpers/buildingDataUtils';
import { wallCenterIndexToFacadeId } from '../../helpers/directionUtils';
import { fetchBuildingImages } from '../database/ImageDownloader';

import { computeExtrudedGeometries } from './ExtrusionLogic';
import { GroupedBuildingsRenderer } from './BuildingReSelect';

interface BuildingProps {
  data: BuildingData;
  currentSlide: number;
  showDimensions?: boolean;
  wallColor?: string;
  selectedWalls?: number[];
  onWallClick?: (wallIndex: number) => void;
  geruestWidth?: number;
  eaveHeightDifference?: number;
  userRole?: string | null;
  lod2Id?: string | null;
  selectedNeighbours?: number[];
  selectedSurroundingBuildings?: number[];
  onNeighbourClick?: (index: number) => void;
  onSurroundingBuildingClick?: (index: number) => void;
  selectionModeActive?: boolean;
  isMainBuildingSelected?: boolean;
  onMainBuildingClick?: () => void;
}

// For point clouds, use instanced meshes
function PointCloud({ points, color, offset }: { points: { x: number; y: number; z: number }[]; color: string; offset: Vector3 }) {
  const instancedMesh = useMemo(() => {
    const mesh = new InstancedMesh(
      new SphereGeometry(0.1),
      new MeshStandardMaterial({ color }),
      points.length
    );
    
    points.forEach((point, i) => {
      const matrix = new Matrix4();
      matrix.setPosition(
        point.x - offset.x,
        point.z - offset.z, // Swap Y and Z for better visualization
        point.y - offset.y
      );
      mesh.setMatrixAt(i, matrix);
    });
    
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, [points, color, offset]);

  return <primitive object={instancedMesh} />;
}

// For wall center markers with numbers


import { getCardinalDirection } from '../../helpers/directionUtils';

function UploadButton({ 
  pos, 
  originalIndex, 
  facadeId 
}: { 
  pos: [number, number, number]; 
  originalIndex: number; 
  facadeId: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const scale = isHovered ? 1.15 : 1.0;

  return (
    <Billboard
      position={pos}
      onClick={(e) => {
        e.stopPropagation();
        eventBus.dispatch('trigger-image-upload', { number: getCardinalDirection(originalIndex) });
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setIsHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setIsHovered(false);
        document.body.style.cursor = 'grab';
      }}
    >
      {/* The photo icon */}
      <group scale={scale}>
        {/* Frame/Border */}
        <RoundedBox args={[5.4, 2.7 * (597/1226) + 0.2, 0.02]} radius={0.2}>
          <meshBasicMaterial color="#fff" />
        </RoundedBox>
        {/* Camera image with correct aspect ratio */}
        <Image
          url="/photo-upload.png"
          scale={[5.2, 2.7 * (597/1226)]}
          position={[0, 0, 0.02]}
          opacity={1}
          transparent
        />
      </group>

      {/* The wall number, in the top-left corner of the icon. */}
      <group position={[-2.8, 1.0, 0.1]} scale={scale}>
        <Circle args={[0.65, 32]}>
          <meshBasicMaterial color="#000000" />
        </Circle>
        <Text
          fontSize={0.8}
          color="white"
          anchorX="center"
          anchorY="middle"
          material-props={{ depthTest: false, depthWrite: false }}
        >
          {getCardinalDirection(originalIndex)}
        </Text>
      </group>
    </Billboard>
  );
}

function WallCenterMarkers({
  centers,
  offset,
  imageUrls,
  userRole,
  currentSlide
}: {
  centers: { center: { x: number; y: number; z: number }; originalIndex: number }[]
  offset: Vector3
  imageUrls: Record<string, string>
  userRole?: string | null
  currentSlide: number
}) {
  return (
    <group>
      {centers.map(({ center, originalIndex }, idx) => {
        const pos: [number, number, number] = [
          center.x - offset.x,
          center.z - offset.z + 1,
          center.y - offset.y,
        ];
        
        const facadeId = wallCenterIndexToFacadeId(originalIndex);
        const imageUrl = imageUrls[String(facadeId)];

        return (
          <group key={idx}>
            {/* Upload button */}
            {userRole !== "geruestbauer" && currentSlide === 1 && (
              <UploadButton pos={pos} originalIndex={originalIndex} facadeId={String(facadeId)} />
            )}

            {/* Display uploaded image underneath the button if it exists */}
            {imageUrl && (
              <Billboard
                position={[pos[0], pos[1] - 3.5, pos[2]]}
              >
                <group>
                  {/* White frame for the image */}
                  <boxGeometry args={[6.2, 4.2, 0.02]} />
                  <meshBasicMaterial color="#000" />
                  {/* The uploaded image */}
                  <Image
                    url={imageUrl}
                    scale={[6, 4]}
                    position={[0, 0, 0.02]}
                    opacity={1}
                    transparent
                  />
                </group>
              </Billboard>
            )}
          </group>
        )
      })}
    </group>
  )
}




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

  // Convert to local 3D (note your Y/Z swap)
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

export function Building({ data, currentSlide, showDimensions = false, wallColor = '#cccccc', selectedWalls = [], onWallClick, geruestWidth, eaveHeightDifference, userRole, lod2Id, selectedNeighbours = [], selectedSurroundingBuildings = [], onNeighbourClick, onSurroundingBuildingClick, selectionModeActive = false, isMainBuildingSelected = false, onMainBuildingClick }: BuildingProps) {
  // Use allWalls to consolidate legacy walls and new directional facades
  const allWalls = useMemo(() => getAllWalls(data), [data]);
  
  // State to store facade images
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  
  // Function to load images
  const loadImages = useCallback(() => {
    if (lod2Id) {
      fetchBuildingImages(lod2Id).then(urls => {
        console.log('[Building] Loaded facade images:', urls);
        setImageUrls(urls);
      }).catch(err => {
        console.error('Error fetching facade images:', err);
      });
    }
  }, [lod2Id]);

  // Fetch facade images when lod2Id changes
  useEffect(() => {
    loadImages();
  }, [loadImages]);
  
  // Listen for image upload events to refresh images
  useEffect(() => {
    const handleImageUploaded = (event: Event) => {
      const customEvent = event as CustomEvent<{ ID_LOD2: string; facade_id: string }>;
      if (customEvent.detail?.ID_LOD2 === lod2Id) {
        console.log('[Building] Image uploaded, refreshing images...');
        // Wait a bit for the database to update, then reload
        setTimeout(() => loadImages(), 500);
      }
    };

    eventBus.on('facade-image-uploaded', handleImageUploaded as EventListener);
    return () => {
      eventBus.off('facade-image-uploaded', handleImageUploaded as EventListener);
    };
  }, [lod2Id, loadImages]);

  // Calculate the center point for normalization
  const offset = useMemo(() => {
    const allVertices = [
      ...allWalls.flatMap(w => w.wall.vertices),
      ...data.roofs.flatMap(r => r.vertices),
      ...(data.neighbours || []).flatMap(n => n.vertices),
      ...(data.surroundingBuildings || []).flatMap(b => b.vertices)
    ];
    
    if (allVertices.length === 0) return new Vector3();
    
    const minX = Math.min(...allVertices.map(v => v.x));
    const maxX = Math.max(...allVertices.map(v => v.x));
    const minY = Math.min(...allVertices.map(v => v.y));
    const maxY = Math.max(...allVertices.map(v => v.y));
    const minZ = Math.min(...allVertices.map(v => v.z));
    const maxZ = Math.max(...allVertices.map(v => v.z));
    
    return new Vector3(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2
    );
  }, [data, allWalls]);

  const geometries = useMemo(() => {
    console.log('Creating geometries from data:', {
      walls: allWalls.length,
      roofs: data.roofs.length,
      wallVertices: allWalls.map(w => w.wall.vertices.length),
      roofVertices: data.roofs.map(r => r.vertices.length),
      offset: offset.toArray()
    });
    
    // Convert data to Three.js geometries
    const wallGeometries = allWalls.map(wallData => createGeometryFromVertices(wallData.wall.vertices, offset));
    const roofGeometries = data.roofs.map(roof => createGeometryFromVertices(roof.vertices, offset));
    const groundGeometries = data.ground.map(ground => createGeometryFromVertices(ground.vertices, offset));
    // Neighbours and SurroundingBuildings are now handled by GroupedBuildingsRenderer

    return { walls: wallGeometries, roofs: roofGeometries, ground: groundGeometries };
  }, [data, allWalls, offset]);

  const extrudedData = useMemo(() => {
    if (currentSlide === 2 && userRole === 'geruestbauer' && geruestWidth && selectedWalls.length > 0) {
      return computeExtrudedGeometries(
        allWalls.map(w => w.wall),
        data.roofs,
        data.ground,
        selectedWalls,
        geruestWidth / 100,
        offset,
        eaveHeightDifference || 0
      );
    }
    return [];
  }, [data, allWalls, selectedWalls, geruestWidth, eaveHeightDifference, currentSlide, offset, userRole]);

  const extrudedAreas = useMemo(() => {
    if (extrudedData.length > 0) {
      const map = new Map<number, { area: number, height: number }>();
      extrudedData.forEach(data => {
        map.set(data.wallIndex, { area: data.area, height: data.height });
      });
      return map;
    }
    return undefined;
  }, [extrudedData]);

  // Handle wall measurements and event bus communication
  useWallMeasurements(
    allWalls.map(w => w.wall), 
    data.ground, 
    currentSlide, 
    extrudedAreas,
    allWalls.map(w => w.direction),
    userRole
  );

  return (
    <group>
      {/* Ground - Render first (behind everything) */}
      {geometries.ground.map((geometry, i) => (
        <mesh key={`ground-${i}`} geometry={geometry} renderOrder={1}>
          <meshPhongMaterial color="#555555" opacity={0.7} transparent side={2} />
        </mesh>
      ))}

      {/* Surrounding Buildings - not direct neighbours */}
      <GroupedBuildingsRenderer
        surfaces={data.surroundingBuildings}
        selectedGroupIndices={selectedSurroundingBuildings}
        onGroupClick={onSurroundingBuildingClick}
        offset={offset}
        colorSelected='#ff9900'
        colorDefault='#dddddd'
        opacitySelected={0.6}
        opacityDefault={0.3}
        active={currentSlide === 1 && selectionModeActive}
      />

      {/* Neighbours */}
      <GroupedBuildingsRenderer
        surfaces={data.neighbours}
        selectedGroupIndices={selectedNeighbours}
        onGroupClick={onNeighbourClick}
        offset={offset}
        colorSelected='#ff9900'
        colorDefault='#aaaaaa'
        opacitySelected={0.7}
        opacityDefault={0.4}
        active={currentSlide === 1 && selectionModeActive}
      />

      {/* Extrusion Tops - Render second */}
      {data.extrusions.tops.map((top, i) => (
        <mesh key={`extrusion-top-${i}`} geometry={createGeometryFromVertices(top.vertices, offset)} renderOrder={2}>
          <meshPhongMaterial color="red" opacity={0.7} transparent side={2} />
        </mesh>
      ))}

      {/* Extrusion Walls - Render third */}
      {data.extrusions.walls.map((wallGroup, groupIndex) =>
        wallGroup.map((wall, wallIndex) => (
          <mesh
            key={`extrusion-wall-${groupIndex}-${wallIndex}`}
            geometry={createGeometryFromVertices(wall.vertices, offset)}
            renderOrder={3}
          >
            <meshPhongMaterial color="orange" opacity={0.7} transparent side={2} />
          </mesh>
        ))
      )}

      {/* Main Building Selection Mode Logic */}
      {selectionModeActive && (
         <group
            onClick={(e) => {
                e.stopPropagation();
                if (onMainBuildingClick) onMainBuildingClick();
            }}
            onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
            }}
            onPointerOut={(e) => {
                 e.stopPropagation();
                 document.body.style.cursor = 'grab';
            }}
         >
             {[...geometries.walls, ...geometries.roofs].map((geometry, i) => {
                 const baseColor = getComputedStyle(document.documentElement).getPropertyValue('--base-col1').trim() || '#8977FD';
                 const color = isMainBuildingSelected ? baseColor : "#bbbbbb";
                 const opacity = isMainBuildingSelected ? 0.8 : 0.4;
                 
                 return (
                    <mesh key={`main-select-${i}`} geometry={geometry} renderOrder={4}>
                         <meshPhongMaterial color={color} opacity={opacity} transparent side={2} />
                    </mesh>
                 );
             })}
         </group>
      )}

      {/* Walls - Render fourth - Hide in Selection Mode */}
      {!selectionModeActive && geometries.walls.map((geometry, i) => {
        // Here i is the index in allWalls
        const isSelected = selectedWalls.includes(i);
        const extrudedWall = extrudedData.find(data => data.wallIndex === i);
        const hasExtrusion = extrudedWall && ((userRole === "geruestbauer" && currentSlide === 2) || (userRole !== "geruestbauer" && currentSlide === 1));

        if (hasExtrusion) {
           const extrudedGeom = extrudedWall.geometry;
           const extrusionColor = (() => {
             if (typeof document !== 'undefined') {
                const col = getComputedStyle(document.documentElement).getPropertyValue('--base-col2').trim();
                return col || '#4DE0A9';
             }
             return '#4DE0A9';
           })();

           return (
             <mesh
                key={`wall-extruded-${i}`}
                geometry={extrudedGeom}
                renderOrder={4}
                onClick={(e) => {
                    if (onWallClick) {
                        e.stopPropagation();
                        onWallClick(i);
                    }
                }}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    document.body.style.cursor = 'pointer';
                }}
                onPointerOut={(e) => {
                    e.stopPropagation();
                    document.body.style.cursor = 'grab';
                }}
             >
                <meshPhongMaterial color={extrusionColor} opacity={0.5} transparent side={2} />
             </mesh>
           );
        }

        // Get the actual color value from CSS variable if selected
        const color = (() => {
          if (isSelected && ((userRole === "geruestbauer" && currentSlide === 2) || (userRole !== "geruestbauer" && (currentSlide === 1 || currentSlide === 2)))) {
            // Get computed CSS variable value
            const baseColor = getComputedStyle(document.documentElement)
              .getPropertyValue('--base-col1')
              .trim();
            return baseColor || '#8977FD'; // Fallback color
          }
          return wallColor;
        })();
        
        return (
          <mesh 
            key={`wall-${i}`} 
            geometry={geometry} 
            renderOrder={4}
            onClick={(e) => {
              if (onWallClick && ((userRole === "geruestbauer" && currentSlide === 2) || (userRole !== "geruestbauer" && currentSlide === 1))) {
                e.stopPropagation();
                onWallClick(i);
              }
            }}
            onPointerOver={(e) => {
              if ((userRole === "geruestbauer" && currentSlide === 2) || (userRole !== "geruestbauer" && currentSlide === 1)) {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
              }
            }}
            onPointerOut={(e) => {
              if ((userRole === "geruestbauer" && currentSlide === 2) || (userRole !== "geruestbauer" && currentSlide === 1)) {
                e.stopPropagation();
                document.body.style.cursor = 'grab';
              }
            }}
          >
            <meshPhongMaterial color={color} opacity={0.8} transparent side={2}/>
          </mesh>
        );
      })}

      {/* Roofs - Render last (on top) - Hide in Selection Mode */}
      {!selectionModeActive && geometries.roofs.map((geometry, i) => (
        <mesh key={`roof-${i}`} geometry={geometry} renderOrder={5}>
          <meshPhongMaterial color="#B96B67" opacity={0.8} transparent side={2} />
        </mesh>
      ))}

      {/* Point Clouds - Render on top of everything */}
      {data.points.single.length > 0 && (
        <PointCloud points={data.points.single} color="#111111" offset={offset} />
      )}
      {data.points.multi.length > 0 && (
        <PointCloud points={data.points.multi} color="#999999" offset={offset} />
      )}
      {data.points.roofExtrusions.map((points, i) => (
        <PointCloud
          key={`roof-extrusion-${i}`}
          points={points}
          color={`hsl(${(i * 360) / data.points.roofExtrusions.length}, 70%, 50%)`}
          offset={offset}
        />
      ))}


      {(currentSlide === 1 || currentSlide === 2) && data.wallCenters && data.wallCenters.length > 0 && (() => {
        // Get the facadeIds of all selected walls
        const selectedFacadeIds = new Set(
          selectedWalls
            .map(wallIndex => allWalls[wallIndex])
            .filter(wall => wall !== undefined)
            .map(wall => wall.facadeId)
        );

        // Filter wallCenters to only show buttons for directions with selected facades
        const filteredCenters = data.wallCenters
          .map((center, index) => ({ center, originalIndex: index }))
          .filter(item => {
            // Filter out placeholder centers
            if (item.center.x === 1 && item.center.y === 1 && item.center.z === 1) {
              return false;
            }
            // Only show if at least one facade of this direction is selected
            const facadeId = wallCenterIndexToFacadeId(item.originalIndex);
            return selectedFacadeIds.has(facadeId);
          });

        return filteredCenters.length > 0 ? (
          <WallCenterMarkers 
            centers={filteredCenters}
            offset={offset}
            imageUrls={imageUrls}
            userRole={userRole}
            currentSlide={currentSlide}
          />
        ) : null;
      })()}

      {/* Edge Dimensions */}
      {showDimensions && (
        <>
          {/* Wall edge dimensions */}
          {allWalls.map((wallData, i) => (
            <EdgeDimensions key={`wall-dim-${i}`} vertices={wallData.wall.vertices} offset={offset} />
          ))}
          
          {/* Roof edge dimensions */}
          {data.roofs.map((roof, i) => (
            <EdgeDimensions key={`roof-dim-${i}`} vertices={roof.vertices} offset={offset} />
          ))}
          
          {/* Ground edge dimensions */}
          {data.ground.map((ground, i) => (
            <EdgeDimensions key={`ground-dim-${i}`} vertices={ground.vertices} offset={offset} />
          ))}
        </>
      )}

    </group>
  );
}
