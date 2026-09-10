/**
 * Validates URLs to prevent SSRF attacks.
 * Blocks internal IP ranges and local hostnames.
 */

function isSafeUrl(urlString) {
  if (!urlString) return false;

  try {
    const url = new URL(urlString);

    // Only allow HTTP and HTTPS
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    const hostname = url.hostname;

    // Block localhost and related domains
    const blockedHostnames = ['localhost', 'metadata.google.internal', '169.254.169.254'];
    if (blockedHostnames.includes(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return false;
    }

    // Block common private IPv4 ranges
    const parts = hostname.split('.');
    if (parts.length === 4 && parts.every(p => !isNaN(parseInt(p, 10)))) {
      const ip = parts.map(p => parseInt(p, 10));

      // 0.0.0.0/8
      if (ip[0] === 0) return false;
      // 10.0.0.0/8
      if (ip[0] === 10) return false;
      // 127.0.0.0/8
      if (ip[0] === 127) return false;
      // 169.254.0.0/16
      if (ip[0] === 169 && ip[1] === 254) return false;
      // 172.16.0.0/12
      if (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31) return false;
      // 192.168.0.0/16
      if (ip[0] === 192 && ip[1] === 168) return false;
    }

    // Could add IPv6 check here, but mainly protecting against typical metadata endpoints

    return true;
  } catch (err) {
    // If URL parsing fails, it's not safe
    return false;
  }
}

module.exports = { isSafeUrl };
