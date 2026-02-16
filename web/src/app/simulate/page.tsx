'use client';

import PhaserGame from '../../components/PhaserGame';
import SimControls from '../../components/SimControls';
import HomeButton from '../../components/HomeButton';

export default function SimulatePage() {
  return (
    <div className="flex flex-col h-screen relative">
      <HomeButton />
      <SimControls />
      <div className="flex-1 relative">
        <PhaserGame mode="simulate" bridgeId="simulate" />
      </div>
    </div>
  );
}
