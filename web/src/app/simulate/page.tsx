'use client';

import PhaserGame from '../../components/PhaserGame';
import SimControls from '../../components/SimControls';

export default function SimulatePage() {
  return (
    <div className="flex flex-col h-screen">
      <SimControls />
      <div className="flex-1 relative">
        <PhaserGame mode="simulate" bridgeId="simulate" />
      </div>
    </div>
  );
}
