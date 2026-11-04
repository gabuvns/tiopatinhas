import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  firebaseConfigured,
  observeAccount,
  loginGoogle,
  logoutGoogle,
  uploadCloudBackup,
  listCloudBackups,
  downloadCloudBackup,
  type CloudBackupItem,
} from "../../infrastructure/cloudBackup";
import { createExportSnapshot, type AppData } from "../../infrastructure/store";

export default function CloudBackupPanel({
  data,
  demo,
  readable,
  onClose,
  onPreview,
  onSaved,
}: {
  data: AppData;
  demo: boolean;
  readable: boolean;
  onClose: () => void;
  onPreview: (data: AppData) => void;
  onSaved: (data: AppData) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [backups, setBackups] = useState<CloudBackupItem[]>([]);
  const lock = useRef(false),
    account = useRef<string | null>(null);
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);
  useEffect(() => {
    if (!firebaseConfigured) return;
    return observeAccount((next) => {
      account.current = next?.uid ?? null;
      setUser(next);
      setBackups([]);
      setNotice("");
    });
  }, []);
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (cause) {
      const code = (cause as { code?: string })?.code;
      setNotice(
        code?.startsWith("auth/")
          ? "Não foi possível entrar. Confira os domínios autorizados, o login Google e se o popup foi bloqueado."
          : code === "permission-denied"
            ? "Acesso negado. Confira as regras do Firestore para esta conta."
            : cause instanceof Error
              ? cause.message
              : "Não foi possível concluir a operação.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="cloud-dialog"
      aria-labelledby="cloud-title"
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClose={onClose}
    >
      <div className="panel-heading">
        <h2 id="cloud-title">Conta e backup na nuvem</h2>
        <button
          className="button button-outline"
          onClick={onClose}
          disabled={busy}
        >
          Fechar
        </button>
      </div>
      {!firebaseConfigured ? (
        <div>
          <p>O login Google ainda não está ativado neste ambiente.</p>
          <p>
            O administrador precisa criar um projeto Firebase, habilitar Google
            Authentication e Cloud Firestore, publicar as regras e configurar as
            quatro variáveis públicas do app.
          </p>
          <a
            href="https://github.com/gabuvns/tiopatinhas/blob/main/docs/FIREBASE.md"
            target="_blank"
            rel="noreferrer"
          >
            Ver instruções de configuração
          </a>
        </div>
      ) : (
        <>
          {user ? (
            <>
              <p>
                Conta para backups:{" "}
                <strong>{user.email ?? user.displayName ?? "Google"}</strong>
              </p>
              <p>
                Entrar não substitui os dados deste navegador. Confira a conta e
                os lançamentos antes de enviar um backup. A restauração passa
                por uma prévia.
              </p>
              {demo && (
                <p role="status">
                  Você está na demonstração. Saia dela para enviar dados à
                  nuvem.
                </p>
              )}
              {!readable && (
                <p role="alert">
                  O histórico local não pôde ser lido. Restaure um backup válido
                  antes de enviar dados à nuvem.
                </p>
              )}
              <div className="cloud-actions">
                <button
                  className="button button-primary"
                  disabled={busy || demo || !readable}
                  onClick={() =>
                    run(async () => {
                      const uid = user.uid,
                        exported = createExportSnapshot(data);
                      await uploadCloudBackup(exported, uid);
                      if (account.current !== uid) return;
                      onSaved(exported);
                      setNotice(
                        "Backup confirmado na nuvem. O snapshot foi adicionado ao histórico local.",
                      );
                    })
                  }
                >
                  {busy ? "Aguarde…" : "Salvar backup desta conta"}
                </button>
                <button
                  className="button button-outline"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const uid = user.uid,
                        result = await listCloudBackups(uid);
                      if (account.current === uid) {
                        setBackups(result);
                        setNotice(
                          result.length
                            ? "Últimos backups desta conta carregados."
                            : "Esta conta ainda não tem backups.",
                        );
                      }
                    })
                  }
                >
                  Consultar meus backups
                </button>
                <button
                  className="button button-quiet"
                  disabled={busy}
                  onClick={() => run(logoutGoogle)}
                >
                  Sair da conta Google
                </button>
              </div>
              <ul className="cloud-backups">
                {backups.map((backup) => (
                  <li key={backup.id}>
                    <span>
                      {backup.date} · {backup.eventCount} eventos
                    </span>
                    <button
                      className="button button-outline"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const uid = user.uid,
                            result = await downloadCloudBackup(uid, backup.id);
                          if (account.current === uid) {
                            onPreview(result);
                            onClose();
                          }
                        })
                      }
                    >
                      Revisar restauração
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p>
                Entre com Google para guardar e recuperar backups privados desta
                conta. Nada é enviado automaticamente.
              </p>
              <button
                className="button button-primary"
                disabled={busy}
                onClick={() => run(loginGoogle)}
              >
                Entrar com Google
              </button>
            </>
          )}
        </>
      )}
      <p className="cloud-notice" role="status">
        {notice}
      </p>
      <p className="muted">
        A conta controla os backups remotos. Dados locais continuam neste
        navegador após sair do Google. Cada backup remoto tem limite de 900 KB;
        a exportação JSON continua disponível.
      </p>
    </dialog>
  );
}
