'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Add CSS for custom markers and animated lines
if (typeof window !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    .custom-customer-marker,
    .custom-server-marker,
    .custom-olt-marker,
    .custom-odc-marker,
    .custom-odp-marker {
      background: transparent !important;
      border: none !important;
    }
    @keyframes ping {
      75%, 100% {
        transform: scale(2);
        opacity: 0;
      }
    }
    .animate-ping {
      animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
    }
    .customer-marker-icon {
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    }
    @keyframes dash {
      to {
        stroke-dashoffset: -30;
      }
    }
    .animated-path {
      animation: dash 1s linear infinite;
    }
  `;
  if (!document.head.querySelector('[data-map-styles]')) {
    style.setAttribute('data-map-styles', 'true');
    document.head.appendChild(style);
  }
}

interface NetworkMapComponentProps {
  networkData: {
    servers: any[];
    olts: any[];
    odcs: any[];
    odps: any[];
    customers: any[];
    customerAssignments?: any[];
  };
  visibleLayers: {
    servers: boolean;
    olts: boolean;
    odcs: boolean;
    odps: boolean;
    customers: boolean;
    cables: boolean;
  };
  ponColors: Array<{ port: number; color: string; name: string }>;
}

// Map tile layers
const MAP_LAYERS = {
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
  dark: {
    name: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  },
  topo: {
    name: 'Topographic',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a>',
  },
};

export default function NetworkMapComponent({
  networkData,
  visibleLayers,
  ponColors,
}: NetworkMapComponentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentLayer, setCurrentLayer] = useState<keyof typeof MAP_LAYERS>('osm');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView(
        [-7.071273611475302, 108.04475042198051],
        15
      );

      // Add initial tile layer
      const layer = MAP_LAYERS[currentLayer];
      tileLayerRef.current = L.tileLayer(layer.url, {
        attribution: layer.attribution,
        maxZoom: 19,
      }).addTo(mapRef.current);

      // Initialize markers layer
      markersRef.current = L.layerGroup().addTo(mapRef.current);
    }

    // Clear existing markers
    if (markersRef.current) {
      markersRef.current.clearLayers();
    }

    // Add Server markers
    if (visibleLayers.servers) {
      networkData.servers.forEach((server: any) => {
        const iconHtml = `
          <div style="position: relative; width: 40px; height: 40px;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="3" width="20" height="6" rx="1" fill="#3B82F6" stroke="#1E40AF" stroke-width="1.5"/>
              <rect x="2" y="11" width="20" height="6" rx="1" fill="#3B82F6" stroke="#1E40AF" stroke-width="1.5"/>
              <rect x="2" y="19" width="20" height="2" rx="1" fill="#3B82F6" stroke="#1E40AF" stroke-width="1.5"/>
              <circle cx="5" cy="6" r="0.8" fill="#10B981"/>
              <circle cx="5" cy="14" r="0.8" fill="#10B981"/>
              <line x1="8" y1="6" x2="11" y2="6" stroke="#E5E7EB" stroke-width="1" stroke-linecap="round"/>
              <line x1="8" y1="14" x2="11" y2="14" stroke="#E5E7EB" stroke-width="1" stroke-linecap="round"/>
            </svg>
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'custom-server-marker',
          html: iconHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const marker = L.marker([server.latitude, server.longitude], {
          icon: customIcon,
        });

        marker.bindPopup(`
          <div class="p-2">
            <h3 class="font-bold text-blue-600">🖥️ Server</h3>
            <p class="text-sm"><strong>${server.name}</strong></p>
            <p class="text-xs text-gray-600">${server.ipAddress}</p>
            <p class="text-xs text-gray-500">Status: ${server.status}</p>
            <p class="text-xs text-gray-500">OLTs: ${server._count?.olts || 0}</p>
          </div>
        `);

        markersRef.current?.addLayer(marker);
      });
    }

    // Add OLT markers
    if (visibleLayers.olts) {
      networkData.olts.forEach((olt: any) => {
        const iconHtml = `
          <div style="position: relative; width: 36px; height: 36px;">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="5" width="18" height="14" rx="2" fill="#A855F7" stroke="#7C3AED" stroke-width="1.5"/>
              <rect x="6" y="8" width="4" height="3" rx="0.5" fill="#E9D5FF"/>
              <rect x="6" y="12" width="4" height="3" rx="0.5" fill="#E9D5FF"/>
              <rect x="14" y="8" width="4" height="3" rx="0.5" fill="#E9D5FF"/>
              <rect x="14" y="12" width="4" height="3" rx="0.5" fill="#E9D5FF"/>
              <circle cx="12" cy="16" r="1" fill="#10B981"/>
              <path d="M8 3 L12 5 L16 3" stroke="#7C3AED" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'custom-olt-marker',
          html: iconHtml,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([olt.latitude, olt.longitude], {
          icon: customIcon,
        });

        const routerNames = olt.routers?.map((r: any) => r.router?.name).filter(Boolean).join(', ') || '-';
        
        marker.bindPopup(`
          <div class="p-2">
            <h3 class="font-bold text-purple-600">📡 OLT</h3>
            <p class="text-sm"><strong>${olt.name}</strong></p>
            <p class="text-xs text-gray-600">${olt.ipAddress}</p>
            <p class="text-xs text-gray-500">Routers: ${routerNames}</p>
            <p class="text-xs text-gray-500">ODCs: ${olt._count?.odcs || 0}</p>
            <p class="text-xs text-gray-500">ODPs: ${olt._count?.odps || 0}</p>
          </div>
        `);

        markersRef.current?.addLayer(marker);
      });
    }

    // Add ODC markers
    if (visibleLayers.odcs) {
      networkData.odcs.forEach((odc: any) => {
        const ponColor = ponColors.find((p) => p.port === odc.ponPort)?.color || '#EAB308';

        // Count all ODPs connected to this ODC (direct + cascaded)
        const directOdps = networkData.odps.filter((o: any) => o.odcId === odc.id);
        const getTotalOdps = (parentOdpIds: string[]): number => {
          const childOdps = networkData.odps.filter((o: any) => parentOdpIds.includes(o.parentOdpId));
          if (childOdps.length === 0) return 0;
          return childOdps.length + getTotalOdps(childOdps.map((o: any) => o.id));
        };
        const totalOdps = directOdps.length + getTotalOdps(directOdps.map((o: any) => o.id));

        const iconHtml = `
          <div style="position: relative; width: 32px; height: 32px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="6" width="16" height="12" rx="1.5" fill="${ponColor}" stroke="#854D0E" stroke-width="1.5"/>
              <rect x="7" y="9" width="2" height="2" rx="0.5" fill="white" opacity="0.9"/>
              <rect x="11" y="9" width="2" height="2" rx="0.5" fill="white" opacity="0.9"/>
              <rect x="15" y="9" width="2" height="2" rx="0.5" fill="white" opacity="0.9"/>
              <rect x="7" y="13" width="2" height="2" rx="0.5" fill="white" opacity="0.9"/>
              <rect x="11" y="13" width="2" height="2" rx="0.5" fill="white" opacity="0.9"/>
              <rect x="15" y="13" width="2" height="2" rx="0.5" fill="white" opacity="0.9"/>
              <circle cx="12" cy="4" r="1.5" fill="#10B981"/>
            </svg>
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'custom-odc-marker',
          html: iconHtml,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([odc.latitude, odc.longitude], {
          icon: customIcon,
        });

        marker.bindPopup(`
          <div class="p-2">
            <h3 class="font-bold text-yellow-600">📻 ODC</h3>
            <p class="text-sm"><strong>${odc.name}</strong></p>
            <p class="text-xs text-gray-600">PON Port: ${odc.ponPort}</p>
            <p class="text-xs text-gray-500">OLT: ${odc.olt?.name || '-'}</p>
            <p class="text-xs text-gray-500">Port Count: ${odc.portCount}</p>
            <p class="text-xs text-gray-500">ODPs: ${totalOdps}</p>
          </div>
        `);

        markersRef.current?.addLayer(marker);
      });
    }

    // Add ODP markers
    if (visibleLayers.odps) {
      networkData.odps.forEach((odp: any) => {
        const ponColor = ponColors.find((p) => p.port === odp.ponPort)?.color || '#10B981';

        const iconHtml = `
          <div style="position: relative; width: 28px; height: 28px;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" fill="${ponColor}" stroke="#065F46" stroke-width="1.5"/>
              <circle cx="12" cy="12" r="6" fill="white" opacity="0.3"/>
              <circle cx="12" cy="8" r="1.5" fill="white" opacity="0.9"/>
              <circle cx="8" cy="13" r="1.5" fill="white" opacity="0.9"/>
              <circle cx="16" cy="13" r="1.5" fill="white" opacity="0.9"/>
              <circle cx="12" cy="16" r="1.5" fill="white" opacity="0.9"/>
            </svg>
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'custom-odp-marker',
          html: iconHtml,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([odp.latitude, odp.longitude], {
          icon: customIcon,
        });

        marker.bindPopup(`
          <div class="p-2">
            <h3 class="font-bold text-green-600">📶 ODP</h3>
            <p class="text-sm"><strong>${odp.name}</strong></p>
            <p class="text-xs text-gray-600">PON Port: ${odp.ponPort}</p>
            <p class="text-xs text-gray-500">Port Count: ${odp.portCount || 8}</p>
            ${odp.odc ? `<p class="text-xs text-gray-500">ODC: ${odp.odc.name}</p>` : ''}
            ${odp.parentOdp ? `<p class="text-xs text-gray-500">Parent ODP: ${odp.parentOdp.name}</p>` : ''}
            <p class="text-xs text-gray-500">OLT: ${odp.olt?.name || '-'}</p>
            <p class="text-xs text-gray-500">Status: ${odp.status}</p>
          </div>
        `);

        markersRef.current?.addLayer(marker);
      });
    }

    // Add Customer markers
    if (visibleLayers.customers) {
      networkData.customers.forEach((customer: any) => {
        // Only show customers with valid latitude/longitude
        if (customer.latitude && customer.longitude) {
          const isOnline = customer.isOnline;
          const isActive = customer.status === 'active';
          
          // Create custom icon with house/user SVG and animation
          const iconHtml = isOnline
            ? `
              <div class="relative flex items-center justify-center">
                <div class="absolute w-9 h-9 bg-green-400 rounded-full animate-ping opacity-75"></div>
                <div class="relative customer-marker-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" fill="#10B981" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M9 22V12H15V22" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
              </div>
            `
            : `
              <div class="relative flex items-center justify-center">
                <div class="absolute w-9 h-9 bg-red-400 rounded-full animate-ping opacity-75"></div>
                <div class="relative customer-marker-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" fill="${
                  isActive ? '#EF4444' : '#9CA3AF'
                }" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M9 22V12H15V22" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
              </div>
            `;

          const customIcon = L.divIcon({
            className: 'custom-customer-marker',
            html: iconHtml,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

          const marker = L.marker([customer.latitude, customer.longitude], {
            icon: customIcon,
          });

          // Find if customer is assigned to an ODP
          const assignment = networkData.customerAssignments?.find(
            (a: any) => a.customerId === customer.id
          );

          marker.bindPopup(`
            <div class="p-2">
              <h3 class="font-bold text-blue-600 flex items-center gap-1">
                👤 Customer
                ${isOnline 
                  ? '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700">Online</span>' 
                  : '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">Offline</span>'
                }
              </h3>
              <p class="text-sm mt-1"><strong>${customer.name}</strong></p>
              <p class="text-xs text-gray-600">${customer.username}</p>
              <p class="text-xs text-gray-500">Phone: ${customer.phone}</p>
              ${customer.address ? `<p class="text-xs text-gray-500">Address: ${customer.address}</p>` : ''}
              ${assignment ? `<p class="text-xs text-gray-500 mt-1">📶 ODP: ${assignment.odp.name} - Port ${assignment.portNumber}</p>` : ''}
              <p class="text-xs mt-1">
                <span class="font-semibold">Account:</span> 
                <span class="${isActive ? 'text-green-600' : 'text-red-600'}">
                  ${isActive ? 'Active' : 'Inactive'}
                </span>
              </p>
            </div>
          `);

          markersRef.current?.addLayer(marker);
        }
      });
    }

    // Draw customer to ODP connections
    if (visibleLayers.cables && visibleLayers.customers && networkData.customerAssignments) {
      networkData.customerAssignments.forEach((assignment: any) => {
        const customer = networkData.customers.find((c: any) => c.id === assignment.customerId);
        const odp = networkData.odps.find((o: any) => o.id === assignment.odpId);

        if (customer && odp && customer.latitude && customer.longitude) {
          const isOnline = customer.isOnline;
          const lineColor = isOnline ? '#10B981' : '#EF4444'; // Green if online, red if offline

          // Draw white background line (border effect)
          const borderLine = L.polyline(
            [
              [odp.latitude, odp.longitude],
              [customer.latitude, customer.longitude],
            ],
            {
              color: '#FFFFFF',
              weight: 4,
              opacity: 0.9,
              dashArray: '10, 10',
              className: 'animated-path',
            }
          );

          // Draw colored line on top
          const polyline = L.polyline(
            [
              [odp.latitude, odp.longitude],
              [customer.latitude, customer.longitude],
            ],
            {
              color: lineColor,
              weight: 2,
              opacity: 0.8,
              dashArray: '10, 10',
              className: 'animated-path',
            }
          );

          polyline.bindPopup(`
            <div class="text-sm">
              <strong>${customer.name}</strong> → <strong>${odp.name}</strong><br/>
              Port: ${assignment.portNumber}<br/>
              ${assignment.distance ? `Distance: ${assignment.distance.toFixed(2)} km<br/>` : ''}
              Status: <span class="${isOnline ? 'text-green-600' : 'text-red-600'}">
                ${isOnline ? '🟢 Online' : '🔴 Offline'}
              </span>
            </div>
          `);

          // Add both lines to map (border first, then colored line)
          markersRef.current?.addLayer(borderLine);
          markersRef.current?.addLayer(polyline);
        }
      });
    }

    // Add OLT markers
    if (visibleLayers.olts) {
      networkData.olts.forEach((olt: any) => {
        const marker = L.circleMarker([olt.latitude, olt.longitude], {
          radius: 8,
          fillColor: '#A855F7',
          color: '#7C3AED',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
        });

        const routerNames = olt.routers?.map((r: any) => r.router?.name).filter(Boolean).join(', ') || '-';
        
        marker.bindPopup(`
          <div class="p-2">
            <h3 class="font-bold text-purple-600">📡 OLT</h3>
            <p class="text-sm"><strong>${olt.name}</strong></p>
            <p class="text-xs text-gray-600">${olt.ipAddress}</p>
            <p class="text-xs text-gray-500">Routers: ${routerNames}</p>
            <p class="text-xs text-gray-500">ODPs: ${olt._count?.odps || 0}</p>
            <p class="text-xs mt-1">
              <span class="font-semibold">Routing:</span> 
              <span class="${olt.followRoad ? 'text-green-600' : 'text-gray-600'}">
                ${olt.followRoad ? '🛣️ Follow Road' : '➡️ Straight Line'}
              </span>
            </p>
          </div>
        `);

        markersRef.current?.addLayer(marker);
      });
    }

    // Draw cables (lines) between network elements
    if (visibleLayers.cables) {
      // Connect OLTs to their Servers via Routers
      networkData.olts.forEach(async (olt: any) => {
        // Get all routers assigned to this OLT
        const oltRouters = olt.routers || [];
        
        // For each router, find its server and draw line
        oltRouters.forEach(async (oltRouter: any) => {
          const router = oltRouter.router;
          if (!router) return;
          
          // Find server that has this router
          const server = networkData.servers.find((s: any) => s.routerId === router.id);
          if (!server) return;
          
        if (true) {
          if (olt.followRoad) {
            // Use OSRM routing
            try {
              const osrmUrl = 'https://osrm.gnetid.xyz';
              const routeUrl = `${osrmUrl}/route/v1/driving/${server.longitude},${server.latitude};${olt.longitude},${olt.latitude}?overview=full&geometries=geojson`;
              
              const res = await fetch(routeUrl, {
                method: 'GET',
                mode: 'cors',
                headers: {
                  'Accept': 'application/json',
                },
              });
              
              if (!res.ok) {
                throw new Error(`OSRM API returned ${res.status}`);
              }
              
              const data = await res.json();
              
              if (data.code === 'Ok' && data.routes && data.routes[0]) {
                const coordinates = data.routes[0].geometry.coordinates.map(
                  ([lng, lat]: [number, number]) => [lat, lng]
                );
                
                const polyline = L.polyline(coordinates, {
                  color: '#A855F7',
                  weight: 3,
                  opacity: 0.7,
                  dashArray: '10, 10',
                  className: 'animated-path',
                });
                
                polyline.bindPopup(`
                  <div class="text-sm">
                    <strong>${server.name}</strong> → <strong>${olt.name}</strong><br/>
                    Distance: ${(data.routes[0].distance / 1000).toFixed(2)} km<br/>
                    🛣️ Following road
                  </div>
                `);
                
                markersRef.current?.addLayer(polyline);
              } else {
                console.warn('OSRM returned non-Ok code:', data.code);
                drawStraightLine(server, olt);
              }
            } catch (error) {
              console.error('OSRM routing failed:', error);
              // Fallback to straight line
              drawStraightLine(server, olt, router.name);
            }
          } else {
            // Draw straight line
            drawStraightLine(server, olt, router.name);
          }
        }
        });
      });
      
      // Helper function to draw straight line with animation
      function drawStraightLine(server: any, olt: any, routerName: string) {
        const polyline = L.polyline(
          [
            [server.latitude, server.longitude],
            [olt.latitude, olt.longitude],
          ],
          {
            color: '#A855F7',
            weight: 2,
            opacity: 0.6,
            dashArray: '10, 10',
            className: 'animated-path',
          }
        );
        
        polyline.bindPopup(`
          <div class="text-sm">
            <strong>${server.name}</strong> → <strong>${routerName}</strong> → <strong>${olt.name}</strong><br/>
            ➡️ Straight line
          </div>
        `);
        
        markersRef.current?.addLayer(polyline);
      }

      // Helper function to draw ODC connection lines
      async function drawOdcConnection(olt: any, odc: any, ponColor: string) {
        if (odc.followRoad) {
          // Use OSRM routing
          try {
            const osrmUrl = 'https://osrm.gnetid.xyz';
            const routeUrl = `${osrmUrl}/route/v1/driving/${olt.longitude},${olt.latitude};${odc.longitude},${odc.latitude}?overview=full&geometries=geojson`;
            
            const res = await fetch(routeUrl, {
              method: 'GET',
              mode: 'cors',
              headers: {
                'Accept': 'application/json',
              },
            });
            
            if (!res.ok) {
              throw new Error(`OSRM API returned ${res.status}`);
            }
            
            const data = await res.json();
            
            if (data.code === 'Ok' && data.routes && data.routes[0]) {
              const coordinates = data.routes[0].geometry.coordinates.map(
                ([lng, lat]: [number, number]) => [lat, lng]
              );
              
              const polyline = L.polyline(coordinates, {
                color: ponColor,
                weight: 2.5,
                opacity: 0.7,
                dashArray: '10, 10',
                className: 'animated-path',
              });
              
              polyline.bindPopup(`
                <div class="text-sm">
                  <strong>${olt.name}</strong> → <strong>${odc.name}</strong><br/>
                  PON Port: ${odc.ponPort}<br/>
                  Distance: ${(data.routes[0].distance / 1000).toFixed(2)} km<br/>
                  🛣️ Following road
                </div>
              `);
              
              markersRef.current?.addLayer(polyline);
            } else {
              drawStraightOdcLine(olt, odc, ponColor);
            }
          } catch (error) {
            console.error('OSRM routing failed for ODC:', error);
            drawStraightOdcLine(olt, odc, ponColor);
          }
        } else {
          drawStraightOdcLine(olt, odc, ponColor);
        }
      }

      function drawStraightOdcLine(olt: any, odc: any, ponColor: string) {
        const polyline = L.polyline(
          [
            [olt.latitude, olt.longitude],
            [odc.latitude, odc.longitude],
          ],
          {
            color: ponColor,
            weight: 2.5,
            opacity: 0.6,
            dashArray: '10, 10',
            className: 'animated-path',
          }
        );
        
        polyline.bindPopup(`
          <div class="text-sm">
            <strong>${olt.name}</strong> → <strong>${odc.name}</strong><br/>
            PON Port: ${odc.ponPort}<br/>
            ➡️ Straight line
          </div>
        `);
        
        markersRef.current?.addLayer(polyline);
      }

      // Connect ODCs to their OLTs
      networkData.odcs.forEach((odc: any) => {
        const olt = networkData.olts.find((o: any) => o.id === odc.oltId);
        if (olt) {
          const ponColor = ponColors.find((p) => p.port === odc.ponPort)?.color || '#EAB308';
          drawOdcConnection(olt, odc, ponColor);
        }
      });

      // Helper function to draw ODP connection lines
      async function drawOdpConnection(source: any, odp: any, ponColor: string) {
        if (odp.followRoad) {
          // Use OSRM routing
          try {
            const osrmUrl = 'https://osrm.gnetid.xyz';
            const routeUrl = `${osrmUrl}/route/v1/driving/${source.longitude},${source.latitude};${odp.longitude},${odp.latitude}?overview=full&geometries=geojson`;
            
            const res = await fetch(routeUrl, {
              method: 'GET',
              mode: 'cors',
              headers: {
                'Accept': 'application/json',
              },
            });
            
            if (!res.ok) {
              throw new Error(`OSRM API returned ${res.status}`);
            }
            
            const data = await res.json();
            
            if (data.code === 'Ok' && data.routes && data.routes[0]) {
              const coordinates = data.routes[0].geometry.coordinates.map(
                ([lng, lat]: [number, number]) => [lat, lng]
              );
              
              const polyline = L.polyline(coordinates, {
                color: ponColor,
                weight: 2,
                opacity: 0.6,
                dashArray: '10, 10',
                className: 'animated-path',
              });
              
              polyline.bindPopup(`
                <div class="text-sm">
                  <strong>${source.name}</strong> → <strong>${odp.name}</strong><br/>
                  PON Port: ${odp.ponPort}<br/>
                  Distance: ${(data.routes[0].distance / 1000).toFixed(2)} km<br/>
                  🛣️ Following road
                </div>
              `);
              
              markersRef.current?.addLayer(polyline);
            } else {
              drawStraightOdpLine(source, odp, ponColor);
            }
          } catch (error) {
            console.error('OSRM routing failed for ODP:', error);
            drawStraightOdpLine(source, odp, ponColor);
          }
        } else {
          drawStraightOdpLine(source, odp, ponColor);
        }
      }

      function drawStraightOdpLine(source: any, odp: any, ponColor: string) {
        const polyline = L.polyline(
          [
            [source.latitude, source.longitude],
            [odp.latitude, odp.longitude],
          ],
          {
            color: ponColor,
            weight: 2,
            opacity: 0.6,
          }
        );
        
        polyline.bindPopup(`
          <div class="text-sm">
            <strong>${source.name}</strong> → <strong>${odp.name}</strong><br/>
            PON Port: ${odp.ponPort}<br/>
            ➡️ Straight line
          </div>
        `);
        
        markersRef.current?.addLayer(polyline);
      }

      // Connect ODPs to their ODCs or parent ODPs
      networkData.odps.forEach((odp: any) => {
        const ponColor = ponColors.find((p) => p.port === odp.ponPort)?.color || '#10B981';
        
        if (odp.odcId) {
          // Connect to ODC
          const odc = networkData.odcs.find((o: any) => o.id === odp.odcId);
          if (odc) {
            drawOdpConnection(odc, odp, ponColor);
          }
        } else if (odp.parentOdpId) {
          // Connect to parent ODP
          const parentOdp = networkData.odps.find((o: any) => o.id === odp.parentOdpId);
          if (parentOdp) {
            drawOdpConnection(parentOdp, odp, ponColor);
          }
        }
      });
    }

    return () => {
      // Cleanup on unmount
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [networkData, visibleLayers, ponColors]);

  // Handle layer change
  const handleLayerChange = (layerKey: keyof typeof MAP_LAYERS) => {
    if (mapRef.current && tileLayerRef.current) {
      // Remove old layer
      mapRef.current.removeLayer(tileLayerRef.current);
      
      // Add new layer
      const layer = MAP_LAYERS[layerKey];
      tileLayerRef.current = L.tileLayer(layer.url, {
        attribution: layer.attribution,
        maxZoom: 19,
      }).addTo(mapRef.current);
      
      setCurrentLayer(layerKey);
    }
  };

  // Handle fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Invalidate map size after fullscreen toggle
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 100);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-gray-900">
      <div ref={mapContainerRef} className="w-full h-full" />
      
      {/* Compact Layer Selector */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-1">
        {Object.entries(MAP_LAYERS).map(([key, layer]) => (
          <button
            key={key}
            onClick={() => handleLayerChange(key as keyof typeof MAP_LAYERS)}
            title={layer.name}
            className={`w-9 h-9 rounded shadow-lg transition-all ${
              currentLayer === key
                ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <span className="text-xs font-semibold">
              {key === 'osm' && '🗺️'}
              {key === 'satellite' && '🛰️'}
              {key === 'dark' && '🌙'}
              {key === 'topo' && '⛰️'}
            </span>
          </button>
        ))}
      </div>

      {/* Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        className="absolute bottom-4 right-4 z-[1000] w-10 h-10 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded shadow-lg transition-all flex items-center justify-center"
      >
        <span className="text-lg">
          {isFullscreen ? '❌' : '⛶️'}
        </span>
      </button>
    </div>
  );
}
