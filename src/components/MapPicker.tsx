'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { X, Layers } from 'lucide-react';
import { useMapEvents } from 'react-leaflet';

// Dynamically import map components to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);

interface MapPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

function LocationMarker({ 
  position, 
  setPosition 
}: { 
  position: [number, number] | null;
  setPosition: (pos: [number, number]) => void;
}) {
  const map = useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return position === null ? null : <Marker position={position} />;
}

export default function MapPicker({
  isOpen,
  onClose,
  onSelect,
  initialLat = -7.0712854057077745,
  initialLng = 108.04477186751905,
}: MapPickerProps) {
  const [position, setPosition] = useState<[number, number] | null>(
    initialLat && initialLng ? [initialLat, initialLng] : null
  );
  const [isMounted, setIsMounted] = useState(false);
  const [basemap, setBasemap] = useState<'street' | 'satellite'>('street');

  useEffect(() => {
    setIsMounted(true);
    // Import Leaflet CSS
    import('leaflet/dist/leaflet.css');
    
    // Fix default marker icon issue with Webpack
    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });
    });
  }, []);

  useEffect(() => {
    if (initialLat && initialLng) {
      setPosition([initialLat, initialLng]);
    }
  }, [initialLat, initialLng]);

  if (!isOpen || !isMounted) return null;

  const handleConfirm = () => {
    if (position) {
      onSelect(position[0], position[1]);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl mx-4">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold">Pilih Lokasi di Peta</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="relative h-[500px] rounded-lg overflow-hidden border dark:border-gray-700">
            {/* Basemap Toggle */}
            <div className="absolute top-3 right-3 z-[1000] bg-white dark:bg-gray-800 rounded-lg shadow-lg">
              <div className="flex flex-col">
                <button
                  onClick={() => setBasemap('street')}
                  className={`px-3 py-2 text-xs font-medium transition rounded-t-lg flex items-center gap-2 ${
                    basemap === 'street'
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Layers className="h-3 w-3" />
                  Street
                </button>
                <button
                  onClick={() => setBasemap('satellite')}
                  className={`px-3 py-2 text-xs font-medium transition rounded-b-lg flex items-center gap-2 ${
                    basemap === 'satellite'
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Layers className="h-3 w-3" />
                  Satelit
                </button>
              </div>
            </div>

            <MapContainer
              center={position || [initialLat, initialLng]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              {basemap === 'street' ? (
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              ) : (
                <TileLayer
                  attribution='&copy; <a href="https://www.esri.com">Esri</a>'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              )}
              <LocationMarker position={position} setPosition={setPosition} />
            </MapContainer>
          </div>

          {position && (
            <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              Koordinat terpilih: {position[0].toFixed(6)}, {position[1].toFixed(6)}
            </div>
          )}

          <p className="mt-2 text-sm text-gray-500">
            Klik pada peta untuk memilih lokasi
          </p>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={!position}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Pilih Lokasi
          </button>
        </div>
      </div>
    </div>
  );
}
