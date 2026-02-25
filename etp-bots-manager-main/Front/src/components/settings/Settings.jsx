import { AnimatePresence, motion } from "framer-motion";
import {
    AlertCircle, CheckCircle, ChevronDown, ChevronUp,
    Database, ExternalLink, FileText, Key, Lock,
    LogOut, Mail, PlugZap, RotateCcw, Save,
    Send, Server, Shield, User, WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

/* ═══════════════════════════════════════════════════════════
   HELPERS AUTH
══════════════════════════════════════════════════════════════ */
const getAuthHeaders = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return { Authorization: `Bearer ${user?.token || ""}` };
};

/* ═══════════════════════════════════════════════════════════
   API — MONGODB CONFIG
══════════════════════════════════════════════════════════════ */
const getConfig = async () => {
    const res = await fetch("http://localhost:8000/configuration/db/", {
        headers: getAuthHeaders(),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw Object.assign(new Error(data?.error || `Erreur ${res.status}`), { response: { data } });
    }
    return res.json();
};

const updateConfig = async (dbConfig) => {
    const res = await fetch("http://localhost:8000/configuration/db/", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(dbConfig),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw Object.assign(new Error(data?.error || `Erreur ${res.status}`), { response: { data } });
    }
    return res.json();
};

/* ═══════════════════════════════════════════════════════════
   API — OUTLOOK ACCOUNT (IMAP basique)
══════════════════════════════════════════════════════════════ */
const getOutlookAccount = async () => {
    const res = await fetch("http://localhost:8000/outlook/account/", { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`Erreur ${res.status}`);
    return res.json();
};

const saveOutlookAccount = async (payload) => {
    const res = await fetch("http://localhost:8000/outlook/account/", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || `Erreur ${res.status}`);
    }
    return res.json();
};

const testOutlookAccount = async (payload) => {
    const res = await fetch("http://localhost:8000/outlook/account/test/", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
    });
    const d = await res.json().catch(() => ({}));
    return {
        success: res.ok && d.success === true,
        message: d.message || d.error || (res.ok ? "Connexion testée" : `Erreur ${res.status}`),
    };
};

/* ═══════════════════════════════════════════════════════════
   API — OAUTH2 MICROSOFT GRAPH
══════════════════════════════════════════════════════════════ */
const getOAuthStatus = async () => {
    try {
        const res = await fetch("http://localhost:8000/mail/status/", { headers: getAuthHeaders() });
        if (!res.ok) return { connected: false };
        return res.json();
    } catch { return { connected: false }; }
};

const startOAuth = async () => {
    const res = await fetch("http://localhost:8000/mail/start/", { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Impossible de démarrer l'authentification Microsoft.");
    const d = await res.json();
    return d.auth_url;
};

const disconnectOAuth = async () => {
    const res = await fetch("http://localhost:8000/mail/disconnect/", {
        method: "POST", headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`Erreur ${res.status}`);
    return res.json();
};

/* ═══════════════════════════════════════════════════════════
   INITIAL STATES
══════════════════════════════════════════════════════════════ */
const dbInitial = {
    host: "localhost",
    port: 27017,
    db_name: "testdb",
    username: "",
    password: "",
    change_reason: "Migration vers une nouvelle base de données",
};

const outlookInitial = {
    imap_host: "outlook.office365.com",
    imap_port: 993,
    imap_user: "",
    imap_password: "",
    smtp_host: "smtp.office365.com",
    smtp_port: 587,
    smtp_user: "",
    smtp_password: "",
    use_ssl: true,
};

/* ═══════════════════════════════════════════════════════════
   SHARED STYLES
══════════════════════════════════════════════════════════════ */
const sectionStyle = {
    border: "1px solid rgba(229, 235, 249, 0.8)",
    borderRadius: "12px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    background: "rgba(229, 235, 249, 0.08)",
};

const sectionHeaderStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    fontWeight: "700",
    color: "#003087",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
};

const labelStyle = {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    color: "#242D45",
    marginBottom: "6px",
};

const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    background: "rgba(248, 250, 255, 0.8)",
    border: "1.5px solid rgba(229, 235, 249, 0.9)",
    borderRadius: "10px",
    fontSize: "14px",
    color: "#010C28",
    fontFamily: "Inter, sans-serif",
    transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
    boxSizing: "border-box",
};

const inputFocusedStyle = { borderColor: "rgba(0, 48, 135, 0.3)", background: "white" };
const inputOutlookFocused = { borderColor: "rgba(0, 114, 198, 0.35)", background: "white" };
const OUTLOOK_BLUE = "#0072C6";

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : DbInfoPanel
══════════════════════════════════════════════════════════════ */
function DbInfoPanel({ form, token, isLoading }) {
    const connectionString = `mongodb://${form.username ? `${form.username}:***@` : ""}${form.host}:${form.port}/${form.db_name}`;
    const rows = [
        { label: "Hôte",         value: form.host     || "—", icon: Server },
        { label: "Port",         value: form.port     || "—", icon: Key },
        { label: "Base",         value: form.db_name  || "—", icon: Database },
        { label: "Utilisateur",  value: form.username || "—", icon: User },
        { label: "Mot de passe", value: form.password ? "••••••••" : "—", icon: Lock },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 100, damping: 20 }}
            style={{ flex: "0 0 300px", background: "white", borderRadius: "16px", boxShadow: "0 6px 18px rgba(0,0,0,0.07)", border: "1px solid rgba(0, 48, 135, 0.1)", overflow: "hidden", position: "sticky", top: "32px", alignSelf: "flex-start" }}
        >
            <div style={{ height: "5px", background: "linear-gradient(90deg, #003087 0%, #5FCC80 100%)" }} />

            <div style={{ padding: "24px 24px 20px", borderBottom: "1px solid rgba(229, 235, 249, 0.8)", background: "rgba(229, 235, 249, 0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{ background: "linear-gradient(135deg, #003087, #1746D9)", padding: "12px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0, 48, 135, 0.25)" }}>
                        <Database size={22} color="white" />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#010C28" }}>Nouvelle Configuration</h3>
                        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#6B7280", fontFamily: "Inter, sans-serif" }}>Aperçu en temps réel</p>
                    </div>
                    <div style={{ marginLeft: "auto", width: "10px", height: "10px", borderRadius: "50%", background: isLoading ? "#E3920C" : "#5FCC80", boxShadow: isLoading ? "0 0 0 3px rgba(227, 146, 12, 0.2)" : "0 0 0 3px rgba(95, 204, 128, 0.2)", flexShrink: 0 }} />
                </div>
                {token && (
                    <div style={{ marginTop: "14px", padding: "8px 12px", background: "rgba(23, 70, 217, 0.06)", borderRadius: "8px", border: "1px solid rgba(23, 70, 217, 0.12)", fontSize: "11px", color: "#1746D9", fontFamily: "monospace", wordBreak: "break-all" }}>
                        🔑 {token.slice(0, 28)}…
                    </div>
                )}
            </div>

            {isLoading && <div style={{ padding: "20px", textAlign: "center", color: "#6B7280", fontSize: "13px" }}>Chargement de la configuration...</div>}

            {!isLoading && (
                <>
                    <div style={{ padding: "8px 0" }}>
                        {rows.map((r, idx) => (
                            <motion.div key={r.label} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * idx + 0.4 }}
                                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 24px", borderBottom: idx < rows.length - 1 ? "1px solid rgba(229, 235, 249, 0.6)" : "none" }}>
                                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(229, 235, 249, 0.8)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <r.icon size={15} color="#003087" />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: "10px", fontWeight: "600", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "2px" }}>{r.label}</div>
                                    <div style={{ fontSize: "13px", fontWeight: "600", color: r.value === "—" ? "#9CA3AF" : "#010C28", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.value}</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                    <div style={{ margin: "0 16px 16px", padding: "12px 14px", background: "rgba(229, 235, 249, 0.4)", borderRadius: "10px", border: "1px solid rgba(0, 48, 135, 0.1)" }}>
                        <div style={{ fontSize: "10px", fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "8px" }}>Chaîne de connexion</div>
                        <div style={{ fontSize: "11px", color: "#003087", fontFamily: "monospace", wordBreak: "break-all", lineHeight: "1.6", fontWeight: "500" }}>{connectionString}</div>
                    </div>
                    {form.change_reason && (
                        <div style={{ margin: "0 16px 20px", padding: "12px 14px", background: "rgba(95, 204, 128, 0.06)", borderRadius: "10px", border: "1px solid rgba(95, 204, 128, 0.2)" }}>
                            <div style={{ fontSize: "10px", fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "6px", display: "flex", alignItems: "center", gap: "5px" }}>
                                <FileText size={11} color="#6B7280" /> Raison
                            </div>
                            <p style={{ margin: 0, fontSize: "12px", color: "#242D45", lineHeight: "1.6", fontStyle: "italic" }}>{form.change_reason}</p>
                        </div>
                    )}
                </>
            )}
        </motion.div>
    );
}

/* ═══════════════════════════════════════════════════════════
   SOUS-COMPOSANT : OAuthSection
══════════════════════════════════════════════════════════════ */
function OAuthSection() {
    const [oauthStatus, setOauthStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const checkStatus = useCallback(async () => {
        const s = await getOAuthStatus();
        setOauthStatus(s);
    }, []);

    useEffect(() => {
        checkStatus();
        const onFocus = () => setTimeout(checkStatus, 1200);
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [checkStatus]);

    const handleConnect = async () => {
        setLoading(true); setError(null);
        try {
            const url = await startOAuth();
            const w = 520, h = 640;
            const left = (window.screen.width - w) / 2;
            const top = (window.screen.height - h) / 2;
            window.open(url, "MicrosoftOAuth", `width=${w},height=${h},left=${left},top=${top}`);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };

    const handleDisconnect = async () => {
        setLoading(true); setError(null);
        try {
            await disconnectOAuth();
            setOauthStatus({ connected: false });
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };

    const isConnected = oauthStatus?.connected && oauthStatus?.is_valid;
    const isExpired   = oauthStatus?.connected && !oauthStatus?.is_valid;

    const btnStyle = (disabled) => ({
        display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
        padding: "13px 24px", width: "100%",
        background: disabled ? "#9CA3AF" : `linear-gradient(135deg, ${OUTLOOK_BLUE}, #005A9E)`,
        border: "none", borderRadius: "10px", color: "white",
        fontSize: "14px", fontWeight: "700",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "Inter, sans-serif",
        boxShadow: disabled ? "none" : `0 4px 14px rgba(0,114,198,0.35)`,
        transition: "all 0.2s",
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ padding: "13px 16px", background: "rgba(0,114,198,0.04)", border: "1px solid rgba(0,114,198,0.12)", borderRadius: "10px", fontSize: "13px", color: "#374151", lineHeight: "1.7" }}>
                <strong style={{ color: OUTLOOK_BLUE }}>Pour les comptes @outlook.fr, @hotmail.com, @live.com et Microsoft 365 modernes.</strong><br />
                Microsoft a supprimé l'authentification par mot de passe via IMAP pour ces comptes. La connexion OAuth2 est la seule méthode fiable.
            </div>

            {oauthStatus === null ? (
                <div style={{ fontSize: "13px", color: "#6B7280" }}>Vérification du statut…</div>
            ) : isConnected ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "rgba(95,204,128,0.07)", border: "1px solid rgba(95,204,128,0.3)", borderRadius: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "linear-gradient(135deg, #5FCC80, #2D7A4F)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <CheckCircle size={18} color="white" />
                        </div>
                        <div>
                            <div style={{ fontSize: "13px", fontWeight: "700", color: "#010C28" }}>Compte connecté</div>
                            <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "2px" }}>{oauthStatus.email || "Email non récupéré"}</div>
                        </div>
                    </div>
                    <button type="button" onClick={handleDisconnect} disabled={loading}
                        style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: "white", border: "1.5px solid rgba(216,23,23,0.25)", borderRadius: "8px", color: "#D81717", fontSize: "12px", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontFamily: "Inter, sans-serif" }}>
                        <LogOut size={13} /> Déconnecter
                    </button>
                </motion.div>
            ) : isExpired ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "rgba(227,146,12,0.06)", border: "1px solid rgba(227,146,12,0.25)", borderRadius: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <AlertCircle size={18} color="#E3920C" />
                        <div>
                            <div style={{ fontSize: "13px", fontWeight: "700", color: "#010C28" }}>Token expiré</div>
                            <div style={{ fontSize: "12px", color: "#6B7280" }}>{oauthStatus.email} — reconnectez-vous</div>
                        </div>
                    </div>
                    <button type="button" onClick={handleConnect} disabled={loading} style={{ ...btnStyle(loading), width: "auto", padding: "9px 18px", fontSize: "13px" }}>
                        Reconnecter
                    </button>
                </div>
            ) : (
                <button type="button" onClick={handleConnect} disabled={loading} style={btnStyle(loading)}>
                    {loading ? (
                        <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ animation: "spin 0.8s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>Ouverture de Microsoft…</>
                    ) : (
                        <>
                            <svg width="16" height="16" viewBox="0 0 23 23">
                                <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
                                <rect x="12" y="1" width="10" height="10" fill="#7fba00"/>
                                <rect x="1" y="12" width="10" height="10" fill="#00a4ef"/>
                                <rect x="12" y="12" width="10" height="10" fill="#ffb900"/>
                            </svg>
                            Se connecter avec Microsoft
                            <ExternalLink size={13} style={{ opacity: 0.8 }} />
                        </>
                    )}
                </button>
            )}

            {error && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "rgba(216,23,23,0.06)", border: "1px solid rgba(216,23,23,0.2)", borderRadius: "8px", color: "#D81717", fontSize: "12px" }}>
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />{error}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   SOUS-COMPOSANT : ImapSection
══════════════════════════════════════════════════════════════ */
function ImapSection() {
    const [form, setForm] = useState(outlookInitial);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [saved, setSaved] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [error, setError] = useState(null);
    const [touched, setTouched] = useState({});
    const [showImapPwd, setShowImapPwd] = useState(false);
    const [showSmtpPwd, setShowSmtpPwd] = useState(false);
    const [isConfigured, setIsConfigured] = useState(false);
    const [smtpOpen, setSmtpOpen] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const d = await getOutlookAccount();
                if (d.configured) {
                    setIsConfigured(true);
                    setForm({
                        imap_host: d.imap_host || outlookInitial.imap_host,
                        imap_port: d.imap_port || outlookInitial.imap_port,
                        imap_user: d.imap_user || "",
                        imap_password: d.imap_password || "",
                        smtp_host: d.smtp_host || outlookInitial.smtp_host,
                        smtp_port: d.smtp_port || outlookInitial.smtp_port,
                        smtp_user: d.smtp_user || "",
                        smtp_password: d.smtp_password || "",
                        use_ssl: d.use_ssl ?? true,
                    });
                }
            } catch (e) {
                console.warn("Impossible de charger le compte IMAP :", e);
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(p => ({ ...p, [name]: type === "checkbox" ? checked : name.includes("port") ? Number(value) : value }));
        setTouched(p => ({ ...p, [name]: true }));
        setSaved(false); setTestResult(null); setError(null);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true); setError(null); setTestResult(null);
        try {
            await saveOutlookAccount(form);
            setSaved(true); setIsConfigured(true); setTouched({});
            setTimeout(() => setSaved(false), 3000);
        } catch (err) { setError(err.message); }
        finally { setIsSaving(false); }
    };

    const handleTest = async () => {
        setIsTesting(true); setTestResult(null); setError(null);
        try {
            const result = await testOutlookAccount({ imap_user: form.imap_user, imap_password: form.imap_password });
            setTestResult(result);
        } catch (err) {
            setTestResult({ success: false, message: err.message });
        } finally { setIsTesting(false); }
    };

    const EyeBtn = ({ show, onToggle }) => (
        <button type="button" onClick={onToggle}
            style={{ position: "absolute", right: "13px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6B7280", display: "flex", padding: "2px" }}>
            {show
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            }
        </button>
    );

    if (isLoading) return <div style={{ padding: "20px", textAlign: "center", color: "#6B7280", fontSize: "13px" }}>Chargement…</div>;

    return (
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Avertissement */}
            <div style={{ padding: "11px 14px", background: "rgba(227,146,12,0.06)", border: "1px solid rgba(227,146,12,0.2)", borderRadius: "10px", fontSize: "12px", color: "#92600A", lineHeight: "1.6" }}>
                ⚠️ <strong>Comptes Exchange entreprise uniquement.</strong> Pour les comptes @outlook.fr / @hotmail / @live, utilisez l'onglet "Connexion Microsoft" — l'authentification par mot de passe est bloquée par Microsoft sur ces comptes.
            </div>

            {/* ── IMAP ── */}
            <div style={sectionStyle}>
                <div style={{ ...sectionHeaderStyle, color: OUTLOOK_BLUE }}>
                    <Server size={14} color={OUTLOOK_BLUE} />
                    Réception — IMAP
                    {isConfigured && (
                        <span style={{ marginLeft: "auto", fontSize: "11px", fontWeight: "600", color: "#5FCC80", background: "rgba(95,204,128,0.1)", padding: "2px 10px", borderRadius: "20px", border: "1px solid rgba(95,204,128,0.25)" }}>
                            Configuré
                        </span>
                    )}
                </div>

                <div style={{ display: "flex", gap: "16px" }}>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle} htmlFor="imap_host">Serveur IMAP</label>
                        <input id="imap_host" name="imap_host" type="text" value={form.imap_host} onChange={handleChange}
                            placeholder="outlook.office365.com"
                            style={{ ...inputStyle, ...(touched.imap_host ? inputOutlookFocused : {}) }} />
                    </div>
                    <div style={{ width: "120px" }}>
                        <label style={labelStyle} htmlFor="imap_port">Port</label>
                        <input id="imap_port" name="imap_port" type="number" value={form.imap_port} onChange={handleChange}
                            min={1} max={65535}
                            style={{ ...inputStyle, ...(touched.imap_port ? inputOutlookFocused : {}) }} />
                    </div>
                </div>

                <div style={{ display: "flex", gap: "16px" }}>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle} htmlFor="imap_user">Adresse email</label>
                        <div style={{ position: "relative" }}>
                            <span style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }}><Mail size={14} /></span>
                            <input id="imap_user" name="imap_user" type="email" value={form.imap_user} onChange={handleChange}
                                placeholder="vous@entreprise.com"
                                style={{ ...inputStyle, paddingLeft: "36px", ...(touched.imap_user ? inputOutlookFocused : {}) }} />
                        </div>
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle} htmlFor="imap_password">Mot de passe</label>
                        <div style={{ position: "relative" }}>
                            <input id="imap_password" name="imap_password" type={showImapPwd ? "text" : "password"} value={form.imap_password} onChange={handleChange}
                                placeholder="Mot de passe ou App Password"
                                style={{ ...inputStyle, paddingRight: "44px", ...(touched.imap_password ? inputOutlookFocused : {}) }} />
                            <EyeBtn show={showImapPwd} onToggle={() => setShowImapPwd(p => !p)} />
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input id="use_ssl" name="use_ssl" type="checkbox" checked={form.use_ssl} onChange={handleChange}
                        style={{ width: "16px", height: "16px", accentColor: OUTLOOK_BLUE, cursor: "pointer" }} />
                    <label htmlFor="use_ssl" style={{ ...labelStyle, marginBottom: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Shield size={13} color={OUTLOOK_BLUE} /> Utiliser SSL / TLS
                    </label>
                </div>
            </div>

            {/* ── SMTP repliable ── */}
            <div style={{ border: "1px solid rgba(229,235,249,0.8)", borderRadius: "12px", overflow: "hidden" }}>
                <button type="button" onClick={() => setSmtpOpen(p => !p)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "14px 20px", background: "rgba(229,235,249,0.1)", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "700", color: "#5B6789", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                        <Send size={13} color="#5B6789" /> Envoi — SMTP (optionnel)
                    </span>
                    {smtpOpen ? <ChevronUp size={16} color="#9CA3AF" /> : <ChevronDown size={16} color="#9CA3AF" />}
                </button>
                <AnimatePresence>
                    {smtpOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px", borderTop: "1px solid rgba(229,235,249,0.8)" }}>
                                <div style={{ display: "flex", gap: "16px" }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle} htmlFor="smtp_host">Serveur SMTP</label>
                                        <input id="smtp_host" name="smtp_host" type="text" value={form.smtp_host} onChange={handleChange} placeholder="smtp.office365.com" style={{ ...inputStyle, ...(touched.smtp_host ? inputOutlookFocused : {}) }} />
                                    </div>
                                    <div style={{ width: "120px" }}>
                                        <label style={labelStyle} htmlFor="smtp_port">Port</label>
                                        <input id="smtp_port" name="smtp_port" type="number" value={form.smtp_port} onChange={handleChange} min={1} max={65535} style={{ ...inputStyle, ...(touched.smtp_port ? inputOutlookFocused : {}) }} />
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: "16px" }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle} htmlFor="smtp_user">Utilisateur SMTP</label>
                                        <input id="smtp_user" name="smtp_user" type="email" value={form.smtp_user} onChange={handleChange} placeholder="Identique à l'adresse IMAP si vide" style={{ ...inputStyle, ...(touched.smtp_user ? inputOutlookFocused : {}) }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle} htmlFor="smtp_password">Mot de passe SMTP</label>
                                        <div style={{ position: "relative" }}>
                                            <input id="smtp_password" name="smtp_password" type={showSmtpPwd ? "text" : "password"} value={form.smtp_password} onChange={handleChange} placeholder="Optionnel si identique à IMAP" style={{ ...inputStyle, paddingRight: "44px", ...(touched.smtp_password ? inputOutlookFocused : {}) }} />
                                            <EyeBtn show={showSmtpPwd} onToggle={() => setShowSmtpPwd(p => !p)} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Résultat test */}
            {testResult && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "13px 16px", background: testResult.success ? "rgba(95,204,128,0.07)" : "rgba(216,23,23,0.05)", border: `1px solid ${testResult.success ? "rgba(95,204,128,0.3)" : "rgba(216,23,23,0.2)"}`, borderRadius: "10px", color: testResult.success ? "#2D7A4F" : "#D81717", fontSize: "13px", fontWeight: "500", lineHeight: "1.6" }}>
                    {testResult.success ? <CheckCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} /> : <WifiOff size={16} style={{ flexShrink: 0, marginTop: "2px" }} />}
                    <span style={{ whiteSpace: "pre-line" }}>{testResult.message}</span>
                </motion.div>
            )}

            {/* Erreur */}
            {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ display: "flex", alignItems: "center", gap: "10px", padding: "13px 16px", background: "rgba(216,23,23,0.05)", border: "1px solid rgba(216,23,23,0.2)", borderRadius: "10px", color: "#D81717", fontSize: "13px", fontWeight: "500" }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />{error}
                </motion.div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", flexWrap: "wrap" }}>
                <motion.button type="button" onClick={handleTest}
                    disabled={isSaving || isTesting || !form.imap_user}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    style={{ display: "flex", alignItems: "center", gap: "8px", padding: "11px 22px", background: "white", border: `1.5px solid rgba(0,114,198,0.3)`, borderRadius: "10px", color: OUTLOOK_BLUE, fontSize: "14px", fontWeight: "600", cursor: (isSaving || isTesting || !form.imap_user) ? "not-allowed" : "pointer", opacity: (isSaving || isTesting || !form.imap_user) ? 0.5 : 1, fontFamily: "Inter, sans-serif" }}>
                    {isTesting
                        ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={OUTLOOK_BLUE} strokeWidth="2.5" style={{ animation: "spin 0.8s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>Test en cours…</>
                        : <><PlugZap size={15} />Tester la connexion</>
                    }
                </motion.button>

                <motion.button type="submit" disabled={isSaving || isTesting}
                    whileHover={{ scale: (isSaving || isTesting) ? 1 : 1.02 }} whileTap={{ scale: (isSaving || isTesting) ? 1 : 0.98 }}
                    style={{ display: "flex", alignItems: "center", gap: "8px", padding: "11px 28px", background: saved ? "#5FCC80" : `linear-gradient(135deg, ${OUTLOOK_BLUE}, #005A9E)`, border: "none", borderRadius: "10px", color: "white", fontSize: "14px", fontWeight: "700", cursor: (isSaving || isTesting) ? "not-allowed" : "pointer", opacity: (isSaving || isTesting) ? 0.85 : 1, fontFamily: "Inter, sans-serif", boxShadow: saved ? "0 4px 12px rgba(95,204,128,0.35)" : "0 4px 12px rgba(0,114,198,0.3)", transition: "background 0.25s, box-shadow 0.25s" }}>
                    {isSaving
                        ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ animation: "spin 0.8s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>Sauvegarde…</>
                        : saved ? <><CheckCircle size={14} />Sauvegardé</> : <><Save size={14} />Sauvegarder</>
                    }
                </motion.button>
            </div>
        </form>
    );
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : OutlookAccountCard (avec onglets)
══════════════════════════════════════════════════════════════ */
function OutlookAccountCard() {
    const [activeTab, setActiveTab] = useState("oauth");

    const tabs = [
        { id: "oauth", label: "Connexion Microsoft", icon: "🔑", desc: "Outlook.fr · Hotmail · M365" },
        { id: "imap",  label: "IMAP / SMTP",         icon: "🖥️", desc: "Exchange entreprise" },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 100, damping: 20 }}
            style={{ background: "white", borderRadius: "16px", boxShadow: "0 6px 18px rgba(0,0,0,0.07)", border: `1px solid rgba(0,114,198,0.12)`, overflow: "hidden", marginTop: "28px" }}
        >
            <div style={{ height: "5px", background: `linear-gradient(90deg, ${OUTLOOK_BLUE} 0%, #00B4E0 100%)` }} />

            <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "24px 32px", borderBottom: "1px solid rgba(229,235,249,0.8)", background: "rgba(229,235,249,0.12)" }}>
                <div style={{ background: `linear-gradient(135deg, ${OUTLOOK_BLUE}, #005A9E)`, padding: "14px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px rgba(0,114,198,0.3)` }}>
                    <Mail size={24} color="white" />
                </div>
                <div>
                    <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#010C28" }}>Boîte mail Outlook</h2>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>Compte connecté aux bots pour la lecture des emails</p>
                </div>
            </div>

            {/* Onglets */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(229,235,249,0.8)", background: "rgba(248,250,255,0.5)" }}>
                {tabs.map(tab => (
                    <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                        style={{ flex: 1, padding: "14px 20px", background: "none", border: "none", borderBottom: activeTab === tab.id ? `3px solid ${OUTLOOK_BLUE}` : "3px solid transparent", cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.2s" }}>
                        <div style={{ fontSize: "13px", fontWeight: "700", color: activeTab === tab.id ? OUTLOOK_BLUE : "#6B7280" }}>
                            {tab.icon} {tab.label}
                        </div>
                        <div style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>{tab.desc}</div>
                    </button>
                ))}
            </div>

            <div style={{ padding: "24px 32px" }}>
                <AnimatePresence mode="wait">
                    {activeTab === "oauth" ? (
                        <motion.div key="oauth" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }}>
                            <OAuthSection />
                        </motion.div>
                    ) : (
                        <motion.div key="imap" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
                            <ImapSection />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

/* ═══════════════════════════════════════════════════════════
   PAGE SETTINGS (principale)
══════════════════════════════════════════════════════════════ */
export default function Settings() {
    const [form, setForm] = useState(dbInitial);
    const [showPassword, setShowPassword] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [touched, setTouched] = useState({});
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);

    const user = useMemo(() => {
        try { return JSON.parse(localStorage.getItem("user")); }
        catch { return null; }
    }, []);
    const token = user?.token || "";

    useEffect(() => {
        if (!token) { setIsLoadingConfig(false); setError("Utilisateur non authentifié"); return; }
        (async () => {
            setIsLoadingConfig(true); setError(null);
            try {
                const d = await getConfig();
                setForm({
                    host:          d.host          || dbInitial.host,
                    port:          d.port          || dbInitial.port,
                    db_name:       d.db_name       || dbInitial.db_name,
                    username:      d.username      || dbInitial.username,
                    password:      d.password      || dbInitial.password,
                    change_reason: d.change_reason || dbInitial.change_reason,
                });
            } catch { setError("Impossible de charger la configuration existante."); }
            finally { setIsLoadingConfig(false); }
        })();
    }, [token]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: name === "port" ? Number(value) : value }));
        setTouched(prev => ({ ...prev, [name]: true }));
        setSaved(false); setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); setLoading(true); setError(null);
        try {
            await updateConfig(form);
            setSaved(true); setTouched({});
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError(err?.response?.data?.detail || err?.response?.data?.error || "Erreur lors de la sauvegarde.");
        } finally { setLoading(false); }
    };

    const handleReset = async () => {
        setTouched({}); setSaved(false); setError(null); setIsLoadingConfig(true);
        try {
            const d = await getConfig();
            setForm({
                host:          d.host          || dbInitial.host,
                port:          d.port          || dbInitial.port,
                db_name:       d.db_name       || dbInitial.db_name,
                username:      d.username      || dbInitial.username,
                password:      d.password      || dbInitial.password,
                change_reason: d.change_reason || dbInitial.change_reason,
            });
        } catch { setForm(dbInitial); }
        finally { setIsLoadingConfig(false); }
    };

    const isDirty = Object.keys(touched).length > 0;

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
            style={{ padding: "28px 40px", maxWidth: "1800px", margin: "0 auto", fontFamily: "Inter, sans-serif" }}
        >
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} style={{ marginBottom: "32px" }}>
                <h1 style={{ fontSize: "36px", fontWeight: "900", color: "#010C28", margin: 0, lineHeight: "1.1", letterSpacing: "-0.5px" }}>Paramètres</h1>
                <p style={{ margin: "10px 0 0", fontSize: "16px", color: "#242D45", opacity: 0.8, fontWeight: "500" }}>
                    Configuration de la connexion MongoDB et du compte mail Outlook
                </p>
            </motion.div>

            <div style={{ display: "flex", gap: "28px", alignItems: "flex-start" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

                    {/* ══ Card MongoDB ══ */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15, type: "spring", stiffness: 100, damping: 20 }}
                        style={{ background: "white", borderRadius: "16px", boxShadow: "0 6px 18px rgba(0,0,0,0.07)", border: "1px solid rgba(0, 48, 135, 0.1)", overflow: "hidden" }}
                    >
                        <div style={{ height: "5px", background: "linear-gradient(90deg, #003087 0%, #1746D9 100%)" }} />

                        <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "24px 32px", borderBottom: "1px solid rgba(229, 235, 249, 0.8)", background: "rgba(229, 235, 249, 0.15)" }}>
                            <div style={{ background: "linear-gradient(135deg, #003087, #1746D9)", padding: "14px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0, 48, 135, 0.25)" }}>
                                <Database size={24} color="white" />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#010C28" }}>Base de données</h2>
                                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>Connexion MongoDB</p>
                            </div>
                            {isDirty && (
                                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                                    style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "600", color: "#E3920C", background: "rgba(227, 146, 12, 0.08)", border: "1px solid rgba(227, 146, 12, 0.25)", borderRadius: "20px", padding: "5px 12px" }}>
                                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#E3920C", boxShadow: "0 0 0 2px rgba(227,146,12,0.2)" }} />
                                    Non sauvegardé
                                </motion.div>
                            )}
                        </div>

                        <form onSubmit={handleSubmit} style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: "24px" }}>
                            <div style={sectionStyle}>
                                <div style={sectionHeaderStyle}><Server size={14} color="#003087" /><span>Connexion</span></div>
                                <div style={{ display: "flex", gap: "16px" }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle} htmlFor="host">Hôte</label>
                                        <input id="host" name="host" type="text" value={form.host} onChange={handleChange} placeholder="ex: localhost" disabled={isLoadingConfig} style={{ ...inputStyle, ...(touched.host ? inputFocusedStyle : {}), opacity: isLoadingConfig ? 0.7 : 1 }} />
                                    </div>
                                    <div style={{ width: "130px" }}>
                                        <label style={labelStyle} htmlFor="port">Port</label>
                                        <input id="port" name="port" type="number" value={form.port} onChange={handleChange} min={1} max={65535} disabled={isLoadingConfig} style={{ ...inputStyle, ...(touched.port ? inputFocusedStyle : {}), opacity: isLoadingConfig ? 0.7 : 1 }} />
                                    </div>
                                </div>
                                <div>
                                    <label style={labelStyle} htmlFor="db_name">Nom de la base</label>
                                    <input id="db_name" name="db_name" type="text" value={form.db_name} onChange={handleChange} placeholder="ex: production_db" disabled={isLoadingConfig} style={{ ...inputStyle, ...(touched.db_name ? inputFocusedStyle : {}), opacity: isLoadingConfig ? 0.7 : 1 }} />
                                </div>
                            </div>

                            <div style={sectionStyle}>
                                <div style={sectionHeaderStyle}><Lock size={14} color="#003087" /><span>Authentification</span></div>
                                <div style={{ display: "flex", gap: "16px" }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle} htmlFor="username">Utilisateur</label>
                                        <input id="username" name="username" type="text" value={form.username} onChange={handleChange} placeholder="Optionnel" disabled={isLoadingConfig} style={{ ...inputStyle, ...(touched.username ? inputFocusedStyle : {}), opacity: isLoadingConfig ? 0.7 : 1 }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle} htmlFor="password">Mot de passe</label>
                                        <div style={{ position: "relative" }}>
                                            <input id="password" name="password" type={showPassword ? "text" : "password"} value={form.password} onChange={handleChange} placeholder="Optionnel" disabled={isLoadingConfig} style={{ ...inputStyle, paddingRight: "44px", ...(touched.password ? inputFocusedStyle : {}), opacity: isLoadingConfig ? 0.7 : 1 }} />
                                            <button type="button" onClick={() => setShowPassword(p => !p)} disabled={isLoadingConfig}
                                                style={{ position: "absolute", right: "13px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: isLoadingConfig ? "not-allowed" : "pointer", color: "#6B7280", display: "flex", padding: "2px", opacity: isLoadingConfig ? 0.5 : 1 }}>
                                                {showPassword
                                                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                }
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={sectionStyle}>
                                <div style={sectionHeaderStyle}><FileText size={14} color="#003087" /><span>Traçabilité</span></div>
                                <div>
                                    <label style={labelStyle} htmlFor="change_reason">Raison de la modification</label>
                                    <textarea id="change_reason" name="change_reason" value={form.change_reason} onChange={handleChange} rows={3} placeholder="Décrivez la raison de ce changement..." disabled={isLoadingConfig}
                                        style={{ ...inputStyle, resize: "vertical", minHeight: "80px", lineHeight: "1.6", fontFamily: "Inter, sans-serif", ...(touched.change_reason ? inputFocusedStyle : {}), opacity: isLoadingConfig ? 0.7 : 1 }} />
                                </div>
                            </div>

                            {error && (
                                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                                    style={{ display: "flex", alignItems: "center", gap: "10px", padding: "13px 16px", background: "rgba(216, 23, 23, 0.06)", border: "1px solid rgba(216, 23, 23, 0.2)", borderRadius: "10px", color: "#D81717", fontSize: "13px", fontWeight: "500" }}>
                                    <AlertCircle size={16} style={{ flexShrink: 0 }} />{error}
                                </motion.div>
                            )}

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", paddingTop: "4px" }}>
                                <motion.button type="button" onClick={handleReset} disabled={loading || isLoadingConfig} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                    style={{ display: "flex", alignItems: "center", gap: "8px", padding: "11px 22px", background: "white", border: "1.5px solid rgba(0, 48, 135, 0.15)", borderRadius: "10px", color: "#242D45", fontSize: "14px", fontWeight: "600", cursor: (loading || isLoadingConfig) ? "not-allowed" : "pointer", opacity: (loading || isLoadingConfig) ? 0.5 : 1, fontFamily: "Inter, sans-serif" }}>
                                    <RotateCcw size={15} />Réinitialiser
                                </motion.button>
                                <motion.button type="submit" disabled={loading || isLoadingConfig}
                                    whileHover={{ scale: (loading || isLoadingConfig) ? 1 : 1.03 }} whileTap={{ scale: (loading || isLoadingConfig) ? 1 : 0.97 }}
                                    style={{ display: "flex", alignItems: "center", gap: "8px", padding: "11px 28px", background: saved ? "#5FCC80" : "linear-gradient(135deg, #003087, #1746D9)", border: "none", borderRadius: "10px", color: "white", fontSize: "14px", fontWeight: "700", cursor: (loading || isLoadingConfig) ? "not-allowed" : "pointer", opacity: (loading || isLoadingConfig) ? 0.85 : 1, fontFamily: "Inter, sans-serif", boxShadow: saved ? "0 4px 12px rgba(95, 204, 128, 0.35)" : "0 4px 12px rgba(0, 48, 135, 0.3)", transition: "background 0.25s, box-shadow 0.25s" }}>
                                    {loading
                                        ? <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ animation: "spin 0.8s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Sauvegarde...</>
                                        : saved ? <><CheckCircle size={15} />Sauvegardé</> : <><Save size={15} />Sauvegarder</>
                                    }
                                </motion.button>
                            </div>
                        </form>
                    </motion.div>

                    {/* ══ Card Outlook ══ */}
                    <OutlookAccountCard />
                </div>

                {/* Panneau info MongoDB sticky */}
                <DbInfoPanel form={form} token={token} isLoading={isLoadingConfig} />
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                input[type=number]::-webkit-outer-spin-button,
                input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
                input::placeholder, textarea::placeholder { color: #9CA3AF; }
                input:focus, textarea:focus {
                    outline: none;
                    border-color: #003087 !important;
                    box-shadow: 0 0 0 3px rgba(0, 48, 135, 0.1) !important;
                    background: white !important;
                }
                input:disabled, textarea:disabled {
                    background: rgba(229, 235, 249, 0.3);
                    cursor: not-allowed;
                }
            `}</style>
        </motion.div>
    );
}
