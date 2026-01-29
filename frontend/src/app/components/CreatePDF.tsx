import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Link } from '@react-pdf/renderer';

interface WallInfo {
  wallIndex: number;
  area: number;
  maxHeight: number;
  width?: number;
  direction?: string;
}

interface PDFProps {
  walls: WallInfo[];
  windowShare: number;
  directionWindowShares?: Record<string, number>;
  selectedCount: number;
  maxHeight: number;
  groundPerimeter: number;
  totalArea: number;
  totalWindowArea: number;
  totalWallArea: number;
  pricePerSqm: number;
  safetyMargin: number;
  additionalCosts: number;
  totalPrice: number;
  logoUrl?: string;
  address: string;
  userRole?: string | null;
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#333',
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
    color: '#000000',
    fontWeight: 'bold',
  },
  logo: {
    position: 'absolute',
    top: 30,
    right: 30,
    maxWidth: 100,
    height: 48,
    objectFit: 'contain',
  },
  address: {
    fontSize: 12,
    marginBottom: 20,
    textAlign: 'center',
    color: '#666',
  },
  section: {
    marginBottom: 15,
    padding: 0,
    border: 'none',
  },
  table: {
    display: "flex",
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderColor: '#e0e0e0',
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableColHeader: {
    width: '25%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
    padding: 5,
  },
  tableCol: {
    width: '25%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: '#e0e0e0',
    padding: 5,
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 11,
  },
  summaryContainer: {
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 0,
    border: '1px solid #dddddd',
    borderLeft: '4px solid var(--base-col1)',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: {
    color: '#666',
  },
  summaryValue: {
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 4,
  },
  priceResultContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 0,
    border: '1px solid #dddddd',
    borderLeft: '4px solid var(--base-col1)',
  },
  priceResultTable: {
    width: '100%',
  },
  priceResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceResultColHeader: {
    textAlign: 'left',
    fontWeight: 'bold',
    fontSize: 11,
    paddingBottom: 4,
  },
  priceResultCol: {
    textAlign: 'left',
    fontSize: 10,
    paddingBottom: 4,
  },
  totalPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTop: '1px solid #e0e0e0',
    marginTop: 8,
  },
  totalPriceLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'var(--base-col1)',
  },
  totalPriceValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'var(--base-col1)',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    color: '#666',
    fontSize: 8,
  },
});

export const OfferPDF = ({
  walls,
  windowShare,
  directionWindowShares = {},
  selectedCount,
  maxHeight,
  groundPerimeter,
  totalArea,
  totalWindowArea,
  totalWallArea,
  pricePerSqm,
  safetyMargin,
  additionalCosts,
  totalPrice,
  logoUrl,
  address,
  userRole,
}: PDFProps) => {
  const leistungspreis = totalWallArea * pricePerSqm;
  const sicherheitsaufschlag = leistungspreis * (safetyMargin / 100);
  const total_length_walls = walls.reduce((sum, wall) => sum + (wall.width || 0), 0);
  
  // Calculate average window share from direction-specific shares
  const averageWindowShare = totalArea > 0 
    ? (totalWindowArea / totalArea * 100) 
    : (windowShare || 15);
  
  const colStyle = userRole === 'geruestbauer' ? { width: '33.33%' } : {};

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Image style={styles.logo} src={logoUrl || '/wattwert_logo.jpg'} />
        <Text style={styles.title}>WattWert Schnellaufmaß</Text>
        <Text style={styles.address}>{address}</Text>
        {/* Wall Table */}
        <View style={styles.section}>
          <Text style={{ marginBottom: 10, fontSize: 16 }}>Maße</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={[styles.tableColHeader, colStyle]}><Text style={styles.headerText}>Wand</Text></View>
              {userRole === 'geruestbauer' ? (
                <>
                  <View style={[styles.tableColHeader, colStyle]}><Text style={styles.headerText}>Gerüst-Außenfläche</Text></View>
                  <View style={[styles.tableColHeader, colStyle]}><Text style={styles.headerText}>Gerüsthöhe</Text></View>
                </>
              ) : (
                <>
                  <View style={styles.tableColHeader}><Text style={styles.headerText}>Wand + Fensterfläche</Text></View>
                  <View style={styles.tableColHeader}><Text style={styles.headerText}>Wandfläche</Text></View>
                  <View style={styles.tableColHeader}><Text style={styles.headerText}>Höhe</Text></View>
                </>
              )}
            </View>
            {walls.map((wall) => {
              // Use direction-specific window share if available, otherwise fall back to global windowShare (defaulting to 15% if both are missing/0)
              const windowShareForWall = wall.direction && directionWindowShares[wall.direction] !== undefined
                ? directionWindowShares[wall.direction]
                : (windowShare || 15);
              const windowShareDecimal = windowShareForWall / 100;
              const wallArea = wall.area * (1 - windowShareDecimal);
              
              return (
                <View key={wall.wallIndex} style={styles.tableRow}>
                  <View style={[styles.tableCol, colStyle]}><Text>{wall.wallIndex + 1}</Text></View>
                  {userRole === 'geruestbauer' ? (
                    <>
                      <View style={[styles.tableCol, colStyle]}><Text>{wall.area.toFixed(1)} m²</Text></View>
                      <View style={[styles.tableCol, colStyle]}><Text>{wall.maxHeight.toFixed(1)} m</Text></View>
                    </>
                  ) : (
                    <>
                      <View style={styles.tableCol}><Text>{wall.area.toFixed(1)} m²</Text></View>
                      <View style={styles.tableCol}><Text>{wallArea.toFixed(1)} m²</Text></View>
                      <View style={styles.tableCol}><Text>{wall.maxHeight.toFixed(1)} m</Text></View>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Summary */}
        <View style={[styles.section, styles.summaryContainer]}>
          <Text style={{ fontSize: 16, marginBottom: 8 }}>Zusammenfassung</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Ausgewählte Wände:</Text>
            <Text style={styles.summaryValue}>{selectedCount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{userRole === 'geruestbauer' ? 'Max. Gerüsthöhe:' : 'Max. Höhe:'}</Text>
            <Text style={styles.summaryValue}>{maxHeight.toFixed(1)} m</Text>
          </View>
          {userRole === 'geruestbauer' ? (
            <>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Gesamt-Außenfläche Gerüst:</Text>
                <Text style={styles.summaryValue}>{totalArea.toFixed(1)} m²</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Gesamtlänge Dachuntersicht:</Text>
                <Text style={styles.summaryValue}>{total_length_walls.toFixed(1)} m</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Gesamtfläche Fassade:</Text>
                <Text style={styles.summaryValue}>{totalArea.toFixed(1)} m²</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>- Fensterfläche (Ø {averageWindowShare.toFixed(1)}%):</Text>
                <Text style={styles.summaryValue}>{totalWindowArea.toFixed(1)} m²</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { fontWeight: 'bold' }]}>Wandfläche (Ø {(100 - averageWindowShare).toFixed(1)}%):</Text>
                <Text style={styles.summaryValue}>{totalWallArea.toFixed(1)} m²</Text>
              </View>
            </>
          )}
        </View>

        {/* Price Result */}
        <View style={[styles.section, styles.priceResultContainer]}>
          <Text style={{ fontSize: 16, marginBottom: 8 }}>Preiskalkulation</Text>
          <View style={styles.priceResultTable}>
            <View style={styles.priceResultRow}>
              <Text style={styles.priceResultColHeader}>Leistungspreis</Text>
              <Text style={styles.priceResultColHeader}>Sicherheitsaufschlag</Text>
              <Text style={styles.priceResultColHeader}>Zusatzaufwände</Text>
              <Text style={[styles.priceResultColHeader, {fontWeight: 800}]}>Gesamtkosten</Text>
            </View>
             <View style={styles.priceResultRow}>
              <Text style={styles.priceResultCol}>{leistungspreis.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</Text>
              <Text style={styles.priceResultCol}>{sicherheitsaufschlag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</Text>
              <Text style={styles.priceResultCol}>{additionalCosts.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</Text>
              <Text style={[styles.priceResultCol, {fontWeight: 800}]}>{totalPrice.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, { marginTop: 10 }]}>
          <Text style={{ fontSize: 10, color: '#666' }}>
            Gebäudemaße automatisch mit dem digitalen Aufmaß von WattWert ermittelt: <Link style={{ color: '#0066cc', textDecoration: 'underline' }} src="https://aufmass.umbau.digital">aufmass.umbau.digital</Link>
          </Text>
        </View>

        <Text style={styles.footer}>
          Die Wandflächen des Schnellaufmaßes basieren auf Level of Detail 2 (LOD2)-Daten des jeweiligen Bundeslandes und ggf. vom Nutzer hochgeladenen Bildern. 
          WattWert übernimmt keine Haftung für die Korrektheit dieser Daten. Es wird zu einer Prüfung auf Plausibilität vor Erstellen eines Agebots auf Basis dieser Daten geraten.
        </Text>
      </Page>
    </Document>
  );
};