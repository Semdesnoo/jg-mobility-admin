import { NextRequest } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

// Foto's worden vanuit de browser RECHTSTREEKS naar Vercel Blob geüpload (client upload),
// zodat we niet tegen de 4,5MB body-limiet van serverless functions aanlopen bij veel/grote
// foto's. Deze route geeft alleen een kortlevend upload-token uit. De uiteindelijke publieke
// blob-URL (https://<store>.public.blob.vercel-storage.com/...) wordt door beide deployments
// (admin + website) bereikt — dát is de gedeelde foto-opslag die de koppeling sluit.
export async function POST(request: NextRequest): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
        addRandomSuffix: true,
        maximumSizeInBytes: 20 * 1024 * 1024, // 20MB per foto
      }),
      // onUploadCompleted vuurt alleen op een publiek bereikbare URL (niet op localhost).
      // We hebben de blob-URL al client-side uit upload(); hier hoeft niets te gebeuren.
      onUploadCompleted: async () => {},
    });

    return Response.json(jsonResponse);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
