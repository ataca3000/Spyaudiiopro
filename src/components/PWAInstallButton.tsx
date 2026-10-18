import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X, Check, Laptop } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already running inside standalone PWA window, hide button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const installed = await install();
      if (installed) {
        setJustInstalled(true);
        setTimeout(() => setJustInstalled(false), 4000);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {/* Install Button in Header/Top Bar */}
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-semibold text-xs transition-all shadow-md shadow-amber-500/20 hover:shadow-amber-500/40 cursor-pointer active:scale-95"
        title="Instalar esta aplicación como PWA en tu dispositivo móvil o computadora"
      >
        {isIOS ? (
          <>
            <Smartphone className="w-3.5 h-3.5 text-stone-950" />
            <span>Instalar en iOS</span>
          </>
        ) : isInstallable ? (
          <>
            <Download className="w-3.5 h-3.5 text-stone-950 stroke-[2.5]" />
            <span>Instalar App</span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5 text-stone-950" />
            <span className="hidden sm:inline">Instalar PWA</span>
            <span className="sm:hidden">PWA</span>
          </>
        )}
      </button>

      {/* Success notification if installed */}
      {justInstalled && (
        <div className="fixed top-16 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white shadow-xl text-xs font-medium animate-fade-in">
          <Check className="w-4 h-4 text-emerald-200" />
          <span>¡Aplicación instalada con éxito! Ya está disponible en tu pantalla de inicio.</span>
        </div>
      )}

      {/* Guide Modal for iOS Safari and other browsers */}
      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-stone-900 border border-stone-700/80 p-5 sm:p-6 shadow-2xl relative text-stone-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-stone-100">
                  Instalar como Aplicación (PWA)
                </h3>
                <p className="text-xs text-stone-400">
                  Úsala a pantalla completa, sin barras de navegador y con acceso instantáneo.
                </p>
              </div>
            </div>

            {/* Modal Body */}
            {isIOS ? (
              <div className="space-y-3 bg-stone-950/60 p-4 rounded-xl border border-stone-800 text-xs">
                <p className="text-amber-300 font-medium flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4" /> Pasos para iPhone y iPad (Safari):
                </p>
                <div className="space-y-2 text-stone-300">
                  <div className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px]">
                      1
                    </span>
                    <p>
                      Toca el botón <strong className="text-white">Compartir</strong> (
                      <Share className="w-3.5 h-3.5 inline mx-1 text-sky-400" />
                      ícono de cuadro con flecha arriba) en la barra de herramientas de Safari.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px]">
                      2
                    </span>
                    <p>
                      Desplázate hacia abajo y selecciona{' '}
                      <strong className="text-white">"Agregar a pantalla de inicio"</strong> (
                      <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-amber-400" />
                      ).
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px]">
                      3
                    </span>
                    <p>
                      Presiona <strong className="text-emerald-400">"Agregar"</strong> en la esquina superior derecha.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 bg-stone-950/60 p-4 rounded-xl border border-stone-800 text-xs">
                <div className="space-y-2">
                  <p className="text-amber-300 font-medium flex items-center gap-1.5">
                    <Laptop className="w-4 h-4" /> En Computadora (Chrome / Edge / Brave):
                  </p>
                  <p className="text-stone-300 leading-relaxed">
                    Haz clic en el ícono de <strong className="text-amber-400">Instalar</strong> ubicado en el extremo derecho de la barra de direcciones del navegador (junto a la estrella de favoritos) o en el menú de tres puntos → <em>"Instalar Amplificador y Grabador..."</em>.
                  </p>
                </div>

                <div className="pt-2 border-t border-stone-800/80 space-y-2">
                  <p className="text-emerald-300 font-medium flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4" /> En Android (Chrome):
                  </p>
                  <p className="text-stone-300 leading-relaxed">
                    Toca el menú de tres puntos (⋮) en la esquina superior de Chrome y elige <strong className="text-white">"Instalar aplicación"</strong> o <strong className="text-white">"Agregar a la pantalla principal"</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Benefits */}
            <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-stone-400">
              <div className="bg-stone-800/50 p-2.5 rounded-lg border border-stone-700/50 flex items-center gap-2">
                <span className="text-emerald-400">⚡</span>
                <span>Latencia ultra-baja y sin retraso</span>
              </div>
              <div className="bg-stone-800/50 p-2.5 rounded-lg border border-stone-700/50 flex items-center gap-2">
                <span className="text-amber-400">📶</span>
                <span>Funciona sin conexión (Offline)</span>
              </div>
            </div>

            {/* Close action */}
            <button
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium text-xs transition cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
