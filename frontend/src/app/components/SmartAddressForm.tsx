import React, { useState, useEffect, useCallback, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';

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

interface SmartAddressFormProps {
  onAddressChange: (address: ParsedAddress) => void;
  onAddressParsed: (formData: {
    street: string;
    number: string;
    city: string;
    state: string;
    country: string;
  }) => void;
  clearSignal?: number; // when changed, suggestions will be cleared
  onStart?: () => void; // optional: triggers slide advance
  canStart?: boolean; // optional: enable/disable Start button
  loadingStart?: boolean; // optional: show loading state
  clickedAddress?: { street: string; number: string; city: string; state: string; country: string; fullAddress: string } | null; // address from manual map click
}

const SmartAddressForm: React.FC<SmartAddressFormProps> = ({ 
  onAddressChange, 
  onAddressParsed,
  clearSignal,
  onStart,
  canStart = true,
  loadingStart = false,
  clickedAddress
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [lastTriggeredValue, setLastTriggeredValue] = useState<string>('');
  const [patternMet, setPatternMet] = useState<boolean>(false);
  const [blacklistedState, setBlacklistedState] = useState<string | null>(null);
  const pauseTimerRef = useRef<number | null>(null);

  const handleStartClick = () => {
    trackEvent('click', 'Address Form', 'Start Button');
    if (onStart) {
      onStart();
    }
  };

  // Blacklist of states not available in WattWert
  const stateBlacklist = ['Saarland'];

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

  // Parse German address format
  const parseAddress = (input: string): ParsedAddress => {
    const trimmed = input.trim();
    if (!trimmed) {
      return { country: 'Deutschland', completeness: 'none', freeformQuery: '' };
    }

    // German postcode pattern (5 digits)
    const postcodeMatch = trimmed.match(/\b(\d{5})\b/);
    
    // House number pattern and street candidate
    const numberMatch = trimmed.match(/\b(\d+[a-zA-Z]?)\b/);
    const beforeComma = trimmed.split(',')[0];
    let streetCandidate: string | undefined;
    if (numberMatch) {
      streetCandidate = beforeComma.replace(numberMatch[1], '').trim();
    } else {
      streetCandidate = beforeComma.trim();
    }

    const result: ParsedAddress = {
      country: 'Deutschland',
      completeness: 'none',
      freeformQuery: trimmed
    };

    if (postcodeMatch) {
      result.postcode = postcodeMatch[1];
      result.completeness = 'postcode';
    }

    if (streetCandidate && streetCandidate.length >= 3) {
      result.street = streetCandidate;
      if (numberMatch) {
        result.houseNumber = numberMatch[1];
        result.completeness = result.postcode ? 'complete' : 'street';
      } else if (!result.postcode) {
        result.completeness = 'street';
      }
    }

    return result;
  };

  // Geocode using Mapbox API
  const geocodeAddress = async (parsedAddress: ParsedAddress) => {
    if (parsedAddress.completeness === 'none') return;

    setIsGeocoding(true);
    
    try {
      let query = '';
      
      if (parsedAddress.completeness === 'postcode') {
        query = `${parsedAddress.postcode}, Deutschland`;
      } else if (parsedAddress.completeness === 'street') {
        // Prefer freeform query to leverage Mapbox internal search
        query = parsedAddress.freeformQuery || `${parsedAddress.street}, Deutschland`;
      } else if (parsedAddress.completeness === 'complete') {
        query = `${parsedAddress.street} ${parsedAddress.houseNumber}${parsedAddress.postcode ? ', ' + parsedAddress.postcode : ''}, Deutschland`;
      } else if (parsedAddress.freeformQuery) {
        query = parsedAddress.freeformQuery;
      }

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&country=DE&types=address,postcode,place,locality,region&language=de&autocomplete=true&limit=5`
      );
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const context = feature.context || [];
        
        // Extract city and state from context
        let city = '';
        let region = '';
        
        // Look for place (city) and region (state) in context
        for (const item of context) {
          if (item.id.startsWith('place.')) {
            city = item.text;
          } else if (item.id.startsWith('locality.')) {
            // fallback if place not available
            if (!city) city = item.text;
          } else if (item.id.startsWith('region.')) {
            region = item.text;
          }
        }
        
        // If no city found in context, try to extract from feature text
        if (!city && feature.place_name) {
          const parts = feature.place_name.split(',');
          if (parts.length > 1) {
            city = parts[1].trim();
          }
        }

        // Normalize region/state name and add fallback for city-states
        let mappedState = stateNormalizationMap[region] || region;
        if (!mappedState && (city === 'Berlin' || city === 'Hamburg' || city === 'Bremen')) {
          mappedState = city;
        }

        // Check if state is blacklisted
        if (mappedState && stateBlacklist.includes(mappedState)) {
          setBlacklistedState(mappedState);
        } else {
          setBlacklistedState(null);
        }

        // Update parsed address with geocoded information
        const updatedAddress: ParsedAddress = {
          ...parsedAddress,
          city: city || parsedAddress.city,
          state: mappedState || parsedAddress.state,
          freeformQuery: parsedAddress.freeformQuery || query
        };

        // Call the form data callback with complete information
        onAddressParsed({
          street: (feature.properties?.street as string) || parsedAddress.street || feature.text || '',
          number: (feature.address as string) || parsedAddress.houseNumber || '',
          city: city || '',
          state: mappedState || '',
          country: 'Deutschland'
        });

        onAddressChange(updatedAddress);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Single gated trigger for both map and suggestions
  const triggerUpdate = useCallback(() => {
    if (!inputValue || inputValue === lastTriggeredValue) return;

    const parsedAddress = parseAddress(inputValue);
    onAddressChange(parsedAddress);
    geocodeAddress(parsedAddress);

    // Fetch suggestions only now (same gating)
    if (inputValue.length >= 2) {
      fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(inputValue)}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&country=DE&types=address,place,locality,postcode,region&language=de&autocomplete=true&limit=1`
      )
        .then((resp) => resp.json())
        .then((json) => {
          const list = json.features || [];
          setSuggestions(list.slice(0, 1));
        })
        .catch((e) => console.error('Suggestion fetch failed:', e));
    } else {
      setSuggestions([]);
    }

    setLastTriggeredValue(inputValue);
  }, [inputValue, lastTriggeredValue, onAddressChange]);

  // Input change: schedule 1s pause trigger; trigger once on threshold crossing (2 words + number); WHY? -> Don't change on every chatacter typed in
  useEffect(() => {
    // Clear prior pause timer
    if (pauseTimerRef.current) {
      window.clearTimeout(pauseTimerRef.current);
    }
    // Schedule new pause-based trigger
    pauseTimerRef.current = window.setTimeout(() => {
      triggerUpdate();
    }, 1000);

    // Threshold crossing detection
    const words = inputValue.match(/[A-Za-zÄÖÜäöüß]{2,}/g) || [];
    const hasTwoWords = words.length >= 2;
    const hasNumber = /\d+/.test(inputValue);
    const meetsPattern = hasTwoWords && hasNumber;

    if (meetsPattern && !patternMet) {
      triggerUpdate();
      setPatternMet(true);
      // Cancel pending pause trigger as we've just updated due to pattern
      if (pauseTimerRef.current) {
        window.clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
    }
    if (!meetsPattern && patternMet) {
      setPatternMet(false);
    }

    return () => {
      // Cleanup on unmount
    };
  }, [inputValue, triggerUpdate, patternMet]);

  // Clear suggestions when clearSignal changes (e.g., building marked)
  useEffect(() => {
    if (clearSignal !== undefined) {
      setSuggestions([]);
    }
  }, [clearSignal]);

  // Handle clicked address from manual map clicks
  useEffect(() => {
    if (clickedAddress) {
      // Update input value with the full address
      setInputValue(clickedAddress.fullAddress);
      setSuggestions([]);

      // Check if state is blacklisted
      if (clickedAddress.state && stateBlacklist.includes(clickedAddress.state)) {
        setBlacklistedState(clickedAddress.state);
      } else {
        setBlacklistedState(null);
      }

      // Parse and update address data
      const parsed: ParsedAddress = {
        postcode: clickedAddress.fullAddress.match(/\b(\d{5})\b/)?.[1],
        street: clickedAddress.street,
        houseNumber: clickedAddress.number,
        city: clickedAddress.city,
        state: clickedAddress.state,
        country: clickedAddress.country,
        completeness: clickedAddress.number && clickedAddress.street ? 'complete' : 
                      clickedAddress.street ? 'street' : 'none',
        freeformQuery: clickedAddress.fullAddress
      };

      onAddressChange(parsed);
      onAddressParsed({
        street: clickedAddress.street,
        number: clickedAddress.number,
        city: clickedAddress.city,
        state: clickedAddress.state,
        country: clickedAddress.country
      });

      setLastTriggeredValue(clickedAddress.fullAddress);
    }
  }, [clickedAddress]);

  const handleSuggestionClick = (feature: any) => {
    const postcode = (feature.context || []).find((c: any) => c.id.startsWith('postcode.'))?.text;
    const place =
      (feature.context || []).find((c: any) => c.id.startsWith('place.'))?.text ||
      (feature.context || []).find((c: any) => c.id.startsWith('locality.'))?.text ||
      '';
    const regionRaw = (feature.context || []).find((c: any) => c.id.startsWith('region.'))?.text || '';
    let mappedState = stateNormalizationMap[regionRaw] || regionRaw;
    if (!mappedState && (place === 'Berlin' || place === 'Hamburg' || place === 'Bremen')) {
      mappedState = place;
    }

    // Check if state is blacklisted
    if (mappedState && stateBlacklist.includes(mappedState)) {
      setBlacklistedState(mappedState);
    } else {
      setBlacklistedState(null);
    }

    const street = (feature.properties?.street as string) || feature.text || '';
    const number = (feature.address as string) || '';

    const nextInput = feature.place_name as string;
    setInputValue(nextInput);
    setSuggestions([]);

    const parsed: ParsedAddress = {
      postcode,
      street,
      houseNumber: number,
      city: place,
      state: mappedState,
      country: 'Deutschland',
      completeness: number && street ? 'complete' : street ? 'street' : postcode ? 'postcode' : 'none',
      freeformQuery: nextInput
    };

    onAddressChange(parsed);
    onAddressParsed({
      street,
      number,
      city: place,
      state: mappedState,
      country: 'Deutschland'
    });

    geocodeAddress(parsed);
    setLastTriggeredValue(nextInput);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ') {
      // Spacebar triggers update
      triggerUpdate();
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      width: '90%',
      maxWidth: '500px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
        padding: '12px'
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="PLZ, Straße, Nummer"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={onKeyDown}
            style={{
              width: '100%',
              fontSize: '16px',
              padding: '12px',
              border: '2px solid #ddd',
              borderRadius: '6px',
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#4DE0A9';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#ddd';
            }}
          />
          {onStart && (
            <button
              onClick={handleStartClick}
              disabled={!canStart || loadingStart}
              style={{
                padding: '12px 18px',
                fontSize: 16,
                borderRadius: 6,
                border: 'none',
                backgroundColor: canStart && !loadingStart ? 'var(--base-col2)' : '#ccc',
                color: 'black',
                cursor: canStart && !loadingStart ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap'
              }}
            >
              {loadingStart ? '...' : 'Start'}
            </button>
          )}
        </div>
        {suggestions.length > 0 && (
          <div style={{
            marginTop: '8px',
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            maxHeight: '240px',
            overflowY: 'auto'
          }}>
            {suggestions.map((s) => (
              <div
                key={s.id}
                onClick={() => handleSuggestionClick(s)}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f0f0f0'
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <div style={{ fontSize: '14px', color: '#333' }}>{s.text}</div>
                <div style={{ fontSize: '12px', color: '#777' }}>{s.place_name}</div>
              </div>
            ))}
          </div>
        )}
        {isGeocoding && (
          <div style={{
            marginTop: '8px',
            fontSize: '12px',
            color: '#666',
            textAlign: 'center'
          }}>
            Suche Adresse...
          </div>
        )}
        {blacklistedState && (
          <div style={{
            marginTop: '8px',
            padding: '12px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '6px',
            fontSize: '14px',
            color: '#856404',
            textAlign: 'center'
          }}>
            Gebäude in {blacklistedState} sind noch nicht in WattWert verfügbar
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartAddressForm;
