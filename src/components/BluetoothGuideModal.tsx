import React from 'react';
import { X, Headphones, Radio, Mic, Zap, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface BluetoothGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BluetoothGuideModal: React.FC<BluetoothGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-5 text-stone-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-100 text-sm sm:text-base">
                Guía de Uso: Bluetooth, Monitoreo Dual y Micrófono
              </h3>
              <p className="text-[11px] text-stone-400">
                Aprende a configurar tus audífonos para escuchar en vivo y grabar a distancia
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configurations List */}
        <div className="space-y-4 text-xs sm:text-sm">
          {/* FAQ: Microphone vs Speaker Independence */}
          <div className="bg-gradient-to-r from-amber-950/40 via-stone-950 to-cyan-950/40 border border-amber-600/40 p-4 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs sm:text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>¿El micrófono puede ser elegido aunque se apague el audio de uno o de AMBOS audífonos?</span>
            </div>
            <p className="text-stone-200 text-xs leading-relaxed font-medium">
              <strong>¡SÍ, 100% CONFIRMADO, TANTO DE UNO COMO DE AMBOS AUDÍFONOS!</strong> Los micrófonos y los altavoces son circuitos independientes:
            </p>
            <ul className="space-y-2 text-xs text-stone-300 pl-1">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>
                  <strong>Silencio Total en Ambos Audífonos (0 Sonido):</strong> Si apagas el altavoz de <strong>ambos audífonos</strong> a la vez, los dos parlantes quedan en <strong>silencio absoluto</strong>. Nadie a su alrededor podrá escuchar nada proveniente de ellos, eliminando cualquier sospecha o acople acústico.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>
                  <strong>Micrófonos de Ambos Audífonos Activos:</strong> A pesar de que los altavoces de ambos audífonos estén apagados, los <strong>micrófonos (de ambos audífonos o del que elijas) continúan activos al 100%</strong>. Capturan cada susurro y conversación con la amplificación y ecualización elegidas.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>
                  <strong>Grabación y Vúmetro Intactos:</strong> La app graba la señal directamente de los micrófonos antes de llegar a los altavoces. Verás las ondas sonoras moverse en la pantalla y la grabación se guardará en tu teléfono con fidelidad cristalina.
                </span>
              </li>
            </ul>
          </div>

          {/* Configuration 1 */}
          <div className="bg-stone-950/50 border border-stone-800 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs sm:text-sm">
              <Radio className="w-4 h-4" />
              <span>Opción 1 (Recomendada): Teléfono como Micrófono Remoto + Audífonos Bluetooth</span>
            </div>
            <p className="text-stone-300 text-xs leading-relaxed">
              Es la forma más clara y potente:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-stone-400 pl-1">
              <li>Coloca el celular en la mesa o cerca del área / persona que deseas escuchar.</li>
              <li>Ponte tus audífonos Bluetooth y aléjate a la distancia que necesites (hasta 10-15 metros).</li>
              <li>Activa <strong>"Monitoreo"</strong> y ajusta la <strong>"Ganancia"</strong> (ej. 2.5x o 4x).</li>
              <li>Si solo quieres tener un audífono en tu oreja y la otra libre, selecciona en la app <strong>"Solo Izquierdo (L)"</strong> o <strong>"Solo Derecho (R)"</strong>.</li>
            </ol>
          </div>

          {/* Configuration 2 */}
          <div className="bg-stone-950/50 border border-stone-800 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs sm:text-sm">
              <Mic className="w-4 h-4" />
              <span>Opción 2: Dejar un Auricular como Micrófono y escuchar por el otro</span>
            </div>
            <p className="text-stone-300 text-xs leading-relaxed">
              Muchos audífonos Bluetooth TWS permiten usar el micrófono del auricular:
            </p>
            <ul className="space-y-1.5 text-xs text-stone-400">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Aísla el auricular emisor:</strong> Usa los botones <strong>"Solo Izquierdo (L)"</strong> o <strong>"Solo Derecho (R)"</strong> en la app. Esto apaga el altavoz del audífono que vas a dejar como micrófono o con otra persona, evitando que emita sonido y haga eco o acople.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Selecciona la entrada:</strong> En el selector de "Fuente de Entrada", elige el micrófono de tu auricular Bluetooth conectado si aparece listado.
                </span>
              </li>
            </ul>
          </div>

          {/* Low Latency Tips */}
          <div className="bg-stone-950/50 border border-stone-800 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs sm:text-sm">
              <Zap className="w-4 h-4" />
              <span>Consejos para Baja Latencia (Menor Retraso de Audio)</span>
            </div>
            <ul className="space-y-1 text-xs text-stone-400">
              <li>• La aplicación utiliza Web Audio en modo interactivo prioritario (~10-15ms en el procesador).</li>
              <li>• Si tus audífonos Bluetooth cuentan con <strong>"Modo Juego" o "Baja Latencia"</strong>, actívalo en sus botones táctiles o app oficial.</li>
              <li>• Audífonos con cable o adaptadores USB-C/Jack ofrecen latencia prácticamente nula (0ms).</li>
            </ul>
          </div>

          {/* Protection */}
          <div className="bg-stone-950/50 border border-stone-800 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs sm:text-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>Protección Auditiva y Botón de Emergencia</span>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed">
              El <strong>Limitador de Seguridad</strong> está activo por defecto para amortiguar golpes repentinos en el micrófono. Si en algún momento escuchas un pitido (acople acústico), pulsa el botón <strong>"Silencio Rápido"</strong> en la barra superior.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-2 border-t border-stone-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-xs sm:text-sm transition cursor-pointer"
          >
            Entendido, volver a la app
          </button>
        </div>
      </div>
    </div>
  );
};
