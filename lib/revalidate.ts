export async function revalidateWebsite(): Promise<void> {
  const url = process.env.WEBSITE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!url || !secret) return;
  try {
    await fetch(`${url}/api/revalidate?secret=${encodeURIComponent(secret)}`, {
      method: "POST",
    });
  } catch {
    // Revalidatie mislukt stilt — website-cache vervalt vanzelf na 300s
  }
}
