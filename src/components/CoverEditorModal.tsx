import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Music, RotateCcw, Upload, X } from 'lucide-react';
import type { CoverStyleId, MediaRecord } from '../types/media';

interface CoverEditorModalProps {
  record: MediaRecord;
  onClose: () => void;
  onSaveRecord: (updated: MediaRecord) => void;
}

const COVER_PRESETS: { id: CoverStyleId; label: string; swatch: string }[] = [
  { id: 'meadow-sky', label: 'Meadow Sky', swatch: '#55A8E8' },
  { id: 'night-bus', label: 'Night Transit', swatch: '#25272B' },
  { id: 'heatwave-static', label: 'Halftone Wave', swatch: '#161616' },
  { id: 'glass-harbor', label: 'Glass Harbor', swatch: '#2A67B3' },
  { id: 'sunday-club', label: 'Sunday Ochre', swatch: '#E66B2B' },
  { id: 'copper-silence', label: 'Copper Oxide', swatch: '#B85435' },
  { id: 'daylight-loop', label: 'Cobalt Loop', swatch: '#2454D8' },
  { id: 'suburban-echo', label: 'Amber Bias', swatch: '#DF9E28' },
  { id: 'winter-concourse', label: 'Concourse Green', swatch: '#214A3D' },
];

export function CoverEditorModal({
  record,
  onClose,
  onSaveRecord,
}: CoverEditorModalProps) {
  const [title, setTitle] = useState(record.title);
  const [artist, setArtist] = useState(record.artist);
  const [coverStyle, setCoverStyle] = useState<CoverStyleId>(record.coverStyle);
  const [customCoverDataUrl, setCustomCoverDataUrl] = useState<string | undefined>(
    record.customCoverDataUrl
  );
  const [customAudioUrl, setCustomAudioUrl] = useState<string | undefined>(
    record.customAudioUrl
  );
  const [customAudioName, setCustomAudioName] = useState<string | undefined>(
    record.customAudioName
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please choose a PNG, JPG, or WebP image file.');
      return;
    }
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomCoverDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAudioUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setErrorMsg('Please choose an MP3, WAV, or OGG audio file.');
      return;
    }
    setErrorMsg(null);
    const url = URL.createObjectURL(file);
    setCustomAudioUrl(url);
    setCustomAudioName(file.name);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedArtist = artist.trim();
    if (!trimmedTitle || !trimmedArtist) {
      setErrorMsg('Both Edition Title and Artist are required.');
      return;
    }
    onSaveRecord({
      ...record,
      title: trimmedTitle.toUpperCase(),
      artist: trimmedArtist.toUpperCase(),
      coverStyle,
      customCoverDataUrl,
      customAudioUrl,
      customAudioName,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cover-editor-title"
    >
      <div className="w-full max-w-lg bg-[#F6F6F3] border border-[#171717]/20 p-6 shadow-xl">
        <div className="flex items-start justify-between border-b border-[#171717]/12 pb-4">
          <div>
            <p className="font-mono-tech text-[11px] text-[#5C5C58]">
              EDITION {record.indexNumber} · {record.format.toUpperCase()}
            </p>
            <h2
              id="cover-editor-title"
              className="mt-1 text-lg font-bold tracking-tight text-[#171717]"
            >
              Customize Cover &amp; Track
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cover editor"
            className="p-1.5 text-[#454542] hover:text-[#171717] transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {errorMsg && (
            <div className="border border-[#D93829]/40 bg-[#D93829]/10 px-3 py-2 text-xs text-[#9B1D12]">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="edition-title-input"
                className="block font-mono-tech text-[11px] text-[#5C5C58] mb-1"
              >
                EDITION TITLE
              </label>
              <input
                id="edition-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={28}
                className="w-full px-3 py-2 text-sm bg-white border border-[#171717]/20 text-[#171717] focus:outline-none focus:border-[#171717]"
              />
            </div>

            <div>
              <label
                htmlFor="edition-artist-input"
                className="block font-mono-tech text-[11px] text-[#5C5C58] mb-1"
              >
                ARTIST NAME
              </label>
              <input
                id="edition-artist-input"
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                maxLength={24}
                className="w-full px-3 py-2 text-sm bg-white border border-[#171717]/20 text-[#171717] focus:outline-none focus:border-[#171717]"
              />
            </div>
          </div>

          <div>
            <span className="block font-mono-tech text-[11px] text-[#5C5C58] mb-2">
              PROCEDURAL ARTWORK PALETTE
            </span>
            <div className="grid grid-cols-3 gap-2">
              {COVER_PRESETS.map((preset) => {
                const selected = !customCoverDataUrl && coverStyle === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setCoverStyle(preset.id);
                      setCustomCoverDataUrl(undefined);
                    }}
                    className={`flex items-center gap-2 px-2.5 py-2 text-left text-xs border transition-colors ${
                      selected
                        ? 'border-[#171717] bg-white font-semibold'
                        : 'border-[#171717]/15 bg-[#EFEFE9] hover:border-[#171717]/40'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 shrink-0 border border-black/15"
                      style={{ backgroundColor: preset.swatch }}
                    />
                    <span className="truncate">{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="border border-[#171717]/15 bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono-tech text-[11px] text-[#5C5C58]">
                  CUSTOM COVER ART
                </span>
                {customCoverDataUrl && (
                  <button
                    type="button"
                    onClick={() => setCustomCoverDataUrl(undefined)}
                    className="inline-flex items-center gap-1 text-[11px] text-[#D93829] hover:underline"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    Reset
                  </button>
                )}
              </div>
              <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-[#EFEFE9] border border-[#171717]/20 hover:border-[#171717] cursor-pointer">
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{customCoverDataUrl ? 'Replace Image' : 'Upload Image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="border border-[#171717]/15 bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono-tech text-[11px] text-[#5C5C58]">
                  CUSTOM AUDIO FILE
                </span>
                {customAudioUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomAudioUrl(undefined);
                      setCustomAudioName(undefined);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-[#D93829] hover:underline"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    Reset
                  </button>
                )}
              </div>
              <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-[#EFEFE9] border border-[#171717]/20 hover:border-[#171717] cursor-pointer max-w-full">
                <Music className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {customAudioName || 'Upload MP3 / WAV'}
                </span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#171717]/12">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#454542] hover:text-[#171717] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-medium bg-[#171717] text-[#F7F7F4] hover:bg-[#2C2C2A] transition-colors"
            >
              Apply to 3D Media
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
