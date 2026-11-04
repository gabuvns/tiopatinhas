import { useState } from "react";
import prompt from "../../../docs/CONVERSION_PROMPT.md?raw";
export default function ImportGuide() {
  const [notice, setNotice] = useState("");
  return (
    <details className="panel import-guide">
      <summary>Trazer dados de uma planilha Excel</summary>
      <h3>Sua planilha, seu histórico</h3>
      <p>
        Use o roteiro abaixo em uma IA de sua escolha junto do XLSX. Revise os
        dados e importe o JSON pelo botão Importar. Você escolhe se compartilha
        sua planilha com outro serviço; o TioPatinhas não envia arquivos nem
        exige chave.
      </p>
      <button
        className="button button-outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(prompt);
            setNotice("Roteiro copiado.");
          } catch {
            setNotice("Selecione e copie o roteiro abaixo.");
          }
        }}
      >
        Copiar roteiro de conversão
      </button>
      <p role="status">{notice}</p>
      <textarea
        readOnly
        value={prompt}
        aria-label="Roteiro para converter XLSX"
        rows={8}
      />
    </details>
  );
}
