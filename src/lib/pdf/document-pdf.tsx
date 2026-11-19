import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PaperProps } from "@/components/documents/document-paper";
import { formatAmount, formatMAD, formatQuantity, formatRate } from "@/lib/money";
import { amountToFrenchWords } from "@/lib/number-to-words";
import { formatDate } from "@/lib/utils";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
let registered = false;
function registerFonts() {
  if (registered) return;
  Font.register({
    family: "Geist",
    fonts: [
      { src: path.join(FONT_DIR, "Geist-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "Geist-Medium.ttf"), fontWeight: 500 },
      { src: path.join(FONT_DIR, "Geist-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(FONT_DIR, "Geist-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({ family: "GeistMono", src: path.join(FONT_DIR, "GeistMono-Medium.ttf") });
  // Pas de césure automatique des mots
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

const INK = "#0e1124";
const SOFT = "#3b3f55";
const MUTED = "#646a82";
const FAINT = "#9a9fb3";
const LINE = "#e7e8ef";
const SUBTLE = "#f6f6fa";

const s = StyleSheet.create({
  page: { fontFamily: "Geist", fontSize: 9, color: INK, paddingTop: 0, paddingBottom: 56, paddingHorizontal: 0, lineHeight: 1.45 },
  band: { height: 5 },
  body: { paddingHorizontal: 40, paddingTop: 30 },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  companyName: { fontSize: 14, fontWeight: 600 },
  small: { fontSize: 8, color: MUTED },
  title: { fontSize: 22, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", textAlign: "right", lineHeight: 1.15 },
  number: { fontFamily: "GeistMono", fontSize: 10, color: SOFT, textAlign: "right", marginTop: 4, lineHeight: 1.2 },
  metaLabel: { color: MUTED, width: 82, textAlign: "right", marginRight: 8 },
  metaValue: { fontWeight: 500, width: 70, textAlign: "right" },
  label: { fontSize: 7, fontWeight: 600, color: FAINT, letterSpacing: 1, textTransform: "uppercase" },
  clientBox: { backgroundColor: SUBTLE, borderRadius: 4, padding: 12, width: 250 },
  th: { color: "#fff", fontSize: 7.5, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", paddingVertical: 6, paddingHorizontal: 5 },
  td: { paddingVertical: 7, paddingHorizontal: 5 },
  totalsBox: { width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  grandTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 4, paddingVertical: 8, paddingHorizontal: 10, marginTop: 4 },
  footer: { position: "absolute", bottom: 18, left: 40, right: 40, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 },
  footerText: { fontSize: 7, color: MUTED, textAlign: "center", lineHeight: 1.4 },
});

// Colonnes : Désignation | Qté | P.U. HT | Remise | TVA | Total HT
const COLS = { desc: "40%", qty: "12%", pu: "14%", disc: "10%", tax: "8%", total: "16%" };

export function DocumentPdf(p: PaperProps) {
  registerFonts();
  const isQuote = p.kind === "quote";
  const accent = p.company.accentColor || "#3A3182";
  const hasDiscount = p.items.some((i) => i.discount > 0);
  const cols = hasDiscount ? COLS : { ...COLS, desc: "50%", disc: "0%" };
  const legal = [
    p.company.ice && `ICE : ${p.company.ice}`,
    p.company.taxId && `IF : ${p.company.taxId}`,
    p.company.rc && `RC : ${p.company.rc}${p.company.rcCity ? ` (${p.company.rcCity})` : ""}`,
    p.company.patente && `Patente : ${p.company.patente}`,
    p.company.cnss && `CNSS : ${p.company.cnss}`,
  ].filter(Boolean).join("  ·  ");
  const balance = p.amountPaid !== undefined ? p.totals.total - p.amountPaid : 0;
  const docTitle = `${isQuote ? "Devis" : "Facture"} ${p.number ?? "brouillon"}`;

  return (
    <Document title={docTitle} author={p.company.name} creator="Mactura" producer="Mactura" language="fr-MA">
      <Page size="A4" style={s.page}>
        <View style={[s.band, { backgroundColor: accent }]} fixed />
        {p.watermark && (
          <View style={{ position: "absolute", top: 330, left: 0, right: 0, alignItems: "center" }} fixed>
            <Text style={{ fontSize: 80, fontWeight: 700, color: "#000", opacity: 0.04, transform: "rotate(-24deg)", letterSpacing: 10, textTransform: "uppercase" }}>{p.watermark}</Text>
          </View>
        )}
        <View style={s.body}>
          {/* En-tête */}
          <View style={s.between}>
            <View style={{ maxWidth: 270 }}>
              <Text style={[s.companyName, { color: accent }]}>
                {p.company.name}
                {p.company.legalForm ? <Text style={{ fontWeight: 400, color: MUTED }}> {p.company.legalForm}</Text> : null}
              </Text>
              <View style={{ marginTop: 5 }}>
                {p.company.address ? <Text style={s.small}>{p.company.address}</Text> : null}
                {p.company.postalCode || p.company.city ? <Text style={s.small}>{[p.company.postalCode, p.company.city].filter(Boolean).join(" ")}</Text> : null}
                {p.company.phone || p.company.email ? <Text style={s.small}>{[p.company.phone, p.company.email].filter(Boolean).join("  ·  ")}</Text> : null}
                {p.company.website ? <Text style={s.small}>{p.company.website}</Text> : null}
              </View>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.title}>{isQuote ? "Devis" : "Facture"}</Text>
              <Text style={s.number}>{p.number ?? "BROUILLON — NON NUMÉROTÉE"}</Text>
              <View style={{ marginTop: 10 }}>
                <View style={[s.row, { justifyContent: "flex-end" }]}><Text style={s.metaLabel}>Date d&apos;émission</Text><Text style={s.metaValue}>{formatDate(p.issueDate, "numeric")}</Text></View>
                <View style={[s.row, { justifyContent: "flex-end" }]}><Text style={s.metaLabel}>{isQuote ? "Valable jusqu'au" : "Échéance"}</Text><Text style={s.metaValue}>{formatDate(p.secondDate, "numeric")}</Text></View>
                {p.reference ? <View style={[s.row, { justifyContent: "flex-end" }]}><Text style={s.metaLabel}>Référence</Text><Text style={s.metaValue}>{p.reference}</Text></View> : null}
              </View>
            </View>
          </View>

          {/* Client */}
          <View style={[s.row, { justifyContent: "flex-end", marginTop: 26 }]}>
            <View style={s.clientBox}>
              <Text style={s.label}>{isQuote ? "Devis adressé à" : "Facturé à"}</Text>
              {p.customer ? (
                <>
                  <Text style={{ fontSize: 11, fontWeight: 600, marginTop: 3 }}>{p.customer.name}</Text>
                  {p.customer.contactName ? <Text style={s.small}>À l&apos;attention de {p.customer.contactName}</Text> : null}
                  {p.customer.address ? <Text style={s.small}>{p.customer.address}</Text> : null}
                  {p.customer.postalCode || p.customer.city ? <Text style={s.small}>{[p.customer.postalCode, p.customer.city].filter(Boolean).join(" ")}</Text> : null}
                  {p.customer.ice ? <Text style={[s.small, { color: SOFT, fontWeight: 500, marginTop: 3 }]}>ICE : {p.customer.ice}</Text> : null}
                  {p.customer.taxId || p.customer.rc ? <Text style={s.small}>{[p.customer.taxId && `IF : ${p.customer.taxId}`, p.customer.rc && `RC : ${p.customer.rc}`].filter(Boolean).join("  ·  ")}</Text> : null}
                </>
              ) : null}
            </View>
          </View>

          {/* Lignes */}
          <View style={{ marginTop: 24 }}>
            <View style={[s.row, { backgroundColor: accent, borderRadius: 3 }]} fixed>
              <Text style={[s.th, { width: cols.desc }]}>Désignation</Text>
              <Text style={[s.th, { width: cols.qty, textAlign: "right" }]}>Qté</Text>
              <Text style={[s.th, { width: cols.pu, textAlign: "right" }]}>P.U. HT</Text>
              {hasDiscount ? <Text style={[s.th, { width: cols.disc, textAlign: "right" }]}>Remise</Text> : null}
              <Text style={[s.th, { width: cols.tax, textAlign: "right" }]}>TVA</Text>
              <Text style={[s.th, { width: cols.total, textAlign: "right" }]}>Total HT</Text>
            </View>
            {p.items.map((it, i) => (
              <View key={i} style={[s.row, { borderBottomWidth: 1, borderBottomColor: LINE }]} wrap={false}>
                <View style={[s.td, { width: cols.desc }]}>
                  <Text style={{ fontWeight: 500 }}>{it.description}</Text>
                  {it.details ? <Text style={{ fontSize: 8, color: MUTED, marginTop: 1.5 }}>{it.details}</Text> : null}
                </View>
                <Text style={[s.td, { width: cols.qty, textAlign: "right" }]}>{formatQuantity(it.quantity)} <Text style={{ color: FAINT }}>{it.unit}</Text></Text>
                <Text style={[s.td, { width: cols.pu, textAlign: "right" }]}>{formatAmount(it.unitPrice)}</Text>
                {hasDiscount ? <Text style={[s.td, { width: cols.disc, textAlign: "right", color: MUTED }]}>{it.discount > 0 ? (it.discountType === "AMOUNT" ? `-${formatAmount(it.discount)}` : `${formatRate(it.discount)} %`) : "—"}</Text> : null}
                <Text style={[s.td, { width: cols.tax, textAlign: "right", color: MUTED }]}>{formatRate(it.taxRate)} %</Text>
                <Text style={[s.td, { width: cols.total, textAlign: "right", fontWeight: 500 }]}>{formatAmount(p.totals.lines[i]?.net ?? 0)}</Text>
              </View>
            ))}
          </View>

          {/* Totaux */}
          <View style={[s.between, { marginTop: 18 }]} wrap={false}>
            <View style={{ width: 240, paddingTop: 4 }}>
              <Text style={s.label}>{isQuote ? "Arrêté le présent devis à la somme de" : "Arrêtée la présente facture à la somme de"}</Text>
              <Text style={{ marginTop: 3, fontWeight: 500, fontStyle: "normal" }}>{amountToFrenchWords(p.totals.total)} TTC</Text>
            </View>
            <View style={s.totalsBox}>
              <View style={s.totalRow}><Text style={{ color: MUTED }}>Total HT brut</Text><Text>{formatMAD(p.totals.subtotal)}</Text></View>
              {p.totals.lineDiscountTotal > 0 ? <View style={s.totalRow}><Text style={{ color: MUTED }}>Remises sur lignes</Text><Text>-{formatMAD(p.totals.lineDiscountTotal)}</Text></View> : null}
              {p.totals.globalDiscountTotal > 0 ? (
                <View style={s.totalRow}>
                  <Text style={{ color: MUTED }}>Remise globale{p.globalDiscount.type === "PERCENT" ? ` (${formatRate(p.globalDiscount.value)} %)` : ""}</Text>
                  <Text>-{formatMAD(p.totals.globalDiscountTotal)}</Text>
                </View>
              ) : null}
              <View style={[s.totalRow, { borderTopWidth: 1, borderTopColor: LINE, marginTop: 2, paddingTop: 4 }]}><Text style={{ fontWeight: 600 }}>Total HT net</Text><Text style={{ fontWeight: 600 }}>{formatMAD(p.totals.taxableTotal)}</Text></View>
              {p.totals.taxes.map((t) => (
                <View key={t.rate} style={s.totalRow}><Text style={{ color: MUTED }}>TVA {formatRate(t.rate)} % sur {formatAmount(t.base)}</Text><Text>{formatMAD(t.amount)}</Text></View>
              ))}
              <View style={[s.grandTotal, { backgroundColor: accent }]}>
                <Text style={{ color: "#fff", fontSize: 8.5, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>Total TTC</Text>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>{formatMAD(p.totals.total)}</Text>
              </View>
              {!isQuote && (p.amountPaid ?? 0) > 0 ? (
                <>
                  <View style={[s.totalRow, { marginTop: 4 }]}><Text style={{ color: MUTED }}>Déjà réglé</Text><Text>-{formatMAD(p.amountPaid!)}</Text></View>
                  <View style={s.totalRow}><Text style={{ fontWeight: 600 }}>Reste à payer</Text><Text style={{ fontWeight: 600 }}>{formatMAD(balance)}</Text></View>
                </>
              ) : null}
            </View>
          </View>

          {/* Notes, conditions, banque */}
          <View style={[s.row, { marginTop: 24, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 12 }]} wrap={false}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              {p.notes ? (<View style={{ marginBottom: 8 }}><Text style={s.label}>Note</Text><Text style={{ marginTop: 2, color: SOFT }}>{p.notes}</Text></View>) : null}
              {p.terms ? (<View><Text style={s.label}>Conditions</Text><Text style={{ marginTop: 2, color: SOFT }}>{p.terms}</Text></View>) : null}
            </View>
            <View style={{ flex: 1 }}>
              {!isQuote && p.paymentTerms ? (<View style={{ marginBottom: 8 }}><Text style={s.label}>Conditions de paiement</Text><Text style={{ marginTop: 2, color: SOFT }}>{p.paymentTerms}</Text></View>) : null}
              {!isQuote && (p.company.bankName || p.company.rib) ? (
                <View>
                  <Text style={s.label}>Coordonnées bancaires</Text>
                  {p.company.bankName ? <Text style={{ marginTop: 2, color: SOFT }}>{p.company.bankName}</Text> : null}
                  {p.company.rib ? <Text style={{ fontFamily: "GeistMono", fontSize: 8, color: SOFT }}>RIB : {p.company.rib}</Text> : null}
                </View>
              ) : null}
              {isQuote ? (
                <View style={{ borderWidth: 1, borderColor: "#d7d9e2", borderStyle: "dashed", borderRadius: 4, padding: 10, height: 70 }}>
                  <Text style={s.label}>Bon pour accord</Text>
                  <Text style={{ fontSize: 7.5, color: FAINT, marginTop: 30 }}>Date, cachet et signature du client</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{p.company.name}{p.company.legalForm ? ` ${p.company.legalForm}` : ""}{p.company.capital ? ` au capital de ${p.company.capital}` : ""}{p.company.address ? ` — ${p.company.address}${p.company.city ? `, ${p.company.city}` : ""}` : ""}</Text>
          {legal ? <Text style={s.footerText}>{legal}</Text> : null}
          <Text style={[s.footerText, { color: FAINT }]}>{docTitle} — édité avec Mactura</Text>
        </View>
      </Page>
    </Document>
  );
}
