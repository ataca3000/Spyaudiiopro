import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-600/95 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-white shadow-2xl border border-amber-400/40 animate-bounce">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-200"></span>
      </span>
      <WifiOff className="w-4 h-4 text-amber-100" />
      <span>Modo sin conexión activo — Todas las funciones locales y grabaciones disponibles</span>
    </div>
  );
};
