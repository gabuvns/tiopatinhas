import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Check, Copy, FileSpreadsheet, X } from "lucide-react";
import prompt from "../../../docs/CONVERSION_PROMPT.md?raw";
import "./import-guide.css";

export default function ImportGuide({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const promptField = useRef<HTMLTextAreaElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const headingId = useId(),
    descriptionId = useId(),
    promptId = useId();
  const [showPrompt, setShowPrompt] = useState(false);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const current = dialog.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const menuTrigger = document.querySelector<HTMLElement>(
      ".header-menu > summary",
    );
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    current?.showModal();
    closeButton.current?.focus();
    return () => {
      current?.close();
      document.body.style.overflow = oldOverflow;
      if (previousFocus?.isConnected && previousFocus.getClientRects().length)
        previousFocus.focus();
      else menuTrigger?.focus();
    };
  }, []);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setNotice("Prompt copiado. Cole na sua IA junto do arquivo Excel.");
    } catch {
      setCopied(false);
      setShowPrompt(true);
      setNotice(
        "A cópia automática não está disponível. O prompt foi selecionado abaixo: use Ctrl+C ou ⌘C.",
      );
      window.requestAnimationFrame(() => {
        promptField.current?.focus();
        promptField.current?.select();
      });
    }
  }

  return (
    <dialog
      ref={dialog}
      className="conversion-dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const focusable = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex='0']",
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <header className="conversion-heading">
        <div>
          <span className="conversion-kicker">
            <FileSpreadsheet size={17} aria-hidden="true" /> Importar do Excel
          </span>
          <h2 id={headingId}>Da sua planilha para o TioPatinhas</h2>
        </div>
        <button
          ref={closeButton}
          type="button"
          className="conversion-close"
          onClick={onClose}
          aria-label="Fechar guia de conversão"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <div className="conversion-body">
        <p id={descriptionId} className="conversion-intro">
          Use o prompt de conversão em uma IA de sua escolha para transformar o
          arquivo Excel em um JSON compatível. Depois, revise os dados antes de
          importar.
        </p>
        <ol className="conversion-steps">
          <li>
            <span className="conversion-step-number" aria-hidden="true">
              1
            </span>
            <div>
              <h3>Leve a planilha e o prompt à sua IA</h3>
              <p>
                Copie o prompt abaixo, abra uma conversa e anexe o arquivo .xlsx
                completo. Informe quais abas usar e a data de referência da
                carteira.
              </p>
            </div>
          </li>
          <li>
            <span className="conversion-step-number" aria-hidden="true">
              2
            </span>
            <div>
              <h3>Confira o resultado da conversão</h3>
              <p>
                Peça o arquivo JSON e o relatório de conferência. Revise os
                totais, as abas excluídas, as moedas e os dados ausentes.
                Aportes, compras e posições iniciais precisam estar separados
                para evitar dupla contagem.
              </p>
            </div>
          </li>
          <li>
            <span className="conversion-step-number" aria-hidden="true">
              3
            </span>
            <div>
              <h3>Importe e revise a prévia</h3>
              <p>
                Escolha o JSON no TioPatinhas. Confira a prévia antes de
                confirmar a substituição do histórico local. Exporte um backup
                dos seus dados atuais antes de restaurar.
              </p>
            </div>
          </li>
        </ol>
        <div className="conversion-prompt-actions">
          <button
            type="button"
            className="conversion-copy"
            onClick={copyPrompt}
          >
            {copied ? (
              <Check size={17} aria-hidden="true" />
            ) : (
              <Copy size={17} aria-hidden="true" />
            )}
            {copied ? "Copiar prompt novamente" : "Copiar prompt de conversão"}
          </button>
          <button
            type="button"
            className="conversion-preview"
            aria-expanded={showPrompt}
            aria-controls={promptId}
            onClick={() => setShowPrompt((value) => !value)}
          >
            {showPrompt ? "Ocultar prompt" : "Ler o prompt"}
          </button>
        </div>
        <p role="status" className="conversion-notice">
          {notice}
        </p>
        <div id={promptId} className="conversion-prompt" hidden={!showPrompt}>
          <label htmlFor={promptId + "-text"}>
            Prompt completo para conversão
          </label>
          <textarea
            ref={promptField}
            id={promptId + "-text"}
            readOnly
            value={prompt}
            rows={12}
            spellCheck={false}
          />
          <p>Você pode selecionar e copiar o texto manualmente.</p>
        </div>
        <p className="conversion-privacy">
          O TioPatinhas não envia a sua planilha a outros serviços. Você decide
          onde fazer a conversão e quais dados compartilhar.
        </p>
      </div>
      <footer className="conversion-footer">
        <button type="button" className="conversion-preview" onClick={onClose}>
          Fechar
        </button>
        {onImport && (
          <button
            type="button"
            className="conversion-import"
            onClick={() => {
              onClose();
              onImport();
            }}
          >
            Já tenho o JSON <ArrowRight size={17} aria-hidden="true" />
          </button>
        )}
      </footer>
    </dialog>
  );
}
