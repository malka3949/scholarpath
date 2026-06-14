/**
 * Windows + NetFree: Node uses a bundled CA store, not Windows roots.
 * HTTPS fetch then fails with "unable to get local issuer certificate".
 * win-ca/api sync-inject adds system root CAs before any outbound fetch.
 */
if (process.platform === 'win32') {
  process.env.NODE_USE_SYSTEM_CA ??= '1';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('win-ca/api')({ inject: '+', async: false });
  } catch (err) {
    console.warn(
      '[tls-env] win-ca inject skipped:',
      err instanceof Error ? err.message : String(err),
    );
  }
}
