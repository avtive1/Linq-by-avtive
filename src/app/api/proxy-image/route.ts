import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  try {
    // We add the ngrok-skip-browser-warning header here on the server
    const response = await fetch(url, {
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
      // Pass cache behavior dynamically if needed, 
      // but typically we can let Next cache it a bit
    });

    if (!response.ok) {
      return new NextResponse(`Failed to fetch image: ${response.statusText}`, { status: response.status });
    }

    const contentType = response.headers.get("content-type");
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType || "image/jpeg",
        // Cache heavily as these files are usually immutable in PocketBase (filename contains hash)
        "Cache-Control": "public, max-age=31536000, immutable", 
      },
    });
  } catch (error) {
    console.error("Error proxying image:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
