/* ── Auth-aware fetch ──────────────────────────────────────────────
 *
 * Cloud.fetch is a thin wrapper over fetch() that:
 *   - waits for Auth bootstrap so window.DETOX_API_BASE is settled,
 *   - prefixes the path with the api base when configured,
 *   - injects "Authorization: Bearer <jwt>" from the active session,
 *   - bounces unauthenticated users to /sign-in.html on 401.
 *
 * In local dev (no api base, no Supabase) this falls through to a
 * same-origin fetch — App.api keeps working against Flask unchanged.
 */

(function () {
    const SIGN_IN_URL = '/sign-in.html';

    const Cloud = {
        async fetch(path, init = {}) {
            await window.Auth.bootstrap();

            const apiBase = window.DETOX_API_BASE || '';
            const url = apiBase && path.startsWith('/api')
                ? apiBase + path.replace(/^\/api/, '/v1')
                : (apiBase ? apiBase + path : path);

            const headers = new Headers(init.headers || {});
            if (!headers.has('Content-Type') && init.body) {
                headers.set('Content-Type', 'application/json');
            }

            if (window.Auth && Auth.configured()) {
                const token = await Auth.accessToken();
                if (token) {
                    headers.set('Authorization', `Bearer ${token}`);
                } else if (!path.startsWith('/api/config')) {
                    location.href = SIGN_IN_URL;
                    throw new Error('unauthenticated');
                }
            }

            const resp = await fetch(url, { ...init, headers });
            if (resp.status === 401 && !path.startsWith('/api/config')) {
                location.href = SIGN_IN_URL;
                throw new Error('unauthenticated');
            }
            return resp;
        },
    };

    window.Cloud = Cloud;
})();
