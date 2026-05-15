import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const kenteken = (formData.get("kenteken") as string)?.replace(/-/g, "").toUpperCase();
    const files = formData.getAll("photos") as File[];

    if (!kenteken) {
      return Response.json({ error: "kenteken is verplicht" }, { status: 400 });
    }
    if (files.length === 0) {
      return Response.json({ error: "Geen foto's ontvangen" }, { status: 400 });
    }

    const folderName = kenteken;
    const dir = path.join(process.cwd(), "public", "uploads", folderName);
    await mkdir(dir, { recursive: true });

    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const filename = `${String(i + 1).padStart(2, "0")}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(dir, filename), buffer);
      urls.push(`/uploads/${folderName}/${filename}`);
    }

    return Response.json({ ok: true, urls });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
