import React, { useEffect, useState } from 'react';
import { getBuildingData } from '../database/getBuildingData';
import { WhitelabelData } from '../database/getWhitelabelData';

interface IntermediateResultProps {
  lod2Id: string | null;
  accessToken: string | null;
  userId?: string | null;
  measures?: string; // comma-separated from FacadeMeasureSlide
  onProceed?: () => void;
  onSkipToContact?: () => void;
  onCostEstimate?: (lower: number | null, upper: number | null) => void;
}

const IntermediateResult: React.FC<IntermediateResultProps> = ({ lod2Id, accessToken, userId, measures, onProceed, onSkipToContact, onCostEstimate }) => {
  const [wallSurfaceTot, setWallSurfaceTot] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [whitelabelData, setWhitelabelData] = useState<WhitelabelData | null>(null);

  // Load whitelabel data from localStorage
  useEffect(() => {
    try {
      const storedData = localStorage.getItem('whitelabel_data');
      if (storedData) {
        const data: WhitelabelData = JSON.parse(storedData);
        setWhitelabelData(data);
      }
    } catch (e) {
      console.error('Error parsing whitelabel data:', e);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!lod2Id || !accessToken) return;
      try {
        setLoading(true);
        const data = await getBuildingData(lod2Id, accessToken);
        const value = (data as any)?.Wall_surface_tot;
        setWallSurfaceTot(typeof value === 'number' ? value : null);
      } catch (e) {
        setError('Fehler beim Laden der Gebäudedaten');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [lod2Id, accessToken]);

  const selected = new Set((measures || '').split(',').map(s => s.trim()).filter(Boolean));
  
  // Use whitelabel-specific pricing if available, otherwise use defaults
  const anstrichRate = whitelabelData?.anstrich_kosten_m2 ?? 95;
  const putzRate = whitelabelData?.putz_kosten_m2 ?? 65;
  
  const ratePerM2 = (selected.has('Fassadenanstrich') ? anstrichRate : 0) + (selected.has('Fassadenputz') ? putzRate : 0);
  const estimate = wallSurfaceTot != null ? wallSurfaceTot * ratePerM2 : null;
  const roundTo100 = (v: number) => Math.round(v / 100) * 100;
  const formatEUR = (v: number) => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  
  const estimateLower = estimate != null ? roundTo100(estimate * 0.9) : null;
  const estimateUpper = estimate != null ? roundTo100(estimate * 1.1) : null;
  
  const estimateText = estimate != null
    ? `${formatEUR(estimateLower!)} – ${formatEUR(estimateUpper!)}`
    : '—';

  // Call the callback whenever estimates change
  useEffect(() => {
    if (onCostEstimate) {
      onCostEstimate(estimateLower, estimateUpper);
    }
  }, [estimateLower, estimateUpper, onCostEstimate]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      padding: '20px',
      backgroundColor: 'var(--foreground)',
      borderRadius: 8,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      flex: 1 // Add flex: 1 to make it stretch
    }}>
      <h2 style={{ margin: 0, color: 'var(--headlinecolor)' }}>Kostenschätzung</h2>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--headlinecolor)' }}>
        {loading ? '…' : estimateText}
      </div>
      {error && <div style={{ color: '#dc3545', fontSize: 14 }}>{error}</div>}
      <div style={{ marginTop: 8, color: 'var(--fontcolor)', fontSize: 14, lineHeight: 1.5 }}>
        Fahren Sie fort, um ein genaues Angebot inkl. Fassadenaufmaß einzuholen.<br />
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          title="Mittels Fotos Ihres Gebäudes wird ein Angebot ink. Aufmaß erstellt. Der Betrag wird Ihnen bei Abschluss des Auftrages erstattet."
          onClick={() => {
            onProceed && onProceed();
          }}
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            border: '1px solid #ddd',
            background: 'var(--base-col2)',
            cursor: 'pointer',
            color: '#333',
            fontSize: 14
          }}
        >
          Jetzt digitales Angebot einholen (40€)
        </button>

        <button
          type="button"
          title="Unser Betrieb kommt nach Terminabsprache bei Ihnen vorbei, nimmt das Aufmaß auf und erstellt ein Angebot. Der Betrag wird Ihnen bei Abschluss des Auftrages erstattet."
          onClick={() => {
            onSkipToContact && onSkipToContact();
          }}
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            border: '1px solid #ddd',
            background: 'var(--base-col2)',
            cursor: 'pointer',
            color: '#333',
            fontSize: 14
          }}
        >
          Vor-Ort-Angebot anfordern (150€)
        </button>
        <br />
        <div style={{ color: 'var(--fontcolor)', fontSize: 12, lineHeight: 1.5 }}>
          Der Betrag wird Ihnen bei Abschluss des Auftrages erstattet.
        </div>
      </div>
    </div>
  );
};

export default IntermediateResult;
