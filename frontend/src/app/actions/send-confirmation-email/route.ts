import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { AufmassAnfrage } from '@/app/types/AufmassAnfrage';

const resend = new Resend(process.env.NEXT_RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lod2Id, accessToken, whitelabelSlug } = body;

    if (!lod2Id || !accessToken) {
      return NextResponse.json(
        { error: 'Missing required fields: lod2Id and accessToken' },
        { status: 400 }
      );
    }

    // Create Supabase client with the user's access token (RLS-aware)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, detectSessionInUrl: false }
    });

    // Fetch all aufmass data using the AufmassAnfrage interface
    const { data: aufmassData, error: fetchError } = await supabase
      .from('aufmass_anfragen')
      .select('*')
      .eq('ID_LOD2', lod2Id)
      .single();

    if (fetchError || !aufmassData) {
      console.error('Error fetching data:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch customer data' },
        { status: 500 }
      );
    }

    // Fetch whitelabel data to get partner email
    let partnerEmail = 'info@wattwert.de'; // Default fallback
    if (whitelabelSlug) {
      const { data: whitelabelData } = await supabase
        .from('partner-aufmass-whitelabel')
        .select('email')
        .eq('slug', whitelabelSlug)
        .single();
      
      if (whitelabelData?.email) {
        partnerEmail = whitelabelData.email;
      }
    }

    const {
      name,
      email,
      phone,
      facade_paint,
      facade_plaster,
      windows,
      ki_aufmass,
      vor_ort_aufmass,
      color_name,
      cost_estimate_lower,
      cost_estimate_upper,
      address,
      wall_area_tot,
      facade_area_tot,
      window_area_tot,
    } = aufmassData as AufmassAnfrage;

    // Build measures text
    const measures: string[] = [];
    if (windows) measures.push('Fenstertausch');
    if (facade_paint) measures.push('Fassadenanstrich');
    if (facade_plaster) measures.push('Fassadenverputzung');
    const measuresText = measures.join(' und ');

    // Build subject line
    let subjectMeasures = '';
    if (facade_paint && facade_plaster) {
      subjectMeasures = 'Fassadenanstrich und Fassadenverputzung';
    } else if (facade_paint) {
      subjectMeasures = 'Fassadenanstrich';
    } else if (facade_plaster) {
      subjectMeasures = 'Fassadenverputzung';
    }

    // Build customer email body (plain text) exactly like the legacy version
    let customerBody = '';
    if (ki_aufmass) {
      customerBody = `Sehr geehrte(r) ${name},

vielen Dank für Ihre Anfrage für eine Angebotserstellung für ${measuresText}. WattWert führt nun das Aufmaß und Angebotserstellung für Ihr Gebäude durch. In Kürze erhalten Sie Ihr Angebot per Mail.


Viele Grüße

Ihr WattWert Team und Meisterbetrieb`;
    } else if (vor_ort_aufmass) {
      customerBody = `Sehr geehrte(r) ${name},

vielen Dank für Ihre Anfrage für eine Angebotserstellung für ${measuresText}. Unser Meisterbetrieb meldet sich bald bei Ihnen, um einen Termin für ein Vor-Ort-Angebot zu vereinbaren.

Viele Grüße

Ihr Meisterbetrieb`;
    }

    // Send email to customer (plain text)
    const customerEmailResult = await resend.emails.send({
      from: 'info@wattwert.de',
      to: email,
      subject: `Ihr Angebot zum ${subjectMeasures}`,
      text: customerBody,
    });

    if ((customerEmailResult as any)?.error) {
      console.error('Error sending customer email:', (customerEmailResult as any).error);
    }

    // Fetch building images if KI-Aufmaß is selected
    let imageAttachments: any[] = [];
    if (ki_aufmass) {
      try {
        const { data: imageData, error: imageError } = await supabase
          .from('building_images')
          .select('description, storage_path')
          .eq('ID_LOD2', lod2Id);

        if (!imageError && imageData && imageData.length > 0) {
          console.log(`Found ${imageData.length} images for LOD2 ID: ${lod2Id}`);
          
          // Fetch images from storage and convert to base64 for email attachments
          for (const image of imageData) {
            if (image.storage_path) {
              try {
                // Download the image from Supabase storage
                const { data: fileData, error: downloadError } = await supabase.storage
                  .from('buildingimages1')
                  .download(image.storage_path);

                if (!downloadError && fileData) {
                  // Convert blob to base64
                  const arrayBuffer = await fileData.arrayBuffer();
                  const base64 = Buffer.from(arrayBuffer).toString('base64');
                  
                  // Determine content type from file extension
                  const extension = image.storage_path.split('.').pop()?.toLowerCase();
                  let contentType = 'image/jpeg';
                  if (extension === 'png') contentType = 'image/png';
                  else if (extension === 'jpg' || extension === 'jpeg') contentType = 'image/jpeg';
                  else if (extension === 'webp') contentType = 'image/webp';

                  imageAttachments.push({
                    filename: `fassade_${image.description || 'bild'}.${extension}`,
                    content: base64,
                    contentType: contentType,
                  });
                  console.log(`Added image attachment: ${image.storage_path}`);
                }
              } catch (error) {
                console.error(`Error processing image ${image.storage_path}:`, error);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching building images:', error);
      }
    }

    // Build internal notification email (HTML)
    const internalBodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px 0; text-align: center; background-color: #f4f4f4;">
        <table role="presentation" style="width: 600px; max-width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                Neue Aufmaß-Anfrage
              </h1>
            </td>
          </tr>

          <!-- Customer Information -->
          <tr>
            <td style="padding: 30px 40px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
                Kundeninformationen
              </h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-weight: 600; width: 140px;">Name:</td>
                  <td style="padding: 8px 0; color: #333333;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-weight: 600;">E-Mail:</td>
                  <td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #667eea; text-decoration: none;">${email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-weight: 600;">Telefon:</td>
                  <td style="padding: 8px 0;"><a href="tel:${phone}" style="color: #667eea; text-decoration: none;">${phone}</a></td>
                </tr>
                ${address ? `
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-weight: 600;">Adresse:</td>
                  <td style="padding: 8px 0; color: #333333;">${address}</td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>

          <!-- Measures -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
                Gewählte Maßnahmen
              </h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-weight: 600; width: 200px;">Fenstertausch:</td>
                  <td style="padding: 8px 0;">
                    <span style="display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: 600; ${windows ? 'background-color: #d4edda; color: #155724;' : 'background-color: #f8d7da; color: #721c24;'}">
                      ${windows ? '✓ Ja' : '✗ Nein'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-weight: 600;">Fassadenanstrich:</td>
                  <td style="padding: 8px 0;">
                    <span style="display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: 600; ${facade_paint ? 'background-color: #d4edda; color: #155724;' : 'background-color: #f8d7da; color: #721c24;'}">
                      ${facade_paint ? '✓ Ja' : '✗ Nein'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-weight: 600;">Fassadenverputzung:</td>
                  <td style="padding: 8px 0;">
                    <span style="display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: 600; ${facade_plaster ? 'background-color: #d4edda; color: #155724;' : 'background-color: #f8d7da; color: #721c24;'}">
                      ${facade_plaster ? '✓ Ja' : '✗ Nein'}
                    </span>
                  </td>
                </tr>
                ${color_name ? `
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-weight: 600;">Ausgewählte Farbe:</td>
                  <td style="padding: 8px 0; color: #333333; font-weight: 600;">${color_name}</td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>

          <!-- Aufmass Type -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
                Aufmaß-Typ
              </h2>
              <div style="display: flex; gap: 10px;">
                <div style="flex: 1; padding: 15px; background-color: ${ki_aufmass ? '#d4edda' : '#f8f9fa'}; border-radius: 6px; border: 2px solid ${ki_aufmass ? '#28a745' : '#dee2e6'};">
                  <div style="font-weight: 600; color: ${ki_aufmass ? '#155724' : '#666666'}; margin-bottom: 5px;">KI-Aufmaß</div>
                  <div style="font-size: 24px; font-weight: 700; color: ${ki_aufmass ? '#28a745' : '#999999'};">${ki_aufmass ? '✓' : '✗'}</div>
                </div>
                <div style="flex: 1; padding: 15px; background-color: ${vor_ort_aufmass ? '#d4edda' : '#f8f9fa'}; border-radius: 6px; border: 2px solid ${vor_ort_aufmass ? '#28a745' : '#dee2e6'};">
                  <div style="font-weight: 600; color: ${vor_ort_aufmass ? '#155724' : '#666666'}; margin-bottom: 5px;">Vor-Ort-Aufmaß</div>
                  <div style="font-size: 24px; font-weight: 700; color: ${vor_ort_aufmass ? '#28a745' : '#999999'};">${vor_ort_aufmass ? '✓' : '✗'}</div>
                </div>
              </div>
            </td>
          </tr>

          ${cost_estimate_lower && cost_estimate_upper ? `
          <!-- Cost Estimate -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
                Initiale Kostenschätzung
              </h2>
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; text-align: center;">
                <div style="color: #ffffff; font-size: 28px; font-weight: 700;">
                  ${cost_estimate_lower.toFixed(0)}€ - ${cost_estimate_upper.toFixed(0)}€
                </div>
                <div style="color: rgba(255,255,255,0.9); font-size: 14px; margin-top: 5px;">
                  Geschätzte Projektkosten
                </div>
              </div>
            </td>
          </tr>
          ` : ''}

          ${wall_area_tot || facade_area_tot || window_area_tot ? `
          <!-- Calculated Areas -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 20px; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
                Berechnete Flächen
              </h2>
              <table style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 6px; overflow: hidden;">
                ${wall_area_tot ? `
                <tr>
                  <td style="padding: 12px 15px; color: #666666; font-weight: 600; border-bottom: 1px solid #dee2e6;">Gesamte Wandfläche:</td>
                  <td style="padding: 12px 15px; color: #333333; font-weight: 700; text-align: right; border-bottom: 1px solid #dee2e6;">${wall_area_tot.toFixed(2)} m²</td>
                </tr>
                ` : ''}
                ${facade_area_tot ? `
                <tr>
                  <td style="padding: 12px 15px; color: #666666; font-weight: 600; border-bottom: 1px solid #dee2e6;">Gesamte Fassadenfläche:</td>
                  <td style="padding: 12px 15px; color: #333333; font-weight: 700; text-align: right; border-bottom: 1px solid #dee2e6;">${facade_area_tot.toFixed(2)} m²</td>
                </tr>
                ` : ''}
                ${window_area_tot ? `
                <tr>
                  <td style="padding: 12px 15px; color: #666666; font-weight: 600;">Gesamte Fensterfläche:</td>
                  <td style="padding: 12px 15px; color: #333333; font-weight: 700; text-align: right;">${window_area_tot.toFixed(2)} m²</td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
          ` : ''}

          ${imageAttachments.length > 0 ? `
          <!-- Images Info -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; border-left: 4px solid #ffc107;">
                <div style="font-weight: 600; color: #856404; margin-bottom: 5px;">Angehängte Fassadenbilder</div>
                <div style="color: #856404; font-size: 14px;">${imageAttachments.length} Bild${imageAttachments.length > 1 ? 'er' : ''} im Anhang</div>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f9fa; text-align: center; border-top: 1px solid #dee2e6;">
              <div style="color: #666666; font-size: 12px; margin-bottom: 5px;">LOD2 ID: <span style="font-family: monospace; background-color: #e9ecef; padding: 2px 6px; border-radius: 3px;">${lod2Id}</span></div>
              <div style="color: #999999; font-size: 11px; margin-top: 10px;">
                Diese E-Mail wurde automatisch von WattWert generiert
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Plain text fallback
    const internalBodyText = `
═══════════════════════════════════════════════════════════
  NEUE AUFMASS-ANFRAGE
═══════════════════════════════════════════════════════════

KUNDENINFORMATIONEN
───────────────────────────────────────────────────────────
Name:     ${name}
E-Mail:   ${email}
Telefon:  ${phone}
${address ? `Adresse:  ${address}` : ''}

GEWÄHLTE MASSNAHMEN
───────────────────────────────────────────────────────────
Fenstertausch:          ${windows ? '✓ Ja' : '✗ Nein'}
Fassadenanstrich:       ${facade_paint ? '✓ Ja' : '✗ Nein'}
Fassadenverputzung:     ${facade_plaster ? '✓ Ja' : '✗ Nein'}
${color_name ? `Ausgewählte Farbe:      ${color_name}` : ''}

AUFMASS-TYP
───────────────────────────────────────────────────────────
KI-Aufmaß:              ${ki_aufmass ? '✓ Ja' : '✗ Nein'}
Vor-Ort-Aufmaß:         ${vor_ort_aufmass ? '✓ Ja' : '✗ Nein'}

${cost_estimate_lower && cost_estimate_upper ? `KOSTENSCHÄTZUNG
───────────────────────────────────────────────────────────
Geschätzte Kosten:      ${cost_estimate_lower.toFixed(0)}€ - ${cost_estimate_upper.toFixed(0)}€

` : ''}${wall_area_tot || facade_area_tot || window_area_tot ? `📐 BERECHNETE FLÄCHEN
───────────────────────────────────────────────────────────
${wall_area_tot ? `Gesamte Wandfläche:     ${wall_area_tot.toFixed(2)} m²\n` : ''}${facade_area_tot ? `Gesamte Fassadenfläche: ${facade_area_tot.toFixed(2)} m²\n` : ''}${window_area_tot ? `Gesamte Fensterfläche:  ${window_area_tot.toFixed(2)} m²\n` : ''}
` : ''}${imageAttachments.length > 0 ? `ANGEHÄNGTE BILDER
───────────────────────────────────────────────────────────
Anzahl Fassadenbilder:  ${imageAttachments.length}

` : ''}═══════════════════════════════════════════════════════════
LOD2 ID: ${lod2Id}
═══════════════════════════════════════════════════════════
`;

    // Prepare email payload with optional attachments
    const emailPayload: any = {
      from: 'info@wattwert.de',
      to: partnerEmail ? [partnerEmail, 'info@wattwert.de'] : 'info@wattwert.de',
      subject: `Neue Aufmaß-Anfrage von ${name}`,
      html: internalBodyHtml,
      text: internalBodyText,
    };

    // Add attachments if available
    if (imageAttachments.length > 0) {
      emailPayload.attachments = imageAttachments;
    }

    // Send internal notification email (plain text with attachments)
    const internalEmailResult = await resend.emails.send(emailPayload);

    if ((internalEmailResult as any)?.error) {
      console.error('Error sending internal email:', (internalEmailResult as any).error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in send-confirmation-email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

