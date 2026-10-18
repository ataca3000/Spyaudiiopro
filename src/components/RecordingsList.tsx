import React, { useState, useRef, useEffect } from 'react';
import {
  ListMusic,
  Play,
  Pause,
  Download,
  Trash2,
  Edit2,
  Check,
  X,
  Clock,
  HardDrive,
  FileType,
  Loader2,
  FileAudio,
  Wand2,
  Share2,
  Music,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { SavedRecording } from '../types';
import {
  convertBlobToWavBlob,
  convertBlobToMp3Blob,
  downloadBlobToDevice,
  shareAudioFile,
} from '../utils/audioWav';
import { RecordedAudioEffectsModal } from './RecordedAudioEffectsModal';

interface RecordingsListProps {
  recordings: SavedRecording[];
  onDeleteRecording: (id: string) => void;
  onRenameRecording: (id: string, newName: string) => void;
  onSaveProcessedRecording?: (newRecording: SavedRecording) => Promise<void>;
}

export const RecordingsList: React.FC<RecordingsListProps> = ({
  recordings,
  onDeleteRecording,
  onRenameRecording,
  onSaveProcessedRecording,
}) => {
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameText, setEditNameText] = useState<string>('');

  // Audio Effects Modal state
  const [effectsModalRec, setEffectsModalRec] = useState<SavedRecording | null>(null);

  // Download & Export Modal state
  const [downloadModalRec, setDownloadModalRec] = useState<SavedRecording | null>(null);
  const [downloadCustomName, setDownloadCustomName] = useState<string>('');
  const [isConvertingWav, setIsConvertingWav] = useState<boolean>(false);
  const [isConvertingMp3, setIsConvertingMp3] = useState<boolean>(false);
  const [isModalSharing, setIsModalSharing] = useState<boolean>(false);
  const [modalShareFormat, setModalShareFormat] = useState<'mp3' | 'wav'>('mp3');

  // Quick Share state per card
  const [sharingRecId, setSharingRecId] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<{
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const handlePlayToggle = (rec: SavedRecording) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
        }
      };
      audioRef.current.onended = () => {
        setActivePlayingId(null);
        setCurrentTime(0);
      };
    }

    if (activePlayingId === rec.id) {
      // Pause
      audioRef.current.pause();
      setActivePlayingId(null);
    } else {
      // Play new
      const url = URL.createObjectURL(rec.blob);
      audioRef.current.src = url;
      audioRef.current.play();
      setActivePlayingId(rec.id);
      setCurrentTime(0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const seekTime = parseFloat(e.target.value);
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const startRename = (rec: SavedRecording) => {
    setEditingId(rec.id);
    setEditNameText(rec.name);
  };

  const saveRename = (id: string) => {
    if (editNameText.trim()) {
      onRenameRecording(id, editNameText.trim());
    }
    setEditingId(null);
  };

  // Open Export / Download Modal
  const openDownloadModal = (rec: SavedRecording) => {
    setDownloadModalRec(rec);
    setDownloadCustomName(rec.name);
  };

  const closeDownloadModal = () => {
    if (isConvertingWav || isConvertingMp3 || isModalSharing) return;
    setDownloadModalRec(null);
    setDownloadCustomName('');
  };

  // Execute WAV Export
  const handleDownloadWav = async () => {
    if (!downloadModalRec) return;

    setIsConvertingWav(true);
    try {
      const wavBlob = await convertBlobToWavBlob(downloadModalRec.blob);

      const cleanName = downloadCustomName.trim() || downloadModalRec.name;
      const fileName = cleanName.toLowerCase().endsWith('.wav')
        ? cleanName
        : `${cleanName}.wav`;

      downloadBlobToDevice(wavBlob, fileName);
      closeDownloadModal();
    } catch (err) {
      console.error('Error al convertir audio a formato WAV:', err);
      alert('Ocurrió un error al procesar el audio en formato WAV.');
    } finally {
      setIsConvertingWav(false);
    }
  };

  // Execute MP3 Export
  const handleDownloadMp3 = async () => {
    if (!downloadModalRec) return;

    setIsConvertingMp3(true);
    try {
      const mp3Blob = await convertBlobToMp3Blob(downloadModalRec.blob, 192);

      const cleanName = downloadCustomName.trim() || downloadModalRec.name;
      const fileName = cleanName.toLowerCase().endsWith('.mp3')
        ? cleanName
        : `${cleanName}.mp3`;

      downloadBlobToDevice(mp3Blob, fileName);
      closeDownloadModal();
    } catch (err) {
      console.error('Error al convertir audio a formato MP3:', err);
      alert('Ocurrió un error al procesar el audio en formato MP3.');
    } finally {
      setIsConvertingMp3(false);
    }
  };

  // Execute Original Format Export
  const handleDownloadOriginal = () => {
    if (!downloadModalRec) return;

    const ext = downloadModalRec.mimeType.includes('wav')
      ? 'wav'
      : downloadModalRec.mimeType.includes('ogg')
      ? 'ogg'
      : downloadModalRec.mimeType.includes('mp4')
      ? 'm4a'
      : 'webm';

    const cleanName = downloadCustomName.trim() || downloadModalRec.name;
    const fileName = cleanName.toLowerCase().endsWith(`.${ext}`)
      ? cleanName
      : `${cleanName}.${ext}`;

    downloadBlobToDevice(downloadModalRec.blob, fileName);
    closeDownloadModal();
  };

  // Quick Native Share Trigger (from recording card)
  const handleQuickShare = async (rec: SavedRecording, format: 'mp3' | 'wav' = 'mp3') => {
    // If native sharing is not supported, open modal with helper
    if (typeof navigator === 'undefined' || !navigator.share) {
      openDownloadModal(rec);
      setShareFeedback({
        id: rec.id,
        type: 'info',
        message: 'Menú nativo no disponible en este navegador. Puedes exportar en MP3 o WAV.',
      });
      setTimeout(() => setShareFeedback(null), 4000);
      return;
    }

    setSharingRecId(rec.id);
    try {
      let targetBlob: Blob;
      let extension: string;

      if (format === 'mp3') {
        targetBlob = await convertBlobToMp3Blob(rec.blob, 192);
        extension = 'mp3';
      } else {
        targetBlob = await convertBlobToWavBlob(rec.blob);
        extension = 'wav';
      }

      const cleanName = rec.name.trim();
      const fileName = cleanName.toLowerCase().endsWith(`.${extension}`)
        ? cleanName
        : `${cleanName}.${extension}`;

      const res = await shareAudioFile({
        blob: targetBlob,
        fileName,
        title: rec.name,
        text: `Escucha esta grabación de audio capturada con AudioLive: ${rec.name}`,
      });

      if (res.success) {
        setShareFeedback({
          id: rec.id,
          type: 'success',
          message: '¡Grabación compartida con éxito!',
        });
        setTimeout(() => setShareFeedback(null), 3500);
      } else if (!res.cancelled) {
        // Fallback: open download modal
        openDownloadModal(rec);
        setShareFeedback({
          id: rec.id,
          type: 'error',
          message: res.error || 'No se pudo compartir. Puedes descargar el archivo.',
        });
        setTimeout(() => setShareFeedback(null), 4000);
      }
    } catch (err) {
      console.error('Error in handleQuickShare:', err);
    } finally {
      setSharingRecId(null);
    }
  };

  // Share from Inside Modal
  const handleModalShare = async () => {
    if (!downloadModalRec) return;

    setIsModalSharing(true);
    try {
      let targetBlob: Blob;
      const extension = modalShareFormat;

      if (modalShareFormat === 'mp3') {
        targetBlob = await convertBlobToMp3Blob(downloadModalRec.blob, 192);
      } else {
        targetBlob = await convertBlobToWavBlob(downloadModalRec.blob);
      }

      const cleanName = downloadCustomName.trim() || downloadModalRec.name;
      const fileName = cleanName.toLowerCase().endsWith(`.${extension}`)
        ? cleanName
        : `${cleanName}.${extension}`;

      const res = await shareAudioFile({
        blob: targetBlob,
        fileName,
        title: cleanName,
        text: `Audio grabado con AudioLive: ${cleanName}`,
      });

      if (res.success) {
        closeDownloadModal();
      } else if (!res.cancelled && res.error) {
        alert(res.error);
      }
    } catch (err) {
      console.error('Error sharing from modal:', err);
      alert('Ocurrió un error al preparar el audio para compartir.');
    } finally {
      setIsModalSharing(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="w-full bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
      {/* List Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 pb-3">
        <div className="flex items-center gap-2">
          <ListMusic className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm sm:text-base font-semibold text-stone-200">
            Grabaciones Guardadas ({recordings.length})
          </h2>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-stone-400">
          <span className="px-2 py-0.5 rounded-md bg-stone-800 border border-stone-700 font-mono text-amber-300">
            Exportación WAV / MP3
          </span>
          <span className="hidden sm:inline px-2 py-0.5 rounded-md bg-stone-800 border border-stone-700 text-sky-300">
            Menú Nativo de Compartir
          </span>
        </div>
      </div>

      {recordings.length === 0 ? (
        <div className="text-center py-8 px-4 rounded-xl border border-dashed border-stone-800 bg-stone-950/30 space-y-2">
          <ListMusic className="w-8 h-8 text-stone-600 mx-auto" />
          <p className="text-xs sm:text-sm text-stone-400 font-medium">
            Aún no has guardado ninguna grabación.
          </p>
          <p className="text-[11px] text-stone-500 max-w-sm mx-auto">
            Presiona "Grabar y Escuchar en Directo" en la sección superior para capturar audio en vivo y exportarlo como WAV o MP3.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recordings.map((rec) => {
            const isPlaying = activePlayingId === rec.id;
            const isSharingThis = sharingRecId === rec.id;
            const feedbackThis = shareFeedback?.id === rec.id ? shareFeedback : null;

            return (
              <div
                key={rec.id}
                className={`p-3.5 sm:p-4 rounded-xl border transition-all space-y-2.5 ${
                  isPlaying
                    ? 'bg-amber-950/20 border-amber-500/50 shadow-sm'
                    : 'bg-stone-950/40 border-stone-800 hover:border-stone-700'
                }`}
              >
                {/* Header of card: title, date & actions */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    {editingId === rec.id ? (
                      <div className="flex items-center gap-1.5 w-full max-w-md">
                        <input
                          type="text"
                          value={editNameText}
                          onChange={(e) => setEditNameText(e.target.value)}
                          className="px-2.5 py-1 text-xs bg-stone-800 border border-stone-600 rounded text-stone-100 w-full focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                          autoFocus
                        />
                        <button
                          onClick={() => saveRename(rec.id)}
                          className="p-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer"
                          title="Guardar nombre"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 cursor-pointer"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-semibold text-stone-200 truncate">
                          {rec.name}
                        </h4>
                        <button
                          onClick={() => startRename(rec)}
                          className="text-stone-500 hover:text-stone-300 p-0.5 cursor-pointer"
                          title="Renombrar grabación"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Metadata pills */}
                  <div className="flex items-center gap-2 text-[11px] text-stone-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-stone-500" />
                      {formatSeconds(rec.duration)}
                    </span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-stone-500" />
                      {formatFileSize(rec.size)}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                        rec.isProcessed
                          ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                          : 'bg-stone-800 text-stone-300 border-stone-700'
                      }`}
                    >
                      {rec.isProcessed ? 'Amplificado' : 'Mic Puro'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-stone-900 text-stone-300 border border-stone-700/80 uppercase">
                      {rec.mimeType.includes('wav') ? 'WAV PCM' : 'WebM'}
                    </span>
                  </div>
                </div>

                {/* Inline Player Bar & Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 bg-stone-900/80 p-2 rounded-lg border border-stone-800/80">
                  <button
                    onClick={() => handlePlayToggle(rec)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer shrink-0 ${
                      isPlaying
                        ? 'bg-amber-500 text-stone-950 shadow-sm'
                        : 'bg-stone-800 hover:bg-stone-700 text-stone-200'
                    }`}
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>

                  {/* Scrubber slider */}
                  <div className="flex-1 min-w-[140px] flex items-center gap-2">
                    <span className="text-[10px] font-mono text-stone-400 w-9 text-right">
                      {isPlaying ? formatSeconds(currentTime) : '00:00'}
                    </span>
                    <input
                      type="range"
                      min="0"
                      max={rec.duration || 1}
                      step="0.1"
                      value={isPlaying ? currentTime : 0}
                      onChange={handleSeek}
                      disabled={!isPlaying}
                      className="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-stone-800 rounded appearance-none disabled:opacity-40"
                    />
                    <span className="text-[10px] font-mono text-stone-400 w-9">
                      {formatSeconds(rec.duration)}
                    </span>
                  </div>

                  {/* Actions: Effects, Native Share, Download (WAV/MP3), & Delete */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Share Button (triggers device native share menu) */}
                    <button
                      onClick={() => handleQuickShare(rec, 'mp3')}
                      disabled={isSharingThis}
                      className="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/35 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                      title="Compartir grabación directamente con el menú nativo del navegador (WhatsApp, Telegram, AirDrop, etc.)"
                    >
                      {isSharingThis ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                          <span className="hidden sm:inline">Preparando...</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3.5 h-3.5 text-sky-400" />
                          <span>Compartir</span>
                        </>
                      )}
                    </button>

                    {/* Effects button */}
                    <button
                      onClick={() => {
                        if (audioRef.current) {
                          audioRef.current.pause();
                          setActivePlayingId(null);
                        }
                        setEffectsModalRec(rec);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                      title="Aplicar Efectos de Sonido (Eco, Reverb, Pitch, Distorsión)"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-purple-400" />
                      <span className="hidden sm:inline">Efectos</span>
                    </button>

                    {/* Download / Export Modal Trigger */}
                    <button
                      onClick={() => openDownloadModal(rec)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                      title="Exportar archivo directamente como WAV o MP3"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-400" />
                      <span>Exportar</span>
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => onDeleteRecording(rec.id)}
                      className="p-1.5 rounded-md hover:bg-rose-950/60 text-stone-400 hover:text-rose-400 transition cursor-pointer"
                      title="Eliminar grabación"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Share Feedback Toast */}
                {feedbackThis && (
                  <div
                    className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 animate-fade-in ${
                      feedbackThis.type === 'success'
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                        : feedbackThis.type === 'info'
                        ? 'bg-sky-950/80 text-sky-300 border border-sky-700/60'
                        : 'bg-rose-950/80 text-rose-300 border border-rose-700/60'
                    }`}
                  >
                    {feedbackThis.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                    {feedbackThis.type === 'info' && <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                    {feedbackThis.type === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                    <span>{feedbackThis.message}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-[10px] text-stone-500 px-1">
                  <span>
                    {new Date(rec.timestamp).toLocaleDateString()} a las{' '}
                    {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EXPORT (WAV & MP3) & NATIVE SHARE MODAL */}
      {downloadModalRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <FileAudio className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-stone-100">
                    Exportar y Compartir Grabación
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Guarda directamente en tu dispositivo o comparte con el menú del sistema.
                  </p>
                </div>
              </div>
              <button
                onClick={closeDownloadModal}
                disabled={isConvertingWav || isConvertingMp3 || isModalSharing}
                className="text-stone-400 hover:text-stone-200 p-1.5 rounded-lg hover:bg-stone-800 transition cursor-pointer disabled:opacity-30"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Custom Filename Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                Nombre del archivo para exportar:
              </label>
              <input
                type="text"
                value={downloadCustomName}
                onChange={(e) => setDownloadCustomName(e.target.value)}
                placeholder="Nombre de la grabación"
                className="w-full px-3.5 py-2.5 bg-stone-800/90 border border-stone-700 rounded-xl text-stone-100 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            {/* Recording info strip */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-950/60 border border-stone-800 text-xs text-stone-400">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Duración: <strong className="text-stone-200">{formatSeconds(downloadModalRec.duration)}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                <span>Tamaño: <strong className="text-stone-200">{formatFileSize(downloadModalRec.size)}</strong></span>
              </div>
            </div>

            {/* Export Format Cards */}
            <div className="space-y-2.5 pt-1">
              <span className="text-xs font-semibold text-stone-300 block">
                Selecciona la opción de exportación directa:
              </span>

              {/* 1. WAV Button */}
              <button
                onClick={handleDownloadWav}
                disabled={isConvertingWav || isConvertingMp3 || isModalSharing}
                className="w-full p-3 rounded-xl bg-stone-800/80 hover:bg-stone-750 border border-amber-500/30 hover:border-amber-500/60 text-left transition cursor-pointer flex items-center justify-between group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                    {isConvertingWav ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <FileType className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-stone-100">
                        Descargar en WAV (16-bit PCM)
                      </h4>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        Sin Pérdida
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-400">
                      Audio de máxima fidelidad y pureza, perfecto para DAWs, edición y archivo master.
                    </p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-stone-400 group-hover:text-amber-400 shrink-0 ml-2" />
              </button>

              {/* 2. MP3 Button */}
              <button
                onClick={handleDownloadMp3}
                disabled={isConvertingWav || isConvertingMp3 || isModalSharing}
                className="w-full p-3 rounded-xl bg-stone-800/80 hover:bg-stone-750 border border-emerald-500/30 hover:border-emerald-500/60 text-left transition cursor-pointer flex items-center justify-between group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                    {isConvertingMp3 ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Music className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-stone-100">
                        Descargar en MP3 (192 kbps)
                      </h4>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Universal
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-400">
                      Archivo comprimido ligero, compatible con cualquier reproductor, teléfono y red social.
                    </p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-stone-400 group-hover:text-emerald-400 shrink-0 ml-2" />
              </button>

              {/* 3. Original Format */}
              <button
                onClick={handleDownloadOriginal}
                disabled={isConvertingWav || isConvertingMp3 || isModalSharing}
                className="w-full py-2 px-3 rounded-lg bg-stone-950/60 hover:bg-stone-800 text-stone-400 hover:text-stone-300 font-medium text-xs transition cursor-pointer flex items-center justify-between border border-stone-800 disabled:opacity-50"
              >
                <span>Descargar en formato original de captura (WebM / Ogg)</span>
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Native Share Section */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-sky-950/30 to-indigo-950/20 border border-sky-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-sky-200 flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-sky-400" />
                  Compartir mediante Menú del Sistema:
                </span>
                {/* Format choice for sharing */}
                <div className="flex items-center gap-1 bg-stone-900/90 p-0.5 rounded-lg border border-stone-700/80 text-[10px]">
                  <button
                    onClick={() => setModalShareFormat('mp3')}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                      modalShareFormat === 'mp3'
                        ? 'bg-sky-500 text-stone-950'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    MP3
                  </button>
                  <button
                    onClick={() => setModalShareFormat('wav')}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                      modalShareFormat === 'wav'
                        ? 'bg-sky-500 text-stone-950'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    WAV
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-stone-400 leading-relaxed">
                Abre el menú nativo de tu teléfono o navegador para enviar la grabación directamente por WhatsApp, Telegram, Correo, AirDrop o guardarla en Google Drive / Archivos.
              </p>

              <button
                onClick={handleModalShare}
                disabled={isConvertingWav || isConvertingMp3 || isModalSharing}
                className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-sky-950/40 disabled:opacity-50"
              >
                {isModalSharing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Preparando archivo {modalShareFormat.toUpperCase()}...</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-white" />
                    <span>Abrir Menú Nativo de Compartir ({modalShareFormat.toUpperCase()})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORDED AUDIO EFFECTS MODAL */}
      <RecordedAudioEffectsModal
        isOpen={!!effectsModalRec}
        recording={effectsModalRec}
        onClose={() => setEffectsModalRec(null)}
        onSaveProcessedRecording={async (newRec) => {
          if (onSaveProcessedRecording) {
            await onSaveProcessedRecording(newRec);
          }
        }}
      />
    </div>
  );
};
