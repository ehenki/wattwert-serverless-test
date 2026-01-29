// frontend/src/app/components/BuildingViewer/EdgeDimensions.tsx
import { useMemo } from 'react';
import { Vector3 } from 'three';
import { Text, Billboard } from '@react-three/drei';

interface Edge {
  start: Vector3;
  end: Vector3;
  midpoint: Vector3;
  length: number;
}

interface EdgeDimensionsProps {
  vertices: { x: number; y: number; z: number }[];
  offset: Vector3;
  color?: string;
}

export function EdgeDimensions({ vertices, offset, color = '#000000' }: EdgeDimensionsProps) {
  const edges = useMemo(() => {
    if (!vertices || vertices.length < 2) return [];

    const edges: Edge[] = [];
    
    // Create edges between consecutive vertices
    for (let i = 0; i < vertices.length; i++) {
      const v1 = vertices[i];
      const v2 = vertices[(i + 1) % vertices.length]; // Loop back to first vertex
      
      // Convert to local coordinates (with Y/Z swap)
      const start = new Vector3(
        v1.x - offset.x,
        v1.z - offset.z,
        v1.y - offset.y
      );
      const end = new Vector3(
        v2.x - offset.x,
        v2.z - offset.z,
        v2.y - offset.y
      );
      
      // Calculate midpoint and length
      const midpoint = new Vector3().addVectors(start, end).multiplyScalar(0.5);
      const length = start.distanceTo(end);
      
      // Only show edges with meaningful length (> 0.5m)
      if (length > 0.5) {
        edges.push({ start, end, midpoint, length });
      }
    }
    
    return edges;
  }, [vertices, offset]);

  return (
    <group>
      {edges.map((edge, idx) => (
        <Billboard
          key={idx}
          position={[edge.midpoint.x, edge.midpoint.y, edge.midpoint.z]}
        >
          <Text
            fontSize={0.4}
            color={color}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.01}
            outlineColor={`#111`}
          >
            {edge.length.toFixed(2)}m
          </Text>
        </Billboard>
      ))}
    </group>
  );
}

