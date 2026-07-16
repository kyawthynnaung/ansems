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
let holderRankCache;
let manualWalletCache;

const readWalletList = (filename) => {
  const filePath = path.join(process.cwd(), "data", filename);
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
};

const getHolderRanks = () => {
  if (holderRankCache) return holderRankCache;

  const rows = readWalletList("ansem-top-holder-accounts.txt");
  holderRankCache = new Map(rows.map((wallet, index) => [wallet, index + 1]));
  return holderRankCache;
};

const getManualWallets = () => {
  if (manualWalletCache) return manualWalletCache;

  manualWalletCache = new Set(readWalletList("manual-wl-wallets.txt"));
  return manualWalletCache;
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
    const holderRanks = getHolderRanks();
    const manualWallets = getManualWallets();
    const queriedHolderRank = walletLookup ? holderRanks.get(query) || null : null;
    const queriedManualWallet = walletLookup && manualWallets.has(query);

    if (queriedManualWallet) {
      return json(response, 200, {
        found: true,
        source: "manual-wallet",
        wallet: maskWallet(query),
        holder: {
          checked: true,
          found: Boolean(queriedHolderRank),
          rank: queriedHolderRank,
        },
      });
    }

    if (queriedHolderRank) {
      return json(response, 200, {
        found: true,
        source: "top-holder",
        wallet: maskWallet(query),
        holder: {
          checked: true,
          found: true,
          rank: queriedHolderRank,
        },
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
        holder: {
          checked: walletLookup,
          found: Boolean(queriedHolderRank),
          rank: queriedHolderRank,
        },
      });
    }

    const winnerHolderRank = holderRanks.get(winner.wallet_address) || null;
    const winnerManualWallet = manualWallets.has(winner.wallet_address);
    return json(response, 200, {
      found: true,
      source: "wl-winner",
      xUsername: winner.x_username,
      wallet: maskWallet(winner.wallet_address),
      selectedAt: winner.selected_at,
      holder: {
        checked: true,
        found: Boolean(winnerHolderRank),
        rank: winnerHolderRank,
      },
      manualWallet: winnerManualWallet,
    });
  } catch (error) {
    return json(response, 500, { error: "WL status could not be checked." });
  }
};
