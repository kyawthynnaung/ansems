const getConfig = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Database is not configured yet.");
  }

  return {
    baseUrl: supabaseUrl.replace(/\/$/, ""),
    serviceRoleKey,
  };
};

const json = (response, status, body) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
};

const assertAdmin = (request) => {
  const adminKey = process.env.ADMIN_KEY;
  const providedKey = request.headers["x-admin-key"];

  if (!adminKey) {
    return "Admin access is not configured yet.";
  }

  if (!providedKey || providedKey !== adminKey) {
    return "Unauthorized.";
  }

  return "";
};

const supabaseFetch = async (path, options = {}) => {
  const { baseUrl, serviceRoleKey } = getConfig();

  return fetch(`${baseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
};

module.exports = {
  assertAdmin,
  json,
  supabaseFetch,
};
