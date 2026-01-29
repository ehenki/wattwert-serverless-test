'use client';
import React, { useEffect, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getWhitelabelData, WhitelabelData } from "./components/database/getWhitelabelData";
import PopUp from './components/ui/PopUp';
import WhatsNextPopUp from './components/PopUps/WhatsNext';
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/app/lib/supabaseClient";
import { trackEvent } from '@/lib/analytics';
import MapBackground from "./components/ui/MapBackground";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const [whitelabelData, setWhitelabelData] = useState<WhitelabelData | null>(null);
  const [showInfoText, setShowInfoText] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  useEffect(() => {
    const slug = searchParams.get('p');
    if (slug) {
      getWhitelabelData(slug).then((data) => {
        if (data) {
          localStorage.setItem('whitelabel_data', JSON.stringify(data));
          setWhitelabelData(data);
        }
      });
    } else {
      const storedData = localStorage.getItem('whitelabel_data');
      if (storedData) {
        try {
          setWhitelabelData(JSON.parse(storedData));
        } catch (e) {
          console.error("Failed to parse whitelabel data", e);
        }
      }
    }
  }, [searchParams]);

  const handleNavigateToTool = () => {
    trackEvent('click', 'Homepage', 'Schnellaufmass starten');
    router.push('/tool');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <main style={{ 
      minHeight: "100vh", 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      backgroundColor: "transparent", 
      position: "relative",
      padding: "20px"
    }}>
      <MapBackground />
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          main {
            padding: 8px !important;
          }
        }
      `}} />
      {session && session.user && !session.user.is_anonymous && (
        <button
          onClick={handleSignOut}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            padding: '10px 15px',
            backgroundColor: 'var(--base-col1)',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px',
            zIndex: 1000
          }}
        >
          Abmelden
        </button>
      )}

      <div style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "stretch",
        gap: "20px",
        width: "100%",
        maxWidth: "min(90vw, 800px)",
      }}>
        <style dangerouslySetInnerHTML={{__html: `
          @media (max-width: 1000px) {
            .layout-spacer { display: none !important; }
          }
          @media (max-width: 768px) {
            .main-card { 
              margin: 8px !important;
              padding: 16px !important;
            }
            .button-container { 
              flex-direction: column !important;
              width: 100% !important;
            }
            .button-container button {
              width: 100% !important;
              min-width: unset !important;
            }
          }
        `}} />


        {/* Main Card */}
        <div className="main-card" style={{
          flex: "1 1 400px",
          textAlign: "center",
          padding: "12px",
          backgroundColor: "var(--foreground)",
          borderRadius: "12px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        }}>

          <h1 style={{
            marginBottom: "16px",
            color: "var(--fontcolor)",
            fontSize: "28px",
            fontWeight: "700"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "15px" }}>
              {whitelabelData?.photo_url ? (
                <img
                  src={whitelabelData.photo_url}
                  alt={whitelabelData.name || "Partner Photo"}
                  style={{ width: "50px", height: "50px", borderRadius: "50%", objectFit: "cover", border: "1px solid var(--fontcolor)" }}
                />
              ) : (
                <div style={{ 
                  width: "50px", 
                  height: "50px", 
                  borderRadius: "50%", 
                  border: "2px solid var(--fontcolor)", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  padding: "5px", 
                  boxSizing: "border-box" 
                }}>
                  <img
                    src="/wattwert.ico"
                    alt="WattWert Logo"
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  />
                </div>
              )}
              <span>Fassaden-Schnellaufmaß</span>
            </div>
          </h1>
          <p style={{
            marginBottom: "16px",
            color: "var(--fontcolor)",
            lineHeight: "1.5",
            textAlign: "center"
          }}>
            In kürzester Zeit Fassadenflächen aufmessen.
          </p>

          <h2 style={{
            marginBottom: "8px",
            color: "var(--fontcolor)",
            fontSize: "18px",
            fontWeight: "700",
            textAlign: "center"
          }}>
            Wie funktioniert's?
          </h2>
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center"
          }}>
            <div 
              style={{
                position: "relative",
                paddingBottom: "39%", /* 16:9 aspect ratio at 75% size */
                height: 0,
                width: "60%",
                borderRadius: "8px",
                overflow: "hidden",
                backgroundColor: "#000",
                cursor: isVideoPlaying ? "auto" : "pointer"
              }}
              onClick={() => !isVideoPlaying && setIsVideoPlaying(true)}
            >
              {!isVideoPlaying ? (
                <>
                  <img 
                    src="https://img.youtube.com/vi/qKFoLC3i1Oo/maxresdefault.jpg" 
                    alt="Video Thumbnail"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover"
                    }}
                  />
                  <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "68px",
                    height: "48px",
                    backgroundColor: "rgba(33, 33, 33, 0.8)",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background-color 0.2s"
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#ff0000"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "rgba(33, 33, 33, 0.8)"}
                  >
                    <div style={{
                      width: 0, 
                      height: 0, 
                      borderTop: "10px solid transparent",
                      borderBottom: "10px solid transparent",
                      borderLeft: "16px solid white",
                      marginLeft: "4px"
                    }} />
                  </div>
                </>
              ) : (
                <iframe
                  src="https://www.youtube.com/embed/qKFoLC3i1Oo?autoplay=1"
                  title="Wie funktioniert's?"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    border: 0
                  }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          </div>


          <div className="button-container" style={{ display: "flex", gap: "15px", justifyContent: "center" }}>
            <button
              onClick={handleNavigateToTool}
              style={{
                backgroundColor: "var(--base-col2)",
                marginTop: "10px",
                color: "white",
                border: "none",
                padding: "12px 16px",
                borderRadius: "6px",
                fontSize: "16px",
                fontWeight: "500",
                cursor: "pointer",
                transition: "background-color 0.2s ease",
                minWidth: "200px"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "var(--base-col1)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "var(--base-col2)";
              }}
            >
              Schnellaufmaß starten
            </button>
            <button
              onClick={() => window.open('https://calendly.com/wattwert/c', '_blank')}
              style={{
                backgroundColor: "var(--base-col1)",
                marginTop: "10px",
                color: "white",
                border: "none",
                padding: "12px 16px",
                borderRadius: "6px",
                fontSize: "16px",
                fontWeight: "500",
                cursor: "pointer",
                transition: "background-color 0.2s ease",
                minWidth: "200px"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "var(--base-col1-hover)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "var(--base-col1)";
              }}
            >
              Gespräch vereinbaren
            </button>
          </div>

          <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px" }}>
            <button
              onClick={() => setShowInfoText(!showInfoText)}
              style={{
                background: "transparent",
                border: "1px solid var(--fontcolor)",
                color: "var(--fontcolor)",
                cursor: "pointer",
                fontSize: "14px",
                padding: "6px 12px",
                borderRadius: "20px",
                marginBottom: showInfoText ? "10px" : "0",
                transition: "all 0.2s ease"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "var(--base-col1)";
                e.currentTarget.style.color = "white";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--base-col1)";
              }}
            >
              Über dieses Tool {showInfoText ? "▲" : "▼"}
            </button>
            {showInfoText && (
              <div style={{ fontSize: "14px", color: "var(--fontcolor)", maxWidth: "800px", lineHeight: "1.5" }}>
                Mit diesem Tool erstellst Du ein Fassaden-Aufmaß in ca. <b>2 Minuten</b> - ganz ohne Vor-Ort-Termin. <br />
                Einfach Adresse eingeben, die Außenwände anklicken, und die Fassadenflächen werden automatisch berechnet. <br />
                Im Anschluss kannst Du bei Bedarf einen pauschalen Angebotspreis ableiten. <br />
                <PopUp content={<WhatsNextPopUp />}>
                  <p style={{
                    marginTop: '10px',
                    color: 'var(--base-col1)',
                    fontSize: '14px',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}>
                    Was kommt als nächstes?
                  </p>
                </PopUp>
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Laden...</div>}>
      <HomeContent />
    </Suspense>
  );
}
