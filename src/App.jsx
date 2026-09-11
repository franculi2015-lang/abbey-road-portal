import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Music2,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCog,
  Users,
  X,
} from "lucide-react";
import {
  configureSupabase,
  normalizeUsername,
  roleLabel,
  supabase,
  usernameToEmail,
} from "./lib/portal-client";
import { api } from "./lib/api";

const fmtDate = (value) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const safeMessage = (error, fallback = "No pudimos completar la acción.") => {
  const message = String(error?.message || "");
  if (/duplicate|already|registered/i.test(message)) return "Ese usuario o registro ya existe.";
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "No se pudo conectar con el servidor. Revisá internet y recargá la página.";
  }
  return message || fallback;
};

function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      <span className="brand__mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span>
        <strong>ABBEY ROAD</strong>
        <small>ENGLISH PORTAL</small>
      </span>
    </div>
  );
}

function SetupScreen({ status, onRetry }) {
  const missing = status?.missing || [];
  return (
    <main className="setup-screen">
      <div className="setup-card">
        <Brand />
        <div className="setup-icon"><ShieldCheck /></div>
        <p className="eyebrow">Configuración inicial</p>
        <h1>{status?.title || "Estamos comprobando la conexión"}</h1>
        <p>{status?.error || "Esperá un momento mientras preparamos el portal."}</p>
        {status?.code === "missing_env" && (
          <>
            <p className="setup-label">Variables que faltan:</p>
            <ul className="setup-vars">
              {missing.map((name) => <li key={name}><code>{name}</code></li>)}
            </ul>
            <p className="setup-note">Cargalas en Netlify → Project configuration → Environment variables → Add a variable. Usá “All scopes” y “Same value for all deploy contexts”.</p>
          </>
        )}
        {status?.code === "schema_missing" && (
          <ol>
            <li>Abrí Supabase → <strong>SQL Editor</strong>.</li>
            <li>Creá una consulta y pegá <code>supabase/schema.sql</code> completo.</li>
            <li>Presioná <strong>Run</strong>. Al final debe aparecer <code>schema_version 2.0</code>.</li>
          </ol>
        )}
        {status?.code === "initial_password_missing" && (
          <p className="setup-note">Nombre: <code>INITIAL_SUPERVISOR_PASSWORD</code>. Valor inicial solicitado: <code>SupeX1234**</code>. Marcala como secreta.</p>
        )}
        <button className="primary-button setup-retry" type="button" onClick={onRetry}><RefreshCw /> Volver a comprobar</button>
        <p className="setup-note">No hace falta volver a construir el sitio después de cambiar estas variables: alcanza con recargar.</p>
      </div>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="loading-screen" aria-live="polite">
      <div className="loading-submarine">Yellow</div>
      <Brand />
      <p>Preparando tu aventura…</p>
    </main>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const enteredUsername = String(form.get("username") || "").trim();
    const username = normalizeUsername(enteredUsername);
    const password = String(form.get("password") || "");

    try {
      if (!enteredUsername.includes("@") && !/^[a-z0-9._-]{3,30}$/.test(username)) {
        throw new Error("El usuario debe tener entre 3 y 30 caracteres y usar letras, números, punto, guion o guion bajo.");
      }
      if (password.length < 10) throw new Error("La contraseña debe tener al menos 10 caracteres.");

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: usernameToEmail(enteredUsername),
          password,
        });
        if (error) {
          if (/invalid login credentials/i.test(error.message)) throw new Error("Usuario o contraseña incorrectos.");
          throw new Error("No pudimos iniciar sesión. Recargá la página y volvé a intentar.");
        }
      } else {
        const fullName = String(form.get("full_name") || "").trim();
        if (fullName.length < 2) throw new Error("Ingresá el nombre del alumno o responsable.");
        const result = await api("/api/register", {
          method: "POST",
          body: JSON.stringify({
            username,
            fullName,
            password,
            adultConsent: form.get("adult_consent") === "yes",
          }),
        });
        setMode("login");
        setMessage(result.message);
      }
    } catch (error) {
      setMessage(safeMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-art" aria-label="Bienvenida al portal de Abbey Road">
        <div className="auth-art__content">
          <Brand />
          <p className="eyebrow">Welcome aboard!</p>
          <h1>Tu aventura en inglés continúa acá.</h1>
          <p>Materiales, calificaciones y grupos en un espacio claro, cuidado y fácil de explorar.</p>
          <div className="word-orbit" aria-hidden="true">
            <span>Hello!</span><span>Learn</span><span>Play</span>
          </div>
        </div>
        <img src="/assets/journey-submarine.svg" alt="Submarino amarillo original con cuatro estudiantes músicos" />
        <div className="auth-wave" aria-hidden="true" />
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-mobile-brand"><Brand compact /></div>
          <p className="eyebrow">Portal educativo</p>
          <h2>{mode === "login" ? "¡Hola de nuevo!" : "Crear una cuenta"}</h2>
          <p className="muted">
            {mode === "login"
              ? "Ingresá con el usuario y la contraseña asignados."
              : "Todas las cuentas nuevas comienzan con el rol de alumno/a."}
          </p>

          <div className="auth-tabs" role="tablist" aria-label="Acceso al portal">
            <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setMessage(""); }} type="button">Ingresar</button>
            <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setMessage(""); }} type="button">Crear cuenta</button>
          </div>

          <form onSubmit={submit} className="stack-form">
            {mode === "register" && (
              <label>
                Nombre y apellido
                <input name="full_name" autoComplete="name" minLength="2" maxLength="80" required placeholder="Ej.: Martina López" />
              </label>
            )}
            <label>
              Usuario
              <input name="username" autoComplete="username" minLength="3" maxLength="30" required placeholder="Tu usuario" />
            </label>
            <label>
              Contraseña
              <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength="10" maxLength="128" required placeholder="Mínimo 10 caracteres" />
            </label>
            {mode === "register" && (
              <label className="consent-row">
                <input name="adult_consent" value="yes" type="checkbox" required />
                <span>Confirmo que la cuenta es creada con autorización de una persona adulta responsable.</span>
              </label>
            )}
            {message && <p className="form-message" role="status">{message}</p>}
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? <RefreshCw className="spin" /> : mode === "login" ? <ChevronRight /> : <Plus />}
              {busy ? "Procesando…" : mode === "login" ? "Entrar al portal" : "Crear mi cuenta"}
            </button>
          </form>
          <p className="privacy-copy"><ShieldCheck /> Tus datos están protegidos. Nunca mostramos las notas de otros alumnos.</p>
        </div>
      </section>
    </main>
  );
}

function StatCard({ icon: Icon, value, label, color }) {
  return (
    <article className="stat-card" style={{ "--stat-color": color }}>
      <span><Icon /></span>
      <strong>{value}</strong>
      <small>{label}</small>
    </article>
  );
}

function EmptyState({ icon: Icon = Sparkles, title, text }) {
  return (
    <div className="empty-state">
      <Icon />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function UserAdminCard({ user, currentUserId, onUpdate, onReset, onDelete }) {
  const [name, setName] = useState(user.full_name);
  const [password, setPassword] = useState("");
  const isSelf = user.id === currentUserId;

  return (
    <article className={`user-card ${!user.active ? "user-card--inactive" : ""}`}>
      <div className="user-avatar" aria-hidden="true">{user.full_name.slice(0, 1).toUpperCase()}</div>
      <div className="user-card__main">
        <div className="user-card__heading">
          <div><h3>{user.full_name}</h3><p>@{user.username}</p></div>
          <span className={`role-badge role-badge--${user.role}`}>{roleLabel(user.role)}</span>
        </div>
        <label className="inline-edit">
          <span>Nombre visible</span>
          <div><input value={name} onChange={(e) => setName(e.target.value)} maxLength="80" /><button type="button" onClick={() => onUpdate(user.id, { full_name: name.trim() })}>Guardar</button></div>
        </label>
        <p className="storage-path">{user.storage_path}</p>
        <div className="user-actions">
          {user.role === "alumno" && <button type="button" onClick={() => onUpdate(user.id, { role: "profesor" })}><GraduationCap /> Asumir a Profesor</button>}
          {user.role === "profesor" && <button type="button" onClick={() => onUpdate(user.id, { role: "alumno" })}><BookOpen /> Pasar a alumno</button>}
          {!isSelf && user.role !== "supervisor" && <button type="button" onClick={() => onUpdate(user.id, { role: "supervisor" })}><ShieldCheck /> Hacer Supervisor</button>}
          {!isSelf && user.role === "supervisor" && <button type="button" onClick={() => onUpdate(user.id, { role: "alumno" })}><BookOpen /> Pasar a alumno</button>}
          {!isSelf && <button className={user.active ? "danger-button" : "success-button"} type="button" onClick={() => onUpdate(user.id, { active: !user.active })}>{user.active ? "Expulsar" : "Reactivar"}</button>}
        </div>
        {!isSelf && (
          <details className="reset-access">
            <summary>Restablecer contraseña</summary>
            <form onSubmit={(event) => { event.preventDefault(); onReset(user.id, password); setPassword(""); }}>
              <input type="password" value={password} minLength="10" maxLength="128" required onChange={(e) => setPassword(e.target.value)} placeholder="Nueva contraseña" />
              <button type="submit">Actualizar</button>
            </form>
          </details>
        )}
        {!isSelf && (
          <button className="delete-account-button" type="button" onClick={() => onDelete(user)}>
            <Trash2 /> Eliminar cuenta definitivamente
          </button>
        )}
      </div>
    </article>
  );
}

function SupervisorPanel({ users, session, profile, refresh, notify }) {
  const [creating, setCreating] = useState(false);

  async function adminRequest(payload) {
    return api("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(payload),
    });
  }

  async function createUser(event) {
    event.preventDefault();
    setCreating(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await adminRequest({ action: "create", username: form.get("username"), fullName: form.get("full_name"), password: form.get("password") });
      formElement.reset();
      notify("Cuenta creada como alumno/a.", "success");
      await refresh();
    } catch (error) {
      notify(safeMessage(error), "error");
    } finally { setCreating(false); }
  }

  async function updateUser(id, patch) {
    try {
      await adminRequest({
        action: "update-profile",
        userId: id,
        ...(Object.hasOwn(patch, "full_name") ? { fullName: patch.full_name } : {}),
        ...(Object.hasOwn(patch, "role") ? { role: patch.role } : {}),
        ...(Object.hasOwn(patch, "active") ? { active: patch.active } : {}),
      });
      notify("Perfil actualizado.", "success");
      await refresh();
    } catch (error) { notify(safeMessage(error), "error"); }
  }

  async function resetPassword(id, password) {
    try {
      await adminRequest({ action: "reset-password", userId: id, password });
      notify("Contraseña restablecida.", "success");
    } catch (error) { notify(safeMessage(error), "error"); }
  }

  async function deleteUser(user) {
    if (!window.confirm(`¿Eliminar definitivamente la cuenta de ${user.full_name}? Esta acción no se puede deshacer.`)) return;
    try {
      await adminRequest({ action: "delete", userId: user.id });
      notify("Cuenta eliminada definitivamente.", "success");
      await refresh();
    } catch (error) { notify(safeMessage(error), "error"); }
  }

  return (
    <div className="panel-grid panel-grid--admin">
      <section className="panel-card sticky-form-card">
        <div className="panel-title"><span><UserCog /></span><div><p className="eyebrow">Control de acceso</p><h2>Crear una cuenta</h2></div></div>
        <p className="muted">Por seguridad, todo perfil nuevo comienza como alumno/a. Después podés asignarlo como profesor.</p>
        <form className="stack-form compact-form" onSubmit={createUser}>
          <label>Nombre y apellido<input name="full_name" required minLength="2" maxLength="80" /></label>
          <label>Usuario<input name="username" required minLength="3" maxLength="30" /></label>
          <label>Contraseña temporal<input name="password" type="password" required minLength="10" maxLength="128" /></label>
          <button className="primary-button" disabled={creating} type="submit"><Plus /> {creating ? "Creando…" : "Crear perfil"}</button>
        </form>
      </section>
      <section className="users-section">
        <div className="section-heading"><div><p className="eyebrow">Usuarios</p><h2>Perfiles y permisos</h2></div><span>{users.length} cuentas</span></div>
        <div className="users-list">
          {users.map((user) => <UserAdminCard key={user.id} user={user} currentUserId={profile.id} onUpdate={updateUser} onReset={resetPassword} onDelete={deleteUser} />)}
        </div>
      </section>
    </div>
  );
}

function MaterialsPanel({ profile, groups, materials, refresh, notify }) {
  const canTeach = profile.role !== "alumno";
  async function createMaterial(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const url = String(form.get("resource_url") || "").trim();
      const { error } = await supabase.from("materials").insert({
        group_id: form.get("group_id"), author_id: profile.id,
        title: String(form.get("title") || "").trim(), content: String(form.get("content") || "").trim(),
        resource_url: url || null,
      });
      if (error) throw error;
      formElement.reset();
      notify("Material publicado.", "success");
      await refresh();
    } catch (error) { notify(safeMessage(error), "error"); }
  }

  async function deleteMaterial(id) {
    if (!window.confirm("¿Eliminar este material? Esta acción no se puede deshacer.")) return;
    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) notify(safeMessage(error), "error");
    else { notify("Material eliminado.", "success"); await refresh(); }
  }

  return (
    <div className={canTeach ? "panel-grid" : ""}>
      {canTeach && (
        <section className="panel-card sticky-form-card">
          <div className="panel-title"><span><BookOpen /></span><div><p className="eyebrow">Biblioteca</p><h2>Agregar material</h2></div></div>
          <form className="stack-form compact-form" onSubmit={createMaterial}>
            <label>Grupo<select name="group_id" required defaultValue=""><option value="" disabled>Elegir grupo</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
            <label>Título<input name="title" required minLength="2" maxLength="120" /></label>
            <label>Contenido o indicaciones<textarea name="content" rows="4" maxLength="5000" /></label>
            <label>Enlace opcional<input name="resource_url" type="url" placeholder="https://…" /></label>
            <button className="primary-button" type="submit"><Plus /> Publicar material</button>
          </form>
        </section>
      )}
      <section className="content-section">
        <div className="section-heading"><div><p className="eyebrow">Discover</p><h2>Material de estudio</h2></div><span>{materials.length} recursos</span></div>
        {materials.length === 0 ? <EmptyState icon={BookOpen} title="Todavía no hay material" text={canTeach ? "Publicá el primer recurso para un grupo." : "Cuando un profesor publique material, aparecerá acá."} /> : (
          <div className="resource-grid">{materials.map((item) => {
            const group = groups.find((g) => g.id === item.group_id);
            const canDelete = profile.role === "supervisor" || item.author_id === profile.id;
            return <article className="resource-card" key={item.id}><span className="resource-card__icon"><BookOpen /></span><small>{group?.name || "Grupo"}</small><h3>{item.title}</h3><p>{item.content || "Material compartido por el profesor."}</p><footer><time>{fmtDate(item.created_at)}</time><span className="card-actions">{item.resource_url && <a href={item.resource_url} target="_blank" rel="noreferrer">Abrir recurso <ChevronRight /></a>}{canDelete && <button type="button" className="icon-danger" onClick={() => deleteMaterial(item.id)} aria-label={`Eliminar ${item.title}`}><Trash2 /></button>}</span></footer></article>;
          })}</div>
        )}
      </section>
    </div>
  );
}

function GradesPanel({ profile, groups, users, members, grades, refresh, notify }) {
  const canTeach = profile.role !== "alumno";
  const [groupId, setGroupId] = useState(groups[0]?.id || "");
  useEffect(() => { if (!groupId && groups[0]) setGroupId(groups[0].id); }, [groups, groupId]);
  const studentIds = members.filter((m) => m.group_id === groupId).map((m) => m.user_id);
  const students = users.filter((u) => studentIds.includes(u.id) && u.role === "alumno" && u.active);

  async function createGrade(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const { error } = await supabase.from("grades").insert({
        group_id: form.get("group_id"), student_id: form.get("student_id"), teacher_id: profile.id,
        title: String(form.get("title") || "").trim(), score: Number(form.get("score")),
        max_score: Number(form.get("max_score")), feedback: String(form.get("feedback") || "").trim(),
      });
      if (error) throw error;
      formElement.reset();
      notify("Calificación guardada.", "success");
      await refresh();
    } catch (error) { notify(safeMessage(error), "error"); }
  }

  async function deleteGrade(id) {
    if (!window.confirm("¿Eliminar esta calificación? Esta acción no se puede deshacer.")) return;
    const { error } = await supabase.from("grades").delete().eq("id", id);
    if (error) notify(safeMessage(error), "error");
    else { notify("Calificación eliminada.", "success"); await refresh(); }
  }

  return (
    <div className={canTeach ? "panel-grid" : ""}>
      {canTeach && (
        <section className="panel-card sticky-form-card">
          <div className="panel-title"><span><Award /></span><div><p className="eyebrow">Seguimiento</p><h2>Agregar una nota</h2></div></div>
          <form className="stack-form compact-form" onSubmit={createGrade}>
            <label>Grupo<select name="group_id" required value={groupId} onChange={(e) => setGroupId(e.target.value)}><option value="">Elegir grupo</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
            <label>Alumno/a<select name="student_id" required defaultValue=""><option value="" disabled>Elegir alumno</option>{students.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label>
            <label>Actividad<input name="title" required minLength="2" maxLength="120" /></label>
            <div className="two-fields"><label>Nota<input name="score" type="number" min="0" step="0.01" required /></label><label>Sobre<input name="max_score" type="number" min="1" step="0.01" defaultValue="10" required /></label></div>
            <label>Devolución<textarea name="feedback" rows="3" maxLength="1500" /></label>
            <button className="primary-button" type="submit"><Plus /> Guardar nota</button>
          </form>
        </section>
      )}
      <section className="content-section">
        <div className="section-heading"><div><p className="eyebrow">Great job!</p><h2>{profile.role === "alumno" ? "Mis calificaciones" : "Calificaciones cargadas"}</h2></div><span>{grades.length} notas</span></div>
        {grades.length === 0 ? <EmptyState icon={Award} title="Todavía no hay calificaciones" text={profile.role === "alumno" ? "Tus notas personales aparecerán únicamente en esta pantalla." : "Cargá una nota seleccionando un grupo y un alumno."} /> : (
          <div className="grades-list">{grades.map((grade) => {
            const student = users.find((u) => u.id === grade.student_id);
            return <article className="grade-card" key={grade.id}><div className="grade-score"><strong>{Number(grade.score).toLocaleString("es-AR")}</strong><small>/ {Number(grade.max_score).toLocaleString("es-AR")}</small></div><div className="grade-card__content"><small>{profile.role === "alumno" ? "Tu resultado" : student?.full_name || "Alumno/a"}</small><h3>{grade.title}</h3><p>{grade.feedback || "Sin devolución escrita."}</p><time>{fmtDate(grade.created_at)}</time>{canTeach && <button type="button" className="text-danger" onClick={() => deleteGrade(grade.id)}><Trash2 /> Eliminar</button>}</div></article>;
          })}</div>
        )}
      </section>
    </div>
  );
}

function GroupsPanel({ profile, groups, users, members, refresh, notify }) {
  const canTeach = profile.role !== "alumno";
  const [selectedGroup, setSelectedGroup] = useState(groups[0]?.id || "");
  const [messages, setMessages] = useState([]);
  const chatEnd = useRef(null);

  useEffect(() => { if (!selectedGroup && groups[0]) setSelectedGroup(groups[0].id); }, [groups, selectedGroup]);

  useEffect(() => {
    if (!selectedGroup) { setMessages([]); return undefined; }
    let active = true;
    supabase.from("messages").select("*").eq("group_id", selectedGroup).order("created_at", { ascending: true }).limit(200)
      .then(({ data, error }) => { if (active && !error) setMessages(data || []); });
    const channel = supabase.channel(`group-chat-${selectedGroup}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${selectedGroup}` }, (payload) => {
        setMessages((current) => current.some((m) => m.id === payload.new.id) ? current : [...current, payload.new]);
      }).subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [selectedGroup]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function createGroup(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const teacherId = profile.role === "supervisor" ? form.get("teacher_id") || profile.id : profile.id;
      const { data: group, error } = await supabase.from("groups").insert({ name: String(form.get("name") || "").trim(), description: String(form.get("description") || "").trim(), teacher_id: teacherId }).select().single();
      if (error) throw error;
      const studentIds = form.getAll("students");
      if (studentIds.length) {
        const { error: membersError } = await supabase.from("group_members").insert(studentIds.map((id) => ({ group_id: group.id, user_id: id })));
        if (membersError) throw membersError;
      }
      formElement.reset();
      notify("Grupo creado.", "success");
      await refresh();
      setSelectedGroup(group.id);
    } catch (error) { notify(safeMessage(error), "error"); }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = String(form.get("body") || "").trim();
    if (!body || !selectedGroup) return;
    const { error } = await supabase.from("messages").insert({ group_id: selectedGroup, sender_id: profile.id, body });
    if (error) notify(safeMessage(error), "error"); else formElement.reset();
  }

  async function deleteGroup() {
    if (!activeGroup || !window.confirm(`¿Eliminar el grupo “${activeGroup.name}”? También se eliminarán sus materiales y mensajes.`)) return;
    const { error } = await supabase.from("groups").delete().eq("id", activeGroup.id);
    if (error) notify(safeMessage(error), "error");
    else {
      setSelectedGroup("");
      notify("Grupo eliminado.", "success");
      await refresh();
    }
  }

  async function deleteMessage(id) {
    if (!window.confirm("¿Eliminar este mensaje del grupo?")) return;
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) notify(safeMessage(error), "error");
    else setMessages((current) => current.filter((message) => message.id !== id));
  }

  const students = users.filter((u) => u.role === "alumno" && u.active);
  const teachers = users.filter((u) => u.role === "profesor" && u.active);
  const activeGroup = groups.find((g) => g.id === selectedGroup);

  return (
    <div className="groups-layout">
      {canTeach && (
        <section className="panel-card group-create-card">
          <div className="panel-title"><span><Users /></span><div><p className="eyebrow">Comunidades</p><h2>Crear grupo</h2></div></div>
          <form className="stack-form compact-form" onSubmit={createGroup}>
            <label>Nombre del grupo<input name="name" required minLength="2" maxLength="80" /></label>
            <label>Descripción<textarea name="description" rows="2" maxLength="500" /></label>
            {profile.role === "supervisor" && <label>Profesor responsable<select name="teacher_id" defaultValue={profile.id}><option value={profile.id}>Supervisor</option>{teachers.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label>}
            <fieldset className="student-picker"><legend>Alumnos del grupo</legend>{students.length === 0 ? <p>No hay alumnos activos.</p> : students.map((u) => <label key={u.id}><input name="students" type="checkbox" value={u.id} /><span>{u.full_name}</span></label>)}</fieldset>
            <button className="primary-button" type="submit"><Plus /> Crear grupo y chat</button>
          </form>
        </section>
      )}

      <section className="chat-shell">
        <aside className="group-list">
          <div><p className="eyebrow">Mis grupos</p><h2>Chats</h2></div>
          {groups.length === 0 ? <p className="muted">Todavía no hay grupos.</p> : groups.map((group) => {
            const count = members.filter((m) => m.group_id === group.id).length;
            return <button className={selectedGroup === group.id ? "active" : ""} type="button" key={group.id} onClick={() => setSelectedGroup(group.id)}><span><MessageCircle /></span><div><strong>{group.name}</strong><small>{count} alumno{count === 1 ? "" : "s"}</small></div><ChevronRight /></button>;
          })}
        </aside>
        <div className="chat-panel">
          {!activeGroup ? <EmptyState icon={MessageCircle} title="Elegí un grupo" text="Seleccioná un grupo para abrir su conversación." /> : <>
            <header><div><h3>{activeGroup.name}</h3><p>{activeGroup.description || "Espacio de conversación del grupo."}</p></div><div className="chat-header-actions"><span><Users /> {members.filter((m) => m.group_id === activeGroup.id).length + 1}</span>{canTeach && <button type="button" onClick={deleteGroup} aria-label={`Eliminar grupo ${activeGroup.name}`}><Trash2 /></button>}</div></header>
            <div className="messages" aria-live="polite">{messages.length === 0 ? <div className="chat-empty"><Music2 /><p>¡Que empiece la conversación!</p></div> : messages.map((message) => {
              const sender = users.find((u) => u.id === message.sender_id);
              const own = message.sender_id === profile.id;
              return <article className={own ? "message message--own" : "message"} key={message.id}><small>{own ? "Vos" : sender?.full_name || "Integrante"}</small><p>{message.body}</p><footer><time>{fmtDate(message.created_at)}</time>{canTeach && <button type="button" onClick={() => deleteMessage(message.id)} aria-label="Eliminar mensaje"><Trash2 /></button>}</footer></article>;
            })}<div ref={chatEnd} /></div>
            <form className="chat-form" onSubmit={sendMessage}><label className="sr-only" htmlFor="chat-body">Escribir mensaje</label><input id="chat-body" name="body" maxLength="1000" required autoComplete="off" placeholder="Escribí un mensaje…" /><button type="submit" aria-label="Enviar mensaje"><Send /></button></form>
          </>}
        </div>
      </section>
    </div>
  );
}

function HomePanel({ profile, groups, materials, grades, users, setPanel }) {
  const isStudent = profile.role === "alumno";
  return (
    <div className="home-panel">
      <section className="welcome-banner">
        <div><p className="eyebrow">Hello, {profile.full_name.split(" ")[0]}!</p><h1>{isStudent ? "¿Listo para seguir aprendiendo?" : "Tu portal está listo para enseñar y acompañar."}</h1><p>{isStudent ? "Encontrá tus materiales, notas y conversaciones en un solo lugar." : "Organizá grupos, compartí recursos y acompañá el progreso de cada alumno."}</p></div>
        <img src="/assets/journey-submarine.svg" alt="" />
      </section>
      <div className="stats-grid">
        <StatCard icon={Users} value={groups.length} label="grupos" color="#ffcc20" />
        <StatCard icon={BookOpen} value={materials.length} label="materiales" color="#42c7c7" />
        <StatCard icon={Award} value={grades.length} label={isStudent ? "mis notas" : "notas cargadas"} color="#ff6b5f" />
        {profile.role === "supervisor" && <StatCard icon={UserCog} value={users.length} label="usuarios" color="#87d65b" />}
      </div>
      <section className="quick-actions">
        <div className="section-heading"><div><p className="eyebrow">Let’s learn</p><h2>Accesos rápidos</h2></div></div>
        <div className="action-grid">
          <button onClick={() => setPanel("materiales")}><span><BookOpen /></span><div><h3>Materiales</h3><p>Recursos compartidos para tus grupos.</p></div><ChevronRight /></button>
          <button onClick={() => setPanel("notas")}><span><Award /></span><div><h3>Calificaciones</h3><p>{isStudent ? "Consultá únicamente tus resultados." : "Cargá y revisá devoluciones."}</p></div><ChevronRight /></button>
          <button onClick={() => setPanel("grupos")}><span><MessageCircle /></span><div><h3>Grupos y chat</h3><p>Conversá dentro de tu comunidad.</p></div><ChevronRight /></button>
          {profile.role === "supervisor" && <button onClick={() => setPanel("usuarios")}><span><ShieldCheck /></span><div><h3>Administrar usuarios</h3><p>Roles, perfiles y accesos.</p></div><ChevronRight /></button>}
        </div>
      </section>
    </div>
  );
}

function ChangePassword({ notify, session, force = false }) {
  const [open, setOpen] = useState(force);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const password = String(form.get("new_password") || "");
    const confirmation = String(form.get("confirm_password") || "");

    if (password.length < 10) {
      notify("La nueva contraseña debe tener al menos 10 caracteres.", "error");
      return;
    }
    if (password !== confirmation) {
      notify("Las contraseñas no coinciden.", "error");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      notify(safeMessage(error), "error");
      return;
    }
    try {
      await api("/api/account", {
        method: "POST",
        headers: { authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "password-changed" }),
      });
    } catch {
      // La contraseña ya fue actualizada en Supabase. El aviso se reintentará después.
    }
    formElement.reset();
    setOpen(false);
    notify("Tu contraseña fue actualizada.", "success");
  }

  return (
    <div className="password-menu">
      <button type="button" className="password-menu__toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <ShieldCheck /> Cambiar mi clave
      </button>
      {open && (
        <form onSubmit={submit} className="password-menu__form">
          {force && <p className="password-required">Por seguridad, cambiá la clave inicial antes de continuar.</p>}
          <label>Nueva clave<input name="new_password" type="password" minLength="10" maxLength="128" autoComplete="new-password" required /></label>
          <label>Repetir clave<input name="confirm_password" type="password" minLength="10" maxLength="128" autoComplete="new-password" required /></label>
          <button type="submit" disabled={busy}>{busy ? "Guardando…" : "Actualizar clave"}</button>
        </form>
      )}
    </div>
  );
}

function PortalShell({ session, profile }) {
  const [panel, setPanel] = useState("inicio");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [grades, setGrades] = useState([]);
  const [toast, setToast] = useState(null);

  const notify = useCallback((text, type = "success") => {
    setToast({ text, type });
    window.setTimeout(() => setToast(null), 3800);
  }, []);

  const refresh = useCallback(async () => {
    const [usersResult, groupsResult, membersResult, materialsResult, gradesResult] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("groups").select("*").order("created_at", { ascending: false }),
      supabase.from("group_members").select("*"),
      supabase.from("materials").select("*").order("created_at", { ascending: false }),
      supabase.from("grades").select("*").order("created_at", { ascending: false }),
    ]);
    const firstError = [usersResult, groupsResult, membersResult, materialsResult, gradesResult].find((item) => item.error)?.error;
    if (firstError) throw firstError;
    setUsers(usersResult.data || []); setGroups(groupsResult.data || []); setMembers(membersResult.data || []);
    setMaterials(materialsResult.data || []); setGrades(gradesResult.data || []);
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh().catch((error) => notify(safeMessage(error), "error")).finally(() => setLoading(false));
  }, [refresh, notify]);

  const nav = useMemo(() => [
    { id: "inicio", label: "Inicio", icon: LayoutDashboard },
    { id: "materiales", label: "Materiales", icon: BookOpen },
    { id: "notas", label: profile.role === "alumno" ? "Mis notas" : "Calificaciones", icon: Award },
    { id: "grupos", label: "Grupos y chat", icon: MessageCircle },
    ...(profile.role === "supervisor" ? [{ id: "usuarios", label: "Usuarios", icon: UserCog }] : []),
  ], [profile.role]);

  async function logout() { await supabase.auth.signOut(); }
  function choosePanel(id) { setPanel(id); setMobileOpen(false); }

  return (
    <div className="portal-shell">
      <button className="mobile-nav-button" onClick={() => setMobileOpen(true)} aria-label="Abrir menú"><Menu /></button>
      {mobileOpen && <button className="nav-backdrop" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" />}
      <aside className={`sidebar ${mobileOpen ? "sidebar--open" : ""}`}>
        <button className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú"><X /></button>
        <Brand compact />
        <div className="profile-mini"><div>{profile.full_name.slice(0, 1).toUpperCase()}</div><span><strong>{profile.full_name}</strong><small>{roleLabel(profile.role)}</small></span></div>
        <nav aria-label="Secciones del portal">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={panel === id ? "active" : ""} onClick={() => choosePanel(id)}><Icon /> {label}</button>)}</nav>
        <div className="sidebar-journey"><Sparkles /><p>Every day is a new adventure!</p></div>
        <ChangePassword notify={notify} session={session} force={profile.must_change_password} />
        <button className="logout-button" onClick={logout}><LogOut /> Cerrar sesión</button>
      </aside>

      <main className="portal-main">
        <header className="portal-topbar"><div><small>ABBEY ROAD · ROSARIO</small><strong>{nav.find((item) => item.id === panel)?.label}</strong></div><span className={`role-badge role-badge--${profile.role}`}>{roleLabel(profile.role)}</span></header>
        {loading ? <div className="panel-loader"><RefreshCw className="spin" /><p>Buscando novedades…</p></div> : (
          <div className="portal-content">
            {panel === "inicio" && <HomePanel profile={profile} groups={groups} materials={materials} grades={grades} users={users} setPanel={setPanel} />}
            {panel === "materiales" && <MaterialsPanel profile={profile} groups={groups} materials={materials} refresh={refresh} notify={notify} />}
            {panel === "notas" && <GradesPanel profile={profile} groups={groups} users={users} members={members} grades={grades} refresh={refresh} notify={notify} />}
            {panel === "grupos" && <GroupsPanel profile={profile} groups={groups} users={users} members={members} refresh={refresh} notify={notify} />}
            {panel === "usuarios" && profile.role === "supervisor" && <SupervisorPanel users={users} session={session} profile={profile} refresh={refresh} notify={notify} />}
          </div>
        )}
      </main>
      {toast && <div className={`toast toast--${toast.type}`} role="status">{toast.type === "success" ? <CheckCircle2 /> : <X />}{toast.text}</div>}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [booting, setBooting] = useState(true);
  const [authError, setAuthError] = useState("");
  const [setupStatus, setSetupStatus] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    let subscription;
    setBooting(true);
    setSetupStatus(null);

    async function initialize() {
      try {
        const status = await api("/api/setup-status");
        if (!active) return;
        if (!status.ready) {
          setSetupStatus(status);
          setBooting(false);
          return;
        }

        const config = await api("/api/config");
        if (!active) return;
        const client = configureSupabase(config);
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (!active) return;
        setSession(data.session);
        subscription = client.auth.onAuthStateChange((_event, nextSession) => {
          if (!active) return;
          setSession(nextSession);
          if (!nextSession) setProfile(null);
        }).data.subscription;
        setBooting(false);
      } catch (error) {
        if (!active) return;
        setSetupStatus({
          ready: false,
          code: error.code || "connection_error",
          title: "No pudimos conectar el portal",
          error: safeMessage(error),
          missing: error.details?.missing || [],
        });
        setBooting(false);
      }
    }

    initialize();
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [retryKey]);

  useEffect(() => {
    if (!session?.user) { setProfile(null); return; }
    let active = true;
    setBooting(true);
    supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle().then(async ({ data, error }) => {
      if (!active) return;
      if (error || !data) { setAuthError("No encontramos el perfil asociado a esta cuenta."); await supabase.auth.signOut(); }
      else if (!data.active) { setAuthError("Esta cuenta fue desactivada. Consultá con el instituto."); await supabase.auth.signOut(); }
      else { setAuthError(""); setProfile(data); }
    }).finally(() => { if (active) setBooting(false); });
    return () => { active = false; };
  }, [session?.user?.id]);

  if (booting) return <LoadingScreen />;
  if (setupStatus && !setupStatus.ready) return <SetupScreen status={setupStatus} onRetry={() => setRetryKey((value) => value + 1)} />;
  if (!session || !profile) return <><AuthScreen />{authError && <div className="global-alert" role="alert">{authError}</div>}</>;
  return <PortalShell session={session} profile={profile} />;
}
