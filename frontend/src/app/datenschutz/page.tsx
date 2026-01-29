import React from 'react';
import { Metadata } from 'next';
import BackButton from '../components/ui/BackButton';

export const metadata: Metadata = {
  title: "Datenschutz | WattWert",
  description: "Datenschutzerklärung von WattWert – Informationen zur Verarbeitung Ihrer personenbezogenen Daten.",
  alternates: {
    canonical: "/datenschutz",
  },
};

const Datenschutz = () => {
  const sectionStyle = {
    marginBottom: "24px",
    color: "var(--fontcolor)",
    lineHeight: "1.6"
  };

  const h2Style = {
    fontSize: "20px",
    fontWeight: "600",
    color: "var(--headlinecolor)",
    marginBottom: "8px"
  };

  return (
    <div style={{ 
      minHeight: "100vh", 
      backgroundColor: "var(--background)", 
      padding: "40px 20px",
      color: "var(--fontcolor)",
      fontFamily: "var(--font-noto-sans), system-ui, -apple-system, sans-serif"
    }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", position: "relative" }}>
        <BackButton style={{ left: "-120px", top: "0px" }} />
        
        <header style={{ marginBottom: "40px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: "700", color: "var(--headlinecolor)" }}>
            Datenschutzerklärung
          </h1>
        </header>

        <section style={sectionStyle}>
          <h2 style={h2Style}>1. Einleitung</h2>
          <p>
            Der Schutz Ihrer persönlichen Daten ist uns ein wichtiges Anliegen. Diese Datenschutzerklärung informiert Sie darüber, welche personenbezogenen Daten wir erheben, wie wir sie verwenden, zu welchem Zweck und auf welcher Rechtsgrundlage dies geschieht. Wir handeln stets im Einklang mit der Datenschutz-Grundverordnung (DSGVO) und dem Bundesdatenschutzgesetz (BDSG).
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>2. Verantwortlicher für die Datenverarbeitung</h2>
          <p>
            WattWert GbR<br />
            Brienner Str. 45, 80333 München<br />
            info@wattwert.de<br />
            (Im Folgenden "wir" oder "uns" genannt)
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>3. Erhebung und Verarbeitung personenbezogener Daten</h2>
          <h3 style={{ ...h2Style, fontSize: "18px" }}>3.1. Daten, die Sie uns mitteilen</h3>
          <p>
            Wir erheben personenbezogene Daten, die Sie uns im Rahmen Ihrer Nutzung unserer Website oder unserer Dienste freiwillig mitteilen, z.B. bei der Registrierung, der Kontaktaufnahme über Formulare, der Bestellung von Diensten oder Produkten. Dies können beispielsweise sein: Name, E-Mail-Adresse, Postanschrift, Telefonnummer und andere Informationen, die für die Abwicklung Ihrer Anfrage oder die Erbringung unserer Dienste erforderlich sind.
          </p>
          <br />
          <h3 style={{ ...h2Style, fontSize: "18px" }}>3.2. Automatisch erhobene Daten (Logfiles)</h3>
          <p>
            Bei jedem Zugriff auf unsere Website werden von Ihrem Browser automatisch Informationen an den Server unserer Website gesendet und in sogenannten Server-Logfiles gespeichert. Dies sind:
          </p>
          <ul style={{ paddingLeft: "20px", marginTop: "10px" }}>
            <li>Browsertyp und Browserversion</li>
            <li>verwendetes Betriebssystem</li>
            <li>Referrer URL (die zuvor besuchte Seite)</li>
            <li>Hostname des zugreifenden Rechners</li>
            <li>Uhrzeit der Serveranfrage</li>
            <li>IP-Adresse</li>
          </ul>
          <p style={{ marginTop: "10px" }}>
            Diese Daten sind nicht bestimmten Personen zuordenbar und werden nicht mit anderen Datenquellen zusammengeführt. Die Erhebung erfolgt auf Grundlage unseres berechtigten Interesses gemäß Art. 6 Abs. 1 lit. f DSGVO an der Stabilität und Sicherheit unserer Website.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>4. Zweck der Datenverarbeitung</h2>
          <p>
            Wir verarbeiten Ihre personenbezogenen Daten zu folgenden Zwecken:
          </p>
          <ul style={{ paddingLeft: "20px", marginTop: "10px" }}>
            <li>Zur Bereitstellung, Optimierung und Sicherstellung des Betriebs unserer Website und Dienste.</li>
            <li>Zur Bearbeitung Ihrer Anfragen und zur Kommunikation mit Ihnen.</li>
            <li>Zur Erfüllung vertraglicher Verpflichtungen.</li>
            <li>Zur Verbesserung unserer Angebote und Dienste, basierend auf anonymisierten Analysen.</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>5. Weitergabe von Daten an Dritte</h2>
          <p>
            <strong>Ihre personenbezogenen Daten werden grundsätzlich nicht an Dritte weitergegeben.</strong> Eine Übermittlung an Dritte findet nur statt, wenn:
          </p>
          <ul style={{ paddingLeft: "20px", marginTop: "10px" }}>
            <li>Sie gemäß Art. 6 Abs. 1 lit. a DSGVO Ihre ausdrückliche Einwilligung dazu erteilt haben.</li>
            <li>die Weitergabe nach Art. 6 Abs. 1 lit. f DSGVO zur Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen erforderlich ist und kein Grund zur Annahme besteht, dass Sie ein überwiegendes schutzwürdiges Interesse an der Nichtweitergabe Ihrer Daten haben.</li>
            <li>für den Fall, dass für die Weitergabe nach Art. 6 Abs. 1 lit. c DSGVO eine gesetzliche Verpflichtung besteht.</li>
            <li>dies gesetzlich zulässig und nach Art. 6 Abs. 1 lit. b DSGVO für die Abwicklung von Vertragsverhältnissen mit Ihnen erforderlich ist.</li>
          </ul>
          <p style={{ marginTop: "10px" }}>
            Sollten wir Dienstleister für die Abwicklung von Verarbeitungsprozessen einsetzen, geschieht dies auf Basis eines Auftragsverarbeitungsvertrages nach Art. 28 DSGVO.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>6. Anonymisierte Nutzerverhaltensanalyse (Google Analytics)</h2>
          <p>
            Wir nutzen Google Analytics, einen Webanalysedienst der Google Ireland Limited („Google“), Gordon House, Barrow Street, Dublin 4, Irland. Die Datenverarbeitung dient dem Zweck, diese Website und ihre Besucher zu analysieren. Dazu verwendet Google Cookies, die eine Analyse der Benutzung unserer Website durch Sie ermöglichen. Die mittels der Cookies erhobenen Informationen über Ihre Benutzung dieser Website (einschließlich Ihrer gekürzten IP-Adresse) werden in der Regel an einen Server von Google in den USA übertragen und dort gespeichert.
          </p>
          <p style={{ marginTop: "10px" }}>
            Wir verwenden Google Analytics ausschließlich mit der Erweiterung „_anonymizeIp()“, die eine Anonymisierung der IP-Adresse durch Kürzung sicherstellt und eine direkte Personenbeziehbarkeit ausschließt. Durch die Erweiterung wird Ihre IP-Adresse von Google innerhalb von Mitgliedstaaten der Europäischen Union oder in anderen Vertragsstaaten des Abkommens über den Europäischen Wirtschaftsraum zuvor gekürzt. Nur in Ausnahmefällen wird die volle IP-Adresse an einen Server von Google in den USA übertragen und dort gekürzt.
          </p>
          <p style={{ marginTop: "10px" }}>
            Google wird diese Informationen in unserem Auftrag benutzen, um Ihre Nutzung der Website auszuwerten, um Reports über die Websiteaktivitäten zusammenzustellen und um weitere mit der Websitenutzung und der Internetnutzung verbundene Dienstleistungen uns gegenüber zu erbringen. Die im Rahmen von Google Analytics von Ihrem Browser übermittelte IP-Adresse wird nicht mit anderen Daten von Google zusammengeführt.
          </p>
          <p style={{ marginTop: "10px" }}>
            <strong>Die Analyse des Nutzerverhaltens erfolgt ausschließlich anonymisiert und nur bei Ihrer ausdrücklichen Zustimmung zu Cookies. Diese anonymisierten Daten werden nicht an Dritte weitergegeben.</strong>
          </p>
          <p style={{ marginTop: "10px" }}>
            Rechtsgrundlage ist Ihre Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO. Sie können Ihre Einwilligung jederzeit widerrufen, indem Sie Ihre Cookie-Einstellungen anpassen.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>7. Ihre Rechte als betroffene Person</h2>
          <p>Sie haben das Recht:</p>
          <ul style={{ paddingLeft: "20px", marginTop: "10px" }}>
            <li>gemäß Art. 15 DSGVO Auskunft über Ihre von uns verarbeiteten personenbezogenen Daten zu verlangen.</li>
            <li>gemäß Art. 16 DSGVO unverzüglich die Berichtigung unrichtiger oder Vervollständigung Ihrer bei uns gespeicherten personenbezogenen Daten zu verlangen.</li>
            <li>gemäß Art. 17 DSGVO die Löschung Ihrer bei uns gespeicherten personenbezogenen Daten zu verlangen...</li>
            <li>gemäß Art. 18 DSGVO die Einschränkung der Verarbeitung Ihrer personenbezogenen Daten zu verlangen.</li>
            <li>gemäß Art. 20 DSGVO Ihre personenbezogenen Daten in einem strukturierten, gängigen und maschinenlesbaren Format zu erhalten.</li>
            <li>gemäß Art. 7 Abs. 3 DSGVO Ihre einmal erteilte Einwilligung jederzeit uns gegenüber zu widerrufen.</li>
            <li>gemäß Art. 77 DSGVO sich bei einer Aufsichtsbehörde zu beschweren.</li>
            <li>gemäß Art. 21 DSGVO Widerspruch gegen die Verarbeitung Ihrer personenbezogenen Daten einzulegen.</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>8. Speicherdauer der personenbezogenen Daten</h2>
          <p>
            Die Dauer der Speicherung von personenbezogenen Daten bemisst sich nach der jeweiligen gesetzlichen Aufbewahrungsfrist. Nach Ablauf der Frist werden die entsprechenden Daten routinemäßig gelöscht, sofern sie nicht mehr zur Vertragserfüllung oder Vertragsanbahnung erforderlich sind und/oder unsererseits kein berechtigtes Interesse an der Weiterspeicherung fortbesteht.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>9. Datensicherheit</h2>
          <p>
            Wir verarbeiten Ihre Daten unter Einsatz geeigneter technischer und organisatorischer Sicherheitsmaßnahmen, um Ihre Daten gegen zufällige oder vorsätzliche Manipulationen, teilweisen oder vollständigen Verlust, Zerstörung oder gegen den unbefugten Zugriff Dritter zu schützen.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>10. Änderungen dieser Datenschutzerklärung</h2>
          <p>
            Wir behalten uns vor, diese Datenschutzerklärung bei Bedarf anzupassen, damit sie stets den aktuellen rechtlichen Anforderungen entspricht oder um Änderungen unserer Leistungen in der Datenschutzerklärung umzusetzen, z.B. bei der Einführung neuer Dienste. Für Ihren erneuten Besuch gilt dann die neue Datenschutzerklärung.
          </p>
        </section>
      </div>
    </div>
  );
};

export default Datenschutz;
