import React, { useState } from 'react';

interface ColorSelectionSlideProps {
  value: string; // selected color key like 'Exclusiv 9197'
  chooseLater: boolean;
  onChange: (nextValue: string) => void;
  onChooseLaterChange: (checked: boolean) => void;
}

type PaletteColor = {
  key: string;   // "Exclusiv ####"
  rgb: string;   // "rgb(r,g,b)"
};

export const COLORS: PaletteColor[] = [
  // --- Sheet 1 (Farbwerte/Process colour codes KEIM Palette Exclusiv) ---
  { key: 'Exclusiv 9125', rgb: 'rgb(185,135,106)' },
  { key: 'Exclusiv 9001', rgb: 'rgb(239,233,132)' },
  { key: 'Exclusiv 9073', rgb: 'rgb(231,202,145)' },
  { key: 'Exclusiv 9129', rgb: 'rgb(206,167,144)' },
  { key: 'Exclusiv 9002', rgb: 'rgb(221,168,80)' },
  { key: 'Exclusiv 9075', rgb: 'rgb(234,213,169)' },
  { key: 'Exclusiv 9132', rgb: 'rgb(224,195,172)' },
  { key: 'Exclusiv 9003', rgb: 'rgb(149,71,55)' },
  { key: 'Exclusiv 9076', rgb: 'rgb(235,221,186)' },
  { key: 'Exclusiv 9135', rgb: 'rgb(230,213,196)' },
  { key: 'Exclusiv 9004', rgb: 'rgb(107,100,77)' },
  { key: 'Exclusiv 9077', rgb: 'rgb(231,222,196)' },
  { key: 'Exclusiv 9136', rgb: 'rgb(236,223,208)' },
  { key: 'Exclusiv 9005', rgb: 'rgb(92,125,87)' },
  { key: 'Exclusiv 9078', rgb: 'rgb(234,226,204)' },
  { key: 'Exclusiv 9137', rgb: 'rgb(236,227,215)' },
  { key: 'Exclusiv 9006', rgb: 'rgb(70,104,197)' },
  { key: 'Exclusiv 9084', rgb: 'rgb(184,134,87)' },
  { key: 'Exclusiv 9144', rgb: 'rgb(180,124,92)' },
  { key: 'Exclusiv 9007', rgb: 'rgb(107,70,59)' },
  { key: 'Exclusiv 9087', rgb: 'rgb(204,160,108)' },
  { key: 'Exclusiv 9146', rgb: 'rgb(204,146,115)' },
  { key: 'Exclusiv 9008', rgb: 'rgb(66,66,67)' },
  { key: 'Exclusiv 9089', rgb: 'rgb(218,170,119)' },
  { key: 'Exclusiv 9149', rgb: 'rgb(223,169,134)' },
  { key: 'Exclusiv 9009', rgb: 'rgb(0,138,183)' },
  { key: 'Exclusiv 9090', rgb: 'rgb(225,178,123)' },
  { key: 'Exclusiv 9153', rgb: 'rgb(234,195,165)' },
  { key: 'Exclusiv 9010', rgb: 'rgb(137,71,67)' },
  { key: 'Exclusiv 9091', rgb: 'rgb(219,185,140)' },
  { key: 'Exclusiv 9154', rgb: 'rgb(233,206,183)' },
  { key: 'Exclusiv 9033', rgb: 'rgb(241,212,133)' },
  { key: 'Exclusiv 9092', rgb: 'rgb(219,194,159)' },
  { key: 'Exclusiv 9156', rgb: 'rgb(236,220,204)' },
  { key: 'Exclusiv 9036', rgb: 'rgb(237,218,164)' },
  { key: 'Exclusiv 9095', rgb: 'rgb(233,213,179)' },
  { key: 'Exclusiv 9157', rgb: 'rgb(232,224,212)' },
  { key: 'Exclusiv 9037', rgb: 'rgb(237,225,183)' },
  { key: 'Exclusiv 9096', rgb: 'rgb(234,221,200)' },
  { key: 'Exclusiv 9162', rgb: 'rgb(159,88,69)' },
  { key: 'Exclusiv 9038', rgb: 'rgb(237,229,197)' },
  { key: 'Exclusiv 9097', rgb: 'rgb(239,226,208)' },
  { key: 'Exclusiv 9164', rgb: 'rgb(188,111,88)' },
  { key: 'Exclusiv 9049', rgb: 'rgb(222,170,91)' },
  { key: 'Exclusiv 9102', rgb: 'rgb(143,109,88)' },
  { key: 'Exclusiv 9166', rgb: 'rgb(209,137,114)' },
  { key: 'Exclusiv 9051', rgb: 'rgb(234,188,120)' },
  { key: 'Exclusiv 9103', rgb: 'rgb(166,118,85)' },
  { key: 'Exclusiv 9169', rgb: 'rgb(222,164,140)' },
  { key: 'Exclusiv 9053', rgb: 'rgb(235,204,154)' },
  { key: 'Exclusiv 9105', rgb: 'rgb(200,133,88)' },
  { key: 'Exclusiv 9171', rgb: 'rgb(226,180,162)' },
  { key: 'Exclusiv 9055', rgb: 'rgb(236,219,182)' },
  { key: 'Exclusiv 9108', rgb: 'rgb(210,156,108)' },
  { key: 'Exclusiv 9174', rgb: 'rgb(234,203,187)' },
  { key: 'Exclusiv 9057', rgb: 'rgb(236,224,199)' },
  { key: 'Exclusiv 9110', rgb: 'rgb(224,184,136)' },
  { key: 'Exclusiv 9176', rgb: 'rgb(235,215,204)' },
  { key: 'Exclusiv 9058', rgb: 'rgb(233,226,211)' },
  { key: 'Exclusiv 9112', rgb: 'rgb(233,198,156)' },
  { key: 'Exclusiv 9177', rgb: 'rgb(236,226,217)' },
  { key: 'Exclusiv 9064', rgb: 'rgb(174,136,84)' },
  { key: 'Exclusiv 9115', rgb: 'rgb(235,212,179)' },
  { key: 'Exclusiv 9182', rgb: 'rgb(145,97,82)' },
  { key: 'Exclusiv 9066', rgb: 'rgb(193,153,98)' },
  { key: 'Exclusiv 9117', rgb: 'rgb(237,220,197)' },
  { key: 'Exclusiv 9183', rgb: 'rgb(166,116,104)' },
  { key: 'Exclusiv 9069', rgb: 'rgb(208,174,120)' },
  { key: 'Exclusiv 9122', rgb: 'rgb(149,95,70)' },
  { key: 'Exclusiv 9184', rgb: 'rgb(184,123,105)' },
  { key: 'Exclusiv 9071', rgb: 'rgb(228,191,125)' },
  { key: 'Exclusiv 9123', rgb: 'rgb(163,106,74)' },

  // --- Sheet 2 ---
  { key: 'Exclusiv 9330', rgb: 'rgb(204,184,134)' },
  { key: 'Exclusiv 9186', rgb: 'rgb(189,139,122)' },
  { key: 'Exclusiv 9263', rgb: 'rgb(142,119,92)' },
  { key: 'Exclusiv 9332', rgb: 'rgb(212,197,159)' },
  { key: 'Exclusiv 9187', rgb: 'rgb(197,157,139)' },
  { key: 'Exclusiv 9265', rgb: 'rgb(166,146,114)' },
  { key: 'Exclusiv 9335', rgb: 'rgb(225,217,193)' },
  { key: 'Exclusiv 9190', rgb: 'rgb(212,178,164)' },
  { key: 'Exclusiv 9268', rgb: 'rgb(190,171,141)' },
  { key: 'Exclusiv 9337', rgb: 'rgb(233,228,211)' },
  { key: 'Exclusiv 9192', rgb: 'rgb(218,193,181)' },
  { key: 'Exclusiv 9271', rgb: 'rgb(206,191,164)' },
  { key: 'Exclusiv 9339', rgb: 'rgb(238,232,219)' },
  { key: 'Exclusiv 9195', rgb: 'rgb(231,215,204)' },
  { key: 'Exclusiv 9274', rgb: 'rgb(224,209,188)' },
  { key: 'Exclusiv 9345', rgb: 'rgb(161,150,115)' },
  { key: 'Exclusiv 9197', rgb: 'rgb(232,224,216)' },
  { key: 'Exclusiv 9276', rgb: 'rgb(233,220,201)' },
  { key: 'Exclusiv 9348', rgb: 'rgb(180,170,139)' },
  { key: 'Exclusiv 9200', rgb: 'rgb(111,75,69)' },
  { key: 'Exclusiv 9283', rgb: 'rgb(133,116,96)' },
  { key: 'Exclusiv 9351', rgb: 'rgb(199,187,157)' },
  { key: 'Exclusiv 9201', rgb: 'rgb(127,94,89)' },
  { key: 'Exclusiv 9285', rgb: 'rgb(163,146,124)' },
  { key: 'Exclusiv 9354', rgb: 'rgb(217,207,184)' },
  { key: 'Exclusiv 9203', rgb: 'rgb(143,114,110)' },
  { key: 'Exclusiv 9288', rgb: 'rgb(182,166,145)' },
  { key: 'Exclusiv 9357', rgb: 'rgb(232,226,211)' },
  { key: 'Exclusiv 9206', rgb: 'rgb(170,146,138)' },
  { key: 'Exclusiv 9292', rgb: 'rgb(207,195,179)' },
  { key: 'Exclusiv 9367', rgb: 'rgb(171,161,105)' },
  { key: 'Exclusiv 9210', rgb: 'rgb(199,179,171)' },
  { key: 'Exclusiv 9294', rgb: 'rgb(219,210,197)' },
  { key: 'Exclusiv 9369', rgb: 'rgb(189,180,128)' },
  { key: 'Exclusiv 9213', rgb: 'rgb(217,203,194)' },
  { key: 'Exclusiv 9295', rgb: 'rgb(225,215,202)' },
  { key: 'Exclusiv 9373', rgb: 'rgb(209,203,164)' },
  { key: 'Exclusiv 9215', rgb: 'rgb(224,213,205)' },
  { key: 'Exclusiv 9296', rgb: 'rgb(227,220,210)' },
  { key: 'Exclusiv 9375', rgb: 'rgb(225,219,188)' },
  { key: 'Exclusiv 9217', rgb: 'rgb(229,224,216)' },
  { key: 'Exclusiv 9298', rgb: 'rgb(236,229,218)' },
  { key: 'Exclusiv 9382', rgb: 'rgb(107,109,97)' },
  { key: 'Exclusiv 9225', rgb: 'rgb(153,137,133)' },
  { key: 'Exclusiv 9304', rgb: 'rgb(154,140,120)' },
  { key: 'Exclusiv 9383', rgb: 'rgb(122,127,107)' },
  { key: 'Exclusiv 9229', rgb: 'rgb(190,176,175)' },
  { key: 'Exclusiv 9307', rgb: 'rgb(170,160,145)' },
  { key: 'Exclusiv 9385', rgb: 'rgb(148,152,127)' },
  { key: 'Exclusiv 9233', rgb: 'rgb(211,201,202)' },
  { key: 'Exclusiv 9310', rgb: 'rgb(193,184,166)' },
  { key: 'Exclusiv 9389', rgb: 'rgb(175,181,156)' },
  { key: 'Exclusiv 9243', rgb: 'rgb(157,126,92)' },
  { key: 'Exclusiv 9312', rgb: 'rgb(207,199,182)' },
  { key: 'Exclusiv 9392', rgb: 'rgb(201,203,184)' },
  { key: 'Exclusiv 9245', rgb: 'rgb(179,148,111)' },
  { key: 'Exclusiv 9314', rgb: 'rgb(219,211,197)' },
  { key: 'Exclusiv 9395', rgb: 'rgb(218,218,203)' },
  { key: 'Exclusiv 9248', rgb: 'rgb(193,162,127)' },
  { key: 'Exclusiv 9317', rgb: 'rgb(232,227,216)' },
  { key: 'Exclusiv 9396', rgb: 'rgb(227,225,212)' },
  { key: 'Exclusiv 9249', rgb: 'rgb(195,170,141)' },
  { key: 'Exclusiv 9323', rgb: 'rgb(133,121,92)' },
  { key: 'Exclusiv 9398', rgb: 'rgb(232,229,220)' },
  { key: 'Exclusiv 9251', rgb: 'rgb(211,191,161)' },
  { key: 'Exclusiv 9325', rgb: 'rgb(165,143,94)' },
  { key: 'Exclusiv 9402', rgb: 'rgb(98,119,99)' },
  { key: 'Exclusiv 9253', rgb: 'rgb(218,198,174)' },
  { key: 'Exclusiv 9328', rgb: 'rgb(195,164,96)' },
  { key: 'Exclusiv 9406', rgb: 'rgb(144,159,132)' },
  { key: 'Exclusiv 9255', rgb: 'rgb(226,213,194)' },
  { key: 'Exclusiv 9329', rgb: 'rgb(205,179,116)' },

  // --- Sheet 3 ---
  { key: 'Exclusiv 9574', rgb: 'rgb(218,211,209)' },
  { key: 'Exclusiv 9410', rgb: 'rgb(180,187,164)' },
  { key: 'Exclusiv 9494', rgb: 'rgb(213,210,207)' },
  { key: 'Exclusiv 9576', rgb: 'rgb(226,219,214)' },
  { key: 'Exclusiv 9412', rgb: 'rgb(197,202,182)' },
  { key: 'Exclusiv 9497', rgb: 'rgb(224,223,218)' },
  { key: 'Exclusiv 9582', rgb: 'rgb(117,118,118)' },
  { key: 'Exclusiv 9430', rgb: 'rgb(152,189,170)' },
  { key: 'Exclusiv 9505', rgb: 'rgb(142,143,138)' },
  { key: 'Exclusiv 9585', rgb: 'rgb(150,148,146)' },
  { key: 'Exclusiv 9432', rgb: 'rgb(182,206,193)' },
  { key: 'Exclusiv 9510', rgb: 'rgb(182,186,182)' },
  { key: 'Exclusiv 9590', rgb: 'rgb(186,183,178)' },
  { key: 'Exclusiv 9435', rgb: 'rgb(203,217,203)' },
  { key: 'Exclusiv 9514', rgb: 'rgb(208,208,204)' },
  { key: 'Exclusiv 9592', rgb: 'rgb(201,199,196)' },
  { key: 'Exclusiv 9436', rgb: 'rgb(218,225,214)' },
  { key: 'Exclusiv 9516', rgb: 'rgb(220,219,216)' },
  { key: 'Exclusiv 9595', rgb: 'rgb(218,219,216)' },
  { key: 'Exclusiv 9437', rgb: 'rgb(231,230,220)' },
  { key: 'Exclusiv 9523', rgb: 'rgb(134,131,122)' },
  { key: 'Exclusiv 9870', rgb: 'rgb(233,230,224)' },
  { key: 'Exclusiv 9448', rgb: 'rgb(138,177,180)' },
  { key: 'Exclusiv 9525', rgb: 'rgb(160,155,140)' },
  { key: 'Exclusiv 9451', rgb: 'rgb(170,194,194)' },
  { key: 'Exclusiv 9529', rgb: 'rgb(186,179,160)' },
  { key: 'Exclusiv 9526', rgb: 'rgb(163,155,137)' },
  { key: 'Exclusiv 9454', rgb: 'rgb(197,211,208)' },
  { key: 'Exclusiv 9531', rgb: 'rgb(198,192,175)' },
  { key: 'Exclusiv 9456', rgb: 'rgb(213,219,213)' },
  { key: 'Exclusiv 9533', rgb: 'rgb(214,205,190)' },
  { key: 'Exclusiv 9457', rgb: 'rgb(222,224,216)' },
  { key: 'Exclusiv 9536', rgb: 'rgb(226,220,205)' },
  { key: 'Exclusiv 9463', rgb: 'rgb(106,129,134)' },
  { key: 'Exclusiv 9541', rgb: 'rgb(97,92,84)' },
  { key: 'Exclusiv 9466', rgb: 'rgb(142,152,152)' },
  { key: 'Exclusiv 9543', rgb: 'rgb(129,124,117)' },
  { key: 'Exclusiv 9468', rgb: 'rgb(163,168,166)' },
  { key: 'Exclusiv 9546', rgb: 'rgb(158,150,139)' },
  { key: 'Exclusiv 9471', rgb: 'rgb(190,189,183)' },
  { key: 'Exclusiv 9550', rgb: 'rgb(189,183,175)' },
  { key: 'Exclusiv 9473', rgb: 'rgb(208,207,200)' },
  { key: 'Exclusiv 9552', rgb: 'rgb(205,198,189)' },
  { key: 'Exclusiv 9475', rgb: 'rgb(216,214,206)' },
  { key: 'Exclusiv 9554', rgb: 'rgb(212,206,195)' },
  { key: 'Exclusiv 9477', rgb: 'rgb(231,228,221)' },
  { key: 'Exclusiv 9555', rgb: 'rgb(216,210,198)' },
  { key: 'Exclusiv 9482', rgb: 'rgb(100,113,134)' },
  { key: 'Exclusiv 9556', rgb: 'rgb(226,220,209)' },
  { key: 'Exclusiv 9486', rgb: 'rgb(143,153,168)' },
  { key: 'Exclusiv 9564', rgb: 'rgb(145,134,128)' },
  { key: 'Exclusiv 9488', rgb: 'rgb(167,174,185)' },
  { key: 'Exclusiv 9567', rgb: 'rgb(169,160,154)' },
  { key: 'Exclusiv 9490', rgb: 'rgb(185,190,195)' },
  { key: 'Exclusiv 9569', rgb: 'rgb(187,179,175)' },
  { key: 'Exclusiv 9493', rgb: 'rgb(200,203,204)' },
  { key: 'Exclusiv 9572', rgb: 'rgb(202,195,191)' },
];

const ColorSelectionSlide: React.FC<ColorSelectionSlideProps> = ({
  value,
  chooseLater,
  onChange,
  onChooseLaterChange
}) => {
  const [showAll, setShowAll] = useState<boolean>(false);
  const handleSelect = (key: string) => {
    if (chooseLater) return; // ignore selection when choose later is active
    onChange(key === value ? '' : key);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '20px',
        backgroundColor: 'var(--foreground)',
        borderRadius: 8,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        flex: 1 // Make content stretch
      }}
    >
      <h2 style={{ margin: 0, color: 'var(--headlinecolor)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Farbe auswählen
        <img src="/keim-logo.svg" alt="Keim Logo" style={{ width: 'auto', height: '40px', marginLeft: 'auto' }} />
      </h2>
      <p style={{ margin: 0, color: 'var(--fontcolor)', fontSize: 14 }}>
        Wählen Sie eine Fassadenfarbe aus oder entscheiden Sie sich später.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
          gap: 16,
          opacity: chooseLater ? 0.5 : 1,
          pointerEvents: chooseLater ? ('none' as const) : 'auto',
        }}
      >
        {((() => {
          const sorted = [...COLORS].sort((a, b) => {
          const aLetters = (a.key.match(/[A-Za-zÄÖÜäöüß\s]+/)?.[0] || '').trim();
          const bLetters = (b.key.match(/[A-Za-zÄÖÜäöüß\s]+/)?.[0] || '').trim();
          const letterCmp = aLetters.localeCompare(bLetters, 'de', { sensitivity: 'base' });
          if (letterCmp !== 0) return letterCmp;
          const aNum = parseInt(a.key.match(/\d+/)?.[0] || '0', 10);
          const bNum = parseInt(b.key.match(/\d+/)?.[0] || '0', 10);
          return aNum - bNum;
          });
          return showAll ? sorted : sorted.slice(0, 12);
        })()).map(({ key, rgb }) => {
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleSelect(key)}
              title={key}
              aria-label={key}
              aria-pressed={selected}
              style={{
                border: selected ? '3px solid var(--base-col1)' : '1px solid var(--base-grey-light)',
                borderRadius: 10,
                padding: 0,
                cursor: 'pointer',
                background: 'transparent',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: 80,
                  borderRadius: 8,
                  backgroundColor: rgb,
                  // subtle inset border to keep light tones visible
                  boxShadow:
                    'inset 0 0 0 1px rgba(0,0,0,0.06)',
                }}
              />
            </button>
          );
        })}
      </div>

      {!showAll && COLORS.length > 12 && (
        <div>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            style={{
              marginTop: 8,
              padding: '10px 14px',
              borderRadius: 6,
              border: '1px solid var(--base-grey-light)',
              background: 'var(--background)',
              cursor: 'pointer',
              color: 'var(--fontcolor)',
              fontSize: 14
            }}
          >
            Alle Farben anzeigen
          </button>
        </div>
      )}

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: 'var(--fontcolor)',
          marginTop: 8,
        }}
      >
        <input
          type="checkbox"
          checked={chooseLater}
          onChange={(e) => onChooseLaterChange(e.target.checked)}
        />
        Farbe später auswählen
      </label>
    </div>
  );
};

export default ColorSelectionSlide;
