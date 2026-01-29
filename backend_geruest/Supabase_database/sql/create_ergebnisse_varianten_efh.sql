-- Tabelle für EFH-Optimierungsergebnisse
-- Eine Zeile pro LOD2_ID mit allen Varianten als JSONB-Array

CREATE TABLE IF NOT EXISTS ergebnisse_varianten_efh (
    id SERIAL PRIMARY KEY,
    lod2_id TEXT UNIQUE NOT NULL,
    
    -- Gebäude-Basisdaten
    heizwaermebedarf_baseline_kwh INTEGER,
    heizwaermebedarf_baseline_mit_ww_kwh INTEGER,
    endenergie_baseline_kwh INTEGER,
    endenergie_baseline_mit_ww_kwh INTEGER,
    nutzflaeche_m2 REAL,
    
    -- Alle Varianten als JSONB-Array
    varianten JSONB NOT NULL,
    
    -- Metadaten
    anzahl_varianten INTEGER,
    optimierung_datum TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index für effiziente Abfragen
CREATE INDEX IF NOT EXISTS idx_ergebnisse_varianten_efh_lod2_id ON ergebnisse_varianten_efh(lod2_id);
CREATE INDEX IF NOT EXISTS idx_ergebnisse_varianten_efh_varianten ON ergebnisse_varianten_efh USING GIN(varianten);

-- Kommentare für Dokumentation
COMMENT ON TABLE ergebnisse_varianten_efh IS 'Speichert EFH-Optimierungsergebnisse mit allen Varianten pro LOD2_ID';
COMMENT ON COLUMN ergebnisse_varianten_efh.lod2_id IS 'Eindeutige LOD2-Gebäude-ID';
COMMENT ON COLUMN ergebnisse_varianten_efh.varianten IS 'JSONB-Array mit allen Optimierungsvarianten und deren Details';
COMMENT ON COLUMN ergebnisse_varianten_efh.heizwaermebedarf_baseline_kwh IS 'Baseline-Heizwärmebedarf ohne EnEV-Zuschlag';
COMMENT ON COLUMN ergebnisse_varianten_efh.heizwaermebedarf_baseline_mit_ww_kwh IS 'Baseline-Heizwärmebedarf inklusive Warmwasser (EnEV-Zuschlag)';
COMMENT ON COLUMN ergebnisse_varianten_efh.endenergie_baseline_kwh IS 'Baseline-Endenergieverbrauch ohne Warmwasser (Heizwärmebedarf / Systemeffizienz)';
COMMENT ON COLUMN ergebnisse_varianten_efh.endenergie_baseline_mit_ww_kwh IS 'Baseline-Endenergieverbrauch mit Warmwasser (inkl. EnEV-Zuschlag / Systemeffizienz)';
COMMENT ON COLUMN ergebnisse_varianten_efh.nutzflaeche_m2 IS 'Nutzfläche des Gebäudes in m²';

-- Beispiel für JSONB-Struktur der Varianten:
/*
[
  {
    "variante_id": "wp_nur",
    "heizwaermebedarf_kwh": 12500,
    "heizwaermebedarf_mit_ww_kwh": 14000,
    "endenergie_variante_kwh": 13889,
    "endenergie_variante_mit_ww_kwh": 15556,
    "brutto_investition_eur": 25000,
    "netto_investition_eur": 20000,
    "foerdersumme_eur": 5000,
    "co2_einsparung_20j_eur": 8500,
    "energie_einsparung_20j_eur": 15000,
    "durchschnitt_nebenkosten_einsparung_eur_jahr": 1175,
    "npv_20j_eur": 12000,
    "payback_jahre": 12.5,
    "score": 75,
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
    "brutto_investition_eur": 40000,
    "netto_investition_eur": 32000,
    "foerdersumme_eur": 8000,
    "co2_einsparung_20j_eur": 12000,
    "energie_einsparung_20j_eur": 22000,
    "durchschnitt_nebenkosten_einsparung_eur_jahr": 1700,
    "npv_20j_eur": 18500,
    "payback_jahre": 10.2,
    "score": 85,
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
