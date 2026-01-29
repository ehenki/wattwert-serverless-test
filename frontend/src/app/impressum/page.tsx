import { Metadata } from "next";
import BackButton from "../components/ui/BackButton";

export const metadata: Metadata = {
  title: "Impressum | WattWert",
  description: "Impressum von WattWert – Anbieterkennzeichnung, Kontakt und rechtliche Hinweise.",
  alternates: {
    canonical: "/impressum",
  },
};

const Impressum = () => {
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "WattWert",
    email: "info@wattwert.de",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Brienner Str. 45/a-d",
      addressLocality: "München",
      postalCode: "80333",
      addressCountry: "DE"
    },
    url: "https://wattwert.de/impressum"
  };

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
      color: "var(--fontcolor)"
    }}>
      <main style={{ maxWidth: "800px", margin: "0 auto", position: "relative" }}>
        <BackButton style={{ left: "-120px", top: "0px" }} />
        <header style={{ marginBottom: "40px", textAlign: "center" }}>
          <h1 style={{ fontSize: "32px", fontWeight: "700", color: "var(--headlinecolor)" }}>
            Impressum
          </h1>
        </header>

        <article>
          <section style={sectionStyle}>
            <h2 style={h2Style}>Angaben gemäß § 5 TMG</h2>
            <p>WattWert (i.G.)</p>
            <p>
              c/o Munich Innovation Ecosystem
              <br />
              Design Offices Königsplatz
              <br />
              Brienner Str. 45/a-d
              <br />
              80333 München
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>Vertreten durch</h2>
            <p>zukünftige Geschäftsführer: Christopher Höllerer, Leonhard Noll, Emil Henking</p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>Kontakt</h2>
            <p>
              E-Mail: {" "}
              <a href="mailto:info@wattwert.de" style={{ color: "var(--base-col1)", textDecoration: "underline" }}>
                info@wattwert.de
              </a>
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>Hinweis auf EU-Streitbeilegung</h2>
            <p>
              Die Europäische Kommission stellt unter dem nachfolgenden Link eine
              Plattform zur Online-Streitbeilegung (OS) bereit: {" "}
              <a href="http://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" style={{ color: "var(--base-col1)", textDecoration: "underline" }}>
                http://ec.europa.eu/consumers/odr
              </a>
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>Hinweis gemäß § 36 Verbraucherstreitbeilegungsgesetz (VSBG)</h2>
            <p>
              Wir schließen die Teilnahme an einem Streitbeilegungsverfahren vor
              einer Verbraucherschlichtungsstelle im Sinne des
              Verbraucherstreitbeilegungsgesetzes (VSBG) aus und haben uns dazu
              entschieden, nicht an einem solchen Streitbeilegungsverfahren
              teilzunehmen; zur Teilnahme an einem solchen
              Streitbeilegungsverfahren sind wir auch nicht verpflichtet.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>Haftung für Inhalte</h2>
            <p>
              Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte
              auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach
              §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet,
              übermittelte oder gespeicherte fremde Informationen zu überwachen oder
              nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit
              hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von
              Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.
              Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der
              Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden
              von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend
              entfernen.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>Haftung für Links</h2>
            <p>
              Unser Angebot kann Links zu externen Webseiten Dritter enthalten, auf
              deren Inhalte wir keinen Einfluss haben. Deshalb können wir für die
              Aktualität, Richtigkeit und Vollständigkeit dieser fremden Inhalte
              grundsätzlich keine Gewähr übernehmen.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>Geistiges Eigentum & Copyright</h2>
            <p>2025 alle Rechte vorbehalten. Alle Texte, Bilder, Graphiken, Ton-, Video- oder Animationsdateien auf unserer Website unterliegen in der Regel dem Urheberrecht und/oder anderen Gesetzen zum Schutz des geistigen Eigentums. Die Vervielfältigung, Bearbeitung, Verbreitung und jede andere Art der Nutzung und Verwertung für geschäftliche Zwecke ist grundsätzlich unzulässig, es sei denn, es liegt die vorherige schriftliche Zustimmung der Geschäftsführer von WattWert vor.</p>
          </section>
        </article>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(orgJsonLd)
          }}
        />
      </main>
    </div>
  );
};

export default Impressum;
