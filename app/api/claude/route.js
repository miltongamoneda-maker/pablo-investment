export async function POST(req) {
  try {
    const body = await req.json();
    
    // Try the requested model, then fallback to alternatives
    const models = [body.model, "claude-sonnet-4-20250514", "claude-3-7-sonnet-20250219", "claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"];
    
    for (const model of models) {
      if (!model) continue;
      const payload = { ...body, model };
      
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
      });
      
      const data = await r.json();
      
      // If model not found, try next
      if (data?.error?.type === "not_found_error") continue;
      
      return Response.json(data);
    }
    
    return Response.json({ error: "No valid model found" }, { status: 500 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
