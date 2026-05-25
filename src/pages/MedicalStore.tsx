import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Search, Star, Clock, Phone, ExternalLink, Navigation, Loader2, Store, X, Info, Shield, Bike } from 'lucide-react';
import { findNearbyPharmacies } from '../services/geminiService';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const PharmacyIcon = L.divIcon({
  html: `<div class="flex items-center justify-center bg-emerald-600 w-8 h-8 rounded-full shadow-xl border-2 border-white text-white transition-all transform hover:scale-110">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 5 7 7-7 7"/><path d="M5 12h14"/></svg>
  </div>`,
  className: 'pharmacy-marker-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

const UserIcon = L.divIcon({
  html: `<div class="relative flex items-center justify-center w-8 h-8">
    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
    <div class="relative bg-blue-600 w-5 h-5 rounded-full shadow-lg border-2 border-white"></div>
  </div>`,
  className: 'user-marker-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

const DeliveryIcon = L.divIcon({
  html: `<div class="bg-indigo-600 p-1.5 rounded-full shadow-lg border-2 border-white text-white">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/><path d="M19 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/><path d="M16 18H9"/><path d="M16 18a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H9"/><path d="M20 10c.5 0 .5.5.5 1v5"/><path d="M5 18H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h1"/><path d="m14 7-1-4H6L5 7"/><path d="M13 11k-2 0"/></svg>
  </div>`,
  className: 'delivery-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
}

export default function MedicalStore() {
  const [location, setLocation] = useState('New York, NY');
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPharmacy, setSelectedPharmacy] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([40.7128, -74.0060]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [deliveryPos, setDeliveryPos] = useState<[number, number] | null>(null);

  const deliveryTimer = useRef<any>(null);

  const services = [
    { id: 'delivery', name: 'Home Delivery', icon: Navigation },
    { id: '24h', name: '24/7 Open', icon: Clock },
    { id: 'vaccine', name: 'Vaccinations', icon: Shield },
    { id: 'online', name: 'Online Chat', icon: Phone },
  ];

  const handleSearch = async (targetLocation?: string) => {
    const searchVal = targetLocation !== undefined ? targetLocation : location;
    if (!searchVal || !searchVal.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await findNearbyPharmacies(searchVal);
      // Map mock services to data
      const enhancedData = data.map((p: any, i: number) => ({
        ...p,
        services: i % 2 === 0 ? ['delivery', '24h'] : ['vaccine', 'online'],
        stockStatus: Math.random() > 0.3 ? 'High' : 'Low',
        deliveryTime: Math.floor(Math.random() * 30) + 15,
      }));
      setPharmacies(enhancedData);
      if (enhancedData.length > 0) {
        setMapCenter([enhancedData[0].lat, enhancedData[0].lng]);
      }
    } catch (error) {
      console.error(error);
      setError("Failed to find pharmacies. Please try again with a different location.");
    } finally {
      setIsLoading(false);
    }
  };

  const useCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        const coordString = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        setUserLocation([latitude, longitude]);
        setMapCenter([latitude, longitude]);
        setLocation(coordString);
        handleSearch(coordString);
      }, (err) => {
        console.error("Geolocation error:", err);
        setError("Could not read current location. Please verify device permissions.");
      });
    } else {
      setError("Geolocation is not supported by your browser.");
    }
  };

  const filteredPharmacies = pharmacies.filter(p => 
    activeFilters.length === 0 || activeFilters.every(f => p.services.includes(f))
  );

  // Simulate Live Delivery tracking
  useEffect(() => {
    if (selectedPharmacy && selectedPharmacy.services.includes('delivery')) {
      setDeliveryPos([selectedPharmacy.lat + 0.005, selectedPharmacy.lng + 0.005]);
      
      deliveryTimer.current = setInterval(() => {
        setDeliveryPos(prev => {
          if (!prev) return null;
          return [prev[0] - 0.0001, prev[1] - 0.0001];
        });
      }, 2000);
    } else {
      setDeliveryPos(null);
      if (deliveryTimer.current) clearInterval(deliveryTimer.current);
    }

    return () => {
      if (deliveryTimer.current) clearInterval(deliveryTimer.current);
    };
  }, [selectedPharmacy]);

  useEffect(() => {
    handleSearch();
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Search Header */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-800">Find Nearby Pharmacies</h2>
          <p className="text-slate-500">Real-time mapping of medical stores in your area.</p>
        </div>
        <div className="flex flex-col gap-3 w-full md:w-auto">
          <div className="flex w-full md:w-auto gap-2">
            <div className="relative flex-1 md:w-64">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter your location..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
              />
            </div>
            <button 
              type="button"
              onClick={useCurrentLocation}
              className="p-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-xl transition-all flex items-center justify-center active:scale-95"
              title="Use Current Location"
            >
              <Navigation className="w-5 h-5 text-emerald-600 animate-pulse" />
            </button>
            <button 
              onClick={() => handleSearch()}
              disabled={isLoading}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95 text-sm whitespace-nowrap"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              Search
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-medium px-1">
            <span className="font-extrabold uppercase tracking-wide text-slate-400">Presets:</span>
            <button 
              type="button" 
              onClick={useCurrentLocation} 
              className="px-2.5 py-1 rounded-md bg-emerald-100/60 hover:bg-emerald-100 text-emerald-800 transition-all flex items-center gap-1 font-bold border border-emerald-200/50"
            >
              <Navigation className="w-3 h-3 text-emerald-600" /> Detect Me
            </button>
            <button type="button" onClick={() => { setLocation('New York, NY'); handleSearch('New York, NY'); }} className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all font-semibold">New York</button>
            <button type="button" onClick={() => { setLocation('Los Angeles, CA'); handleSearch('Los Angeles, CA'); }} className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all font-semibold">Los Angeles</button>
            <button type="button" onClick={() => { setLocation('Chicago, IL'); handleSearch('Chicago, IL'); }} className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all font-semibold">Chicago</button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {services.map(service => (
          <button
            key={service.id}
            onClick={() => {
              setActiveFilters(prev => 
                prev.includes(service.id) ? prev.filter(f => f !== service.id) : [...prev, service.id]
              );
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
              activeFilters.includes(service.id)
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-500'
            }`}
          >
            <service.icon className="w-4 h-4" />
            {service.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* List Section */}
        <div className="lg:col-span-1 space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
          {error && (
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-start gap-3 text-rose-600">
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}
          {isLoading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 animate-pulse space-y-3">
                <div className="h-5 bg-slate-100 rounded w-3/4" />
                <div className="h-4 bg-slate-50 rounded w-1/2" />
                <div className="flex gap-2">
                  <div className="h-4 bg-slate-50 rounded w-12" />
                  <div className="h-4 bg-slate-50 rounded w-12" />
                </div>
              </div>
            ))
          ) : filteredPharmacies.length > 0 ? (
            filteredPharmacies.map((pharmacy, i) => (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                key={i}
                whileHover={{ scale: 1.01, translateY: -2 }}
                onClick={() => {
                  setSelectedPharmacy(pharmacy);
                  setMapCenter([pharmacy.lat, pharmacy.lng]);
                }}
                className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden ${
                  selectedPharmacy?.name === pharmacy.name 
                    ? 'border-emerald-500 dark:border-emerald-400 shadow-md ring-1 ring-emerald-500/30' 
                    : 'border-slate-200 dark:border-slate-800/80 hover:border-emerald-500 dark:hover:border-emerald-400/70 hover:shadow-md'
                }`}
              >
                {/* Visual marker bar on the side of selected pharmacy card */}
                {selectedPharmacy?.name === pharmacy.name && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 dark:bg-emerald-450 rounded-r" />
                )}

                <div className="flex justify-between items-start mb-2.5">
                  <h3 className="font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors uppercase tracking-tight text-sm">
                    {pharmacy.name}
                  </h3>
                  <div className="flex items-center gap-1 text-amber-500 text-xs font-black bg-amber-50 dark:bg-amber-950/40 px-2.2 py-1 rounded-lg">
                    <Star className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span>{pharmacy.rating || '4.5'}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2 mb-4 leading-relaxed">
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                  <span className="line-clamp-2">{pharmacy.address}</span>
                </p>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide border ${
                      pharmacy.openNow 
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}>
                      {pharmacy.openNow ? 'Open Now' : 'Closed'}
                    </span>
                    <span className={`text-[9px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide border ${
                      pharmacy.stockStatus === 'High' 
                        ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/40' 
                        : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/40'
                    }`}>
                      {pharmacy.stockStatus === 'High' ? 'Regular Stock' : 'Low Stock'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 dark:text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                    <span>{pharmacy.deliveryTime} mins</span>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
              <Store className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500">No pharmacies found in this area.</p>
            </div>
          )}
        </div>

        {/* Map Visualization */}
        <div className="lg:col-span-2 bg-slate-100 rounded-3xl border border-slate-200 overflow-hidden relative min-h-[500px]">
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <ChangeView center={mapCenter} />
            {filteredPharmacies.map((p, i) => (
              <Marker 
                key={i} 
                position={[p.lat, p.lng]}
                icon={PharmacyIcon}
                eventHandlers={{
                  click: () => setSelectedPharmacy(p),
                }}
              >
                <Popup>
                  <div className="p-1">
                    <h4 className="font-bold text-slate-800 uppercase tracking-tight">{p.name}</h4>
                    <p className="text-xs text-slate-500">{p.address}</p>
                    <div className={`mt-2 text-[10px] font-bold uppercase ${p.openNow ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {p.openNow ? '● Open Now' : '● Closed'}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
            {userLocation && (
              <Marker position={userLocation} icon={UserIcon}>
                <Popup>
                  <div className="p-1 text-center">
                    <span className="font-bold text-blue-600 text-xs">Your Location</span>
                  </div>
                </Popup>
              </Marker>
            )}
            {deliveryPos && (
              <Marker position={deliveryPos} icon={DeliveryIcon}>
                <Popup>
                  <div className="p-1">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Live Delivery Tracking</p>
                    <p className="text-[10px] text-slate-500">Speed: 25 km/h • ETA: 12 min</p>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>

          {/* Map Overlay Info */}
          <AnimatePresence>
            {selectedPharmacy && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-6 left-6 right-6 md:left-6 md:right-auto bg-white/90 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-2xl max-w-sm z-[1000]"
              >
                <button 
                  onClick={() => setSelectedPharmacy(null)}
                  className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                    <Store className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{selectedPharmacy.name}</h3>
                    <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                      <Star className="w-3 h-3 fill-current" />
                      {selectedPharmacy.rating || '4.5'}
                    </div>
                  </div>
                </div>
                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-3 text-sm text-slate-600">
                    <MapPin className="w-4 h-4 mt-0.5 text-slate-400" />
                    <span>{selectedPharmacy.address}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>{selectedPharmacy.openNow ? 'Open Now' : 'Closed'} • Closes at 10:00 PM</span>
                  </div>
                  {selectedPharmacy.services.includes('delivery') && (
                    <div className="flex items-center gap-3 text-sm text-emerald-600 font-bold bg-emerald-50 p-2 rounded-lg">
                      <Bike className="w-4 h-4" />
                      <span>Active Delivery: Arriving in {selectedPharmacy.deliveryTime} mins</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>+1 (555) 000-0000</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button className="py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                    <Navigation className="w-4 h-4" />
                    Directions
                  </button>
                  <button className="py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                    <Phone className="w-4 h-4" />
                    Call Store
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!selectedPharmacy && (
            <div className="absolute top-6 left-6 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-xl max-w-xs z-[1000]">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Live Map Grounding</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Showing real-time pharmacy locations near <span className="font-bold text-emerald-600">{location}</span>. Data is verified via Google Maps.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
