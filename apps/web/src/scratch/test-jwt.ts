// Testing base64url decoding similar to proxy.ts logic
const token = "header.eyJleHAiOjE3MTMyNDY0MDB9.signature";
const payloadPart = token.split(".")[1];

let base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
while (base64.length % 4) {
  base64 += "=";
}

try {
  const decoded = atob(base64);
  const payload = JSON.parse(decoded);
  console.log("Decoded payload:", payload);
  console.log("Expiration:", new Date(payload.exp * 1000).toLocaleString());
} catch (err) {
  console.error("Decoding failed:", err);
}
