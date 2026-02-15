'use client';

import dynamic from 'next/dynamic';

const PhaserGame = dynamic(() => import('./PhaserGameInner'), { ssr: false });

export default PhaserGame;
