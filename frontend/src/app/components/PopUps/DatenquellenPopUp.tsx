import React from 'react';

const DatenquellenPopUp: React.FC = () => {
  return (
    <div style={{ color: 'var(--fontcolor)' }}>
      <h2 style={{ margin: '0 0 20px 0', color: 'var(--headlinecolor)', fontSize: '24px' }}>
        Datenquellen & Lizenzen
      </h2>

      <div style={{ marginBottom: '25px', lineHeight: '1.6' }}>
        WattWert bezieht Gebäudegeometrien aus Geodatensätzen der Länder unter den Lizenzen "Creative Commons Namensnennung 4.0 International (CC BY 4.0)", "Datenlizenz Deutschland - Namensnennung - Version 2.0 (dl-de/by-2-0)" sowie der "Datenlizenz Deutschland - Zero - Version 2.0 (dl-de/zero-2-0)".
        <br /><br />
        Folgende Datenquellen werden verwendet:
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <section>
          <h3 style={{ borderBottom: '1px solid var(--bordercolor)', paddingBottom: '5px' }}>Baden-Württemberg</h3>
          <p><strong>Quelle:</strong> LGL, <a href="https://www.lgl-bw.de" target="_blank" rel="noopener noreferrer">www.lgl-bw.de</a></p>
          <p><strong>Lizenz:</strong> Datenlizenz Deutschland – Namensnennung – Version 2.0</p>
          <p><strong>Metadaten:</strong> LGL BW - 3D-Gebäudemodelle LoD2</p>
        </section>

        <section>
          <h3 style={{ borderBottom: '1px solid var(--bordercolor)', paddingBottom: '5px' }}>Bayern</h3>
          <p><strong>Quelle:</strong> Bayerische Vermessungsverwaltung – <a href="https://www.geodaten.bayern.de" target="_blank" rel="noopener noreferrer">www.geodaten.bayern.de</a></p>
          <p><strong>Lizenz:</strong> Creative Commons Namensnennung 4.0 International (CC BY 4.0)</p>
          <p><strong>Metadaten:</strong> Geodaten Bayern - 3D-Gebäudemodelle (LoD2)</p>
        </section>

        <section>
          <h3 style={{ borderBottom: '1px solid var(--bordercolor)', paddingBottom: '5px' }}>Berlin</h3>
          <p><strong>Quelle:</strong> Geoportal Berlin / 3D-Gebäudemodelle im Level of Detail 2 (LoD 2)</p>
          <p><strong>Lizenz:</strong> Datenlizenz Deutschland - Zero - Version 2.0</p>
          <p><strong>Metadaten:</strong> Berlin Open Data - LoD2</p>
        </section>

        <section>
          <h3 style={{ borderBottom: '1px solid var(--bordercolor)', paddingBottom: '5px' }}>Brandenburg</h3>
          <p><strong>Quelle:</strong> © Landesvermessung und Geobasisinformation Brandenburg</p>
          <p><strong>Lizenz:</strong> Datenlizenz Deutschland – Namensnennung – Version 2.0</p>
          <p><strong>Metadaten:</strong> LGB Brandenburg - 3D-Gebäudemodelle LoD2</p>
        </section>

        <section>
          <h3 style={{ borderBottom: '1px solid var(--bordercolor)', paddingBottom: '5px' }}>Bremen</h3>
          <p><strong>Quelle:</strong> © GeoBasis-DE / Landesamt GeoInformation Bremen</p>
          <p><strong>Lizenz:</strong> Datenlizenz Deutschland – Namensnennung – Version 2.0</p>
          <p><strong>Metadaten:</strong> Geoinformation Bremen - Open Data Übersicht</p>
        </section>

        <section>
          <h3 style={{ borderBottom: '1px solid var(--bordercolor)', paddingBottom: '5px' }}>Hamburg</h3>
          <p><strong>Quelle:</strong> Freie und Hansestadt Hamburg, Landesbetrieb Geoinformation und Vermessung (LGV)</p>
          <p><strong>Lizenz:</strong> Datenlizenz Deutschland – Namensnennung – Version 2.0</p>
          <p><strong>Metadaten:</strong> MetaVer - 3D-Gebäudemodell LoD2-DE Hamburg</p>
        </section>

        <section>
          <h3 style={{ borderBottom: '1px solid var(--bordercolor)', paddingBottom: '5px' }}>Hessen</h3>
          <p><strong>Quelle:</strong> Hessische Verwaltung für Bodenmanagement und Geoinformation (HVBG)</p>
          <p><strong>Lizenz:</strong> Datenlizenz Deutschland – Namensnennung – Version 2.0</p>
          <p><strong>Metadaten:</strong> HVBG - 3D-Gebäudemodelle</p>
        </section>

        <section>
          <h3 style={{ borderBottom: '1px solid var(--bordercolor)', paddingBottom: '5px' }}>Mecklenburg-Vorpommern</h3>
          <p><strong>Quelle:</strong> Landesamt für innere Verwaltung M-V</p>
          <p><strong>Lizenz:</strong> Creative Commons Namensnennung 4.0 International (CC BY 4.0)</p>
          <p><strong>Metadaten:</strong> LAiV M-V - Gebäudemodelle</p>
        </section>

        <section>
          <h3 style={{ borderBottom: '1px solid var(--bordercolor)', paddingBottom: '5px' }}>Niedersachsen</h3>
          <p><strong>Quelle:</strong> LGLN</p>
          <p><strong>Lizenz:</strong> Creative Commons Namensnennung 4.0 International (CC BY 4.0)</p>
          <p><strong>Metadaten:</strong> LGLN - 3D-Gebäudemodelle (LoD2)</p>
        </section>

        <section>
          <h3 style={{ borderBottom: '1px solid var(--bordercolor)', paddingBottom: '5px' }}>Nordrhein-Westfalen</h3>
          <p><strong>Quelle:</strong> Land NRW / Geobasis NRW</p>
          <p><strong>Lizenz:</strong> Datenlizenz Deutschland - Zero - Version 2.0</p>
          <p><strong>Metadaten:</strong> Geobasis NRW - 3D-Gebäudemodell LoD2</p>
        </section>

        <section>
          <h3 style={{ borderBottom: '1px solid var(--bordercolor)', paddingBottom: '5px' }}>Rheinland-Pfalz</h3>
          <p><strong>Quelle:</strong> © GeoBasis-DE / LVermGeoRP {'<'}Jahr{'>'}, dl-de/by-2-0, <a href="https://www.lvermgeo.rlp.de" target="_blank" rel="noopener noreferrer">www.lvermgeo.rlp.de</a></p>
          <p><strong>Lizenz:</strong> Datenlizenz Deutschland – Namensnennung – Version 2.0</p>
          <p><strong>Metadaten:</strong> Metaportal RLP - 3D-Gebäudemodell LoD2</p>
        </section>

        <section>
          <h3 style={{ borderBottom: '1px solid var(--bordercolor)', paddingBottom: '5px' }}>Saarland</h3>
          <p><strong>Quelle:</strong> © GeoBasis DE/LVGL-SL</p>
          <p><strong>Lizenz:</strong> Datenlizenz Deutschland – Namensnennung – Version 2.0</p>
          <p><strong>Metadaten:</strong> Geoportal Saarland - Metadaten LoD2</p>
        </section>

        <section>
          <h3 style={{ borderBottom: '1px solid var(--bordercolor)', paddingBottom: '5px' }}>Sachsen</h3>
          <p><strong>Quelle:</strong> GeoSN</p>
          <p><strong>Lizenz:</strong> Datenlizenz Deutschland – Namensnennung – Version 2.0</p>
          <p><strong>Metadaten:</strong> GeoSN - Digitale Höhen- und 3D-Stadtmodelle</p>
        </section>

        <section>
          <h3 style={{ borderBottom: '1px solid var(--bordercolor)', paddingBottom: '5px' }}>Sachsen-Anhalt</h3>
          <p><strong>Quelle:</strong> © GeoBasis-DE / LVermGeo ST</p>
          <p><strong>Lizenz:</strong> Datenlizenz Deutschland – Namensnennung – Version 2.0</p>
          <p><strong>Metadaten:</strong> LVermGeo Sachsen-Anhalt - Open Data</p>
        </section>

        <section>
          <h3 style={{ borderBottom: '1px solid var(--bordercolor)', paddingBottom: '5px' }}>Schleswig-Holstein</h3>
          <p><strong>Quelle:</strong> © GeoBasis-DE/LVermGeo SH/CC BY 4.0</p>
          <p><strong>Lizenz:</strong> Creative Commons Namensnennung 4.0 International (CC BY 4.0)</p>
          <p><strong>Metadaten:</strong> LVermGeo SH - ALKIS und 3D-Daten</p>
        </section>

        <section>
          <h3 style={{ borderBottom: '1px solid var(--bordercolor)', paddingBottom: '5px' }}>Thüringen</h3>
          <p><strong>Quelle:</strong> © GDI-Th</p>
          <p><strong>Lizenz:</strong> Datenlizenz Deutschland – Namensnennung – Version 2.0</p>
          <p><strong>Metadaten:</strong> TLBG - 3D-Gebäudemodelle</p>
        </section>
      </div>
    </div>
  );
};

export default DatenquellenPopUp;

