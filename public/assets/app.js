const $ = (selector) => document.querySelector(selector);
const state = { targets: [] };

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
    empty.textContent = "No services are configured. Add an ALLOWED_ORIGINS JSON map to the backend environment to make your approved services appear here.";
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
    sub.textContent = "CONFIGURED UPSTREAM";
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
    const [healthResponse, targetsResponse] = await Promise.all([
      fetch("/health", { cache: "no-store" }),
      fetch("/api/targets", { cache: "no-store" })
    ]);
    if (!healthResponse.ok || !targetsResponse.ok) throw new Error("Backend returned an error.");
    const health = await healthResponse.json();
    const data = await targetsResponse.json();
    state.targets = Array.isArray(data.targets) ? data.targets : [];
    setStatus(true, "Backend online", health.configuredTargets + " CONFIGURED");
    renderTargets();
  } catch {
    setStatus(false, "Backend unavailable", "OFFLINE");
    $("#target-list").innerHTML = '<div class="empty-card">Could not connect to the backend. Open this page from the running server, not as a standalone CDN file.</div>';
    $("#response-output").textContent = "The API is not reachable.";
    $("#response-output").classList.add("error");
  }
}

$("#request-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const target = $("#target-select").value;
  const path = $("#path-input").value.trim().replace(/^\/+/, "");
  const output = $("#response-output");
  const status = $("#response-status");
  if (!state.targets.includes(target)) return;
  if (path.split("/").some(part => part === "." || part === "..") || /^[a-z]+:\/\//i.test(path)) {
    output.textContent = "Enter a relative path only. Absolute URLs and dot segments are not accepted.";
    output.classList.add("error");
    status.textContent = "INVALID PATH";
    return;
  }

  const encodedPath = path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  const url = "/p/" + encodeURIComponent(target) + (encodedPath ? "/" + encodedPath : "");
  const button = $("#send-button");
  button.disabled = true;
  button.querySelector("span").textContent = "Sending…";
  output.classList.remove("error");
  output.textContent = "Waiting for configured service…";
  status.textContent = "REQUESTING";

  try {
    const response = await fetch(url, { method: "GET", headers: { Accept: "application/json, text/plain, */*" } });
    const body = await response.text();
    let formatted = body;
    try { formatted = JSON.stringify(JSON.parse(body), null, 2); } catch {}
    output.textContent = formatted.slice(0, 16000) || "(empty response)";
    status.textContent = "HTTP " + response.status;
    if (!response.ok) output.classList.add("error");
  } catch {
    output.textContent = "Request failed. Check that the backend and configured service are online.";
    output.classList.add("error");
    status.textContent = "FAILED";
  } finally {
    button.disabled = state.targets.length === 0;
    button.querySelector("span").textContent = "Send request";
  }
});

boot();
