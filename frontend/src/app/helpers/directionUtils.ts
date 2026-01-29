/**
 * Maps a numeric index to a cardinal direction (German abbreviations for display).
 * The mapping assumes the order: 0->N, 1->NE, 2->E, 3->SE, 4->S, 5->SW, 6->W, 7->NW
 */
export function getCardinalDirection(index: number): string {
  const directions = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  return directions[index % directions.length];
}

export function  getFullCardinalDirection(index: number): string {
  const directions = ['Norden', 'Nordosten', 'Osten', 'Südosten', 'Süden', 'Südwesten', 'Westen', 'Nordwesten'];
  return directions[index % directions.length];
}

/**
 * Maps a wallCenter index to the corresponding facadeId.
 * wallCenter index 0 corresponds to N (facadeId 1), index 1 to NE (facadeId 2), etc.
 */
export function wallCenterIndexToFacadeId(wallCenterIndex: number): number {
  return wallCenterIndex + 1;
}

/**
 * Maps a wallCenter index to the English cardinal direction identifier.
 * Used for matching with facade data (facade_N, facade_NE, etc.)
 */
export function wallCenterIndexToDirection(wallCenterIndex: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[wallCenterIndex % directions.length];
}
