import axe from "axe-core";
export function installAudit() {
  const section = document.createElement("section");
  section.setAttribute("aria-label", "Ferramentas de teste de acessibilidade");
  section.style.padding = "24px";
  section.style.background = "#fff";
  section.style.color = "#172b35";
  const button = document.createElement("button");
  button.textContent = "Executar auditoria de acessibilidade";
  button.style.padding = "12px";
  const result = document.createElement("pre");
  result.id = "accessibility-results";
  result.style.whiteSpace = "pre-wrap";
  button.onclick = async () => {
    result.textContent = "Executando…";
    button.disabled = true;
    try {
      const report = await axe.run(document.querySelector(".app-shell")!, {
        runOnly: {
          type: "rule",
          values: [
            "color-contrast",
            "label",
            "button-name",
            "aria-input-field-name",
            "aria-dialog-name",
            "aria-valid-attr-value",
          ],
        },
      });
      result.textContent = JSON.stringify(
        {
          viewport: {
            width: document.documentElement.clientWidth,
            contentWidth: document.documentElement.scrollWidth,
          },
          smallTouchTargets:
            window.innerWidth <= 680
              ? Array.from(
                  document.querySelectorAll<HTMLElement>(
                    ".app-shell button, .app-shell summary, .app-shell input:not([type=hidden]), .app-shell select, .app-shell a",
                  ),
                )
                  .filter((node) => {
                    if (node.matches(".month-picker-native")) return false; // Same action has a full-size month-picker button.
                    if (
                      !node.getClientRects().length ||
                      node.closest("[inert]")
                    )
                      return false;
                    const rect = (
                      node.closest("label") ?? node
                    ).getBoundingClientRect();
                    return rect.width < 43 || rect.height < 43;
                  })
                  .slice(0, 12)
                  .map((node) => ({
                    label:
                      node.getAttribute("aria-label") ??
                      node.textContent?.trim().slice(0, 60),
                    width: Math.round(node.getBoundingClientRect().width),
                    height: Math.round(node.getBoundingClientRect().height),
                  }))
              : [],
          violations: report.violations.map((violation) => ({
            id: violation.id,
            nodes: violation.nodes.map((node) => ({
              target: node.target,
              summary: node.failureSummary,
            })),
          })),
          incomplete: report.incomplete.length,
        },
        null,
        2,
      );
    } catch (cause) {
      result.textContent = String(cause);
    } finally {
      button.disabled = false;
    }
  };
  section.append(button, result);
  document.body.append(section);
}
