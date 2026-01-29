-- Tabelle für MFH-Optimierungsergebnisse
-- Eine Zeile pro LOD2_ID mit allen Varianten als JSONB-Array

CREATE TABLE IF NOT EXISTS ergebnisse_varianten_mfh (
    id SERIAL PRIMARY KEY,
    lod2_id TEXT UNIQUE NOT NULL,
    
    -- Gebäude-Basisdaten (wie EFH)
    heizwaermebedarf_baseline_kwh INTEGER,
    heizwaermebedarf_baseline_mit_ww_kwh INTEGER,
    endenergie_baseline_kwh INTEGER,
    endenergie_baseline_mit_ww_kwh INTEGER,
    nutzflaeche_m2 REAL,
    
    -- MFH-spezifische Basisdaten
    anzahl_wohnungen INTEGER,
    durchschnittliche_miete_eur_m2 REAL,
    cap_rate REAL,
    
    -- Alle Varianten als JSONB-Array
    varianten JSONB NOT NULL,
    
    -- Metadaten
    anzahl_varianten INTEGER,
    optimierung_datum TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index für effiziente Abfragen
CREATE INDEX IF NOT EXISTS idx_ergebnisse_varianten_mfh_lod2_id ON ergebnisse_varianten_mfh(lod2_id);
CREATE INDEX IF NOT EXISTS idx_ergebnisse_varianten_mfh_varianten ON ergebnisse_varianten_mfh USING GIN(varianten);

-- Kommentare für Dokumentation
COMMENT ON TABLE ergebnisse_varianten_mfh IS 'Speichert MFH-Optimierungsergebnisse mit allen Varianten pro LOD2_ID';
COMMENT ON COLUMN ergebnisse_varianten_mfh.lod2_id IS 'Eindeutige LOD2-Gebäude-ID';
COMMENT ON COLUMN ergebnisse_varianten_mfh.varianten IS 'JSONB-Array mit allen Optimierungsvarianten und deren Details';
COMMENT ON COLUMN ergebnisse_varianten_mfh.heizwaermebedarf_baseline_kwh IS 'Baseline-Heizwärmebedarf ohne EnEV-Zuschlag';
COMMENT ON COLUMN ergebnisse_varianten_mfh.heizwaermebedarf_baseline_mit_ww_kwh IS 'Baseline-Heizwärmebedarf inklusive Warmwasser (EnEV-Zuschlag)';
COMMENT ON COLUMN ergebnisse_varianten_mfh.endenergie_baseline_kwh IS 'Baseline-Endenergieverbrauch ohne Warmwasser (Heizwärmebedarf / Systemeffizienz)';
COMMENT ON COLUMN ergebnisse_varianten_mfh.endenergie_baseline_mit_ww_kwh IS 'Baseline-Endenergieverbrauch mit Warmwasser (inkl. EnEV-Zuschlag / Systemeffizienz)';
COMMENT ON COLUMN ergebnisse_varianten_mfh.nutzflaeche_m2 IS 'Gesamte Nutzfläche des MFH in m²';
COMMENT ON COLUMN ergebnisse_varianten_mfh.anzahl_wohnungen IS 'Anzahl der Wohneinheiten im MFH';
COMMENT ON COLUMN ergebnisse_varianten_mfh.durchschnittliche_miete_eur_m2 IS 'Durchschnittliche Miete pro m² für §559 BGB Berechnungen';
COMMENT ON COLUMN ergebnisse_varianten_mfh.cap_rate IS 'Cap-Rate für Wertsteigerungsberechnungen';

-- Beispiel für JSONB-Struktur der Varianten:
/*
[
  {
    "variante_id": "wp_nur",
    "heizwaermebedarf_kwh": 12500,
    "heizwaermebedarf_mit_ww_kwh": 14000,
    "endenergie_variante_kwh": 13889,
    "endenergie_variante_mit_ww_kwh": 15556,
    "endenergie_spezifisch_kwh_m2_jahr": 84.3,
    "brutto_investition_eur": 25000,
    "netto_investition_eur": 20000,
    "foerdersumme_eur": 5000,
    "co2_einsparung_20j_eur": 8500,
    "energie_einsparung_20j_eur": 15000,
    "durchschnitt_nebenkosten_einsparung_eur_jahr": 1175,
    "npv_20j_eur": 12000,
    "payback_jahre": 12.5,
    "score": 75,
    "terminal_value_eur": 15000,
    "zulaessige_umlage_eur_m2_monat": 0.75,
    "gesamtumlage_eur_jahr": 9000,
    "owner_share_co2_kosten_eur": 2500,
    "massnahmen": [
      {
        "key": "waermepumpe_installation",
        "cost_brutto_eur": 25000,
        "cost_netto_eur": 20000,
        "subsidy_eur": 5000,
        "count": 1
      }
    ]
  },
  {
    "variante_id": "wall_wp",
    "heizwaermebedarf_kwh": 10800,
    "heizwaermebedarf_mit_ww_kwh": 12300,
    "endenergie_variante_kwh": 12000,
    "endenergie_variante_mit_ww_kwh": 13667,
    "endenergie_spezifisch_kwh_m2_jahr": 72.7,
    "brutto_investition_eur": 40000,
    "netto_investition_eur": 32000,
    "foerdersumme_eur": 8000,
    "co2_einsparung_20j_eur": 12000,
    "energie_einsparung_20j_eur": 22000,
    "durchschnitt_nebenkosten_einsparung_eur_jahr": 1700,
    "npv_20j_eur": 18500,
    "payback_jahre": 10.2,
    "score": 85,
    "terminal_value_eur": 22000,
    "zulaessige_umlage_eur_m2_monat": 1.20,
    "gesamtumlage_eur_jahr": 14400,
    "owner_share_co2_kosten_eur": 3500,
    "massnahmen": [
      {
        "key": "aussenwand_wdvs",
        "cost_brutto_eur": 15000,
        "cost_netto_eur": 12000,
        "subsidy_eur": 3000,
        "area_m2": 120
      },
      {
        "key": "waermepumpe_installation",
        "cost_brutto_eur": 25000,
        "cost_netto_eur": 20000,
        "subsidy_eur": 5000,
        "count": 1
      }
    ]
  }
]
*/
