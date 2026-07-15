const json = (response, status, body) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
};

const normalizeHandle = (value = "") => {
  const cleaned = String(value).replace(/\s+/g, "").trim();
  if (!cleaned) return "";
  return cleaned.startsWith("@") ? cleaned : `@${cleaned}`;
};

const isSolanaAddress = (value = "") => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(value).trim());
const isXLink = (value = "") => /^https?:\/\/(x\.com|twitter\.com)\/[A-Za-z0-9_]+\/status\/\d+/i.test(String(value).trim());

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "Method not allowed." });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return json(response, 500, { error: "Database is not configured yet." });
  }

  const body = request.body || {};
  const xUsername = normalizeHandle(body.xUsername);
  const walletAddress = String(body.walletAddress || "").trim();
  const commentLink = String(body.commentLink || "").trim();
  const tasks = body.tasks || {};

  if (!/^@[A-Za-z0-9_]{1,15}$/.test(xUsername)) {
    return json(response, 400, { error: "Enter a valid X username." });
  }

  if (commentLink.length > 240 || walletAddress.length > 64) {
    return json(response, 400, { error: "Submitted values are too long." });
  }

  if (!isSolanaAddress(walletAddress)) {
    return json(response, 400, { error: "Enter a valid Solana wallet address." });
  }

  if (!isXLink(commentLink)) {
    return json(response, 400, { error: "Paste a valid X comment link." });
  }

  if (!tasks.liked || !tasks.commented || !tasks.reposted || !tasks.confirmed) {
    return json(response, 400, { error: "Complete every WL requirement before submitting." });
  }

  const payload = {
    x_username: xUsername,
    wallet_address: walletAddress,
    comment_link: commentLink,
    liked_post: true,
    commented_post: true,
    reposted_post: true,
    confirmed: true,
    user_agent: request.headers["user-agent"] || null,
  };

  const insertResponse = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/wl_entries`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (!insertResponse.ok) {
    const message = await insertResponse.text();
    if (insertResponse.status === 409 || message.includes("duplicate key")) {
      return json(response, 409, {
        error: "This X username or wallet has already submitted a WL entry.",
      });
    }

    return json(response, 500, {
      error: "WL entry could not be saved.",
    });
  }

  return json(response, 200, { ok: true });
};
