import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface ParsedAddress {
  postcode?: string;
  street?: string;
  houseNumber?: string;
  city?: string;
  state?: string;
  country: string;
  completeness: 'postcode' | 'street' | 'complete' | 'none';
  freeformQuery?: string;
}

interface MapboxViewerProps {
  coordinates?: [number, number]; // [longitude, latitude]
  address?: {
    Street: string;
    House_number: string;
    City: string;
    State: string;
    Country: string;
  };
  parsedAddress?: ParsedAddress;
  onCoordinateClick?: (coordinates: [number, number]) => void;
  onBuildingMarked?: () => void; // new: signal when a building/marker is set
  onManualMapClick?: (address: { street: string; number: string; city: string; state: string; country: string; fullAddress: string }) => void; // reverse geocoded address from manual click
}

const MapboxViewer: React.FC<MapboxViewerProps> = ({ coordinates, address, parsedAddress, onCoordinateClick, onBuildingMarked, onManualMapClick }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const previousAddressRef = useRef<string | null>(null);

  const stateNormalizationMap: Record<string, string> = {
    'Baden-Württemberg': 'Baden-Württemberg',
    'Bavaria': 'Bayern',
    'Bayern': 'Bayern',
    'Berlin': 'Berlin',
    'Land Berlin': 'Berlin',
    'State of Berlin': 'Berlin',
    'Brandenburg': 'Brandenburg',
    'Bremen': 'Bremen',
    'Land Bremen': 'Bremen',
    'Free Hanseatic City of Bremen': 'Bremen',
    'Freie Hansestadt Bremen': 'Bremen',
    'Hamburg': 'Hamburg',
    'Free and Hanseatic City of Hamburg': 'Hamburg',
    'Freie und Hansestadt Hamburg': 'Hamburg',
    'Hesse': 'Hessen',
    'Hessen': 'Hessen',
    'Mecklenburg-Vorpommern': 'Mecklenburg-Vorpommern',
    'Lower Saxony': 'Niedersachsen',
    'Niedersachsen': 'Niedersachsen',
    'North Rhine-Westphalia': 'Nordrhein-Westfalen',
    'Nordrhein-Westfalen': 'Nordrhein-Westfalen',
    'Rhineland-Palatinate': 'Rheinland-Pfalz',
    'Rheinland-Pfalz': 'Rheinland-Pfalz',
    'Saarland': 'Saarland',
    'Saxony': 'Sachsen',
    'Sachsen': 'Sachsen',
    'Saxony-Anhalt': 'Sachsen-Anhalt',
    'Sachsen-Anhalt': 'Sachsen-Anhalt',
    'Schleswig-Holstein': 'Schleswig-Holstein',
    'Thuringia': 'Thüringen',
    'Thüringen': 'Thüringen'
  };

  // Helper to get CSS variable value
  const getCssVar = (name: string) => {
    if (typeof window !== 'undefined') {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }
    return '#4DE0A9'; // Fallback default
  };

  // Helper function to highlight building at coordinates
  const highlightBuildingAtLocation = (map: mapboxgl.Map, lngLat: [number, number]) => {
    const point = map.project(lngLat);
    const features = map.queryRenderedFeatures(point, { layers: ['3d-buildings'] });
    
    if (features.length > 0) {
      const highlightColor = getCssVar('--base-col2');
      map.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
        'case',
        ['==', ['id'], features[0].id],
        highlightColor, // Highlight color
        '#aaa' // Default color
      ]);
    }
  };

  // Handle parsed address changes with smart zoom levels
  useEffect(() => {
    if (!parsedAddress || parsedAddress.completeness === 'none' || !mapRef.current) return;

    const geocodeAndZoom = async () => {
      let query = '';
      let zoom = 5;
      let shouldAddMarker = false;
      
      // Determine query and zoom level based on completeness
      switch (parsedAddress.completeness) {
        case 'postcode':
          if (parsedAddress.postcode && parsedAddress.postcode.length === 5) {
            query = `${parsedAddress.postcode}, Deutschland`;
            zoom = 12; // City level zoom
          }
          break;
        case 'street':
          if (parsedAddress.freeformQuery) {
            query = parsedAddress.freeformQuery;
          } else if (parsedAddress.street) {
            query = `${parsedAddress.street}, Deutschland`;
          }
          zoom = 15; // Street level zoom
          break;
        case 'complete':
          if (parsedAddress.street && parsedAddress.houseNumber) {
            query = `${parsedAddress.street} ${parsedAddress.houseNumber}`;
            if (parsedAddress.postcode) {
              query += `, ${parsedAddress.postcode}`;
            }
            query += ', Deutschland';
            zoom = 19; // Building level zoom
            shouldAddMarker = true;
          }
          break;
      }

      if (!query) return;

      // Skip if query hasn't changed
      if (previousAddressRef.current === query) return;
      previousAddressRef.current = query;

      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&country=DE&types=address,postcode,place,locality,region&language=de&autocomplete=true&limit=5`
        );
        const data = await response.json();

        if (data.features && data.features.length > 0) {
          const [lng, lat] = data.features[0].center;
          
          mapRef.current!.flyTo({
            center: [lng, lat],
            zoom: zoom,
            duration: 1500,
            pitch: parsedAddress.completeness === 'complete' ? 45 : 10
          });

          // Add marker and highlight building only for complete addresses
          if (shouldAddMarker) {
            if (markerRef.current) {
              markerRef.current.remove();
            }
            markerRef.current = new mapboxgl.Marker()
              .setLngLat([lng, lat])
              .addTo(mapRef.current!);

            // Highlight building and emit coordinates after movement
            mapRef.current!.once('moveend', () => {
              highlightBuildingAtLocation(mapRef.current!, [lng, lat]);
              
              // Check if we found a building and emit coordinates
              const point = mapRef.current!.project([lng, lat]);
              const features = mapRef.current!.queryRenderedFeatures(point, { layers: ['3d-buildings'] });
              if (features.length > 0) {
                onCoordinateClick?.([lng, lat]);
                onBuildingMarked?.();
              }
            });
          } else {
            // Remove marker for incomplete addresses
            if (markerRef.current) {
              markerRef.current.remove();
              markerRef.current = null;
            }
            // Reset building highlighting
            if (mapRef.current) {
              mapRef.current.setPaintProperty('3d-buildings', 'fill-extrusion-color', '#aaa');
            }
          }
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      }
    };

    geocodeAndZoom();
  }, [parsedAddress, onCoordinateClick, onBuildingMarked]);

  // Legacy geocode address to coordinates (keep for backward compatibility)
  useEffect(() => {
    if (!address || parsedAddress) return; // Skip if using new parsed address system

    const query = `${address.Street} ${address.House_number}, ${address.City}, ${address.State}, ${address.Country}`;
    const encodedQuery = encodeURIComponent(query);

    // Skip geocoding if the address hasn't changed
    if (previousAddressRef.current === encodedQuery) {
      return;
    }

    previousAddressRef.current = encodedQuery;

    const geocodeAddress = async () => {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${mapboxgl.accessToken}&country=DE&types=address`
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        if (mapRef.current) {
          mapRef.current.flyTo({
            center: [lng, lat],
            zoom: 19,
            duration: 2000,
            pitch: 10
          });

          // Update marker
          if (markerRef.current) {
            markerRef.current.remove();
          }
          markerRef.current = new mapboxgl.Marker()
            .setLngLat([lng, lat])
            .addTo(mapRef.current);

          // Highlight the building after the map movement is complete
          mapRef.current.once('moveend', () => {
            highlightBuildingAtLocation(mapRef.current!, [lng, lat]);

            // Also emit coordinates for LOD2 search if building was found
            const point = mapRef.current!.project([lng, lat]);
            const features = mapRef.current!.queryRenderedFeatures(point, { layers: ['3d-buildings'] });
            if (features.length > 0) {
              onCoordinateClick?.([lng, lat]);
              onBuildingMarked?.();
            }
          });
        }
      }
    };

    geocodeAddress();
  }, [address, onCoordinateClick, parsedAddress, onBuildingMarked]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: coordinates || [11.575547144256063, 48.13715667934253],
      zoom: coordinates ? 19 : 16,
      pitch: 35,
      antialias: true
    });

    mapRef.current = map;

    // Add 3D building layer when map loads
    map.on('load', () => {
      // Add 3D building layer
      map.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'height']
          ],
          'fill-extrusion-base': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'min_height']
          ],
          'fill-extrusion-opacity': 0.6
        }
      });

      // Add house numbers layer
      map.addLayer({
        'id': 'house-numbers',
        'type': 'symbol',
        'source': 'composite',
        'source-layer': 'housenum_label',
        'minzoom': 17,
        'layout': {
          'text-field': ['get', 'house_num'],
          'text-size': 16,
          'text-anchor': 'center',
          'text-allow-overlap': true,
          'symbol-sort-key': ['get', 'house_num']
        },
        'paint': {
          'text-color': '#000000',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2
        }
      });

      // Add click handler for buildings
      map.on('click', async (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['3d-buildings'] });
        
        // Remove existing marker if any
        if (markerRef.current) {
          markerRef.current.remove();
        }

        // Create new marker at clicked location
        const clickedCoordinates: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        markerRef.current = new mapboxgl.Marker()
          .setLngLat(clickedCoordinates)
          .addTo(map);

        // Highlight building if clicked on one
        if (features.length > 0) {
          const highlightColor = getCssVar('--base-col2');
          map.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
            'case',
            ['==', ['id'], features[0].id],
            highlightColor, // Highlight color
            '#aaa' // Default color
          ]);
        } else {
          // Reset building colors if clicked outside buildings
          map.setPaintProperty('3d-buildings', 'fill-extrusion-color', '#aaa');
        }

        // Emit clicked coordinates
        onCoordinateClick?.(clickedCoordinates);
        onBuildingMarked?.();

        // Perform reverse geocoding for manual clicks
        if (onManualMapClick) {
          try {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${clickedCoordinates[0]},${clickedCoordinates[1]}.json?access_token=${mapboxgl.accessToken}&country=DE&types=address&language=de&limit=1`
            );
            const data = await response.json();

            if (data.features && data.features.length > 0) {
              const feature = data.features[0];
              const context = feature.context || [];
              
              // Extract address components
              const street = (feature.properties?.street as string) || feature.text || '';
              const number = (feature.address as string) || '';
              const postcode = context.find((c: any) => c.id.startsWith('postcode.'))?.text || '';
              const place = context.find((c: any) => c.id.startsWith('place.'))?.text || 
                           context.find((c: any) => c.id.startsWith('locality.'))?.text || '';
              const regionRaw = context.find((c: any) => c.id.startsWith('region.'))?.text || '';
              
              // Normalize state
              let mappedState = stateNormalizationMap[regionRaw] || regionRaw;
              if (!mappedState && (place === 'Berlin' || place === 'Hamburg' || place === 'Bremen')) {
                mappedState = place;
              }

              // Call the callback with the reverse geocoded address
              onManualMapClick({
                street,
                number,
                city: place,
                state: mappedState,
                country: 'Deutschland',
                fullAddress: feature.place_name || `${street} ${number}, ${postcode} ${place}`
              });
            }
          } catch (error) {
            console.error('Reverse geocoding error:', error);
          }
        }
      });
    });

    return () => {
      map.remove();
      if (markerRef.current) {
        markerRef.current.remove();
      }
    };
  }, []);

  // Update map when coordinates change
  useEffect(() => {
    if (coordinates && mapRef.current) {
      mapRef.current.flyTo({
        center: coordinates,
        zoom: 20,
        duration: 2000,
        pitch: 10
      });

      // Highlight building at the new coordinates after movement
      mapRef.current.once('moveend', () => {
        highlightBuildingAtLocation(mapRef.current!, coordinates);
      });
    }
  }, [coordinates]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px' // Ensure minimum usable height
      }}
      ref={mapContainerRef}
      className="map-container"
    />
  );
};

export default MapboxViewer;