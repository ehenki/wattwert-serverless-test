import { useEffect } from 'react';
import eventBus from '../helpers/eventBus';

interface Vertex {
  x: number;
  y: number;
  z: number;
}

interface Wall {
  vertices: Vertex[];
}

interface WallInfo {
  wallIndex: number;
  area: number;
  maxHeight: number;
  width: number;
  direction?: string;
  vertices?: Vertex[];
}

/**
 * Calculate the horizontal width of a wall (max distance between any two vertices in X-Y plane)
 */
export function calculateWallWidth(vertices: Vertex[]): number {
  if (!vertices || vertices.length < 2) return 0;
  
  let maxWidth = 0;
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const dx = vertices[i].x - vertices[j].x;
      const dy = vertices[i].y - vertices[j].y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > maxWidth) maxWidth = distance;
    }
  }
  return Math.round(maxWidth * 10) / 10;
}

/**
 * Calculate the area of a 3D polygon using the cross product method
 */
export function calculate3DPolygonArea(vertices: Vertex[]): number {
  let area = 0;
  if (vertices.length >= 3) {
    // Use cross product method for 3D polygon area
    const v0 = vertices[0];
    for (let i = 1; i < vertices.length - 1; i++) {
      const v1 = vertices[i];
      const v2 = vertices[i + 1];
      
      // Vectors from v0 to v1 and v0 to v2
      const a = {
        x: v1.x - v0.x,
        y: v1.y - v0.y,
        z: v1.z - v0.z
      };
      const b = {
        x: v2.x - v0.x,
        y: v2.y - v0.y,
        z: v2.z - v0.z
      };
      
      // Cross product
      const cross = {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
      };
      
      // Add half the magnitude of cross product
      const magnitude = Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z);
      area += magnitude / 2;
    }
  }
  return Math.round(area*10)/10;
}

/**
 * Calculate the perimeter of a 3D polygon
 */
export function calculatePolygonPerimeter(vertices: Vertex[]): number {
  let perimeter = 0;
  if (vertices.length < 2) return 0;
  for (let i = 0; i < vertices.length; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % vertices.length];
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const dz = v2.z - v1.z;
    perimeter += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return Math.round(perimeter * 10) / 10;
}

/**
 * Calculate the height of a wall based on its vertices
 */
export function calculateWallHeight(vertices: Vertex[]): number {
  const maxHeight = Math.max(...vertices.map(v => v.z));
  const minHeight = Math.min(...vertices.map(v => v.z));
  return Math.round((maxHeight - minHeight) * 10) / 10;
}

/**
 * Calculate wall information (area and height) for all walls
 */
export function calculateWallsInfo(
  walls: Wall[], 
  extrudedAreas?: Map<number, { area: number, height: number }>,
  directions?: string[]
): WallInfo[] {
  return walls.map((wall, index) => {
    const vertices = wall.vertices;
    let area = calculate3DPolygonArea(vertices);
    let maxHeight = calculateWallHeight(vertices);
    let width = calculateWallWidth(vertices);

    if (extrudedAreas && extrudedAreas.has(index)) {
      const extruded = extrudedAreas.get(index)!;
      area = Math.round(extruded.area*10)/10;
      maxHeight = Math.round(extruded.height * 10) / 10;
      // Width usually stays the same for extrusions, but let's be safe
    }

    return {
      wallIndex: index,
      area: area,
      maxHeight: maxHeight,
      width: width,
      direction: directions ? directions[index] : undefined,
      vertices: vertices
    };
  });
}

/**
 * Hook to handle wall measurement logic and event bus communication
 */
export function useWallMeasurements(
  walls: Wall[], 
  ground: Wall[], 
  currentSlide: number, 
  extrudedAreas?: Map<number, { area: number, height: number }>,
  directions?: string[],
  userRole?: string | null
) {
  // Calculate and dispatch wall info when entering slide 2 or when data changes
  useEffect(() => {
    if ((userRole === "geruestbauer" && currentSlide === 2) || (userRole !== "geruestbauer" && currentSlide === 1)) {
      const wallsInfo = calculateWallsInfo(walls, extrudedAreas, directions);
      const groundPerimeter = ground.reduce((sum, g) => sum + calculatePolygonPerimeter(g.vertices), 0);
      eventBus.dispatch('wall-info-update', { walls: wallsInfo, groundPerimeter });
    }
  }, [walls, ground, currentSlide, extrudedAreas, directions]);

  // Listen for wall info requests
  useEffect(() => {
    const handleRequest = () => {
      if ((userRole === "geruestbauer" && currentSlide === 2) || (userRole !== "geruestbauer" && currentSlide === 1)) {
        const wallsInfo = calculateWallsInfo(walls, extrudedAreas, directions);
        const groundPerimeter = ground.reduce((sum, g) => sum + calculatePolygonPerimeter(g.vertices), 0);
        eventBus.dispatch('wall-info-update', { walls: wallsInfo, groundPerimeter });
      }
    };

    eventBus.on('request-wall-info', handleRequest as EventListener);
    return () => {
      eventBus.off('request-wall-info', handleRequest as EventListener);
    };
  }, [walls, ground, currentSlide, extrudedAreas, directions]);
}
