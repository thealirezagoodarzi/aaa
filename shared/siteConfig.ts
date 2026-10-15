/**
 * Shared site constants used by BOTH the client bundle and the server bundle.
 *
 * BUG FIX (audit item #54): the client fallback e-mail domain was hard-coded
 * to '@betonlab.ir' while the server seeds accounts with SITE_EMAIL_DOMAIN
 * ('azmajahanbin.ir'). The two sources drifted and every profile without an
 * explicit e-mail got a different (wrong, legacy demo) domain depending on
 * which layer built the projection. One constant, imported everywhere.
 */
export const DEFAULT_SITE_EMAIL_DOMAIN = 'azmajahanbin.ir';
