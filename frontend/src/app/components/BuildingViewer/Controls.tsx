// frontend/src/components/BuildingViewer/Controls.tsx
import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

export function Controls() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const [initialCameraPosition, setInitialCameraPosition] = useState<[number, number, number]>([20, 20, 20]);

  // Store initial camera position when component mounts
  useEffect(() => {
    if (camera && camera.position) {
      const pos = camera.position;
      setInitialCameraPosition([pos.x, pos.y, pos.z]);
    }
  }, [camera]);

  // Function to reset camera to initial position
  const resetCameraView = () => {
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.object.position.set(...initialCameraPosition);
      controlsRef.current.update();
    }
  };

  // Make reset function available globally for the button
  useEffect(() => {
    // @ts-ignore - Add to window for access from button
    window.resetCameraView = resetCameraView;
  }, [resetCameraView]);

  return (
    <>
      {/* This component handles the controls logic but doesn't render UI */}
      <OrbitControls
        ref={controlsRef}
        enableDamping={false}
        target={[0, 0, 0]}
      />
    </>
  );
}