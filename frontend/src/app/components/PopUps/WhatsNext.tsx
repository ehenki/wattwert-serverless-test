import React from 'react';

const WhatsNextPopUp: React.FC = () => {
  return (
    <div style={{ color: 'var(--fontcolor)' }}>
      <h2 style={{ margin: '0 0 20px 0', color: 'var(--headlinecolor)', fontSize: '24px' }}>
        Was entwickeln wir derzeit bei WattWert?
      </h2>
      
      <p style={{ marginBottom: '16px', lineHeight: '1.6', fontSize: '15px' }}>
      Aktuell kannst du mit dem <span style={{fontWeight: 'bold'}}>Schnellaufmaß</span> unsere bereitgestellten 3D-Fassadenmodelle automatisch auswerten und alle relevanten Flächen ermitteln. Auf dieser Basis berechnest du in wenigen Minuten Pauschalpreise für einfache Fassadenprojekte. <br /> <br />
      Keine Zeit, zum Gebäude zu fahren und manuell aufzumessen?
      <br />
      Keine Lust, Längen ungenau und mühsam aus Google Maps rauszumessen?
      <br />
      <br />
      Gemeinsam mit Betrieben wie deinem entwickeln wir die Zukunft der Gebäudevermessung. Sei dabei und teste unser Tool unverbindlich & kostenlos bis zum 15.01.2026 und verschaffe Dir so einen echten Vorsprung.
      <br />
        {/* Des weiteren bieten wir bereits eine individualisierbare Seite an, auf der Ihre Kunden schnell selbst ihr Gebäude mit 3D-Daten und Fotos erfassen und ein Angebot anfragen können.
        Diese Seite können Sie mit Ihrem Branding, Logo, Preisen und Texten personalisieren, sodass Kunden sich persönlich angesprochen fühlen.
        Sie wissen damit gleich, auf welche Art von Projekt Sie sich einlassen, und können Ihr Angebot entsprechend gestalten.
        Eine Beispielseite finden Sie unter: <u><a href="https://aufmass.umbau.digital/?p=test" target="_blank" rel="noopener noreferrer">aufmass.umbau.digital</a></u>. <br />
        Wenn Sie ebenfalls eine solche Seite für Ihre Kunden erstellen möchten oder Fragen haben, kontaktieren Sie uns gerne unter info@wattwert.de. */}
      </p>

      <h3 style={{ margin: '20px 0 12px 0', color: 'var(--headlinecolor)', fontSize: '24px' }}>
        Bald verfügbar: Das Detailaufmaß
      </h3>

      <p style={{ marginBottom: '16px', lineHeight: '1.6', fontSize: '15px' }}>
      Wir wollen den Aufmaß- und Angebotsprozess im Fassadenhandwerk so <b>einfach wie möglich</b> gestalten. <br /> <br />
      Durch kontinuierliche Updates entwickeln wir dieses Tool bis Mitte 2026 zu einer Anwendung weiter, die das Fassadenaufmaß anhand von Fotos und unseren 3D-Modelle weitgehend automatisiert. <br /> <br/>
      So bleibt <b>mehr Zeit</b> für Ausbildung, Teamführung und die Betreuung deiner Projekte. Auf unserer Website kannst du dich für die Beta-Version anmelden: <a href="https://www.umbau.digital/#tester" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--base-col1)', textDecoration: 'underline' }}>umbau.digital</a>
      </p>
      <p style={{ marginBottom: '16px', lineHeight: '1.6', fontSize: '15px' }}>
      Hast Du noch weitere Anregungen, wie wir WattWert für deinen Betrieb verbessern können? Kontaktiere uns einfach unter <a href="mailto:info@wattwert.de" style={{ color: 'var(--base-col1)', textDecoration: 'underline' }}>info@wattwert.de</a> oder rufe uns an unter +49 151 708 573 66
      </p>
    </div>
  );
};

export default WhatsNextPopUp;
