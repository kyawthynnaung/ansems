const fs = require("fs");
const path = require("path");
const { json, supabaseFetch } = require("./_supabase");

const normalizeHandle = (value = "") => {
  const cleaned = String(value).replace(/\s+/g, "").trim();
  if (!cleaned) return "";
  return cleaned.startsWith("@") ? cleaned : `@${cleaned}`;
};

const isHandle = (value = "") => /^@?[A-Za-z0-9_]{1,15}$/.test(String(value).trim());
const isSolanaAddress = (value = "") => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(value).trim());
const maskWallet = (value = "") => `${value.slice(0, 4)}...${value.slice(-4)}`;
let finalWalletCache;

const readWalletList = (filename) => {
  const filePath = path.join(process.cwd(), "data", filename);
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
};

const getFinalWallets = () => {
  if (finalWalletCache) return finalWalletCache;

  finalWalletCache = new Set(readWalletList("ansem-top-holder-accounts.txt"));
  return finalWalletCache;
};

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "Method not allowed." });
  }

  const query = String(request.body?.query || "").trim();
  if (!query || query.length > 64) {
    return json(response, 400, { error: "Enter your X username or wallet address." });
  }

  const walletLookup = isSolanaAddress(query);
  const handleLookup = isHandle(query);

  if (!walletLookup && !handleLookup) {
    return json(response, 400, { error: "Enter a valid X username or Solana wallet." });
  }

  try {
    const finalWallets = getFinalWallets();

    if (walletLookup && finalWallets.has(query)) {
      return json(response, 200, {
        found: true,
        source: "final-wl",
        wallet: maskWallet(query),
      });
    }

    const filter = walletLookup
      ? `wallet_address=eq.${encodeURIComponent(query)}`
      : `x_username=ilike.${encodeURIComponent(normalizeHandle(query))}`;
    const winnerResponse = await supabaseFetch(
      `wl_winners?select=x_username,wallet_address,selected_at&${filter}&limit=1`
    );

    if (!winnerResponse.ok) {
      return json(response, 500, { error: "WL status could not be checked." });
    }

    const [winner] = await winnerResponse.json();
    if (!winner) {
      return json(response, 200, {
        found: false,
        source: "none",
      });
    }

    return json(response, 200, {
      found: true,
      source: "final-wl",
      xUsername: winner.x_username,
      wallet: maskWallet(winner.wallet_address),
      selectedAt: winner.selected_at,
    });
  } catch (error) {
    return json(response, 500, { error: "WL status could not be checked." });
  }
};
