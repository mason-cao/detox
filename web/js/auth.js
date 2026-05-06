/* ── Supabase auth glue ──────────────────────────────────────────────
 *
 * Shared across index.html, sign-in.html, and pair.html. Pulls
 * supabase-js v2 from esm.sh as a module, caches it on `window.Auth`.
 *
 * Local dev (no DETOX_SUPABASE_URL env): the Flask /api/config returns
 * empty strings. Auth then runs in "shim" mode — `ready()` resolves with
 * a null session and `signInWithMagicLink` rejects with a clear error,
 * so the same-origin Flask flow keeps working untouched.
 */

(function () {
    const Auth = {
        _bootstrapPromise: null,
        _client: null,
        _config: null,

        bootstrap() {
            if (this._bootstrapPromise) return this._bootstrapPromise;
            this._bootstrapPromise = (async () => {
                const cfg = await this._loadConfig();
                this._config = cfg;
                if (!cfg.supabase_url || !cfg.supabase_anon_key) return null;
                const mod = await import('https://esm.sh/@supabase/supabase-js@2');
                this._client = mod.createClient(cfg.supabase_url, cfg.supabase_anon_key);
                return this._client;
            })();
            return this._bootstrapPromise;
        },

        async _loadConfig() {
            // Cloudflare Pages injects window.DETOX_* at build time.
            const injected = {
                supabase_url: window.DETOX_SUPABASE_URL || '',
                supabase_anon_key: window.DETOX_SUPABASE_ANON_KEY || '',
                api_base: window.DETOX_API_BASE || '',
            };
            if (injected.supabase_url) return injected;
            try {
                const res = await fetch('/api/config');
                if (!res.ok) return injected;
                const body = await res.json();
                window.DETOX_SUPABASE_URL = body.supabase_url || '';
                window.DETOX_SUPABASE_ANON_KEY = body.supabase_anon_key || '';
                window.DETOX_API_BASE = body.api_base || '';
                return body;
            } catch (_) {
                return injected;
            }
        },

        configured() {
            return !!(this._config && this._config.supabase_url);
        },

        client() {
            return this._client;
        },

        async ready() {
            await this.bootstrap();
            if (!this._client) return { session: null };
            const { data } = await this._client.auth.getSession();
            return { session: data.session };
        },

        async session() {
            const { session } = await this.ready();
            return session;
        },

        async accessToken() {
            const session = await this.session();
            return session ? session.access_token : null;
        },

        async signInWithMagicLink(email) {
            await this.bootstrap();
            if (!this._client) {
                throw new Error('Cloud auth is not configured for this build.');
            }
            return this._client.auth.signInWithOtp({
                email,
                options: { emailRedirectTo: `${location.origin}/` },
            });
        },

        async signOut() {
            await this.bootstrap();
            if (!this._client) return;
            await this._client.auth.signOut();
        },

        onChange(cb) {
            this.bootstrap().then(() => {
                if (this._client) {
                    this._client.auth.onAuthStateChange(cb);
                }
            });
        },
    };

    window.Auth = Auth;
    Auth.bootstrap();
})();
