import { BuildingData, Surface } from '../BuildingViewer/types';

export interface AugmentedWall {
  wall: Surface;
  direction: string;
  facadeId: number;
  originalIndex: number; // Index in the flattened array
}

export const getAllWalls = (data: BuildingData): AugmentedWall[] => {
  const directions = [
    { dir: 'N', id: 1, prop: 'facade_N' as keyof BuildingData },
    { dir: 'NE', id: 2, prop: 'facade_NE' as keyof BuildingData },
    { dir: 'E', id: 3, prop: 'facade_E' as keyof BuildingData },
    { dir: 'SE', id: 4, prop: 'facade_SE' as keyof BuildingData },
    { dir: 'S', id: 5, prop: 'facade_S' as keyof BuildingData },
    { dir: 'SW', id: 6, prop: 'facade_SW' as keyof BuildingData },
    { dir: 'W', id: 7, prop: 'facade_W' as keyof BuildingData },
    { dir: 'NW', id: 8, prop: 'facade_NW' as keyof BuildingData },
  ];

  let allWalls: AugmentedWall[] = [];
  let currentIndex = 0;

  // Check if we have any directional facades
  const hasDirectionalFacades = directions.some(d => {
    const val = data[d.prop];
    return Array.isArray(val) && val.length > 0;
  });

  if (hasDirectionalFacades) {
    for (const { dir, id, prop } of directions) {
      const facades = data[prop] as Surface[] | undefined;
      if (facades) {
        facades.forEach(surface => {
          allWalls.push({
            wall: surface,
            direction: dir,
            facadeId: id,
            originalIndex: currentIndex++
          });
        });
      }
    }
  } else {
    // Fallback to legacy walls if no directional data
    if (data.walls) {
       data.walls.forEach(surface => {
          allWalls.push({
            wall: surface,
            direction: 'Unknown',
            facadeId: 0,
            originalIndex: currentIndex++
          });
        });
    }
  }

  return allWalls;
};
