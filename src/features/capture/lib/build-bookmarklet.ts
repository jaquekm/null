/**
 * Código `javascript:` do bookmarklet (1.12): abre uma janela pequena de
 * captura com título, URL e seleção da página atual — usa a sessão do
 * navegador, não precisa de token.
 */
export function buildBookmarklet(appUrl: string): string {
  const script =
    "(function(){" +
    "var u=encodeURIComponent(location.href);" +
    "var t=encodeURIComponent(document.title);" +
    "var s=encodeURIComponent(String(window.getSelection()));" +
    `window.open('${appUrl}/capturar?title='+t+'&url='+u+'&text='+s,'hub-capturar','width=480,height=640');` +
    "})();";
  return `javascript:${script}`;
}
