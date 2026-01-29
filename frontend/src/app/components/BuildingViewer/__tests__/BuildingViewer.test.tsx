// frontend/src/components/BuildingViewer/__tests__/BuildingViewer.test.tsx
import { render } from '@testing-library/react';
import { BuildingViewer } from '..';

describe('BuildingViewer', () => {
  it('renders without crashing', () => {
    const mockData = {
      walls: [],
      roofs: [],
      ground: [],
      points: { single: [], multi: [], roofExtrusions: [] },
      extrusions: { tops: [], walls: [] }
    };
    render(<BuildingViewer data={mockData} />);
  });
});