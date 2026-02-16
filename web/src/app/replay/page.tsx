'use client';

import PhaserGame from '../../components/PhaserGame';
import ReplayControls from '../../components/ReplayControls';
import HomeButton from '../../components/HomeButton';

export default function ReplayPage() {
  return (
    <div className="flex flex-col h-screen relative">
      <HomeButton />
      <ReplayControls bridgeId="replay" />
      <div className="flex-1 relative">
        <PhaserGame mode="replay" bridgeId="replay" />
      </div>
    </div>
  );
}
