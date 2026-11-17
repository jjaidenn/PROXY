const SUPABASE_URL = "https://teqctrceotdzzcxynlzb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BIunSLO8Rlq1p0hjKa0FVA_ey5w0oMd";
const FUNCTION_URL = SUPABASE_URL + "/functions/v1/proxy-api";
const state = { targets: [] };
const $ = (selector) => document.querySelector(selector);

async function api(path, options = {}) {
  const response = await fetch(FUNCTION_URL + path, {
    ...options,
    headers: {
      "apikey": SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Backend request failed (" + response.status + ").");
  return data;
}

function setStatus(online, message, meta) {
  $("#status-dot").classList.toggle("online", online);
  $("#status-text").textContent = message;
  $("#status-meta").textContent = meta;
}

function renderTargets() {
  const list = $("#target-list");
  const select = $("#target-select");
  $("#target-count").textContent = String(state.targets.length).padStart(2, "0");
  list.replaceChildren();
  select.innerHTML = '<option value="">Choose a configured service</option>';
  if (!state.targets.length) {
    const empty = document.createElement("div");
    empty.className = "empty-card";
    empty.textContent = "Supabase is connected, but no upstream services are configured yet. Add ALLOWED_ORIGINS in Supabase → Edge Functions → Secrets.";
    list.append(empty);
    return;
  }
  state.targets.forEach((name, index) => {
    const card = document.createElement("article");
    card.className = "target-card";
    const icon = document.createElement("div");
    icon.className = "target-icon";
    icon.textContent = String(index + 1).padStart(2, "0");
    const copy = document.createElement("div");
    const title = document.createElement("div");
    title.className = "target-name";
    title.textContent = name;
    const sub = document.createElement("div");
    sub.className = "target-sub";
    sub.textContent = "CONFIGURED API";
    copy.append(title, sub);
    card.append(icon, copy);
    list.append(card);
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.append(option);
  });
  $("#send-button").disabled = false;
}

async function boot() {
  try {
    const [health, data] = await Promise.all([api("/health"), api("/targets")]);
    state.targets = Array.isArray(data.targets) ? data.targets : [];
    setStatus(true, "Supabase backend online", health.configuredTargets + " CONFIGURED");
    renderTargets();
  } catch (error) {
    setStatus(false, "Backend unavailable", "OFFLINE");
    $("#target-list").textContent = error.message;
    $("#response-output").textContent = error.message;
    $("#response-output").classList.add("error");
  }
}

$("#request-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const target = $("#target-select").value;
  const path = $("#path-input").value.trim();
  const output = $("#response-output");
  const status = $("#response-status");
  if (!state.targets.includes(target)) return;
  if (/^[a-z]+:\/\//i.test(path) || path.split("/").some(part => part === "." || part === "..") || path.indexOf(String.fromCharCode(92)) !== -1) {
    output.textContent = "Use a relative API path only. Full URLs and dot segments are blocked.";
    output.classList.add("error");
    status.textContent = "INVALID PATH";
    return;
  }
  const button = $("#send-button");
  button.disabled = true;
  button.querySelector("span").textContent = "Sending…";
  output.classList.remove("error");
  output.textContent = "Contacting Supabase…";
  status.textContent = "REQUESTING";
  try {
    const result = await api("/fetch", {
      method: "POST",
      body: JSON.stringify({ target, path }),
    });
    output.textContent = JSON.stringify(result.data, null, 2).slice(0, 16000);
    status.textContent = "HTTP " + result.status;
  } catch (error) {
    output.textContent = error.message;
    output.classList.add("error");
    status.textContent = "FAILED";
  } finally {
    button.disabled = state.targets.length === 0;
    button.querySelector("span").textContent = "Send request";
  }
});

boot();
