import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAuth } from "@/lib/auth";
import { loadDocumentView } from "@/lib/document-view";
import { DocumentPdf } from "@/lib/pdf/document-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = { invoice: "invoice", quote: "quote", facture: "invoice", devis: "quote" } as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { kind: rawKind, id } = await params;
  const kind = KINDS[rawKind as keyof typeof KINDS];
  if (!kind) return NextResponse.json({ error: "Type de document inconnu" }, { status: 404 });

  // Le chargement est restreint à l'entreprise de la session (isolation des données)
  const view = await loadDocumentView(kind, auth.company.id, id);
  if (!view) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  try {
    const buffer = await renderToBuffer(<DocumentPdf {...view.paper} />);
    const label = kind === "quote" ? "Devis" : "Facture";
    const filename = `${label}-${view.paper.number ?? "brouillon"}.pdf`.replace(/[^\w.\-]/g, "_");
    const download = req.nextUrl.searchParams.get("download") === "1";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[pdf]", err);
    return NextResponse.json({ error: "La génération du PDF a échoué." }, { status: 500 });
  }
}
